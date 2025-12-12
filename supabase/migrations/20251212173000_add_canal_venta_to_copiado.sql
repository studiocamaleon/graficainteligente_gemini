-- Migration to add sales channel to copy center orders

-- 1. Add column
ALTER TABLE centro_copiado_ordenes 
ADD COLUMN IF NOT EXISTS canal_venta text;

-- 2. Add constraint (matching existing values)
ALTER TABLE centro_copiado_ordenes 
DROP CONSTRAINT IF EXISTS centro_copiado_ordenes_canal_venta_check;

ALTER TABLE centro_copiado_ordenes 
ADD CONSTRAINT centro_copiado_ordenes_canal_venta_check 
CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));

-- 3. Backfill data
-- From associated Work Orders
UPDATE centro_copiado_ordenes oc
SET canal_venta = ot.canal_venta
FROM ordenes_trabajo ot
WHERE oc.orden_trabajo_id = ot.id
AND oc.canal_venta IS NULL;

-- Default remaining to 'Mostrador'
UPDATE centro_copiado_ordenes 
SET canal_venta = 'Mostrador' 
WHERE canal_venta IS NULL;

-- 4. Set Not Null
ALTER TABLE centro_copiado_ordenes 
ALTER COLUMN canal_venta SET NOT NULL;

-- 5. Set Default
ALTER TABLE centro_copiado_ordenes 
ALTER COLUMN canal_venta SET DEFAULT 'Mostrador';
