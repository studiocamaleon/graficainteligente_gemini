BEGIN;

ALTER TABLE public.centro_copiado_ordenes
  ADD COLUMN IF NOT EXISTS requiere_despacho boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.centro_copiado_ordenes.requiere_despacho
  IS 'Indica si la orden de copiado requiere despacho/envio (true) o retiro por local (false).';

COMMIT;
