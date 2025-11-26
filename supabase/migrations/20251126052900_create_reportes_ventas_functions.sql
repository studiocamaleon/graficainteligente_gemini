/*
  # Funciones para Reportes de Ventas

  ## Descripción
  Funciones SQL optimizadas para generar reportes de ventas con métricas,
  KPIs, análisis temporal, rankings y comparaciones de períodos.

  ## Funciones Creadas

  1. fn_calcular_rango_fechas()
     - Calcula fecha inicio y fin según preset de período

  2. fn_reporte_ventas_kpis()
     - KPIs principales: total ventas, órdenes, ticket promedio, cobrado, pendiente

  3. fn_reporte_ventas_timeline()
     - Serie temporal de ventas con granularidad ajustable

  4. fn_reporte_ventas_por_canal()
     - Distribución de ventas por canal (Web, WhatsApp, Mostrador)

  5. fn_reporte_top_productos()
     - Ranking de productos más vendidos

  ## Seguridad
  - Todas las funciones filtran por company_id
  - SECURITY DEFINER para acceso controlado
  - RLS aplicado a nivel de consulta
*/

-- =====================================================
-- FUNCIÓN: Calcular Rango de Fechas según Preset
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_rango_fechas(
  p_preset text,
  p_fecha_inicio date DEFAULT NULL,
  p_fecha_fin date DEFAULT NULL
)
RETURNS TABLE(
  fecha_inicio date,
  fecha_fin date
) AS $$
BEGIN
  CASE p_preset
    WHEN 'hoy' THEN
      RETURN QUERY SELECT CURRENT_DATE, CURRENT_DATE;

    WHEN 'esta_semana' THEN
      RETURN QUERY SELECT
        date_trunc('week', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'este_mes' THEN
      RETURN QUERY SELECT
        date_trunc('month', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'mes_pasado' THEN
      RETURN QUERY SELECT
        date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;

    WHEN 'ultimos_3_meses' THEN
      RETURN QUERY SELECT
        (CURRENT_DATE - INTERVAL '3 months')::date,
        CURRENT_DATE;

    WHEN 'ultimos_6_meses' THEN
      RETURN QUERY SELECT
        (CURRENT_DATE - INTERVAL '6 months')::date,
        CURRENT_DATE;

    WHEN 'este_anio' THEN
      RETURN QUERY SELECT
        date_trunc('year', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'anio_pasado' THEN
      RETURN QUERY SELECT
        date_trunc('year', CURRENT_DATE - INTERVAL '1 year')::date,
        (date_trunc('year', CURRENT_DATE) - INTERVAL '1 day')::date;

    WHEN 'personalizado' THEN
      RETURN QUERY SELECT
        COALESCE(p_fecha_inicio, CURRENT_DATE),
        COALESCE(p_fecha_fin, CURRENT_DATE);

    ELSE
      RETURN QUERY SELECT CURRENT_DATE, CURRENT_DATE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calcular_rango_fechas IS 'Calcula fecha inicio y fin según preset de período seleccionado';

-- =====================================================
-- FUNCIÓN: KPIs Principales de Ventas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_kpis(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  ticket_promedio numeric,
  total_cobrado numeric,
  saldo_pendiente numeric,
  tasa_conversion numeric,
  total_ventas_anterior numeric,
  total_ordenes_anterior bigint,
  variacion_ventas numeric,
  variacion_ordenes numeric
) AS $$
DECLARE
  v_dias_periodo integer;
  v_fecha_inicio_anterior date;
  v_fecha_fin_anterior date;
BEGIN
  v_dias_periodo := p_fecha_fin - p_fecha_inicio + 1;
  v_fecha_inicio_anterior := p_fecha_inicio - (v_dias_periodo || ' days')::interval;
  v_fecha_fin_anterior := p_fecha_inicio - interval '1 day';

  RETURN QUERY
  WITH periodo_actual AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes,
      COALESCE(AVG(ot.total), 0) AS ticket_promedio,
      COALESCE(SUM(CASE WHEN ot.estado IN ('completado', 'entregada') THEN otp.monto ELSE 0 END), 0) AS total_cobrado,
      COALESCE(SUM(CASE WHEN ot.estado IN ('completado', 'entregada') THEN ot.total ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN ot.estado IN ('completado', 'entregada') THEN otp.monto ELSE 0 END), 0) AS saldo_pendiente,
      CASE
        WHEN COUNT(CASE WHEN ot.estado = 'cotizacion' THEN 1 END) > 0
        THEN (COUNT(CASE WHEN ot.estado NOT IN ('borrador', 'cotizacion', 'cancelado') THEN 1 END)::numeric
              / COUNT(CASE WHEN ot.estado IN ('cotizacion', 'confirmado', 'en_produccion', 'completado', 'entregada') THEN 1 END)::numeric * 100)
        ELSE 0
      END AS tasa_conversion
    FROM ordenes_trabajo ot
    LEFT JOIN (
      SELECT orden_id, SUM(monto) AS monto
      FROM ordenes_trabajo_pagos
      GROUP BY orden_id
    ) otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado != 'cancelado'
  ),
  periodo_anterior AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior
      AND ot.estado != 'cancelado'
  ),
  centro_copiado_actual AS (
    SELECT
      COALESCE(SUM(cc.total), 0) AS total_ventas,
      COUNT(DISTINCT cc.id) AS total_ordenes
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  centro_copiado_anterior AS (
    SELECT
      COALESCE(SUM(cc.total), 0) AS total_ventas,
      COUNT(DISTINCT cc.id) AS total_ordenes
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior
      AND cc.estado != 'cancelada'
  )
  SELECT
    pa.total_ventas + cca.total_ventas AS total_ventas,
    pa.total_ordenes + cca.total_ordenes AS total_ordenes,
    CASE
      WHEN (pa.total_ordenes + cca.total_ordenes) > 0
      THEN (pa.total_ventas + cca.total_ventas) / (pa.total_ordenes + cca.total_ordenes)
      ELSE 0
    END AS ticket_promedio,
    pa.total_cobrado AS total_cobrado,
    pa.saldo_pendiente AS saldo_pendiente,
    pa.tasa_conversion AS tasa_conversion,
    pant.total_ventas + ccant.total_ventas AS total_ventas_anterior,
    pant.total_ordenes + ccant.total_ordenes AS total_ordenes_anterior,
    CASE
      WHEN (pant.total_ventas + ccant.total_ventas) > 0
      THEN ((pa.total_ventas + cca.total_ventas - pant.total_ventas - ccant.total_ventas)
            / (pant.total_ventas + ccant.total_ventas) * 100)
      ELSE 0
    END AS variacion_ventas,
    CASE
      WHEN (pant.total_ordenes + ccant.total_ordenes) > 0
      THEN ((pa.total_ordenes + cca.total_ordenes - pant.total_ordenes - ccant.total_ordenes)::numeric
            / (pant.total_ordenes + ccant.total_ordenes)::numeric * 100)
      ELSE 0
    END AS variacion_ordenes
  FROM periodo_actual pa, periodo_anterior pant,
       centro_copiado_actual cca, centro_copiado_anterior ccant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'Calcula KPIs principales de ventas con comparación de período anterior';

-- =====================================================
-- FUNCIÓN: Timeline de Ventas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_timeline(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_granularidad text DEFAULT 'dia'
)
RETURNS TABLE(
  fecha text,
  total_ventas numeric,
  total_ordenes bigint,
  ticket_promedio numeric
) AS $$
BEGIN
  IF p_granularidad = 'mes' THEN
    RETURN QUERY
    WITH ordenes_trabajo AS (
      SELECT
        to_char(date_trunc('month', ot.fecha_creacion), 'YYYY-MM') AS periodo,
        SUM(ot.total) AS ventas,
        COUNT(ot.id) AS ordenes
      FROM ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND ot.estado != 'cancelado'
      GROUP BY periodo
    ),
    centro_copiado AS (
      SELECT
        to_char(date_trunc('month', cc.fecha_solicitud), 'YYYY-MM') AS periodo,
        SUM(cc.total) AS ventas,
        COUNT(cc.id) AS ordenes
      FROM centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND cc.estado != 'cancelada'
      GROUP BY periodo
    )
    SELECT
      COALESCE(ot.periodo, cc.periodo) AS fecha,
      COALESCE(ot.ventas, 0) + COALESCE(cc.ventas, 0) AS total_ventas,
      COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0) AS total_ordenes,
      CASE
        WHEN COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0) > 0
        THEN (COALESCE(ot.ventas, 0) + COALESCE(cc.ventas, 0)) / (COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0))
        ELSE 0
      END AS ticket_promedio
    FROM ordenes_trabajo ot
    FULL OUTER JOIN centro_copiado cc ON ot.periodo = cc.periodo
    ORDER BY fecha;

  ELSE
    RETURN QUERY
    WITH ordenes_trabajo AS (
      SELECT
        ot.fecha_creacion::date AS fecha,
        SUM(ot.total) AS ventas,
        COUNT(ot.id) AS ordenes
      FROM ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND ot.estado != 'cancelado'
      GROUP BY fecha
    ),
    centro_copiado AS (
      SELECT
        cc.fecha_solicitud::date AS fecha,
        SUM(cc.total) AS ventas,
        COUNT(cc.id) AS ordenes
      FROM centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND cc.estado != 'cancelada'
      GROUP BY fecha
    )
    SELECT
      to_char(COALESCE(ot.fecha, cc.fecha), 'YYYY-MM-DD') AS fecha,
      COALESCE(ot.ventas, 0) + COALESCE(cc.ventas, 0) AS total_ventas,
      COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0) AS total_ordenes,
      CASE
        WHEN COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0) > 0
        THEN (COALESCE(ot.ventas, 0) + COALESCE(cc.ventas, 0)) / (COALESCE(ot.ordenes, 0) + COALESCE(cc.ordenes, 0))
        ELSE 0
      END AS ticket_promedio
    FROM ordenes_trabajo ot
    FULL OUTER JOIN centro_copiado cc ON ot.fecha = cc.fecha
    ORDER BY fecha;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_timeline IS 'Genera serie temporal de ventas con granularidad ajustable';

