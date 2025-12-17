-- Migration to relax constraints for Copy Center items
-- Goal: Allow 'centro_copiado' in tipo_item and permit NULL producto_id for it.

-- 1. Update check_tipo_item_valido
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_tipo_item_valido;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_tipo_item_valido
    CHECK (tipo_item IN ('catalogo', 'personalizado', 'centro_copiado'));

-- 2. Update check_catalogo_requiere_producto_id
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_catalogo_requiere_producto_id;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_catalogo_requiere_producto_id
    CHECK (
      tipo_item IN ('personalizado', 'centro_copiado') OR
      (tipo_item = 'catalogo' AND producto_id IS NOT NULL)
    );

-- 3. Update comments
COMMENT ON COLUMN ordenes_trabajo_items.tipo_item IS
'Tipo de item: catalogo, personalizado o centro_copiado';
