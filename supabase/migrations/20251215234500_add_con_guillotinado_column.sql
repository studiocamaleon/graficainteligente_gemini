
-- Add con_guillotinado column to centro_copiado_ordenes_items
ALTER TABLE centro_copiado_ordenes_items
ADD COLUMN con_guillotinado boolean NOT NULL DEFAULT false;
