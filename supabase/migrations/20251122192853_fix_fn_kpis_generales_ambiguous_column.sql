/*
  # Fix ambiguous column reference in fn_kpis_generales

  ## Problem
  The function fn_kpis_generales had an ambiguous column reference error:
  "column reference 'total_pasos_completados' is ambiguous"

  ## Solution
  Added explicit aliases to all CTE column references in the final SELECT
  to eliminate ambiguity. Changed column names in CTEs to be more explicit.

  ## Changes
  - Modified operario_top CTE to use more explicit column name
  - Updated final SELECT to use explicit CTE aliases
  - Ensured no column name conflicts between CTEs
*/

-- Drop and recreate the function with fixed column references
CREATE OR REPLACE FUNCTION fn_kpis_generales(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_ordenes_completadas bigint,
  total_items_completados bigint,
  total_pasos_completados bigint,
  horas_promedio_por_orden numeric,
  minutos_promedio_por_item numeric,
  minutos_promedio_por_paso numeric,
  total_horas_produccion numeric,
  paso_mas_lento text,
  paso_mas_lento_minutos numeric,
  operario_mas_productivo text,
  operario_pasos_completados bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT oti.orden_id)::bigint as total_ordenes,
      COUNT(DISTINCT r.orden_item_id)::bigint as total_items,
      COUNT(*)::bigint as total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as total_minutos
    FROM ordenes_trabajo_items_rutas r
    JOIN ordenes_trabajo_items oti ON oti.id = r.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  ),
  paso_lento AS (
    SELECT
      paso_nombre as pl_paso_nombre,
      minutos_promedio as pl_minutos_promedio
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta)
    ORDER BY minutos_promedio DESC
    LIMIT 1
  ),
  operario_top AS (
    SELECT
      operario_nombre as op_nombre,
      total_pasos_completados as op_total_pasos
    FROM fn_metricas_por_operario(p_company_id, p_fecha_desde, p_fecha_hasta)
    ORDER BY total_pasos_completados DESC
    LIMIT 1
  )
  SELECT
    s.total_ordenes,
    s.total_items,
    s.total_pasos,
    ROUND((s.total_minutos / 60.0 / NULLIF(s.total_ordenes, 0))::numeric, 2) as horas_promedio_por_orden,
    ROUND((s.total_minutos / NULLIF(s.total_items, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((s.total_minutos / NULLIF(s.total_pasos, 0))::numeric, 2) as minutos_promedio_por_paso,
    ROUND((s.total_minutos / 60.0)::numeric, 2) as total_horas_produccion,
    COALESCE(pl.pl_paso_nombre, 'N/A') as paso_mas_lento,
    COALESCE(pl.pl_minutos_promedio, 0) as paso_mas_lento_minutos,
    COALESCE(ot.op_nombre, 'N/A') as operario_mas_productivo,
    COALESCE(ot.op_total_pasos, 0) as operario_pasos_completados
  FROM stats s
  LEFT JOIN paso_lento pl ON true
  LEFT JOIN operario_top ot ON true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_kpis_generales IS 'Retorna KPIs principales para el dashboard de productividad (fixed ambiguous columns)';
