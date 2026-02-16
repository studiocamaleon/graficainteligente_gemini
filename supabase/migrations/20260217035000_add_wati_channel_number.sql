-- Add configurable Wati sender channel number per company
-- and backfill known tenant/channel combination.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'wati_channel_number'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN wati_channel_number text;
  END IF;
END $$;

COMMENT ON COLUMN public.companies.wati_channel_number IS
  'Número emisor para Wati (channelNumber), solo dígitos con código de país.';

-- Initial backfill for tenant endpoint /1082879.
UPDATE public.companies
SET wati_channel_number = '5492902496858'
WHERE (wati_channel_number IS NULL OR btrim(wati_channel_number) = '')
  AND coalesce(wati_api_endpoint, '') LIKE '%/1082879%';

