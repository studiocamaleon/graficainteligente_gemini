/*
  # Corregir Función de Dependencias de Categorías para Múltiples Categorías

  ## Descripción
  Esta migración actualiza la función `check_categoria_has_dependencies` para que funcione
  correctamente con el nuevo esquema de múltiples categorías, que usa tablas relacionales
  en lugar de columnas directas categoria_id.

  ## Problema Resuelto
  La función anterior intentaba buscar en las columnas `categoria_id` de las tablas
  `servicios` y `acabados`, pero estas columnas fueron eliminadas en la migración
  20251107015938_add_multiple_categories_to_servicios_acabados.sql

  ## Cambios Realizados

  ### 1. Actualización de check_categoria_has_dependencies
  - Reemplaza las consultas directas a categoria_id
  - Usa JOINs con las tablas relacionales servicios_categorias y acabados_categorias
  - Mantiene la misma interfaz de retorno para compatibilidad con el frontend

  ### 2. Limpieza de Índices Obsoletos
  - Elimina índices que referenciaban las columnas categoria_id eliminadas
  - Los nuevos índices ya existen en las tablas relacionales

  ## Seguridad
  La función mantiene SECURITY DEFINER para operar con privilegios elevados
  pero solo ejecuta validaciones de lectura, no modifica datos.
*/

-- =====================================================
-- 1. ACTUALIZAR FUNCIÓN: Verificar dependencias de Categoría
-- =====================================================

CREATE OR REPLACE FUNCTION check_categoria_has_dependencies(categoria_id_param uuid)
RETURNS TABLE(has_dependencies boolean, dependency_count integer, dependency_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  servicios_count integer;
  acabados_count integer;
  total_count integer;
  details jsonb;
BEGIN
  -- Contar servicios activos que tienen esta categoría
  -- Usa la tabla relacional servicios_categorias
  SELECT COUNT(DISTINCT s.id) INTO servicios_count
  FROM servicios s
  INNER JOIN servicios_categorias sc ON sc.servicio_id = s.id
  WHERE sc.categoria_id = categoria_id_param AND s.is_active = true;

  -- Contar acabados activos que tienen esta categoría
  -- Usa la tabla relacional acabados_categorias
  SELECT COUNT(DISTINCT a.id) INTO acabados_count
  FROM acabados a
  INNER JOIN acabados_categorias ac ON ac.acabado_id = a.id
  WHERE ac.categoria_id = categoria_id_param AND a.is_active = true;

  total_count := servicios_count + acabados_count;

  details := jsonb_build_object(
    'servicios', servicios_count,
    'acabados', acabados_count,
    'total', total_count
  );

  RETURN QUERY SELECT 
    (total_count > 0) as has_dependencies,
    total_count as dependency_count,
    details as dependency_details;
END;
$$;

-- =====================================================
-- 2. ELIMINAR ÍNDICES OBSOLETOS
-- =====================================================

-- Estos índices referencian columnas que ya no existen
DROP INDEX IF EXISTS idx_servicios_categoria_id_active;
DROP INDEX IF EXISTS idx_acabados_categoria_id_active;

-- =====================================================
-- 3. COMENTARIOS ACTUALIZADOS
-- =====================================================

COMMENT ON FUNCTION check_categoria_has_dependencies(uuid) IS 
  'Verifica si una categoría tiene servicios o acabados activos asociados. Actualizado para trabajar con el esquema de múltiples categorías usando tablas relacionales servicios_categorias y acabados_categorias.';

-- =====================================================
-- 4. VERIFICACIÓN DE ÍNDICES EN TABLAS RELACIONALES
-- =====================================================

-- Asegurar que existen los índices necesarios en las tablas relacionales
-- (estos ya deberían existir de la migración anterior, pero los verificamos)
CREATE INDEX IF NOT EXISTS idx_servicios_categorias_categoria_id ON servicios_categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_acabados_categorias_categoria_id ON acabados_categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categorias_servicio_id ON servicios_categorias(servicio_id);
CREATE INDEX IF NOT EXISTS idx_acabados_categorias_acabado_id ON acabados_categorias(acabado_id);
