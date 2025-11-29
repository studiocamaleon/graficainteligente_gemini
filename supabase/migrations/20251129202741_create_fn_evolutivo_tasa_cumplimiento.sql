/*
  # Función: Evolutivo de Tasa de Cumplimiento

  ## Descripción
  Esta función calcula la evolución de la tasa de cumplimiento en el tiempo,
  agrupada por día, semana o mes. Permite visualizar tendencias y cambios
  en la tasa de cumplimiento a lo largo del tiempo.

  ## Función Creada
  - `fn_evolutivo_tasa_cumplimiento` - Evolución temporal de tasa de cumplimiento

  ## Parámetros
  - `p_company_id` (uuid) - ID de la empresa
  - `p_fecha_desde` (timestamptz) - Fecha inicio del rango
  - `p_fecha_hasta` (timestamptz) - Fecha fin del rango
  - `p_intervalo` (text) - Intervalo de agrupación: 'day', 'week', 'month'

  ## Retorna
  - `periodo` - Fecha del inicio del periodo
  - `periodo_label` - Label legible del periodo
  - `total_ordenes` - Total de órdenes en el periodo
  - `ordenes_a_tiempo` - Órdenes a tiempo en el periodo
  - `ordenes_retrasadas` - Órdenes retrasadas en el periodo
  - `tasa_cumplimiento` - Porcentaje del periodo
  - `tendencia` - 'up', 'down', 'neutral' comparado con periodo anterior

  ## Uso
  - Graficar evolución de la tasa
  - Identificar periodos problemáticos
  - Analizar mejoras o deterioros en el tiempo
*/

-- =====================================================
-- FUNCIÓN: fn_evolutivo_tasa_cumplimiento
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
      DATE_TRUNC(p_intervalo, fecha_completado) AS periodo,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE DATE(fecha_completado) <= DATE(fecha_estimada_entrega)) AS a_tiempo,
      COUNT(*) FILTER (WHERE DATE(fecha_completado) > DATE(fecha_estimada_entrega)) AS retrasadas,
      CASE
        WHEN COUNT(*) = 0 THEN 0::numeric
        ELSE ROUND((COUNT(*) FILTER (WHERE DATE(fecha_completado) <= DATE(fecha_estimada_entrega))::numeric 
               / COUNT(*)::numeric * 100), 2)
      END AS tasa
    FROM ordenes_trabajo
    WHERE company_id = p_company_id
      AND estado IN ('finalizada', 'entregada')
      AND fecha_completado IS NOT NULL
      AND fecha_estimada_entrega IS NOT NULL
      AND fecha_completado >= p_fecha_desde
      AND fecha_completado <= p_fecha_hasta
    GROUP BY DATE_TRUNC(p_intervalo, fecha_completado)
    ORDER BY DATE_TRUNC(p_intervalo, fecha_completado) ASC
  ),
  periodos_con_tendencia AS (
    SELECT
      periodo,
      total,
      a_tiempo,
      retrasadas,
      tasa,
      LAG(tasa) OVER (ORDER BY periodo) AS tasa_anterior
    FROM periodos_data
  )
  SELECT
    periodo,
    CASE 
      WHEN p_intervalo = 'day' THEN TO_CHAR(periodo, 'DD/MM/YYYY')
      WHEN p_intervalo = 'week' THEN 'Semana ' || TO_CHAR(periodo, 'IW, YYYY')
      WHEN p_intervalo = 'month' THEN TO_CHAR(periodo, 'Month YYYY')
      ELSE TO_CHAR(periodo, 'DD/MM/YYYY')
    END AS periodo_label,
    total::bigint AS total_ordenes,
    a_tiempo::bigint AS ordenes_a_tiempo,
    retrasadas::bigint AS ordenes_retrasadas,
    tasa AS tasa_cumplimiento,
    CASE
      WHEN tasa_anterior IS NULL THEN 'neutral'
      WHEN tasa > tasa_anterior THEN 'up'
      WHEN tasa < tasa_anterior THEN 'down'
      ELSE 'neutral'
    END AS tendencia
  FROM periodos_con_tendencia;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario descriptivo de la función
COMMENT ON FUNCTION fn_evolutivo_tasa_cumplimiento IS
'Calcula la evolución de la tasa de cumplimiento en el tiempo, agrupada por día, semana o mes. Útil para detectar tendencias y periodos problemáticos.';
