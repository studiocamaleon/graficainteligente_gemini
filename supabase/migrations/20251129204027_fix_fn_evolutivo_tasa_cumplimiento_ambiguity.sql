/*
  # Fix: Corregir ambigüedad en fn_evolutivo_tasa_cumplimiento

  ## Descripción
  Esta migración corrige el error de ambigüedad en la columna "periodo" 
  de la función fn_evolutivo_tasa_cumplimiento. El error ocurría porque 
  la columna "periodo" no estaba calificada correctamente en los CTEs 
  y causaba conflictos con variables o parámetros del mismo nombre.

  ## Cambios Realizados
  - Calificación explícita de todas las referencias a columnas en los CTEs
  - Uso de alias de tabla para eliminar ambigüedades
  - Corrección del ORDER BY en la función LAG

  ## Error Corregido
  - PostgreSQL Error 42702: "column reference 'periodo' is ambiguous"
*/

-- =====================================================
-- FUNCIÓN: fn_evolutivo_tasa_cumplimiento (CORREGIDA)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_evolutivo_tasa_cumplimiento(
  p_company_id uuid,
  p_fecha_desde timestamptz,
  p_fecha_hasta timestamptz,
  p_intervalo text DEFAULT 'week'
)
RETURNS TABLE (
  periodo timestamptz,
  periodo_label text,
  total_ordenes bigint,
  ordenes_a_tiempo bigint,
  ordenes_retrasadas bigint,
  tasa_cumplimiento numeric,
  tendencia text
) AS $$
BEGIN
  RETURN QUERY
  WITH periodos_data AS (
    SELECT
      DATE_TRUNC(p_intervalo, ot.fecha_completado) AS periodo,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) <= DATE(ot.fecha_estimada_entrega)) AS a_tiempo,
      COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) > DATE(ot.fecha_estimada_entrega)) AS retrasadas,
      CASE
        WHEN COUNT(*) = 0 THEN 0::numeric
        ELSE ROUND((COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) <= DATE(ot.fecha_estimada_entrega))::numeric 
               / COUNT(*)::numeric * 100), 2)
      END AS tasa
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado IN ('finalizada', 'entregada')
      AND ot.fecha_completado IS NOT NULL
      AND ot.fecha_estimada_entrega IS NOT NULL
      AND ot.fecha_completado >= p_fecha_desde
      AND ot.fecha_completado <= p_fecha_hasta
    GROUP BY DATE_TRUNC(p_intervalo, ot.fecha_completado)
    ORDER BY DATE_TRUNC(p_intervalo, ot.fecha_completado) ASC
  ),
  periodos_con_tendencia AS (
    SELECT
      pd.periodo,
      pd.total,
      pd.a_tiempo,
      pd.retrasadas,
      pd.tasa,
      LAG(pd.tasa) OVER (ORDER BY pd.periodo) AS tasa_anterior
    FROM periodos_data pd
  )
  SELECT
    pct.periodo,
    CASE 
      WHEN p_intervalo = 'day' THEN TO_CHAR(pct.periodo, 'DD/MM/YYYY')
      WHEN p_intervalo = 'week' THEN 'Semana ' || TO_CHAR(pct.periodo, 'IW, YYYY')
      WHEN p_intervalo = 'month' THEN TO_CHAR(pct.periodo, 'Month YYYY')
      ELSE TO_CHAR(pct.periodo, 'DD/MM/YYYY')
    END AS periodo_label,
    pct.total::bigint AS total_ordenes,
    pct.a_tiempo::bigint AS ordenes_a_tiempo,
    pct.retrasadas::bigint AS ordenes_retrasadas,
    pct.tasa AS tasa_cumplimiento,
    CASE
      WHEN pct.tasa_anterior IS NULL THEN 'neutral'
      WHEN pct.tasa > pct.tasa_anterior THEN 'up'
      WHEN pct.tasa < pct.tasa_anterior THEN 'down'
      ELSE 'neutral'
    END AS tendencia
  FROM periodos_con_tendencia pct;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario descriptivo de la función
COMMENT ON FUNCTION fn_evolutivo_tasa_cumplimiento IS
'Calcula la evolución de la tasa de cumplimiento en el tiempo, agrupada por día, semana o mes. Útil para detectar tendencias y periodos problemáticos. (Versión corregida sin ambigüedades)';
