/*
  # Agregar Soporte de Rangos de Precio para Productos Impresión Láser

  ## Descripción
  Permite que productos de impresión láser con tipo_venta = 'unidades' 
  utilicen rangos de precio en lugar de cantidades fijas.

  ## Cambios
  1. Agregar rango_precio_id a productos_impresion_laser (nullable)
  2. Modificar productos_impresion_laser_precios para soportar rangos
  3. Agregar validación: tipo 'unidades' requiere rango obligatorio
  4. Crear índices para optimizar búsquedas

  ## Reglas de Negocio
  - tipo_venta = 'unidades' → rango_precio_id OBLIGATORIO
  - tipo_venta = 'cantidades_fijas' → rango_precio_id debe ser NULL
  - El rango asociado debe tener unidad_medida = 'unidades'
*/

-- 1. Agregar columna rango_precio_id a productos_impresion_laser
ALTER TABLE productos_impresion_laser 
  ADD COLUMN IF NOT EXISTS rango_precio_id uuid 
  REFERENCES rangos_precio(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_productos_laser_rango_precio 
  ON productos_impresion_laser(rango_precio_id);

COMMENT ON COLUMN productos_impresion_laser.rango_precio_id IS
  'ID del rango de precios asociado. Obligatorio si tipo_venta = unidades, debe ser NULL si tipo_venta = cantidades_fijas';

-- 2. Modificar productos_impresion_laser_precios para soportar rangos
ALTER TABLE productos_impresion_laser_precios
  ADD COLUMN IF NOT EXISTS rango_precio_min decimal(10,2),
  ADD COLUMN IF NOT EXISTS rango_precio_max decimal(10,2);

-- Hacer cantidad nullable (antes era NOT NULL)
ALTER TABLE productos_impresion_laser_precios 
  ALTER COLUMN cantidad DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pl_precios_rangos
  ON productos_impresion_laser_precios(rango_precio_min, rango_precio_max);

COMMENT ON COLUMN productos_impresion_laser_precios.cantidad IS
  'Cantidad específica para tipo_venta cantidades_fijas. NULL cuando se usan rangos';

COMMENT ON COLUMN productos_impresion_laser_precios.rango_precio_min IS
  'Mínimo del rango de cantidades para tipo_venta unidades. NULL cuando se usan cantidades fijas';

COMMENT ON COLUMN productos_impresion_laser_precios.rango_precio_max IS
  'Máximo del rango de cantidades (NULL = infinito) para tipo_venta unidades';

-- 3. Actualizar constraint unique para soportar ambos modos
-- Primero eliminar el constraint existente si existe
ALTER TABLE productos_impresion_laser_precios 
  DROP CONSTRAINT IF EXISTS unique_precio_configuracion;

-- Crear índices únicos parciales en lugar de constraints
-- Índice único para modo cantidades fijas
DROP INDEX IF EXISTS idx_unique_precio_cantidades;
CREATE UNIQUE INDEX idx_unique_precio_cantidades 
  ON productos_impresion_laser_precios (
    producto_laser_id, medida_ancho, medida_alto, tinta, cantidad, cara_impresa
  ) 
  WHERE cantidad IS NOT NULL;

-- Índice único para modo rangos
DROP INDEX IF EXISTS idx_unique_precio_rangos;
CREATE UNIQUE INDEX idx_unique_precio_rangos 
  ON productos_impresion_laser_precios (
    producto_laser_id, medida_ancho, medida_alto, tinta, 
    rango_precio_min, rango_precio_max, cara_impresa
  ) 
  WHERE rango_precio_min IS NOT NULL;

-- 4. Agregar constraints de validación
ALTER TABLE productos_impresion_laser_precios
  DROP CONSTRAINT IF EXISTS check_precio_usa_cantidad_o_rango;

ALTER TABLE productos_impresion_laser_precios
  ADD CONSTRAINT check_precio_usa_cantidad_o_rango
  CHECK (
    (cantidad IS NOT NULL AND rango_precio_min IS NULL AND rango_precio_max IS NULL)
    OR
    (cantidad IS NULL AND rango_precio_min IS NOT NULL)
  );

-- 5. Crear función de validación
CREATE OR REPLACE FUNCTION validar_rango_precio_laser()
RETURNS TRIGGER AS $$
DECLARE
  v_rango_unidad_medida text;
BEGIN
  -- Validación 1: Si tipo_venta = 'unidades' → rango_precio_id OBLIGATORIO
  IF NEW.tipo_venta = 'unidades' AND NEW.rango_precio_id IS NULL THEN
    RAISE EXCEPTION 'Productos con tipo de venta "Por Unidades" deben tener un rango de precio asociado';
  END IF;

  -- Validación 2: Si tipo_venta = 'cantidades_fijas' → rango_precio_id debe ser NULL
  IF NEW.tipo_venta = 'cantidades_fijas' AND NEW.rango_precio_id IS NOT NULL THEN
    RAISE EXCEPTION 'Productos con tipo de venta "Cantidades Fijas" no deben tener rango de precio asociado';
  END IF;

  -- Validación 3: Si hay rango asociado, debe ser de unidad 'unidades'
  IF NEW.rango_precio_id IS NOT NULL THEN
    SELECT unidad_medida INTO v_rango_unidad_medida
    FROM rangos_precio
    WHERE id = NEW.rango_precio_id;

    IF v_rango_unidad_medida != 'unidades' THEN
      RAISE EXCEPTION 'El rango de precio asociado debe tener unidad_medida = "unidades". Actualmente tiene: %', v_rango_unidad_medida;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger
DROP TRIGGER IF EXISTS trigger_validar_rango_precio_laser ON productos_impresion_laser;

CREATE TRIGGER trigger_validar_rango_precio_laser
  BEFORE INSERT OR UPDATE ON productos_impresion_laser
  FOR EACH ROW
  EXECUTE FUNCTION validar_rango_precio_laser();