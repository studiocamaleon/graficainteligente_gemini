/*
  # Agregar Cantidad Mínima a Productos de Gran Formato y Materiales Rígidos

  ## Descripción
  Esta migración agrega la columna `cantidad_minima` a las tablas de productos que se venden
  por metros cuadrados (mt2) o metros lineales (mt_lineal). Esta cantidad mínima representa
  el mínimo que se cobrará al cliente, incluso si solicita una cantidad menor.

  ## Cambios en Tablas

  ### 1. productos_gran_formato
  - Agregar columna `cantidad_minima` (decimal, nullable)
  - Constraint: debe ser mayor a 0 si se especifica
  - Representa el mínimo en mt2 o metros lineales según el tipo_venta
  - Default: NULL (opcional)

  ### 2. productos_materiales_rigidos
  - Agregar columna `cantidad_minima` (decimal, nullable)
  - Constraint: debe ser mayor a 0 si se especifica
  - Representa el mínimo en mt2 a cobrar
  - Default: NULL (opcional)

  ## Índices
  - Índice en cantidad_minima para optimizar búsquedas de productos con mínimo configurado

  ## Notas Importantes
  - La cantidad mínima es OPCIONAL: los productos pueden o no tenerla configurada
  - Si está configurada, el sistema debe usarla para calcular precios cuando la cantidad
    solicitada por el cliente sea menor al mínimo
  - La unidad de medida depende del tipo_venta:
    * Para productos con tipo_venta='mt2': la cantidad_minima está en metros cuadrados
    * Para productos con tipo_venta='mt_lineal': la cantidad_minima está en metros lineales
*/

-- =====================================================
-- 1. AGREGAR CANTIDAD MÍNIMA A productos_gran_formato
-- =====================================================

-- Agregar columna cantidad_minima
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_gran_formato'
    AND column_name = 'cantidad_minima'
  ) THEN
    ALTER TABLE productos_gran_formato
    ADD COLUMN cantidad_minima decimal(10,2) NULL;
  END IF;
END $$;

-- Agregar constraint para validar que sea positiva si se especifica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_cantidad_minima_positiva_gran_formato'
  ) THEN
    ALTER TABLE productos_gran_formato
    ADD CONSTRAINT check_cantidad_minima_positiva_gran_formato
    CHECK (cantidad_minima IS NULL OR cantidad_minima > 0);
  END IF;
END $$;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_cantidad_minima
ON productos_gran_formato(cantidad_minima)
WHERE cantidad_minima IS NOT NULL;

-- Agregar comentario explicativo
COMMENT ON COLUMN productos_gran_formato.cantidad_minima IS
  'Cantidad mínima a cobrar en mt2 (si tipo_venta=mt2) o metros lineales (si tipo_venta=mt_lineal). Si el cliente solicita menos, se factura esta cantidad mínima.';

-- =====================================================
-- 2. AGREGAR CANTIDAD MÍNIMA A productos_materiales_rigidos
-- =====================================================

-- Agregar columna cantidad_minima
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_materiales_rigidos'
    AND column_name = 'cantidad_minima'
  ) THEN
    ALTER TABLE productos_materiales_rigidos
    ADD COLUMN cantidad_minima decimal(10,2) NULL;
  END IF;
END $$;

-- Agregar constraint para validar que sea positiva si se especifica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_cantidad_minima_positiva_materiales_rigidos'
  ) THEN
    ALTER TABLE productos_materiales_rigidos
    ADD CONSTRAINT check_cantidad_minima_positiva_materiales_rigidos
    CHECK (cantidad_minima IS NULL OR cantidad_minima > 0);
  END IF;
END $$;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_cantidad_minima
ON productos_materiales_rigidos(cantidad_minima)
WHERE cantidad_minima IS NOT NULL;

-- Agregar comentario explicativo
COMMENT ON COLUMN productos_materiales_rigidos.cantidad_minima IS
  'Cantidad mínima a cobrar en metros cuadrados (mt2). Si el cliente solicita menos, se factura esta cantidad mínima.';
