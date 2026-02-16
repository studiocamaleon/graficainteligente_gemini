-- Wati contact attributes: snapshot RPC + admin RPCs + worker claim

-- Snapshot: pack basico de atributos gi_*
CREATE OR REPLACE FUNCTION public.fn_get_wati_contact_snapshot(
  p_company_id uuid,
  p_phone text
)
RETURNS TABLE (
  gi_registrado text,
  gi_cuenta_corriente text,
  gi_ultima_orden_numero text,
  gi_ultima_orden_estado text,
  gi_ultima_orden_fecha text,
  gi_ordenes_pendientes text,
  gi_deuda_total text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
  v_client_id uuid;
  v_cc boolean := false;
  v_last_numero text;
  v_last_estado text;
  v_last_fecha timestamptz;
  v_pending_count int := 0;
  v_deuda numeric := 0;
BEGIN
  v_phone := public.fn_wati_normalize_phone(p_phone);
  IF v_phone IS NULL OR length(v_phone) < 5 THEN
    gi_registrado := 'no';
    gi_cuenta_corriente := 'no';
    gi_ultima_orden_numero := '-';
    gi_ultima_orden_estado := '-';
    gi_ultima_orden_fecha := '-';
    gi_ordenes_pendientes := '0';
    gi_deuda_total := public.fn_format_ars(0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Resolve primary client for that phone within company
  SELECT c.id, COALESCE(c.tiene_cuenta_corriente, false)
  INTO v_client_id, v_cc
  FROM public.clients c
  WHERE c.company_id = p_company_id
    AND public.fn_wati_normalize_phone(c.whatsapp) = v_phone
  ORDER BY c.is_active DESC NULLS LAST, c.updated_at DESC NULLS LAST
  LIMIT 1;

  gi_registrado := CASE WHEN v_client_id IS NULL THEN 'no' ELSE 'si' END;
  gi_cuenta_corriente := CASE WHEN v_client_id IS NULL THEN 'no' WHEN v_cc THEN 'si' ELSE 'no' END;

  -- Last order (OT vs Copiado) excluding cancelada
  WITH last_orders AS (
    SELECT
      'ot'::text AS tipo,
      o.numero_orden::text AS numero,
      o.estado::text AS estado,
      COALESCE(o.fecha_creacion, o.created_at)::timestamptz AS fecha
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado <> 'cancelada'

    UNION ALL

    SELECT
      'cc'::text AS tipo,
      o.numero_orden::text AS numero,
      o.estado::text AS estado,
      COALESCE(o.fecha_solicitud, o.created_at)::timestamptz AS fecha
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado <> 'cancelada'
  )
  SELECT numero, estado, fecha
  INTO v_last_numero, v_last_estado, v_last_fecha
  FROM last_orders
  ORDER BY fecha DESC NULLS LAST
  LIMIT 1;

  gi_ultima_orden_numero := COALESCE(v_last_numero, '-');
  gi_ultima_orden_estado := COALESCE(v_last_estado, '-');
  gi_ultima_orden_fecha := COALESCE(to_char((v_last_fecha AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'DD/MM/YYYY'), '-');

  -- Pending orders count (not cancelada, not entregada)
  SELECT COALESCE((
    SELECT count(*)
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado NOT IN ('cancelada','entregada')
  ),0)
  + COALESCE((
    SELECT count(*)
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado NOT IN ('cancelada','entregada')
  ),0)
  INTO v_pending_count;

  gi_ordenes_pendientes := COALESCE(v_pending_count, 0)::text;

  -- Debt total: sum of positive saldo for OT + CC, excluding cancelada
  WITH ot_pagos AS (
    SELECT p.orden_id, COALESCE(sum(p.monto), 0) AS pagado
    FROM public.ordenes_trabajo_pagos p
    GROUP BY p.orden_id
  ),
  ot_deuda AS (
    SELECT GREATEST(0, round(COALESCE(o.total, 0)::numeric, 2) - round(COALESCE(p.pagado, 0)::numeric, 2)) AS saldo
    FROM public.ordenes_trabajo o
    LEFT JOIN ot_pagos p ON p.orden_id = o.id
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado <> 'cancelada'
  ),
  cc_pagos AS (
    SELECT p.orden_copiado_id, COALESCE(sum(p.monto), 0) AS pagado
    FROM public.centro_copiado_ordenes_pagos p
    GROUP BY p.orden_copiado_id
  ),
  cc_deuda AS (
    SELECT GREATEST(0, round(COALESCE(o.total, 0)::numeric, 2) - round(COALESCE(p.pagado, 0)::numeric, 2)) AS saldo
    FROM public.centro_copiado_ordenes o
    LEFT JOIN cc_pagos p ON p.orden_copiado_id = o.id
    WHERE o.company_id = p_company_id
      AND o.cliente_id = v_client_id
      AND o.estado <> 'cancelada'
  )
  SELECT COALESCE(sum(saldo), 0)
  INTO v_deuda
  FROM (
    SELECT saldo FROM ot_deuda
    UNION ALL
    SELECT saldo FROM cc_deuda
  ) s
  WHERE s.saldo > 0;

  gi_deuda_total := public.fn_format_ars(COALESCE(v_deuda, 0));

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_wati_contact_snapshot(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_get_wati_contact_snapshot(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_get_wati_contact_snapshot(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_wati_contact_snapshot(uuid, text) TO service_role;

-- Worker claim: atomically claim pending items (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.fn_wati_contact_attr_outbox_claim(
  p_limit int DEFAULT 200,
  p_company_id uuid DEFAULT NULL
)
RETURNS SETOF public.wati_contact_attr_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH to_claim AS (
    SELECT id
    FROM public.wati_contact_attr_outbox
    WHERE status = 'pending'
      AND next_attempt_at <= now()
      AND (p_company_id IS NULL OR company_id = p_company_id)
    ORDER BY next_attempt_at ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 1000))
  )
  UPDATE public.wati_contact_attr_outbox o
  SET status = 'processing', updated_at = now()
  WHERE o.id IN (SELECT id FROM to_claim)
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_wati_contact_attr_outbox_claim(int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_wati_contact_attr_outbox_claim(int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_wati_contact_attr_outbox_claim(int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wati_contact_attr_outbox_claim(int, uuid) TO service_role;

-- Admin: enqueue all clients of a company (UI)
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

  WITH src AS (
    SELECT c.id AS client_id, c.company_id, public.fn_wati_normalize_phone(c.whatsapp) AS phone
    FROM public.clients c
    WHERE c.company_id = p_company_id
      AND c.whatsapp IS NOT NULL
      AND public.fn_wati_normalize_phone(c.whatsapp) IS NOT NULL
      AND (NOT p_only_active OR COALESCE(c.is_active, true) = true)
  ), upserted AS (
    INSERT INTO public.wati_contact_attr_outbox (company_id, client_id, phone, reason, status, next_attempt_at)
    SELECT company_id, client_id, phone, 'bulk_sync', 'pending', now()
    FROM src
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

-- Admin: outbox stats (UI)
CREATE OR REPLACE FUNCTION public.fn_wati_outbox_stats(
  p_company_id uuid
)
RETURNS TABLE (
  pending_count int,
  error_count int,
  last_sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_company uuid;
BEGIN
  SELECT company_id INTO v_profile_company
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile_company IS NULL OR v_profile_company <> p_company_id THEN
    RAISE EXCEPTION 'No autorizado para esta empresa';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.wati_contact_attr_outbox o WHERE o.company_id = p_company_id AND o.status = 'pending')::int,
    (SELECT count(*) FROM public.wati_contact_attr_outbox o WHERE o.company_id = p_company_id AND o.status = 'error')::int,
    (SELECT max(s.last_sent_at) FROM public.wati_contact_attr_state s WHERE s.company_id = p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_wati_outbox_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_wati_outbox_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_wati_outbox_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wati_outbox_stats(uuid) TO service_role;
