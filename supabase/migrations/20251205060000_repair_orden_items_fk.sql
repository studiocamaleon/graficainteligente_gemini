-- Reparación de Constraints para ordenes_trabajo_items
-- Objetivo: Asegurar que producto_id pueda ser NULL y que items personalizados no fallen por FK.

-- 1. Asegurar que la columna producto_id permita NULOS
ALTER TABLE ordenes_trabajo_items ALTER COLUMN producto_id DROP NOT NULL;

-- 2. Eliminar la constraint de clave foránea existente (puede tener nombres variados, probamos los comunes)
ALTER TABLE ordenes_trabajo_items DROP CONSTRAINT IF EXISTS ordenes_trabajo_items_producto_id_fkey;
ALTER TABLE ordenes_trabajo_items DROP CONSTRAINT IF EXISTS fk_ordenes_trabajo_items_producto;

-- 3. (OMITIDO) No recreamos FK a tabla 'productos' por arquitectura distribuida
-- La integridad referencial se asume implícita o manejada por lógica de negocio
-- ALTER TABLE ordenes_trabajo_items
-- ADD CONSTRAINT ordenes_trabajo_items_producto_id_fkey
-- FOREIGN KEY (producto_id)
-- REFERENCES productos(id)
-- ON DELETE SET NULL;

-- 4. Reafirmar constraints lógicos (CHECKs)
ALTER TABLE ordenes_trabajo_items DROP CONSTRAINT IF EXISTS check_tipo_item_valido;
ALTER TABLE ordenes_trabajo_items ADD CONSTRAINT check_tipo_item_valido CHECK (tipo_item IN ('catalogo', 'personalizado'));

ALTER TABLE ordenes_trabajo_items DROP CONSTRAINT IF EXISTS check_catalogo_requiere_producto_id;
ALTER TABLE ordenes_trabajo_items ADD CONSTRAINT check_catalogo_requiere_producto_id
CHECK (
  (tipo_item = 'catalogo' AND producto_id IS NOT NULL) OR
  (tipo_item = 'personalizado') -- Si es personalizado, no forzamos producto_id (puede ser NULL)
);

-- NOTA: No validamos que sea NULL si es personalizado, simplemente NO lo obligamos a tener valor.
