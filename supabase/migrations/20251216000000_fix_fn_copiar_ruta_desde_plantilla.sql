CREATE OR REPLACE FUNCTION fn_copiar_ruta_desde_plantilla(
  p_orden_item_id uuid,
  p_producto_id uuid,
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_categoria_nombre text;
  v_configuracion jsonb;
  v_count integer;
BEGIN
  -- 1. Obtener la configuración y la categoría del item directamente de la tabla de items
  --    Evitamos hacer JOIN con 'productos' porque esa tabla no existe como tal (es una abstracción)
  SELECT 
    configuracion,
    producto_categoria
  INTO 
    v_configuracion,
    v_categoria_nombre
  FROM ordenes_trabajo_items
  WHERE id = p_orden_item_id;

  -- 2. Llamar a la función generadora con los datos obtenidos
  v_count := fn_generar_ruta_produccion_item(
    p_orden_item_id,
    p_producto_id,
    COALESCE(v_categoria_nombre, ''), -- Safety check
    COALESCE(v_configuracion, '{}'::jsonb), -- Safety check
    p_company_id
  );

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_copiar_ruta_desde_plantilla IS 'Wrapper corregido: Obtiene categoría de ordenes_trabajo_items y llama a fn_generar_ruta_produccion_item.';
