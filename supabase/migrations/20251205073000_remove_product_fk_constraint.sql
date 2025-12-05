-- Eliminar la restricción FK de producto_id en ordenes_trabajo_items
-- Motivo: La arquitectura usa tablas independientes por categoría (productos_impresion_laser, etc.)
-- y NO una tabla maestra única 'productos' que contenga todos los IDs.
-- Por lo tanto, no se puede validar referencialmente contra una sola tabla.

ALTER TABLE ordenes_trabajo_items 
DROP CONSTRAINT IF EXISTS ordenes_trabajo_items_producto_id_fkey;

ALTER TABLE ordenes_trabajo_items 
DROP CONSTRAINT IF EXISTS fk_ordenes_trabajo_items_producto;

-- Asegurar que producto_id sea UUID pero SIN referencia foránea
-- (La columna ya es UUID, solo nos aseguramos de no romper nada)

-- Mantener los CHECK constraints lógicos
-- Si es catálogo, intentamos que tenga ID, pero ya no verificamos existencia en tabla 'productos'
-- La validación CHECK (tipo_item = 'catalogo' => producto_id IS NOT NULL) sigue siendo válida y útil.
