-- Migration to relax personalizado constraint for Copy Center items
-- Goal: Allow 'centro_copiado' items to exist without failing the description check.
-- Rationale: 'centro_copiado' items act like catalog items (predefined service), not free-text personalized items.

ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_personalizado_requiere_descripcion;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_personalizado_requiere_descripcion
    CHECK (
      tipo_item IN ('catalogo', 'centro_copiado') OR 
      (tipo_item = 'personalizado' AND descripcion IS NOT NULL AND LENGTH(TRIM(descripcion)) > 0)
    );
