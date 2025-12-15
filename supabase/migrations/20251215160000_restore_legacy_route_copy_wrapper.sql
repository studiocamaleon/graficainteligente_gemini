-- Migration: Restore legacy route copy function as a wrapper
-- Date: 2025-12-15
-- Description: Creates a wrapper function fn_copiar_ruta_desde_plantilla that calls fn_generar_ruta_produccion_item
-- This fixes the "Restore" button functionality in the frontend without requiring code changes.

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
  -- 1. Obtener la configuración del item
  SELECT configuracion INTO v_configuracion
  FROM ordenes_trabajo_items
  WHERE id = p_orden_item_id;

  -- 2. Obtener el nombre de la categoría del producto
  SELECT c.nombre INTO v_categoria_nombre
  FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
  WHERE p.id = p_producto_id;

  -- 3. Llamar a la nueva función generadora
  -- Nota: fn_generar_ruta_produccion_item devuelve integer (cantidad de pasos)
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

COMMENT ON FUNCTION fn_copiar_ruta_desde_plantilla IS 'Wrapper de compatibilidad: Llama a fn_generar_ruta_produccion_item para restaurar la ruta. Mantiene la firma antigua para compatibilidad con frontend.';
