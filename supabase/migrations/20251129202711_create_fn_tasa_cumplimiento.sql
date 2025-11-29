/*
  # Función: Calcular Tasa de Cumplimiento

  ## Descripción
  Esta función calcula la tasa de cumplimiento de entregas, que mide el porcentaje
  de órdenes que se completaron antes o en la fecha estimada de entrega.

  ## Función Creada
  - `fn_tasa_cumplimiento` - Calcula métricas de cumplimiento de entregas

  ## Parámetros
  - `p_company_id` (uuid) - ID de la empresa
  - `p_fecha_desde` (timestamptz) - Fecha inicio del rango (opcional)
  - `p_fecha_hasta` (timestamptz) - Fecha fin del rango (opcional)

  ## Retorna
  - `total_ordenes_evaluadas` - Total de órdenes con fecha estimada y completado
  - `ordenes_a_tiempo` - Órdenes completadas antes o en fecha estimada
  - `ordenes_retrasadas` - Órdenes completadas después de fecha estimada
  - `tasa_cumplimiento` - Porcentaje de cumplimiento (0-100)
  - `promedio_dias_adelanto` - Promedio de días de adelanto (cuando es negativo)
  - `promedio_dias_retraso` - Promedio de días de retraso (cuando es positivo)
  - `ordenes_sin_fecha_estimada` - Órdenes sin fecha estimada (no evaluadas)

  ## Lógica
  - Una orden está "a tiempo" si: DATE(fecha_completado) <= DATE(fecha_estimada_entrega)
  - Solo evalúa órdenes en estado 'finalizada' o 'entregada'
  - Solo evalúa órdenes con fecha_completado y fecha_estimada_entrega NOT NULL
  - Usa comparación por día (sin horas) para que el mismo día cuente como a tiempo

  ## Meta
  - Objetivo: Mantener tasa >= 95%
  - Aceptable: 85-94%
  - Crítico: < 85%
*/

-- =====================================================
-- FUNCIÓN: fn_tasa_cumplimiento
-- =====================================================

CREATE OR REPLACE FUNCTION fn_tasa_cumplimiento(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_ordenes_evaluadas bigint,
  ordenes_a_tiempo bigint,
  ordenes_retrasadas bigint,
  tasa_cumplimiento numeric,
  promedio_dias_adelanto numeric,
  promedio_dias_retraso numeric,
  ordenes_sin_fecha_estimada bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_evaluadas AS (
    SELECT
      id,
      fecha_completado,
      fecha_estimada_entrega,
      DATE(fecha_completado) - DATE(fecha_estimada_entrega) AS dias_diferencia
    FROM ordenes_trabajo
    WHERE company_id = p_company_id
      AND estado IN ('finalizada', 'entregada')
      AND fecha_completado IS NOT NULL
      AND fecha_estimada_entrega IS NOT NULL
      AND (p_fecha_desde IS NULL OR fecha_completado >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR fecha_completado <= p_fecha_hasta)
  ),
  ordenes_sin_fecha AS (
    SELECT COUNT(*) AS total_sin_fecha
    FROM ordenes_trabajo
    WHERE company_id = p_company_id
      AND estado IN ('finalizada', 'entregada')
      AND fecha_completado IS NOT NULL
      AND fecha_estimada_entrega IS NULL
      AND (p_fecha_desde IS NULL OR fecha_completado >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR fecha_completado <= p_fecha_hasta)
  )
  SELECT
    COUNT(*)::bigint AS total_ordenes_evaluadas,
    COUNT(*) FILTER (WHERE dias_diferencia <= 0)::bigint AS ordenes_a_tiempo,
    COUNT(*) FILTER (WHERE dias_diferencia > 0)::bigint AS ordenes_retrasadas,
    CASE
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE ROUND((COUNT(*) FILTER (WHERE dias_diferencia <= 0)::numeric / COUNT(*)::numeric * 100), 2)
    END AS tasa_cumplimiento,
    COALESCE(ROUND(AVG(ABS(dias_diferencia)) FILTER (WHERE dias_diferencia < 0)::numeric, 2), 0) AS promedio_dias_adelanto,
    COALESCE(ROUND(AVG(dias_diferencia) FILTER (WHERE dias_diferencia > 0)::numeric, 2), 0) AS promedio_dias_retraso,
    (SELECT total_sin_fecha FROM ordenes_sin_fecha)::bigint AS ordenes_sin_fecha_estimada
  FROM ordenes_evaluadas;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario descriptivo de la función
COMMENT ON FUNCTION fn_tasa_cumplimiento IS
'Calcula la tasa de cumplimiento de entregas: porcentaje de órdenes completadas antes o en la fecha estimada de entrega. Meta: >= 95%';

-- =====================================================
-- ÍNDICE ADICIONAL PARA OPTIMIZAR QUERIES
-- =====================================================

-- Índice para mejorar performance de consultas con fecha_estimada_entrega
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha_estimada_entrega
ON ordenes_trabajo(fecha_estimada_entrega)
WHERE fecha_estimada_entrega IS NOT NULL;

-- Índice compuesto para queries comunes de tasa de cumplimiento
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_estado_fechas_cumplimiento
ON ordenes_trabajo(company_id, estado, fecha_completado, fecha_estimada_entrega)
WHERE estado IN ('finalizada', 'entregada')
  AND fecha_completado IS NOT NULL;
