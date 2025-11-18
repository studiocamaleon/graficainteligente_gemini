/*
  # Corregir Estructura de productos_materiales_rigidos
  
  ## Descripción
  Esta migración corrige la estructura de productos_materiales_rigidos eliminando
  los campos de medidas (medidas_ancho, medidas_alto) que no deben estar en la
  configuración del producto. Los materiales rígidos se venden por m² y las medidas
  finales se definen al momento de crear la orden de trabajo.
  
  ## Cambios Realizados
  
  ### 1. Eliminación de Campos Obsoletos
  - Se eliminan `medidas_ancho` y `medidas_alto`
  - Las medidas finales del trabajo se definen en la orden, no en el producto
  
  ### 2. Nuevo Campo tipo_venta
  - `tipo_venta` (text, required): Siempre 'mt2' para materiales rígidos
  - Se mantiene por consistencia con productos_gran_formato
  
  ### 3. Actualización de Constraints
  - Se eliminan constraints relacionados con medidas_ancho y medidas_alto
  - Se agrega constraint de validación para tipo_venta
  
  ## Migración de Datos
  - Los productos existentes se configuran como 'mt2' (único valor válido)
*/

-- =====================================================
-- 1. AGREGAR NUEVO CAMPO tipo_venta
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_materiales_rigidos' AND column_name = 'tipo_venta'
  ) THEN
    ALTER TABLE productos_materiales_rigidos
      ADD COLUMN tipo_venta text DEFAULT 'mt2';
  END IF;
END $$;

-- =====================================================
-- 2. ACTUALIZAR PRODUCTOS EXISTENTES
-- =====================================================

-- Configurar todos los productos existentes como 'mt2'
UPDATE productos_materiales_rigidos
SET tipo_venta = 'mt2'
WHERE tipo_venta IS NULL;

-- =====================================================
-- 3. HACER tipo_venta NOT NULL
-- =====================================================

ALTER TABLE productos_materiales_rigidos
  ALTER COLUMN tipo_venta SET NOT NULL;

-- =====================================================
-- 4. ELIMINAR CONSTRAINTS ANTIGUOS
-- =====================================================

ALTER TABLE productos_materiales_rigidos
  DROP CONSTRAINT IF EXISTS check_materiales_rigidos_medidas_positivas;

-- =====================================================
-- 5. ELIMINAR CAMPOS OBSOLETOS
-- =====================================================

ALTER TABLE productos_materiales_rigidos
  DROP COLUMN IF EXISTS medidas_ancho;

ALTER TABLE productos_materiales_rigidos
  DROP COLUMN IF EXISTS medidas_alto;

-- =====================================================
-- 6. AGREGAR CONSTRAINT DE VALIDACIÓN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_materiales_rigidos_tipo_venta'
  ) THEN
    ALTER TABLE productos_materiales_rigidos
      ADD CONSTRAINT check_materiales_rigidos_tipo_venta
      CHECK (tipo_venta = 'mt2');
  END IF;
END $$;

-- =====================================================
-- 7. CREAR ÍNDICE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_tipo_venta
  ON productos_materiales_rigidos(tipo_venta);

-- =====================================================
-- 8. ACTUALIZAR COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_materiales_rigidos IS
  'Productos de Materiales Rígidos. Se venden por m² y las medidas finales del trabajo se definen en la orden de trabajo, no en la configuración del producto.';

COMMENT ON COLUMN productos_materiales_rigidos.tipo_venta IS
  'Indica cómo se vende el producto. Siempre mt2 (metros cuadrados) para materiales rígidos';

COMMENT ON COLUMN productos_materiales_rigidos.caras_impresas IS
  'Array de opciones de impresión disponibles: solo_frente, frente_y_dorso, o ambas';

COMMENT ON COLUMN productos_materiales_rigidos.producto_impreso IS
  'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';
