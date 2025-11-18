/*
  # Corregir Schema de Materiales Rígidos para Soportar Múltiples Variantes y Espesores

  ## Descripción
  Esta migración actualiza el esquema de productos de materiales rígidos para soportar
  correctamente múltiples combinaciones de variante y espesor por producto, donde cada
  combinación puede tener su propio precio configurable.

  ## Cambios en productos_materiales_rigidos_materiales

  1. Agregar columna `espesor` (decimal, singular) para almacenar un espesor individual
  2. Eliminar constraint `unique_producto_mr_material` que impedía múltiples registros
  3. Crear nuevo constraint `unique_producto_mr_material_variante_espesor` para prevenir duplicados exactos
  4. Mantener columna `espesores` (array) por compatibilidad legacy

  ## Cambios en productos_materiales_rigidos_precios

  1. Agregar columna `espesor` (decimal, singular) para identificar precios por espesor específico
  2. Modificar constraint `unique_precio_por_producto_mr` para incluir variante y espesor
  3. Actualizar índices para optimizar búsquedas por combinación completa

  ## Estructura Final

  Cada combinación de (producto + material + variante + espesor) será un registro independiente
  en `productos_materiales_rigidos_materiales`, y cada uno podrá tener su propio precio en
  `productos_materiales_rigidos_precios`.

  ## Notas

  - El campo `espesores` (array) se mantiene por compatibilidad pero está deprecated
  - El sistema usará principalmente el campo `espesor` (singular) para operaciones
  - Los precios se vinculan por la combinación completa de campos únicos
*/

-- =====================================================
-- 1. ACTUALIZAR productos_materiales_rigidos_materiales
-- =====================================================

-- Agregar columna espesor (singular) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_materiales_rigidos_materiales'
    AND column_name = 'espesor'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    ADD COLUMN espesor decimal(10,2);

    COMMENT ON COLUMN productos_materiales_rigidos_materiales.espesor IS
      'Espesor individual en mm para esta combinación de material y variante';
  END IF;
END $$;

-- Actualizar registros existentes que tengan datos en espesores array pero no en espesor
UPDATE productos_materiales_rigidos_materiales
SET espesor = espesores[1]
WHERE espesor IS NULL AND espesores IS NOT NULL AND array_length(espesores, 1) > 0;

-- Hacer la columna espesor NOT NULL después de migrar datos
ALTER TABLE productos_materiales_rigidos_materiales
ALTER COLUMN espesor SET NOT NULL;

-- Agregar constraint para validar que espesor sea positivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_pmr_materiales_espesor_positivo'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    ADD CONSTRAINT check_pmr_materiales_espesor_positivo CHECK (espesor > 0);
  END IF;
END $$;

-- Eliminar constraint de unicidad antiguo si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_producto_mr_material'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    DROP CONSTRAINT unique_producto_mr_material;
  END IF;
END $$;

-- Crear nuevo constraint de unicidad que incluya variante y espesor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_producto_mr_material_variante_espesor'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    ADD CONSTRAINT unique_producto_mr_material_variante_espesor
    UNIQUE (producto_materiales_rigidos_id, material_id, variante_nombre, espesor);
  END IF;
END $$;

-- Crear índice optimizado para búsquedas por combinación completa
CREATE INDEX IF NOT EXISTS idx_pmr_materiales_combinacion_completa
ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id, material_id, variante_nombre, espesor);

-- Actualizar comentario de tabla
COMMENT ON TABLE productos_materiales_rigidos_materiales IS
  'Relación entre productos de materiales rígidos y materiales. Cada registro representa una combinación única de variante y espesor.';

COMMENT ON COLUMN productos_materiales_rigidos_materiales.espesores IS
  'DEPRECATED: Array de espesores. Usar columna espesor (singular) en su lugar. Se mantiene por compatibilidad.';

-- =====================================================
-- 2. ACTUALIZAR productos_materiales_rigidos_precios
-- =====================================================

