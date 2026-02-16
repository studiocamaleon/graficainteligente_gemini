-- Programa el procesador de atributos Wati en Supabase (pg_cron) cada 2 minutos.
-- Reemplaza la dependencia de GitHub Actions para tener menor latencia y mayor consistencia.

CREATE OR REPLACE FUNCTION public.fn_cron_process_wati_contact_attributes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'private'
AS $$
DECLARE
  v_edge_url text;
  v_supabase_url text;
  v_trigger_secret text;
BEGIN
  SELECT
    nullif(edge_function_url, ''),
    nullif(supabase_url, ''),
    nullif(trigger_secret_token, '')
  INTO
    v_edge_url,
    v_supabase_url,
    v_trigger_secret
  FROM private.runtime_config
  WHERE id = true
  LIMIT 1;

  v_edge_url := COALESCE(
    v_edge_url,
    CASE
      WHEN v_supabase_url IS NOT NULL THEN rtrim(v_supabase_url, '/') || '/functions/v1/process-wati-contact-attributes'
      ELSE null
    END
  );

  IF v_edge_url IS NULL OR v_trigger_secret IS NULL THEN
    RAISE WARNING '[Wati Attr Cron] Missing edge_function_url/supabase_url or trigger_secret_token. Skipping run.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Trigger-Secret', v_trigger_secret
    ),
    body := jsonb_build_object('limit', 200)
  );
END;
$$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  -- Intentar habilitar pg_cron si no está disponible.
  IF to_regclass('cron.job') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[Wati Attr Cron] Could not enable pg_cron: %', SQLERRM;
    END;
  END IF;

  IF to_regclass('cron.job') IS NULL THEN
    RAISE WARNING '[Wati Attr Cron] cron.job is unavailable. Skipping schedule creation.';
    RETURN;
  END IF;

  -- Eliminar job previo con este nombre para mantener idempotencia.
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'wati_attributes_processor_every_2min'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Cada 2 minutos.
  PERFORM cron.schedule(
    'wati_attributes_processor_every_2min',
    '*/2 * * * *',
    $job$SELECT public.fn_cron_process_wati_contact_attributes();$job$
  );
END $$;
