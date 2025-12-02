/*
  # Agregar notificación WhatsApp al crear nueva orden

  ## Problema
  Cuando se crea una orden de trabajo (INSERT), no se envía notificación WhatsApp
  al cliente. Solo se notifica cuando la orden se finaliza.

  ## Solución
  Crear trigger AFTER INSERT que envíe notificación WhatsApp informando que
  se registró una nueva orden.

  ## Cambios
  1. Crear función fn_trigger_whatsapp_nueva_orden
  2. Crear trigger AFTER INSERT en ordenes_trabajo
  3. Crear trigger AFTER INSERT en centro_copiado_ordenes
*/

-- =====================================================
-- 1. FUNCIÓN: DISPARAR NOTIFICACIÓN DE NUEVA ORDEN
-- =====================================================

CREATE OR REPLACE FUNCTION fn_trigger_whatsapp_nueva_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_tipo_orden text;
  v_request_id bigint;
BEGIN
  -- Determinar tipo de orden
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
  ELSE
    RETURN NEW;
  END IF;

  -- Obtener configuración de Evolution
  SELECT edge_function_url, trigger_secret
  INTO v_edge_function_url, v_trigger_secret
  FROM evolution_integrations
  WHERE company_id = NEW.company_id
  AND estado_conexion = 'conectado'
  LIMIT 1;

  -- Si no hay integración, salir
  IF v_edge_function_url IS NULL THEN
    RETURN NEW;
  END IF;

  -- Log del intento
  RAISE LOG '[Nueva Orden] Orden creada: % (company: %, tipo: %)',
    NEW.id, NEW.company_id, v_tipo_orden;

  -- Hacer petición HTTP asíncrona
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', COALESCE(v_trigger_secret, '')
      ),
      body := jsonb_build_object(
        'orden_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'tipo_orden', v_tipo_orden,
        'tipo_notificacion', 'nueva_orden_trabajo'
      )
    ) INTO v_request_id;

    RAISE LOG '[Nueva Orden] HTTP request enviado con ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    -- No fallar si hay error
    RAISE WARNING '[Nueva Orden] Error enviando notificación: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. TRIGGER PARA ÓRDENES DE TRABAJO
-- =====================================================

DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON ordenes_trabajo;

CREATE TRIGGER trigger_notify_nueva_orden
AFTER INSERT ON ordenes_trabajo
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();

-- =====================================================
-- 3. TRIGGER PARA ÓRDENES DE COPIADO
-- =====================================================

DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;

CREATE TRIGGER trigger_notify_nueva_orden_copiado
AFTER INSERT ON centro_copiado_ordenes
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_trigger_whatsapp_nueva_orden() IS
'Dispara notificación de WhatsApp cuando se crea una nueva orden.
Llama a Edge Function de forma asíncrona.';

COMMENT ON TRIGGER trigger_notify_nueva_orden ON ordenes_trabajo IS
'Envía notificación de WhatsApp cuando se crea una orden de trabajo';

COMMENT ON TRIGGER trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes IS
'Envía notificación de WhatsApp cuando se crea una orden de copiado';
