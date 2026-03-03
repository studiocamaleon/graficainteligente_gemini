CREATE OR REPLACE FUNCTION public.normalize_search_text(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    translate(
      lower(COALESCE(p_input, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñ',
      'aaaaaaeeeeiiiioooouuuun'
    )
  );
$$;

DROP FUNCTION IF EXISTS public.fn_list_clients_with_ltv(uuid, text, boolean, boolean, text, text, int, int);

CREATE OR REPLACE FUNCTION public.fn_list_clients_with_ltv(
  p_company_id uuid,
  p_search_term text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_has_cuenta_corriente boolean DEFAULT NULL,
  p_status_aprobacion text DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at_desc',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  nombre_fantasia text,
  razon_social text,
  tipo_documento text,
  numero_documento text,
  whatsapp text,
  email text,
  domicilio text,
  country_id uuid,
  province_id uuid,
  city_id uuid,
  codigo_postal text,
  tiene_cuenta_corriente boolean,
  acuerdo_pago text,
  dia_cierre_semanal int,
  dia_cierre_mensual int,
  usa_ultimo_dia_mes boolean,
  dias_vencimiento int,
  is_active boolean,
  created_by uuid,
  updated_by uuid,
  app_pin text,
  created_at timestamptz,
  updated_at timestamptz,
  status_aprobacion text,
  ltv_total numeric,
  full_count bigint,
  avg_ltv numeric,
  avg_ltv_global numeric,
  total_ltv numeric
) AS $$
DECLARE
  v_search_term text := trim(COALESCE(p_search_term, ''));
  v_search_term_normalized text := public.normalize_search_text(p_search_term);
BEGIN
  RETURN QUERY
  WITH ventas_ot AS (
    SELECT
      ot.cliente_id,
      SUM(COALESCE(ot.total, 0)) AS total_ot
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado <> 'cancelada'
      AND ot.cliente_id IS NOT NULL
    GROUP BY ot.cliente_id
  ),
  ventas_cc AS (
    SELECT
      cc.cliente_id,
      SUM(COALESCE(cc.total, 0)) AS total_cc
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.estado <> 'cancelada'
      AND cc.cliente_id IS NOT NULL
    GROUP BY cc.cliente_id
  ),
  ltv_por_cliente AS (
    SELECT
      c.id AS cliente_id,
      (COALESCE(vo.total_ot, 0) + COALESCE(vc.total_cc, 0))::numeric AS ltv_total
    FROM clients c
    LEFT JOIN ventas_ot vo ON vo.cliente_id = c.id
    LEFT JOIN ventas_cc vc ON vc.cliente_id = c.id
    WHERE c.company_id = p_company_id
  ),
  filtered AS (
    SELECT
      c.*,
      COALESCE(lpc.ltv_total, 0)::numeric AS ltv_total
    FROM clients c
    LEFT JOIN ltv_por_cliente lpc ON lpc.cliente_id = c.id
    WHERE c.company_id = p_company_id
      AND (p_is_active IS NULL OR c.is_active = p_is_active)
      AND (p_has_cuenta_corriente IS NULL OR c.tiene_cuenta_corriente = p_has_cuenta_corriente)
      AND (p_status_aprobacion IS NULL OR c.status_aprobacion = p_status_aprobacion)
      AND (
        v_search_term = ''
        OR public.normalize_search_text(c.nombre_fantasia) LIKE '%' || v_search_term_normalized || '%'
        OR public.normalize_search_text(c.razon_social) LIKE '%' || v_search_term_normalized || '%'
        OR c.numero_documento ILIKE '%' || v_search_term || '%'
      )
  )
  SELECT
    f.id,
    f.company_id,
    f.nombre_fantasia,
    f.razon_social,
    f.tipo_documento,
    f.numero_documento,
    f.whatsapp,
    f.email,
    f.domicilio,
    f.country_id,
    f.province_id,
    f.city_id,
    f.codigo_postal,
    f.tiene_cuenta_corriente,
    f.acuerdo_pago,
    f.dia_cierre_semanal,
    f.dia_cierre_mensual,
    f.usa_ultimo_dia_mes,
    f.dias_vencimiento,
    f.is_active,
    f.created_by,
    f.updated_by,
    f.app_pin,
    f.created_at,
    f.updated_at,
    f.status_aprobacion,
    f.ltv_total,
    COUNT(*) OVER() AS full_count,
    AVG(NULLIF(f.ltv_total, 0)) OVER() AS avg_ltv,
    AVG(f.ltv_total) OVER() AS avg_ltv_global,
    SUM(f.ltv_total) OVER() AS total_ltv
  FROM filtered f
  ORDER BY
    CASE WHEN p_sort_by = 'ltv_desc' THEN f.ltv_total END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'name_asc' THEN lower(f.nombre_fantasia) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at_desc' THEN f.created_at END DESC NULLS LAST,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.fn_list_clients_commercial_metrics(uuid, text, boolean, boolean, text, text, integer, integer, text, integer);

CREATE OR REPLACE FUNCTION public.fn_list_clients_commercial_metrics(
  p_company_id uuid,
  p_search_term text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_has_cuenta_corriente boolean DEFAULT NULL,
  p_status_aprobacion text DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at_desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_riesgo_comercial text DEFAULT NULL,
  p_sin_compra_dias integer DEFAULT NULL,
  p_sort_criteria jsonb DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  nombre_fantasia text,
  razon_social text,
  tipo_documento text,
  numero_documento text,
  whatsapp text,
  email text,
  domicilio text,
  country_id uuid,
  province_id uuid,
  city_id uuid,
  codigo_postal text,
  tiene_cuenta_corriente boolean,
  acuerdo_pago text,
  dia_cierre_semanal integer,
  dia_cierre_mensual integer,
  usa_ultimo_dia_mes boolean,
  dias_vencimiento integer,
  is_active boolean,
  created_by uuid,
  updated_by uuid,
  app_pin text,
  created_at timestamptz,
  updated_at timestamptz,
  status_aprobacion text,
  ltv_total numeric,
  dias_sin_comprar integer,
  ordenes_90d bigint,
  ticket_promedio numeric,
  canal_preferido text,
  mix_ot_pct numeric,
  mix_copiado_pct numeric,
  riesgo_comercial text,
  full_count bigint,
  avg_ltv numeric,
  total_ltv numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_search_term text := trim(COALESCE(p_search_term, ''));
  v_search_term_normalized text := public.normalize_search_text(p_search_term);
  v_order_by text := '';
  v_sort_item jsonb;
  v_key text;
  v_direction text;
  v_clause text;
BEGIN
  IF p_sort_criteria IS NOT NULL
     AND jsonb_typeof(p_sort_criteria) = 'array'
     AND jsonb_array_length(p_sort_criteria) > 0 THEN

    FOR v_sort_item IN
      SELECT value
      FROM jsonb_array_elements(p_sort_criteria)
    LOOP
      v_key := lower(trim(COALESCE(v_sort_item->>'key', '')));
      v_direction := lower(trim(COALESCE(v_sort_item->>'direction', 'asc')));

      IF v_direction NOT IN ('asc', 'desc') THEN
        v_direction := 'asc';
      END IF;

      v_clause := CASE v_key
        WHEN 'nombre_fantasia' THEN format('lower(f.nombre_fantasia) %s NULLS LAST', upper(v_direction))
        WHEN 'razon_social' THEN format('lower(f.razon_social) %s NULLS LAST', upper(v_direction))
        WHEN 'ltv_total' THEN format('f.ltv_total %s NULLS LAST', upper(v_direction))
        WHEN 'recencia' THEN format('COALESCE(f.dias_sin_comprar, 999999) %s NULLS LAST', upper(v_direction))
        WHEN 'ordenes_90d' THEN format('f.ordenes_90d %s NULLS LAST', upper(v_direction))
        WHEN 'ticket_promedio' THEN format('f.ticket_promedio %s NULLS LAST', upper(v_direction))
        WHEN 'canal_preferido' THEN format('lower(COALESCE(f.canal_preferido, '''')) %s NULLS LAST', upper(v_direction))
        WHEN 'riesgo_comercial' THEN format(
          '(CASE f.riesgo_comercial WHEN ''alto'' THEN 3 WHEN ''medio'' THEN 2 ELSE 1 END) %s NULLS LAST',
          upper(v_direction)
        )
        WHEN 'documento' THEN format(
          'lower(COALESCE(f.tipo_documento, '''') || ''-'' || COALESCE(f.numero_documento, '''')) %s NULLS LAST',
          upper(v_direction)
        )
        WHEN 'status_aprobacion' THEN format('lower(COALESCE(f.status_aprobacion, '''')) %s NULLS LAST', upper(v_direction))
        WHEN 'cuenta_corriente' THEN format('(CASE WHEN f.tiene_cuenta_corriente THEN 1 ELSE 0 END) %s NULLS LAST', upper(v_direction))
        WHEN 'estado' THEN format('(CASE WHEN f.is_active THEN 1 ELSE 0 END) %s NULLS LAST', upper(v_direction))
        ELSE NULL
      END;

      IF v_clause IS NOT NULL THEN
        IF v_order_by <> '' THEN
          v_order_by := v_order_by || ', ';
        END IF;
        v_order_by := v_order_by || v_clause;
      END IF;
    END LOOP;
  END IF;

  IF v_order_by = '' THEN
    v_order_by := CASE p_sort_by
      WHEN 'ltv_desc' THEN 'f.ltv_total DESC NULLS LAST'
      WHEN 'name_asc' THEN 'lower(f.nombre_fantasia) ASC NULLS LAST'
      WHEN 'recency_desc' THEN 'COALESCE(f.dias_sin_comprar, 999999) DESC NULLS LAST'
      WHEN 'frequency_90d_desc' THEN 'f.ordenes_90d DESC NULLS LAST'
      WHEN 'ticket_promedio_desc' THEN 'f.ticket_promedio DESC NULLS LAST'
      ELSE 'f.created_at DESC NULLS LAST'
    END;
  END IF;

  v_order_by := v_order_by || ', f.created_at DESC';

  RETURN QUERY EXECUTE format(
    $SQL$
    WITH movimientos AS (
      SELECT
        ot.cliente_id,
        COALESCE(ot.total, 0)::numeric AS total,
        ot.fecha_creacion AS fecha,
        COALESCE(ot.canal_venta, 'Mostrador')::text AS canal,
        'ot'::text AS tipo
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = $1
        AND ot.estado <> 'cancelada'
        AND ot.cliente_id IS NOT NULL

      UNION ALL

      SELECT
        cc.cliente_id,
        COALESCE(cc.total, 0)::numeric AS total,
        cc.created_at AS fecha,
        'Centro de Copiado'::text AS canal,
        'cc'::text AS tipo
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = $1
        AND cc.estado <> 'cancelada'
        AND cc.cliente_id IS NOT NULL
    ),
    agg_cliente AS (
      SELECT
        m.cliente_id,
        COUNT(*)::bigint AS total_ordenes,
        SUM(m.total)::numeric AS total_vendido,
        MAX(m.fecha) AS ultima_compra,
        COUNT(*) FILTER (WHERE m.fecha >= (now() - interval '90 days'))::bigint AS ordenes_90d,
        SUM(m.total) FILTER (WHERE m.tipo = 'ot')::numeric AS total_ot,
        SUM(m.total) FILTER (WHERE m.tipo = 'cc')::numeric AS total_cc
      FROM movimientos m
      GROUP BY m.cliente_id
    ),
    canal_ranked AS (
      SELECT
        m.cliente_id,
        m.canal,
        COUNT(*)::bigint AS canal_count,
        MAX(m.fecha) AS canal_ultima_fecha,
        ROW_NUMBER() OVER (
          PARTITION BY m.cliente_id
          ORDER BY COUNT(*) DESC, MAX(m.fecha) DESC, m.canal ASC
        ) AS rn
      FROM movimientos m
      GROUP BY m.cliente_id, m.canal
    ),
    enriched AS (
      SELECT
        c.*,
        COALESCE(ac.total_vendido, 0)::numeric AS ltv_total,
        CASE
          WHEN ac.ultima_compra IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - ac.ultima_compra)) / 86400)::integer
        END AS dias_sin_comprar,
        COALESCE(ac.ordenes_90d, 0)::bigint AS ordenes_90d,
        CASE
          WHEN COALESCE(ac.total_ordenes, 0) = 0 THEN 0::numeric
          ELSE (COALESCE(ac.total_vendido, 0) / ac.total_ordenes)::numeric
        END AS ticket_promedio,
        cr.canal::text AS canal_preferido,
        CASE
          WHEN COALESCE(ac.total_vendido, 0) = 0 THEN 0::numeric
          ELSE (COALESCE(ac.total_ot, 0) / ac.total_vendido * 100)::numeric
        END AS mix_ot_pct,
        CASE
          WHEN COALESCE(ac.total_vendido, 0) = 0 THEN 0::numeric
          ELSE (COALESCE(ac.total_cc, 0) / ac.total_vendido * 100)::numeric
        END AS mix_copiado_pct,
        CASE
          WHEN ac.ultima_compra IS NULL THEN 'bajo'
          WHEN floor(extract(epoch FROM (now() - ac.ultima_compra)) / 86400)::integer > 90
            AND COALESCE(ac.ordenes_90d, 0) = 0 THEN 'alto'
          WHEN floor(extract(epoch FROM (now() - ac.ultima_compra)) / 86400)::integer BETWEEN 45 AND 90 THEN 'medio'
          ELSE 'bajo'
        END::text AS riesgo_comercial
      FROM public.clients c
      LEFT JOIN agg_cliente ac ON ac.cliente_id = c.id
      LEFT JOIN canal_ranked cr ON cr.cliente_id = c.id AND cr.rn = 1
      WHERE c.company_id = $1
        AND ($3 IS NULL OR c.is_active = $3)
        AND ($4 IS NULL OR c.tiene_cuenta_corriente = $4)
        AND ($5 IS NULL OR c.status_aprobacion = $5)
        AND (
          $8 = ''
          OR public.normalize_search_text(c.nombre_fantasia) LIKE '%%' || $9 || '%%'
          OR public.normalize_search_text(c.razon_social) LIKE '%%' || $9 || '%%'
          OR c.numero_documento ILIKE '%%' || $8 || '%%'
        )
    ),
    filtered AS (
      SELECT *
      FROM enriched e
      WHERE ($6 IS NULL OR e.riesgo_comercial = $6)
        AND (
          $7 IS NULL
          OR COALESCE(e.dias_sin_comprar, 999999) > $7
        )
    )
    SELECT
      f.id,
      f.company_id,
      f.nombre_fantasia,
      f.razon_social,
      f.tipo_documento,
      f.numero_documento,
      f.whatsapp,
      f.email,
      f.domicilio,
      f.country_id,
      f.province_id,
      f.city_id,
      f.codigo_postal,
      f.tiene_cuenta_corriente,
      f.acuerdo_pago,
      f.dia_cierre_semanal,
      f.dia_cierre_mensual,
      f.usa_ultimo_dia_mes,
      f.dias_vencimiento,
      f.is_active,
      f.created_by,
      f.updated_by,
      f.app_pin,
      f.created_at,
      f.updated_at,
      f.status_aprobacion,
      f.ltv_total,
      f.dias_sin_comprar,
      f.ordenes_90d,
      f.ticket_promedio,
      f.canal_preferido,
      f.mix_ot_pct,
      f.mix_copiado_pct,
      f.riesgo_comercial,
      COUNT(*) OVER() AS full_count,
      AVG(NULLIF(f.ltv_total, 0)) OVER() AS avg_ltv,
      SUM(f.ltv_total) OVER() AS total_ltv
    FROM filtered f
    ORDER BY %s
    LIMIT $10
    OFFSET $11
    $SQL$,
    v_order_by
  )
  USING
    p_company_id,
    p_search_term,
    p_is_active,
    p_has_cuenta_corriente,
    p_status_aprobacion,
    p_riesgo_comercial,
    p_sin_compra_dias,
    v_search_term,
    v_search_term_normalized,
    p_limit,
    p_offset;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_search_ordenes_trabajo(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.fn_search_ordenes_trabajo(
  p_search_term text,
  p_company_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_include_drafts boolean DEFAULT false,
  p_drafts_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  estado text,
  total numeric,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  items_count bigint,
  total_pagado numeric,
  full_count bigint
) AS $$
DECLARE
  v_term text := trim(COALESCE(p_search_term, ''));
  v_term_normalized text := public.normalize_search_text(p_search_term);
  v_term_digits text := regexp_replace(COALESCE(p_search_term, ''), '[^0-9]', '', 'g');
  v_term_alnum text := regexp_replace(v_term_normalized, '[^a-z0-9]', '', 'g');
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.fecha_creacion,
    ot.estado,
    ot.total,
    c.id as cliente_id,
    c.nombre_fantasia as cliente_nombre,
    c.numero_documento as cliente_documento,
    (SELECT count(*) FROM public.ordenes_trabajo_items oti WHERE oti.orden_id = ot.id) as items_count,
    COALESCE((SELECT sum(otp.monto) FROM public.ordenes_trabajo_pagos otp WHERE otp.orden_id = ot.id), 0) as total_pagado,
    COUNT(*) OVER() as full_count
  FROM public.ordenes_trabajo ot
  LEFT JOIN public.clients c ON ot.cliente_id = c.id
  WHERE
    ot.company_id = p_company_id
    AND (
      (p_drafts_only = true AND ot.estado = 'borrador')
      OR (
        p_drafts_only = false
        AND (
          p_include_drafts = true
          OR ot.estado <> 'borrador'
        )
      )
    )
    AND (
      ot.numero_orden ILIKE '%' || v_term || '%'
      OR public.normalize_search_text(COALESCE(c.nombre_fantasia, '')) LIKE '%' || v_term_normalized || '%'
      OR public.normalize_search_text(COALESCE(c.razon_social, '')) LIKE '%' || v_term_normalized || '%'
      OR (
        v_term_digits <> ''
        AND (
          regexp_replace(COALESCE(c.numero_documento, ''), '[^0-9]', '', 'g') LIKE '%' || v_term_digits || '%'
          OR regexp_replace(COALESCE(c.whatsapp, ''), '[^0-9]', '', 'g') LIKE '%' || v_term_digits || '%'
        )
      )
      OR (
        v_term_alnum <> ''
        AND (
          regexp_replace(public.normalize_search_text(COALESCE(c.nombre_fantasia, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_term_alnum || '%'
          OR regexp_replace(public.normalize_search_text(COALESCE(c.razon_social, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_term_alnum || '%'
        )
      )
    )
  ORDER BY ot.fecha_creacion DESC, ot.id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_search_centro_copiado_ordenes(
  p_company_id uuid,
  p_search_term text,
  p_estado text DEFAULT NULL,
  p_estados text[] DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  numero_orden text,
  orden_trabajo_id uuid,
  cliente_id uuid,
  requiere_despacho boolean,
  estado text,
  fecha_solicitud timestamptz,
  fecha_entrega_estimada timestamptz,
  fecha_entrega_real timestamptz,
  total numeric,
  observaciones text,
  requiere_factura boolean,
  numero_factura text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  canal_venta text,
  subtotal numeric,
  total_descuentos numeric,
  cliente_nombre text,
  cliente_documento text,
  created_by_full_name text,
  created_by_avatar_url text,
  items_count bigint,
  full_count bigint
) AS $$
DECLARE
  v_term text := trim(COALESCE(p_search_term, ''));
  v_term_normalized text := public.normalize_search_text(p_search_term);
BEGIN
  RETURN QUERY
  SELECT
    cco.id,
    cco.company_id,
    cco.numero_orden,
    cco.orden_trabajo_id,
    cco.cliente_id,
    cco.requiere_despacho,
    cco.estado::text,
    cco.fecha_solicitud,
    cco.fecha_entrega_estimada,
    cco.fecha_entrega_real,
    cco.total,
    cco.observaciones,
    cco.requiere_factura,
    cco.numero_factura,
    cco.created_by,
    cco.created_at,
    cco.updated_at,
    cco.canal_venta::text,
    cco.subtotal,
    cco.total_descuentos,
    cl.nombre_fantasia AS cliente_nombre,
    cl.numero_documento AS cliente_documento,
    p.full_name AS created_by_full_name,
    p.avatar_url AS created_by_avatar_url,
    (
      SELECT count(*)
      FROM public.centro_copiado_ordenes_items ccoi
      WHERE ccoi.orden_copiado_id = cco.id
    ) AS items_count,
    COUNT(*) OVER() AS full_count
  FROM public.centro_copiado_ordenes cco
  LEFT JOIN public.clients cl ON cco.cliente_id = cl.id
  LEFT JOIN public.profiles p ON cco.created_by = p.id
  WHERE cco.company_id = p_company_id
    AND (p_estado IS NULL OR cco.estado::text = p_estado)
    AND (p_estados IS NULL OR cco.estado::text = ANY(p_estados))
    AND (p_cliente_id IS NULL OR cco.cliente_id = p_cliente_id)
    AND (p_fecha_desde IS NULL OR cco.fecha_solicitud >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR cco.fecha_solicitud <= p_fecha_hasta)
    AND (
      v_term = ''
      OR cco.numero_orden ILIKE '%' || v_term || '%'
      OR COALESCE(cco.observaciones, '') ILIKE '%' || v_term || '%'
      OR public.normalize_search_text(COALESCE(cl.nombre_fantasia, '')) LIKE '%' || v_term_normalized || '%'
      OR public.normalize_search_text(COALESCE(cl.razon_social, '')) LIKE '%' || v_term_normalized || '%'
      OR COALESCE(cl.numero_documento, '') ILIKE '%' || v_term || '%'
    )
  ORDER BY cco.fecha_solicitud ASC, cco.id ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.normalize_search_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_clients_with_ltv(uuid, text, boolean, boolean, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_clients_commercial_metrics(uuid, text, boolean, boolean, text, text, integer, integer, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_search_ordenes_trabajo(text, uuid, int, int, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_search_centro_copiado_ordenes(uuid, text, text, text[], uuid, timestamptz, timestamptz, int, int) TO authenticated;
