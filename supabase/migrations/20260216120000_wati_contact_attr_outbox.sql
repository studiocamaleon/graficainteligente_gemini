-- Wati contact attributes sync (Outbox + State)

CREATE TABLE IF NOT EXISTS public.wati_contact_attr_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid NULL,
  phone text NOT NULL,
  reason text NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  last_error text NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wati_contact_attr_outbox_status_chk CHECK (status IN ('pending','processing','sent','error')),
  CONSTRAINT wati_contact_attr_outbox_company_phone_uniq UNIQUE (company_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wati_contact_attr_outbox_status_next_attempt
  ON public.wati_contact_attr_outbox (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_wati_contact_attr_outbox_company_status_next_attempt
  ON public.wati_contact_attr_outbox (company_id, status, next_attempt_at);

CREATE TABLE IF NOT EXISTS public.wati_contact_attr_state (
  company_id uuid NOT NULL,
  phone text NOT NULL,
  last_payload_hash text NULL,
  last_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wati_contact_attr_state_pkey PRIMARY KEY (company_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wati_contact_attr_state_company_last_sent
  ON public.wati_contact_attr_state (company_id, last_sent_at DESC);

ALTER TABLE public.wati_contact_attr_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wati_contact_attr_state ENABLE ROW LEVEL SECURITY;

-- No direct access from app roles.
REVOKE ALL ON TABLE public.wati_contact_attr_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.wati_contact_attr_outbox FROM anon;
REVOKE ALL ON TABLE public.wati_contact_attr_outbox FROM authenticated;
REVOKE ALL ON TABLE public.wati_contact_attr_state FROM PUBLIC;
REVOKE ALL ON TABLE public.wati_contact_attr_state FROM anon;
REVOKE ALL ON TABLE public.wati_contact_attr_state FROM authenticated;

CREATE OR REPLACE FUNCTION public.fn_wati_normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(coalesce(p,''), '\\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at_wati_contact_attr_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wati_contact_attr_outbox_set_updated_at ON public.wati_contact_attr_outbox;
CREATE TRIGGER trg_wati_contact_attr_outbox_set_updated_at
BEFORE UPDATE ON public.wati_contact_attr_outbox
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at_wati_contact_attr_outbox();

CREATE OR REPLACE FUNCTION public.fn_set_updated_at_wati_contact_attr_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wati_contact_attr_state_set_updated_at ON public.wati_contact_attr_state;
CREATE TRIGGER trg_wati_contact_attr_state_set_updated_at
BEFORE UPDATE ON public.wati_contact_attr_state
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at_wati_contact_attr_state();

-- Enqueue function (SECURITY DEFINER so triggers don't depend on RLS policies)
CREATE OR REPLACE FUNCTION public.fn_enqueue_wati_contact_attr_update(
  p_company_id uuid,
  p_phone text,
  p_reason text,
  p_client_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := public.fn_wati_normalize_phone(p_phone);

  IF v_phone IS NULL OR length(v_phone) < 5 THEN
    RETURN;
  END IF;

  INSERT INTO public.wati_contact_attr_outbox (company_id, client_id, phone, reason, status, next_attempt_at)
  VALUES (p_company_id, p_client_id, v_phone, p_reason, 'pending', now())
  ON CONFLICT (company_id, phone)
  DO UPDATE SET
    client_id = COALESCE(EXCLUDED.client_id, public.wati_contact_attr_outbox.client_id),
    reason = EXCLUDED.reason,
    status = 'pending',
    last_error = NULL,
    next_attempt_at = now(),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_enqueue_wati_contact_attr_update(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_enqueue_wati_contact_attr_update(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_enqueue_wati_contact_attr_update(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_enqueue_wati_contact_attr_update(uuid, text, text, uuid) TO service_role;

-- Helper: format ARS without relying on DB locale.
CREATE OR REPLACE FUNCTION public.fn_format_ars(p_amount numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_amt numeric;
  v_int_part text;
  v_dec_part int;
  v_reversed text;
  v_grouped_rev text := '';
  v_i int;
BEGIN
  v_amt := round(coalesce(p_amount, 0)::numeric, 2);
  v_dec_part := abs((v_amt * 100)::bigint % 100)::int;
  v_int_part := abs(trunc(v_amt))::bigint::text;

  -- Group thousands with '.'
  v_reversed := reverse(v_int_part);
  FOR v_i IN 1..length(v_reversed) LOOP
    IF v_i > 1 AND ((v_i - 1) % 3) = 0 THEN
      v_grouped_rev := v_grouped_rev || '.';
    END IF;
    v_grouped_rev := v_grouped_rev || substr(v_reversed, v_i, 1);
  END LOOP;

  v_int_part := reverse(v_grouped_rev);

  RETURN (CASE WHEN v_amt < 0 THEN '-' ELSE '' END)
    || '$ ' || v_int_part || ',' || lpad(v_dec_part::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_format_ars(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_format_ars(numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_format_ars(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_format_ars(numeric) TO service_role;
