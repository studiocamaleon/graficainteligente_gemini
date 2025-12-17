-- =====================================================
-- FIX: Trigger para Notificación de Orden Finalizada con Credenciales Correctas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_trigger_whatsapp_orden_finalizada()
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
  v_notification_exists boolean;
BEGIN
  -- Solo procesar si el estado cambió a "finalizada"
  -- (Aunque el trigger tiene WHEN, doble check aquí no daña)
  IF NEW.estado != 'finalizada' THEN
    RETURN NEW;
  END IF;

  -- Determinar tipo de orden y tabla
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
  ELSE
    RETURN NEW;
  END IF;

  -- IDEMPOTENCIA: Verificar si ya se envió notificación de finalización para esta orden
  IF v_tipo_orden = 'trabajo' THEN
      SELECT EXISTS (
        SELECT 1 FROM whatsapp_notificaciones 
        WHERE orden_trabajo_id = NEW.id 
        AND tipo_notificacion = 'orden_finalizada'
      ) INTO v_notification_exists;
  ELSE
      SELECT EXISTS (
        SELECT 1 FROM whatsapp_notificaciones 
        WHERE orden_copiado_id = NEW.id 
        AND tipo_notificacion = 'orden_finalizada'
      ) INTO v_notification_exists;
  END IF;

  IF v_notification_exists THEN
    RAISE LOG '[Orden Finalizada] Notificación ya enviada previamente para % ID %', v_tipo_orden, NEW.id;
    RETURN NEW;
  END IF;

  -- Valores hardcodeados (Mismos que nueva_orden)
  v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';
  -- Usamos el mismo token que funcionó para nueva_orden
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

  -- Log del intento
  RAISE LOG '[Orden Finalizada] Detectada orden finalizada: % (company: %, tipo: %)',
    NEW.id, NEW.company_id, v_tipo_orden;

  -- Hacer petición HTTP asíncrona
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret,
        'Authorization', 'Bearer ' || v_trigger_secret
      ),
      body := jsonb_build_object(
        'orden_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'tipo', 'orden_finalizada',
        'orden_tipo', v_tipo_orden
      )
    ) INTO v_request_id;

    RAISE LOG '[Orden Finalizada] HTTP request enviado con ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Orden Finalizada] Error enviando notificación HTTP: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Aseguramos que los triggers estén apuntando a esta función (ya creados anteriormente, pero por seguridad)

-- Trigger para Ordenes de Trabajo
DROP TRIGGER IF EXISTS trigger_notify_orden_finalizada ON ordenes_trabajo;
CREATE TRIGGER trigger_notify_orden_finalizada
AFTER UPDATE OF estado ON ordenes_trabajo
FOR EACH ROW
WHEN (NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada'))
EXECUTE FUNCTION fn_trigger_whatsapp_orden_finalizada();

-- Trigger para Ordenes de Copiado
DROP TRIGGER IF EXISTS trigger_notify_orden_copiado_finalizada ON centro_copiado_ordenes;
CREATE TRIGGER trigger_notify_orden_copiado_finalizada
AFTER UPDATE OF estado ON centro_copiado_ordenes
FOR EACH ROW
WHEN (NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada'))
EXECUTE FUNCTION fn_trigger_whatsapp_orden_finalizada();
