-- Fix: bulk enqueue must dedupe by (company_id, normalized phone).
-- Otherwise, multiple clients sharing the same whatsapp can cause:
-- "ON CONFLICT DO UPDATE command cannot affect row a second time"

CREATE OR REPLACE FUNCTION public.fn_wati_enqueue_all_clients(
  p_company_id uuid,
  p_only_active boolean DEFAULT true
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_company uuid;
  v_count int := 0;
BEGIN
  SELECT company_id INTO v_profile_company
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile_company IS NULL OR v_profile_company <> p_company_id THEN
    RAISE EXCEPTION 'No autorizado para esta empresa';
  END IF;

  WITH src_raw AS (
    SELECT
      c.id AS client_id,
      c.company_id,
      public.fn_wati_normalize_phone(c.whatsapp) AS phone,
      c.is_active,
      c.updated_at
    FROM public.clients c
    WHERE c.company_id = p_company_id
      AND c.whatsapp IS NOT NULL
      AND public.fn_wati_normalize_phone(c.whatsapp) IS NOT NULL
      AND (NOT p_only_active OR COALESCE(c.is_active, true) = true)
  ),
  src_dedup AS (
    -- If multiple clients share the same phone, pick a stable "primary":
    -- active first, then most recently updated.
    SELECT DISTINCT ON (company_id, phone)
      client_id,
      company_id,
      phone
    FROM src_raw
    ORDER BY company_id, phone, is_active DESC NULLS LAST, updated_at DESC NULLS LAST
  ),
  upserted AS (
    INSERT INTO public.wati_contact_attr_outbox (company_id, client_id, phone, reason, status, next_attempt_at)
    SELECT company_id, client_id, phone, 'bulk_sync', 'pending', now()
    FROM src_dedup
    ON CONFLICT (company_id, phone)
    DO UPDATE SET
      client_id = COALESCE(EXCLUDED.client_id, public.wati_contact_attr_outbox.client_id),
      reason = EXCLUDED.reason,
      status = 'pending',
      last_error = NULL,
      next_attempt_at = now(),
      updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upserted;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_wati_enqueue_all_clients(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_wati_enqueue_all_clients(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_wati_enqueue_all_clients(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wati_enqueue_all_clients(uuid, boolean) TO service_role;

