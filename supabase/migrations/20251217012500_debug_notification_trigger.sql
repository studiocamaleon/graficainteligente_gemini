-- =====================================================
-- DEBUG: Verbose Logging for Notification Trigger
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
  -- 1. Log Entry
  RAISE LOG '[DEBUG TRIGGER] fn_trigger_whatsapp_orden_finalizada FIRED. ID: %, TABLE: %, STATUS: % -> %', 
    NEW.id, TG_TABLE_NAME, OLD.estado, NEW.estado;

  -- 2. Validate Status Check (Redundant but logging it)
  IF NEW.estado != 'finalizada' THEN
    RAISE LOG '[DEBUG TRIGGER] Aborting: Estado is not finalizada. (Is: %)', NEW.estado;
    RETURN NEW;
  END IF;

  -- 3. Determine Type
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
  ELSE
    RAISE LOG '[DEBUG TRIGGER] Aborting: Unknown table %', TG_TABLE_NAME;
    RETURN NEW;
  END IF;

  -- 4. Check Idempotency
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
    RAISE LOG '[DEBUG TRIGGER] Aborting: Notification already sent for this order.';
    -- Removing RETURN to FORCE send for debugging if needed, but keeping for now to see logs
    -- RETURN NEW; 
  END IF;

  -- 5. Prepare Request
  v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

  RAISE LOG '[DEBUG TRIGGER] Preparing HTTP POST to %', v_edge_function_url;

  -- 6. Send Request
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

    RAISE LOG '[DEBUG TRIGGER] HTTP request SENT. Request ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[DEBUG TRIGGER] ERROR sending HTTP request: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Refresh Triggers to ensure they capture the print
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