-- =====================================================
-- FUNCIÓN: Ventas por Canal
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_canal(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  canal text,
  total_ventas numeric,
  total_ordenes bigint,
  porcentaje numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ventas_totales AS (
    SELECT COALESCE(SUM(ot.total), 0) AS total
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado != 'cancelado'
  )
  SELECT
    ot.canal_venta AS canal,
    COALESCE(SUM(ot.total), 0) AS total_ventas,
    COUNT(ot.id) AS total_ordenes,
    CASE
      WHEN vt.total > 0
      THEN (COALESCE(SUM(ot.total), 0) / vt.total * 100)
      ELSE 0
    END AS porcentaje,
    COALESCE(AVG(ot.total), 0) AS ticket_promedio
  FROM ordenes_trabajo ot, ventas_totales vt
  WHERE ot.company_id = p_company_id
    AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
    AND ot.estado != 'cancelado'
  GROUP BY ot.canal_venta, vt.total
  ORDER BY total_ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal de venta';

-- =====================================================
-- FUNCIÓN: Top Productos Más Vendidos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_top_productos(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  producto_nombre text,
  categoria_nombre text,
  total_vendido numeric,
  unidades_vendidas numeric,
  porcentaje numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ventas_totales AS (
    SELECT COALESCE(SUM(oti.precio_total), 0) AS total
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado != 'cancelado'
  )
  SELECT
    oti.producto_nombre AS producto_nombre,
    oti.producto_categoria AS categoria_nombre,
    COALESCE(SUM(oti.precio_total), 0) AS total_vendido,
    COALESCE(SUM(oti.cantidad), 0) AS unidades_vendidas,
    CASE
      WHEN vt.total > 0
      THEN (COALESCE(SUM(oti.precio_total), 0) / vt.total * 100)
      ELSE 0
    END AS porcentaje,
    COALESCE(AVG(oti.precio_unitario_final), 0) AS ticket_promedio
  FROM ordenes_trabajo ot
  JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id, ventas_totales vt
  WHERE ot.company_id = p_company_id
    AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
    AND ot.estado != 'cancelado'
  GROUP BY oti.producto_nombre, oti.producto_categoria, vt.total
  ORDER BY total_vendido DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_top_productos IS 'Ranking de productos más vendidos por facturación';

-- Crear índices para optimizar las consultas de reportes
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_reporte_ventas
  ON ordenes_trabajo(company_id, fecha_creacion, estado);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_reporte_ventas
  ON centro_copiado_ordenes(company_id, fecha_solicitud, estado);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_producto
  ON ordenes_trabajo_items(orden_id, producto_nombre, producto_categoria);