-- Agregar columna espesor (singular) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_materiales_rigidos_precios'
    AND column_name = 'espesor'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    ADD COLUMN espesor decimal(10,2);

    COMMENT ON COLUMN productos_materiales_rigidos_precios.espesor IS
      'Espesor específico en mm para este precio';
  END IF;
END $$;

-- Migrar datos existentes de espesores array a espesor singular
UPDATE productos_materiales_rigidos_precios
SET espesor = espesores[1]
WHERE espesor IS NULL AND espesores IS NOT NULL AND array_length(espesores, 1) > 0;

-- Hacer la columna espesor NOT NULL después de migrar datos
DO $$
BEGIN
  -- Solo hacer NOT NULL si hay datos y todos tienen valores
  IF EXISTS (SELECT 1 FROM productos_materiales_rigidos_precios WHERE espesor IS NULL) THEN
    RAISE NOTICE 'Hay registros sin espesor, no se puede hacer NOT NULL todavía';
  ELSE
    ALTER TABLE productos_materiales_rigidos_precios
    ALTER COLUMN espesor SET NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo hacer espesor NOT NULL: %', SQLERRM;
END $$;

-- Agregar constraint para validar que espesor sea positivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_pmr_precios_espesor_positivo'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    ADD CONSTRAINT check_pmr_precios_espesor_positivo CHECK (espesor > 0);
  END IF;
END $$;

-- Eliminar constraint de unicidad antiguo si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_por_producto_mr'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    DROP CONSTRAINT unique_precio_por_producto_mr;
  END IF;
END $$;

-- Crear nuevo constraint de unicidad que incluya material, variante y espesor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_por_combinacion_mr'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    ADD CONSTRAINT unique_precio_por_combinacion_mr
    UNIQUE (company_id, producto_materiales_rigidos_id, material_id, variante_nombre, espesor);
  END IF;
END $$;

-- Crear índice optimizado para búsquedas por combinación completa
CREATE INDEX IF NOT EXISTS idx_pmr_precios_combinacion_completa
ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id, material_id, variante_nombre, espesor);

-- Actualizar comentario de tabla
COMMENT ON TABLE productos_materiales_rigidos_precios IS
  'Precios de productos de materiales rígidos. Cada registro representa el precio para una combinación específica de producto, material, variante y espesor.';

COMMENT ON COLUMN productos_materiales_rigidos_precios.espesores IS
  'DEPRECATED: Array de espesores. Usar columna espesor (singular) en su lugar. Se mantiene por compatibilidad.';

-- =====================================================
-- 3. CREAR FUNCIÓN HELPER PARA VALIDACIÓN
-- =====================================================

-- Función para validar que existe la combinación en materiales antes de crear precio
CREATE OR REPLACE FUNCTION validate_precio_mr_combination()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que existe una entrada en productos_materiales_rigidos_materiales
  -- con la misma combinación de producto, material, variante y espesor
  IF NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales
    WHERE producto_materiales_rigidos_id = NEW.producto_materiales_rigidos_id
    AND material_id = NEW.material_id
    AND variante_nombre = NEW.variante_nombre
    AND espesor = NEW.espesor
  ) THEN
    RAISE EXCEPTION 'No existe una combinación de material-variante-espesor válida para este precio. Producto: %, Material: %, Variante: %, Espesor: %mm',
      NEW.producto_materiales_rigidos_id, NEW.material_id, NEW.variante_nombre, NEW.espesor;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validación
DROP TRIGGER IF EXISTS validate_precio_mr_combination_trigger ON productos_materiales_rigidos_precios;
CREATE TRIGGER validate_precio_mr_combination_trigger
  BEFORE INSERT OR UPDATE ON productos_materiales_rigidos_precios
  FOR EACH ROW
  EXECUTE FUNCTION validate_precio_mr_combination();

COMMENT ON FUNCTION validate_precio_mr_combination IS
  'Valida que existe una combinación válida de material-variante-espesor antes de crear/actualizar un precio';
