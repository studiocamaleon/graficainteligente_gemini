-- Migration to add 'centro_copiado' to presupuestos_items.tipo_item check constraints

-- 1. Drop existing constraints
ALTER TABLE presupuestos_items DROP CONSTRAINT IF EXISTS presupuestos_items_tipo_item_check;
ALTER TABLE presupuestos_items DROP CONSTRAINT IF EXISTS check_producto_sistema;

-- 2. Add updated check constraint for tipo_item
ALTER TABLE presupuestos_items ADD CONSTRAINT presupuestos_items_tipo_item_check 
  CHECK (tipo_item IN ('producto_sistema', 'item_personalizado', 'centro_copiado'));

-- 3. Add updated check constraint for producto_id consistency
ALTER TABLE presupuestos_items ADD CONSTRAINT check_producto_sistema 
  CHECK (
    (tipo_item = 'producto_sistema' AND producto_id IS NOT NULL) OR
    (tipo_item IN ('item_personalizado', 'centro_copiado') AND producto_id IS NULL)
  );
