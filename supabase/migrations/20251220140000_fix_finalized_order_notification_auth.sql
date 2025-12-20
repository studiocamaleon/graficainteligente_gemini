-- =====================================================
-- FIX: Finalized Order Notification Auth and Robustness
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
  v_anon_key text;
  v_tipo_orden text;
  v_request_id bigint;
  v_notification_exists boolean;
  v_config_url text;
BEGIN
  -- 1. Log Entry
  RAISE LOG '[Notify Trigger] Finalized Order Trigger FIRED. ID: %, STATUS: %', NEW.id, NEW.estado;

  -- 2. Validate Status (Only 'finalizada')
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

  -- 4. Check Idempotency (Prevent double notifications)
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
    RAISE LOG '[Notify Trigger] Notification already sent for order %. Skipping.', NEW.id;
    RETURN NEW;
  END IF;

  -- 5. Configuration Strategy
  v_config_url := current_setting('app.edge_function_url', true);
  
  IF v_config_url IS NOT NULL AND v_config_url != '' THEN
     v_edge_function_url := v_config_url;
  ELSE
     -- Fallback a URL de producción velbpmbndvovczruzkzg
     v_edge_function_url := 'https://velbpmbndvovczruzkzg.supabase.co/functions/v1/enviar-notificacion-orden';
  END IF;

  -- 6. Credentials
  -- Usamos el TRIGGER_SECRET_TOKEN compartido para validación interna
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';
  
  -- Usamos la ANON KEY real del proyecto para pasar el Gateway de Supabase sin problemas
  -- Token extraído de fn_convertir_presupuesto_a_orden estable
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbGJwbWJuZHZvdmN6cnV6a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM0MTgsImV4cCI6MjA4MDUyOTQxOH0.NaUzS0Ra1LOvWoVvj1is1c2PmdzcBT5elYDu5WcfSKw';

  -- 7. Send Request
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret,
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'orden_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'tipo', 'orden_finalizada',
        'orden_tipo', v_tipo_orden
      )
    ) INTO v_request_id;

    RAISE LOG '[Notify Trigger] HTTP request sent (ID: %). URL: %', v_request_id, v_edge_function_url;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Notify Trigger] Error sending HTTP request: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
