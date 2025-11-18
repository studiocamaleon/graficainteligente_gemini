/*
  # Agregar campo producto_impreso a la tabla productos

  ## Descripción
  Esta migración agrega un nuevo campo para diferenciar entre productos
  que son impresos versus productos que solo son aptos para impresión.

  ## Cambios

  ### Nuevo Campo en productos
  - `producto_impreso` (boolean, NOT NULL, DEFAULT false)
    - true: El producto se vende ya impreso
    - false: El producto solo es apto para impresión pero se vende sin imprimir

  ## Lógica de Negocio
  - Productos de impresión láser: siempre son productos impresos
  - Materiales rígidos: pueden venderse impresos o sin impresión
  - `tiene_impresion`: indica si el producto es apto para impresión
  - `producto_impreso`: indica si el producto se vende ya impreso

  ## Migración de Datos
  - Se establece en false por defecto para productos existentes
  - No afecta la lógica actual de `tiene_impresion`
*/

-- =====================================================
-- 1. AGREGAR COLUMNA producto_impreso
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productos' AND column_name = 'producto_impreso'
  ) THEN
    ALTER TABLE productos 
    ADD COLUMN producto_impreso boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- 2. COMENTARIO EN COLUMNA
-- =====================================================

COMMENT ON COLUMN productos.producto_impreso IS 'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';

-- =====================================================
-- 3. ÍNDICE PARA CONSULTAS POR producto_impreso
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_productos_producto_impreso'
  ) THEN
    CREATE INDEX idx_productos_producto_impreso 
    ON productos(producto_impreso) 
    WHERE is_active = true;
  END IF;
END $$;
