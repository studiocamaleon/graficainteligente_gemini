-- Debug function to inspect latest budget items
CREATE OR REPLACE FUNCTION public.fn_debug_last_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(t) 
  INTO v_result
  FROM (
    SELECT 
      id, 
      created_at, 
      producto_nombre, 
      descripcion, 
      tipo_item,
      configuracion,
      producto_id
    FROM presupuestos_items 
    ORDER BY created_at DESC 
    LIMIT 5
  ) t;
  
  RETURN v_result;
END;
$$;
