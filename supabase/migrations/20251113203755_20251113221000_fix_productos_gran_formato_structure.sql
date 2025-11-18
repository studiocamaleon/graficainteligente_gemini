/*
  # Corregir Estructura de productos_gran_formato
  
  ## Descripción
  Esta migración corrige la estructura de productos_gran_formato eliminando los campos
  de medidas (ancho_maximo, alto_maximo) que no deben estar en la configuración del producto,
  ya que las medidas finales se definen al momento de crear la orden de trabajo.
  
  ## Cambios Realizados
  
  ### 1. Eliminación de Campos Obsoletos
  - Se eliminan `ancho_maximo` y `alto_maximo`
  - Las medidas finales del trabajo se definen en la orden, no en el producto
  
  ### 2. Nuevo Campo tipo_venta
  - `tipo_venta` (text, required): Indica cómo se vende el producto
    - 'mt2': Se vende por metros cuadrados (el formulario pedirá ancho y alto)
    - 'mt_lineal': Se vende por metros lineales (el formulario solo pedirá largo)
  
  ### 3. Actualización de Constraints
  - Se eliminan constraints relacionados con ancho_maximo y alto_maximo
  - Se agrega constraint de validación para tipo_venta
  
  ### 4. Actualización de Índices
  - Se eliminan índices innecesarios de los campos removidos
  
  ## Migración de Datos
  - Los productos existentes se configuran como 'mt2' por defecto
*/

-- =====================================================
-- 1. AGREGAR NUEVO CAMPO tipo_venta
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_gran_formato' AND column_name = 'tipo_venta'
  ) THEN
    ALTER TABLE productos_gran_formato
      ADD COLUMN tipo_venta text DEFAULT 'mt2';
  END IF;
END $$;

-- =====================================================
-- 2. ACTUALIZAR PRODUCTOS EXISTENTES
-- =====================================================

-- Configurar todos los productos existentes como 'mt2'
UPDATE productos_gran_formato
SET tipo_venta = 'mt2'
WHERE tipo_venta IS NULL;

-- =====================================================
-- 3. HACER tipo_venta NOT NULL
-- =====================================================

ALTER TABLE productos_gran_formato
  ALTER COLUMN tipo_venta SET NOT NULL;

-- =====================================================
-- 4. ELIMINAR CONSTRAINTS ANTIGUOS
-- =====================================================

ALTER TABLE productos_gran_formato 
  DROP CONSTRAINT IF EXISTS check_gran_formato_ancho_maximo_positivo;

ALTER TABLE productos_gran_formato 
  DROP CONSTRAINT IF EXISTS check_gran_formato_alto_maximo_positivo;

-- =====================================================
-- 5. ELIMINAR CAMPOS OBSOLETOS
-- =====================================================

ALTER TABLE productos_gran_formato 
  DROP COLUMN IF EXISTS ancho_maximo;

ALTER TABLE productos_gran_formato 
  DROP COLUMN IF EXISTS alto_maximo;

-- =====================================================
-- 6. AGREGAR CONSTRAINT DE VALIDACIÓN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_gran_formato_tipo_venta'
  ) THEN
    ALTER TABLE productos_gran_formato
      ADD CONSTRAINT check_gran_formato_tipo_venta
      CHECK (tipo_venta IN ('mt2', 'mt_lineal'));
  END IF;
END $$;

-- =====================================================
-- 7. CREAR ÍNDICE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_tipo_venta
  ON productos_gran_formato(tipo_venta);

-- =====================================================
-- 8. ACTUALIZAR COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_gran_formato IS
  'Productos de Impresión Gran Formato. Las medidas finales del trabajo se definen en la orden, no en el producto. El campo tipo_venta indica si se cobra por m² o metros lineales.';

COMMENT ON COLUMN productos_gran_formato.tipo_venta IS
  'Indica cómo se vende el producto: mt2 (metros cuadrados, requiere ancho y alto) o mt_lineal (metros lineales, solo requiere largo)';

COMMENT ON COLUMN productos_gran_formato.producto_impreso IS
  'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';
