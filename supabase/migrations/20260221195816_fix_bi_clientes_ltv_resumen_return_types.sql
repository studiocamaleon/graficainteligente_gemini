-- Fix return type mismatch on fn_bi_clientes_ltv_resumen_v2
-- percentile_cont returns double precision; cast to numeric to match function signature.

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
    SELECT ot.cliente_id, ot.total AS monto
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.cliente_id IS NOT NULL
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')

    UNION ALL

    SELECT cc.cliente_id, cc.total AS monto
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
    COALESCE(AVG(r.ltv_total), 0)::numeric AS ltv_promedio,
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.ltv_total), 0)::numeric AS ltv_mediano,
    COUNT(*)::bigint AS clientes_con_compras
  FROM resumen_cliente r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_clientes_ltv_resumen_v2(uuid) TO authenticated;
