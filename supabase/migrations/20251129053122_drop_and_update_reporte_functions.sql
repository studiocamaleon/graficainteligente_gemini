/*
  # Drop y Actualización de Funciones de Reportes

  ## Descripción
  Primero elimina las funciones existentes para permitir cambios en sus firmas,
  luego las recrea con las mejoras necesarias.

  ## Cambios
  1. Drop de funciones existentes
  2. Recreación con nuevas firmas y lógica mejorada
*/

-- =====================================================
-- DROP FUNCIONES EXISTENTES
-- =====================================================

DROP FUNCTION IF EXISTS fn_reporte_ventas_kpis(uuid, date, date);
DROP FUNCTION IF EXISTS fn_reporte_ventas_por_canal(uuid, date, date);
DROP FUNCTION IF EXISTS fn_reporte_ventas_timeline(uuid, date, date, text);

-- =====================================================
-- RECREAR: KPIs con Tasa de Cobro
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
  tasa_cobro numeric,
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
        - COALESCE(SUM(CASE WHEN ot.estado IN ('completado', 'entregada') THEN otp.monto ELSE 0 END), 0) AS saldo_pendiente
    FROM ordenes_trabajo ot
    LEFT JOIN (
      SELECT orden_id, SUM(monto) AS monto
      FROM ordenes_trabajo_pagos
      GROUP BY orden_id
    ) otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  periodo_anterior AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  centro_copiado_actual AS (
    SELECT
      COALESCE(SUM(cc.total), 0) AS total_ventas,
      COUNT(DISTINCT cc.id) AS total_ordenes,
      COALESCE(SUM(ccp.monto), 0) AS total_cobrado_cc
    FROM centro_copiado_ordenes cc
    LEFT JOIN (
      SELECT orden_copiado_id, SUM(monto) AS monto
      FROM centro_copiado_ordenes_pagos
      GROUP BY orden_copiado_id
    ) ccp ON cc.id = ccp.orden_copiado_id
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
  ),
  tasa_cobro_calc AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS ventas_sin_cc,
      COALESCE(SUM(otp.monto), 0) AS cobrado_sin_cc
    FROM ordenes_trabajo ot
    LEFT JOIN (
      SELECT orden_id, SUM(monto) AS monto
      FROM ordenes_trabajo_pagos
      GROUP BY orden_id
    ) otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.client_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = ot.client_id 
        AND cl.tiene_cuenta_corriente = true
      ))
  )
  SELECT
    pa.total_ventas + cca.total_ventas AS total_ventas,
    pa.total_ordenes + cca.total_ordenes AS total_ordenes,
    CASE
      WHEN (pa.total_ordenes + cca.total_ordenes) > 0
      THEN (pa.total_ventas + cca.total_ventas) / (pa.total_ordenes + cca.total_ordenes)
      ELSE 0
    END AS ticket_promedio,
    pa.total_cobrado + cca.total_cobrado_cc AS total_cobrado,
    pa.saldo_pendiente + (cca.total_ventas - cca.total_cobrado_cc) AS saldo_pendiente,
    CASE
      WHEN tc.ventas_sin_cc > 0 THEN (tc.cobrado_sin_cc / tc.ventas_sin_cc * 100)
      ELSE 0
    END AS tasa_cobro,
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
            / (pant.total_ordenes + ccant.total_ordenes) * 100)
      ELSE 0
    END AS variacion_ordenes
  FROM periodo_actual pa
  CROSS JOIN periodo_anterior pant
  CROSS JOIN centro_copiado_actual cca
  CROSS JOIN centro_copiado_anterior ccant
  CROSS JOIN tasa_cobro_calc tc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECREAR: Ventas por Canal con Cantidades
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
  ordenes_trabajo bigint,
  ordenes_copiado bigint,
  porcentaje_ventas numeric,
  porcentaje_ordenes numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_canal AS (
    SELECT
      COALESCE(ot.origen, 'Mostrador') AS canal,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      COALESCE(cc.origen, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_canales AS (
    SELECT
      canal,
      SUM(monto) AS ventas,
      COUNT(*) AS ordenes,
      COUNT(CASE WHEN tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
      COUNT(CASE WHEN tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
    FROM ordenes_por_canal
    GROUP BY canal
  ),
  totales AS (
    SELECT
      SUM(ventas) AS total_ventas,
      SUM(ordenes) AS total_ordenes
    FROM resumen_canales
  )
  SELECT
    rc.canal,
    rc.ventas,
    rc.ordenes,
    rc.ordenes_trabajo,
    rc.ordenes_copiado,
    CASE
      WHEN t.total_ventas > 0 THEN (rc.ventas / t.total_ventas * 100)
      ELSE 0
    END AS porcentaje_ventas,
    CASE
      WHEN t.total_ordenes > 0 THEN (rc.ordenes::numeric / t.total_ordenes * 100)
      ELSE 0
    END AS porcentaje_ordenes,
    CASE
      WHEN rc.ordenes > 0 THEN rc.ventas / rc.ordenes
      ELSE 0
    END AS ticket_promedio
  FROM resumen_canales rc
  CROSS JOIN totales t
  ORDER BY rc.ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECREAR: Timeline con Separación de Órdenes
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
  ordenes_trabajo bigint,
  ordenes_copiado bigint,
  ticket_promedio numeric
) AS $$
DECLARE
  v_formato_fecha text;
  v_trunc_periodo text;
BEGIN
  CASE p_granularidad
    WHEN 'hora' THEN
      v_formato_fecha := 'YYYY-MM-DD HH24:00';
      v_trunc_periodo := 'hour';
    WHEN 'dia' THEN
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
    WHEN 'semana' THEN
      v_formato_fecha := 'YYYY-WW';
      v_trunc_periodo := 'week';
    WHEN 'mes' THEN
      v_formato_fecha := 'YYYY-MM';
      v_trunc_periodo := 'month';
    ELSE
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
  END CASE;

  RETURN QUERY
  EXECUTE format($query$
    WITH ordenes_timeline AS (
      SELECT
        date_trunc(%L, ot.fecha_creacion)::date AS periodo,
        ot.total AS monto,
        'trabajo' AS tipo_orden
      FROM ordenes_trabajo ot
      WHERE ot.company_id = %L
        AND ot.fecha_creacion::date BETWEEN %L AND %L
        AND ot.estado NOT IN ('cancelado', 'borrador')
      UNION ALL
      SELECT
        date_trunc(%L, cc.fecha_solicitud)::date AS periodo,
        cc.total AS monto,
        'copiado' AS tipo_orden
      FROM centro_copiado_ordenes cc
      WHERE cc.company_id = %L
        AND cc.fecha_solicitud::date BETWEEN %L AND %L
        AND cc.estado != 'cancelada'
    ),
    resumen_timeline AS (
      SELECT
        to_char(periodo, %L) AS fecha,
        SUM(monto) AS ventas,
        COUNT(*) AS ordenes,
        COUNT(CASE WHEN tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
        COUNT(CASE WHEN tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
      FROM ordenes_timeline
      GROUP BY periodo
    )
    SELECT
      fecha,
      ventas,
      ordenes,
      ordenes_trabajo,
      ordenes_copiado,
      CASE
        WHEN ordenes > 0 THEN ventas / ordenes
        ELSE 0
      END AS ticket_promedio
    FROM resumen_timeline
    ORDER BY fecha
  $query$,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_formato_fecha
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
