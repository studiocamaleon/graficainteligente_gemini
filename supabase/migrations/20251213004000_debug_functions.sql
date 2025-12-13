
CREATE OR REPLACE FUNCTION public.fn_debug_list_functions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'oid', p.oid,
    'name', p.proname,
    'args', pg_get_function_identity_arguments(p.oid)
  ))
  INTO v_result
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_convertir_presupuesto_a_orden';
  
  RETURN v_result;
END;
$$;
