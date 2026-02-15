-- Switch Wati finalized-order template from orden_finalizada_v2 to orden_finalizada_v3.
-- This updates the DB trigger function without hardcoding the whole function body.

DO $$
DECLARE
  v_def text;
BEGIN
  BEGIN
    SELECT pg_get_functiondef('public.fn_trigger_whatsapp_orden_finalizada()'::regprocedure)
    INTO v_def;
  EXCEPTION WHEN undefined_function THEN
    v_def := NULL;
  END;

  IF v_def IS NOT NULL AND position('orden_finalizada_v2' IN v_def) > 0 THEN
    v_def := replace(v_def, 'orden_finalizada_v2', 'orden_finalizada_v3');
    EXECUTE v_def;
  END IF;
END;
$$;

