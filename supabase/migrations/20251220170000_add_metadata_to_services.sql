-- Add metadata column to ordenes_trabajo_servicios
-- This allows storing linked_item_ids and other extra data for services

ALTER TABLE ordenes_trabajo_servicios
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ordenes_trabajo_servicios.metadata IS 'Metadata adicional para el servicio, incluyendo items relacionados (linked_item_ids)';
