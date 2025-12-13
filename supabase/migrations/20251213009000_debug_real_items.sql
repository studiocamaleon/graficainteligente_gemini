
CREATE OR REPLACE FUNCTION public.fn_debug_real_items(limit_count int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'presupuesto_id', t.presupuesto_id,
      'producto_nombre', t.producto_nombre,
      'descripcion', t.descripcion,
      'created_at', t.created_at
    )
  )
  INTO v_result
  FROM (
    SELECT id, presupuesto_id, producto_nombre, descripcion, created_at
    FROM presupuestos_items
    ORDER BY created_at DESC
    LIMIT limit_count
  ) t;
  
  RETURN v_result;
END;
$$;
