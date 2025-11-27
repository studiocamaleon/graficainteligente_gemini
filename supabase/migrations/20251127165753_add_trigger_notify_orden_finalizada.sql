/*
  # Trigger para Notificación Automática de Orden Finalizada

  ## Descripción
  Extiende el sistema de actualización de estado de órdenes para que dispare automáticamente
  una notificación de WhatsApp cuando una orden cambia a estado "finalizada".

  ## Cambios Realizados

  ### 1. Habilitar extensión pg_net
  - Permite hacer peticiones HTTP desde triggers de PostgreSQL
  - Necesaria para llamar a la Edge Function

  ### 2. Función fn_trigger_whatsapp_orden_finalizada()
  - Se ejecuta DESPUÉS de que fn_actualizar_estado_orden() cambie el estado
  - Detecta cambio de estado a "finalizada"
  - Hace POST HTTP a Edge Function de Supabase
  - Envía: orden_id, company_id, tipo_orden
  - NO bloquea la transacción si falla el envío

  ### 3. Trigger trigger_notify_orden_finalizada
  - Se dispara DESPUÉS de UPDATE en tabla ordenes_trabajo
  - Condición: estado cambió a "finalizada"
  - Llama a la función de notificación

  ### 4. Trigger trigger_notify_orden_copiado_finalizada
  - Similar al anterior pero para centro_copiado_ordenes
  - Maneja órdenes de copiado finalizadas

  ## Seguridad
  - Usa TRIGGER_SECRET_TOKEN para autenticar la petición
  - La Edge Function valida el token antes de procesar
  - Función con SECURITY DEFINER para bypass de RLS
  - Los errores de envío no afectan la actualización de estado

  ## Flujo Completo
  1. Usuario completa último paso de producción
  2. Trigger actualiza estado de item a "finalizado"
  3. Trigger actualiza estado de orden a "finalizada"
  4. Este trigger detecta el cambio y llama a Edge Function
  5. Edge Function envía notificación de WhatsApp
  6. Se registra resultado en tabla whatsapp_notificaciones

  ## Notas
  - La notificación es asíncrona y no bloquea la transacción
  - Si falla el envío, el estado de la orden NO se revierte
  - Todos los errores quedan registrados en logs de Supabase
  - La Edge Function verifica duplicados antes de enviar
*/

-- =====================================================
-- 1. HABILITAR EXTENSIÓN pg_net PARA HTTP REQUESTS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =====================================================
-- 2. FUNCIÓN: DISPARAR NOTIFICACIÓN DE ORDEN FINALIZADA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_trigger_whatsapp_orden_finalizada()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_tipo_orden text;
  v_request_id bigint;
BEGIN
  -- Solo procesar si el estado cambió a "finalizada"
  IF NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN

    -- Determinar tipo de orden basándose en la tabla
    IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
      v_tipo_orden := 'trabajo';
    ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
      v_tipo_orden := 'copiado';
    ELSE
      -- Tabla no reconocida, salir
      RETURN NEW;
    END IF;

    -- Obtener URL de la Edge Function desde variables de entorno
    -- NOTA: Esta URL debe configurarse en el deployment de Supabase
    v_edge_function_url := current_setting('app.edge_function_url', true);
    v_trigger_secret := current_setting('app.trigger_secret_token', true);

    -- Si no están configuradas, usar valores por defecto (cambiar en producción)
    IF v_edge_function_url IS NULL OR v_edge_function_url = '' THEN
      v_edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-orden-finalizada';
    END IF;

    IF v_trigger_secret IS NULL OR v_trigger_secret = '' THEN
      v_trigger_secret := 'change-this-secret-token';
    END IF;

    -- Log del intento
    RAISE LOG '[Notify Trigger] Orden finalizada detectada: % (company: %, tipo: %)',
      NEW.id, NEW.company_id, v_tipo_orden;

    -- Hacer petición HTTP asíncrona a la Edge Function
    -- Usamos pg_net para no bloquear la transacción
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'orden_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_orden', v_tipo_orden
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Trigger] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Trigger] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TRIGGER PARA ÓRDENES DE TRABAJO
-- =====================================================

DROP TRIGGER IF EXISTS trigger_notify_orden_finalizada ON ordenes_trabajo;

CREATE TRIGGER trigger_notify_orden_finalizada
AFTER UPDATE OF estado ON ordenes_trabajo
FOR EACH ROW
WHEN (NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada'))
EXECUTE FUNCTION fn_trigger_whatsapp_orden_finalizada();

-- =====================================================
-- 4. TRIGGER PARA ÓRDENES DE COPIADO
-- =====================================================

DROP TRIGGER IF EXISTS trigger_notify_orden_copiado_finalizada ON centro_copiado_ordenes;

CREATE TRIGGER trigger_notify_orden_copiado_finalizada
AFTER UPDATE OF estado ON centro_copiado_ordenes
FOR EACH ROW
WHEN (NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada'))
EXECUTE FUNCTION fn_trigger_whatsapp_orden_finalizada();

-- =====================================================
-- 5. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_trigger_whatsapp_orden_finalizada() IS
'Dispara notificación de WhatsApp cuando una orden cambia a estado finalizada. Llama a Edge Function de forma asíncrona.';

COMMENT ON TRIGGER trigger_notify_orden_finalizada ON ordenes_trabajo IS
'Envía notificación de WhatsApp cuando orden de trabajo se finaliza';

COMMENT ON TRIGGER trigger_notify_orden_copiado_finalizada ON centro_copiado_ordenes IS
'Envía notificación de WhatsApp cuando orden de copiado se finaliza';

-- =====================================================
-- 6. CONFIGURACIÓN (Ejecutar manualmente después del deploy)
-- =====================================================

/*
Para configurar las variables en Supabase, ejecutar:

-- Opción 1: Configuración por base de datos (recomendado)
ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-orden-finalizada';
ALTER DATABASE postgres SET app.trigger_secret_token = 'YOUR_SECURE_SECRET_TOKEN';

-- Opción 2: Configuración por sesión (solo para testing)
SET app.edge_function_url = 'http://localhost:54321/functions/v1/notify-orden-finalizada';
SET app.trigger_secret_token = 'test-secret-token';

-- Ver configuración actual
SHOW app.edge_function_url;
SHOW app.trigger_secret_token;
*/
