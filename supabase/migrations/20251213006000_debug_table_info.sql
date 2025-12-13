
CREATE OR REPLACE FUNCTION public.fn_debug_table_info(p_table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable
  ))
  INTO v_result
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name;
  
  RETURN v_result;
END;
$$;
