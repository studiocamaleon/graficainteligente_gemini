-- Ajuste de riesgo comercial: clientes sin historial de órdenes no deben quedar en riesgo alto.
-- Nueva regla: si no tienen ultima_compra, riesgo = 'bajo'.

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
  p_sin_compra_dias integer DEFAULT NULL
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
BEGIN
  RETURN QUERY
  WITH movimientos AS (
    SELECT
      ot.cliente_id,
      COALESCE(ot.total, 0)::numeric AS total,
      ot.fecha_creacion AS fecha,
      COALESCE(ot.canal_venta, 'Mostrador')::text AS canal,
      'ot'::text AS tipo
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
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
    WHERE cc.company_id = p_company_id
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
    WHERE c.company_id = p_company_id
      AND (p_is_active IS NULL OR c.is_active = p_is_active)
      AND (p_has_cuenta_corriente IS NULL OR c.tiene_cuenta_corriente = p_has_cuenta_corriente)
      AND (p_status_aprobacion IS NULL OR c.status_aprobacion = p_status_aprobacion)
      AND (
        v_search_term = ''
        OR c.nombre_fantasia ILIKE '%' || v_search_term || '%'
        OR c.razon_social ILIKE '%' || v_search_term || '%'
        OR c.numero_documento ILIKE '%' || v_search_term || '%'
      )
  ),
  filtered AS (
    SELECT *
    FROM enriched e
    WHERE (p_riesgo_comercial IS NULL OR e.riesgo_comercial = p_riesgo_comercial)
      AND (
        p_sin_compra_dias IS NULL
        OR COALESCE(e.dias_sin_comprar, 999999) > p_sin_compra_dias
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
  ORDER BY
    CASE WHEN p_sort_by = 'ltv_desc' THEN f.ltv_total END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'name_asc' THEN lower(f.nombre_fantasia) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'recency_desc' THEN COALESCE(f.dias_sin_comprar, 999999) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'frequency_90d_desc' THEN f.ordenes_90d END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'ticket_promedio_desc' THEN f.ticket_promedio END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at_desc' THEN f.created_at END DESC NULLS LAST,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
