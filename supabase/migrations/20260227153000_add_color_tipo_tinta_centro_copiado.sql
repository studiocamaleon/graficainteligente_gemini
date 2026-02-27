BEGIN;

ALTER TABLE public.centro_copiado_precios_impresion
  DROP CONSTRAINT IF EXISTS centro_copiado_precios_impresion_tipo_tinta_check;

ALTER TABLE public.centro_copiado_precios_impresion
  ADD CONSTRAINT centro_copiado_precios_impresion_tipo_tinta_check
  CHECK (tipo_tinta IN ('CMYK', 'COLOR', 'K'));

ALTER TABLE public.centro_copiado_ordenes_items
  DROP CONSTRAINT IF EXISTS centro_copiado_ordenes_items_tipo_tinta_check;

ALTER TABLE public.centro_copiado_ordenes_items
  ADD CONSTRAINT centro_copiado_ordenes_items_tipo_tinta_check
  CHECK (tipo_tinta IS NULL OR tipo_tinta IN ('CMYK', 'COLOR', 'K'));

COMMIT;
