/*
  # Función para validar si un presupuesto tiene items sin precio
  
  1. Función
    - fn_presupuesto_tiene_items_sin_precio(uuid): Verifica si un presupuesto tiene items pendientes de cotización
  
  2. Uso
    - Validar antes de cambiar estados
    - Validar antes de convertir a orden
    - Mostrar advertencias en UI
  
  3. Performance
    - Usa índice idx_presupuestos_items_sin_precio para búsqueda rápida
    - STABLE para permitir uso en queries complejas
    - SECURITY DEFINER para bypass de RLS en validaciones internas
*/

-- ============================================================================
-- Función: Verifica si un presupuesto tiene items sin precio
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_presupuesto_tiene_items_sin_precio(p_presupuesto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_items_sin_precio integer;
BEGIN
  -- Contar items sin precio usando el índice
  SELECT COUNT(*)
  INTO v_items_sin_precio
  FROM presupuestos_items
  WHERE presupuesto_id = p_presupuesto_id
    AND (precio_unitario_final IS NULL OR precio_total IS NULL);
  
  RETURN v_items_sin_precio > 0;
END;
$$;

-- ============================================================================
-- Función: Obtener cantidad de items sin precio
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_contar_items_sin_precio(p_presupuesto_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_items_sin_precio integer;
BEGIN
  SELECT COUNT(*)
  INTO v_items_sin_precio
  FROM presupuestos_items
  WHERE presupuesto_id = p_presupuesto_id
    AND (precio_unitario_final IS NULL OR precio_total IS NULL);
  
  RETURN COALESCE(v_items_sin_precio, 0);
END;
$$;

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON FUNCTION fn_presupuesto_tiene_items_sin_precio IS 
  'Retorna true si el presupuesto tiene al menos un item sin precio asignado (pendiente de cotización)';

COMMENT ON FUNCTION fn_contar_items_sin_precio IS 
  'Retorna la cantidad de items sin precio en un presupuesto';
