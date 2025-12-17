-- =====================================================
-- FIX: Update Notification Trigger with CORRECT Project URL
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
  v_config_url text;
BEGIN
  -- 1. Log Entry
  RAISE LOG '[Notify Trigger] Corrected Function FIRED. ID: %, STATUS: %', NEW.id, NEW.estado;

  -- 2. Validate Status
  IF NEW.estado != 'finalizada' THEN
    RETURN NEW;
  END IF;

  -- 3. Determine Type
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
  ELSE
    RETURN NEW;
  END IF;

  -- 4. Check Idempotency (Restored)
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
    RAISE LOG '[Notify Trigger] Notification already sent. Skipping.';
    RETURN NEW;
  END IF;

  -- 5. Configuration Strategy (Production Safety)
  -- Priority 1: Use database config setting (Best for Production)
  v_config_url := current_setting('app.edge_function_url', true);
  
  IF v_config_url IS NOT NULL AND v_config_url != '' THEN
     v_edge_function_url := v_config_url;
     RAISE LOG '[Notify Trigger] Using configured URL: %', v_edge_function_url;
  ELSE
     -- Priority 2: Fallback to the Current Project URL (velbpmbndvovczruzkzg)
     -- PREVIOUS ERROR: Was pointing to sovqpafggvcbzrvbkegi
     v_edge_function_url := 'https://velbpmbndvovczruzkzg.supabase.co/functions/v1/enviar-notificacion-orden';
     RAISE LOG '[Notify Trigger] Using fallback URL: %', v_edge_function_url;
  END IF;

  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

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

    RAISE LOG '[Notify Trigger] HTTP request sent to % (ID: %)', v_edge_function_url, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Notify Trigger] Error sending HTTP request: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
