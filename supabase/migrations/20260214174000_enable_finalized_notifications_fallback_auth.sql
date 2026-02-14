-- Ensure finalized-order notifications can be sent in dev even if app.* DB settings are missing.
-- Keeps app.* settings as priority and falls back to known dev credentials.

CREATE OR REPLACE FUNCTION public.fn_trigger_whatsapp_orden_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_anon_key text;
  v_tipo_orden text;
  v_notification_exists boolean;
  v_config_url text;
  v_cliente_nombre text;
  v_cliente_whatsapp text;
  v_numero_orden text;
  v_tracking_token text;
  v_total numeric;
  v_pagado numeric;
  v_saldo numeric;
  v_saldo_text text;
  v_cliente_id uuid;
BEGIN
  IF NEW.estado != 'finalizada' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
    v_numero_orden := NEW.numero_orden;
    v_tracking_token := NEW.tracking_token;
    v_total := COALESCE(NEW.total, 0);
    v_cliente_id := NEW.cliente_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.ordenes_trabajo_pagos
    WHERE orden_id = NEW.id;
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
    v_numero_orden := NEW.numero_orden;
    v_tracking_token := NEW.tracking_token;
    v_total := COALESCE(NEW.total, 0);
    v_cliente_id := NEW.cliente_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.centro_copiado_ordenes_pagos
    WHERE orden_copiado_id = NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_tipo_orden = 'trabajo' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.whatsapp_notificaciones
      WHERE orden_trabajo_id = NEW.id
        AND tipo_notificacion = 'orden_finalizada'
    ) INTO v_notification_exists;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.whatsapp_notificaciones
      WHERE orden_copiado_id = NEW.id
        AND tipo_notificacion = 'orden_finalizada'
    ) INTO v_notification_exists;
  END IF;

  IF v_notification_exists THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nombre_fantasia, razon_social, 'Cliente'), whatsapp
  INTO v_cliente_nombre, v_cliente_whatsapp
  FROM public.clients
  WHERE id = v_cliente_id;

  IF v_cliente_whatsapp IS NULL OR length(v_cliente_whatsapp) < 5 THEN
    RETURN NEW;
  END IF;

  v_saldo := v_total - COALESCE(v_pagado, 0);
  IF v_saldo <= 0 THEN
    v_saldo_text := 'Saldado';
  ELSE
    v_saldo_text := '$' || to_char(v_saldo, 'FM999,999,990.00');
  END IF;

  v_config_url := current_setting('app.edge_function_url', true);
  IF v_config_url IS NOT NULL AND v_config_url <> '' THEN
    v_edge_function_url := v_config_url;
  ELSE
    v_edge_function_url := 'https://velbpmbndvovczruzkzg.supabase.co/functions/v1/send-wati-message';
  END IF;

  -- Priority: DB settings. Fallback: known dev credentials for this environment.
  v_trigger_secret := COALESCE(
    nullif(current_setting('app.trigger_secret_token', true), ''),
    'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk='
  );
  v_anon_key := COALESCE(
    nullif(current_setting('app.supabase_anon_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbGJwbWJuZHZvdmN6cnV6a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM0MTgsImV4cCI6MjA4MDUyOTQxOH0.NaUzS0Ra1LOvWoVvj1is1c2PmdzcBT5elYDu5WcfSKw'
  );

  BEGIN
    PERFORM net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret,
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'company_id', NEW.company_id::text,
        'phone', v_cliente_whatsapp,
        'template_name', 'orden_finalizada_v2',
        'parameters', jsonb_build_array(
          jsonb_build_object('name', 'nombre_cliente', 'value', v_cliente_nombre),
          jsonb_build_object('name', 'numero_orden', 'value', v_numero_orden),
          jsonb_build_object('name', 'saldo_pendiente', 'value', v_saldo_text),
          jsonb_build_object('name', 'url_tracking', 'value', 'https://www.grafica.ar/track/' || COALESCE(v_tracking_token, '')),
          jsonb_build_object('name', 'nombre_empresa', 'value', 'Gráfica Inteligente'),
          jsonb_build_object('name', '1', 'value', COALESCE(v_tracking_token, ''))
        ),
        'metadata', jsonb_build_object(
          'tipo', 'orden_finalizada',
          'orden_trabajo_id', CASE WHEN v_tipo_orden = 'trabajo' THEN NEW.id ELSE NULL END,
          'orden_copiado_id', CASE WHEN v_tipo_orden = 'copiado' THEN NEW.id ELSE NULL END
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Notify Trigger] Error sending WhatsApp request: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
