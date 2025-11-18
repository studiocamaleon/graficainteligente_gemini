/*
  # Corregir Validación de Anchos Disponibles para Productos Metro Lineal

  ## Descripción
  Los productos de gran formato con tipo_venta 'mt_lineal' deben tener exactamente
  un ancho disponible, no múltiples. Esta migración corrige la constraint para
  asegurar que solo se permita un único ancho.

  ## Cambios

  1. Migración de Datos Existentes
    - Productos con múltiples anchos: se conserva solo el primer ancho
    - Se documenta qué productos fueron afectados

  2. Actualización de Constraint
    - Se elimina la constraint existente check_anchos_disponibles_valid
    - Se crea nueva constraint que valida:
      * tipo_venta = 'mt2' → anchos_disponibles debe estar vacío
      * tipo_venta = 'mt_lineal' → anchos_disponibles debe tener exactamente 1 elemento

  ## Seguridad
  - No afecta RLS ni permisos existentes
  - Solo modifica validación de integridad de datos
*/

-- =====================================================
-- 1. MIGRACIÓN DE DATOS EXISTENTES
-- =====================================================

-- Primero, verificar y registrar productos con múltiples anchos
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Contar productos afectados
  SELECT COUNT(*) INTO affected_count
  FROM productos_gran_formato
  WHERE tipo_venta = 'mt_lineal'
    AND array_length(anchos_disponibles, 1) > 1;

  IF affected_count > 0 THEN
    RAISE NOTICE 'Se encontraron % productos con múltiples anchos. Se conservará solo el primer ancho.', affected_count;
  ELSE
    RAISE NOTICE 'No se encontraron productos con múltiples anchos. No se requiere migración de datos.';
  END IF;
END $$;

-- Migrar datos: conservar solo el primer ancho para productos mt_lineal con múltiples anchos
UPDATE productos_gran_formato
SET anchos_disponibles = ARRAY[anchos_disponibles[1]]
WHERE tipo_venta = 'mt_lineal'
  AND array_length(anchos_disponibles, 1) > 1;

-- =====================================================
-- 2. ACTUALIZAR CONSTRAINT
-- =====================================================

-- Eliminar constraint antigua
ALTER TABLE productos_gran_formato
DROP CONSTRAINT IF EXISTS check_anchos_disponibles_valid;

-- Crear nueva constraint que valida un único ancho para mt_lineal
ALTER TABLE productos_gran_formato
ADD CONSTRAINT check_anchos_disponibles_valid CHECK (
  (tipo_venta = 'mt2' AND anchos_disponibles = ARRAY[]::integer[]) OR
  (tipo_venta = 'mt_lineal' AND array_length(anchos_disponibles, 1) = 1)
);

-- =====================================================
-- 3. ACTUALIZAR COMENTARIOS
-- =====================================================

COMMENT ON COLUMN productos_gran_formato.anchos_disponibles IS
  'Ancho disponible en cm (solo para tipo_venta mt_lineal). Debe contener exactamente un valor. Valores típicos: 30, 60, 120, 160';

-- =====================================================
-- 4. VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que todos los productos cumplan con la nueva constraint
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM productos_gran_formato
  WHERE (
    (tipo_venta = 'mt_lineal' AND array_length(anchos_disponibles, 1) != 1) OR
    (tipo_venta = 'mt2' AND array_length(anchos_disponibles, 1) != 0)
  );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Error: % productos no cumplen con la nueva constraint', invalid_count;
  ELSE
    RAISE NOTICE 'Verificación exitosa: todos los productos cumplen con la nueva constraint';
  END IF;
END $$;
