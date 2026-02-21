-- BI v2: LTV metrics for Clientes tab

DROP FUNCTION IF EXISTS public.fn_bi_clientes_ltv_resumen_v2(uuid);
CREATE OR REPLACE FUNCTION public.fn_bi_clientes_ltv_resumen_v2(
  p_company_id uuid
)
RETURNS TABLE(
  ltv_promedio numeric,
  ltv_mediano numeric,
  clientes_con_compras bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ventas_historicas AS (
    SELECT
      ot.cliente_id,
      ot.total AS monto
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.cliente_id IS NOT NULL
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')

    UNION ALL

    SELECT
      cc.cliente_id,
      cc.total AS monto
    FROM public.centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.cliente_id IS NOT NULL
      AND cc.orden_trabajo_id IS NULL
      AND cc.estado NOT IN ('cancelada', 'cancelado', 'borrador')
  ),
  resumen_cliente AS (
    SELECT
      v.cliente_id,
      SUM(v.monto) AS ltv_total
    FROM ventas_historicas v
    GROUP BY v.cliente_id
  )
  SELECT
    COALESCE(AVG(r.ltv_total), 0) AS ltv_promedio,
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.ltv_total), 0) AS ltv_mediano,
    COUNT(*)::bigint AS clientes_con_compras
  FROM resumen_cliente r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_clientes_ltv_resumen_v2(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_clientes_top_ltv_v2(uuid, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_clientes_top_ltv_v2(
  p_company_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  cliente_id uuid,
  cliente_nombre text,
  ltv_total numeric,
  total_ordenes bigint,
  ticket_promedio numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ventas_historicas AS (
    SELECT
      ot.cliente_id,
      ot.total AS monto
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.cliente_id IS NOT NULL
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')

    UNION ALL

    SELECT
      cc.cliente_id,
      cc.total AS monto
    FROM public.centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.cliente_id IS NOT NULL
      AND cc.orden_trabajo_id IS NULL
      AND cc.estado NOT IN ('cancelada', 'cancelado', 'borrador')
  ),
  resumen_cliente AS (
    SELECT
      v.cliente_id,
      COUNT(*)::bigint AS total_ordenes,
      SUM(v.monto) AS ltv_total
    FROM ventas_historicas v
    GROUP BY v.cliente_id
  )
  SELECT
    r.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social, 'Cliente sin nombre') AS cliente_nombre,
    COALESCE(r.ltv_total, 0) AS ltv_total,
    r.total_ordenes,
    CASE WHEN r.total_ordenes > 0 THEN r.ltv_total / r.total_ordenes ELSE 0 END AS ticket_promedio
  FROM resumen_cliente r
  LEFT JOIN public.clients c ON c.id = r.cliente_id
  ORDER BY r.ltv_total DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_clientes_top_ltv_v2(uuid, integer) TO authenticated;
