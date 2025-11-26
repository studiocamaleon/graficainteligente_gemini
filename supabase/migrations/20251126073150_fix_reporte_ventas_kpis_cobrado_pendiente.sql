/*
  # Corrección: Cálculo de Total Cobrado y Saldo Pendiente en Reportes

  ## Problema Identificado

  La función `fn_reporte_ventas_kpis` calculaba incorrectamente las métricas
  "Total Cobrado" y "Saldo Pendiente" porque:

  1. Solo consideraba pagos de órdenes en estado 'completado' o 'entregada'
  2. Ignoraba pagos adelantados y parciales de órdenes en otros estados válidos
  3. No reflejaba la realidad financiera del negocio

  ## Solución Implementada

  ### Cambios Realizados

  1. **Total Cobrado:**
     - ANTES: `SUM(CASE WHEN estado IN ('completado', 'entregada') THEN otp.monto ELSE 0 END)`
     - DESPUÉS: `SUM(otp.monto)`
     - Ahora suma TODOS los pagos registrados, sin importar el estado de la orden

  2. **Saldo Pendiente:**
     - ANTES: `SUM(CASE ... total) - SUM(CASE ... monto)`
     - DESPUÉS: `SUM(ot.total) - SUM(otp.monto)`
     - Calcula correctamente: Total Facturado - Total Cobrado

  ## Escenarios Cubiertos

  - ✅ Órdenes completamente pagadas
  - ✅ Órdenes con pagos parciales en cualquier estado
  - ✅ Órdenes con pagos adelantados (seña, anticipo)
  - ✅ Órdenes en proceso con pagos registrados
  - ✅ Órdenes pendientes con adelantos
  - ✅ Múltiples pagos por orden

  ## Impacto

  - Sin cambios en estructura de datos
  - Sin cambios en código frontend
  - Corrección transparente para el usuario
  - Refleja realidad financiera del negocio
*/

-- =====================================================
-- FUNCIÓN CORREGIDA: KPIs Principales de Ventas
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
      -- ✅ CORREGIDO: Suma TODOS los pagos sin filtrar por estado
      COALESCE(SUM(otp.monto), 0) AS total_cobrado,
      -- ✅ CORREGIDO: Total facturado - Total cobrado (sin filtros de estado)
      COALESCE(SUM(ot.total), 0) - COALESCE(SUM(otp.monto), 0) AS saldo_pendiente,
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

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'Calcula KPIs principales de ventas con cálculo corregido de cobrado y pendiente (incluye pagos de todos los estados)';