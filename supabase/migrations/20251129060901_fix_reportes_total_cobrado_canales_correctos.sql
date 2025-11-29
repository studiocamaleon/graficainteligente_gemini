/*
  # Fix: Corrección de Total Cobrado y Canales en Reportes

  ## Descripción
  Corrige tres problemas en los reportes financieros:
  1. Total Cobrado mostrando $0 - Simplifica la query de pagos
  2. "Centro de Copiado" apareciendo como canal - Debe usar canal real (Mostrador/WhatsApp/Web)
  3. Asegura que centro_copiado use el canal de orden_trabajo vinculada o 'Mostrador' por defecto

  ## Cambios
  - Simplifica fn_reporte_ventas_kpis para cálculo directo de pagos
  - Modifica fn_reporte_ventas_por_canal para eliminar "Centro de Copiado" como canal
  - Las órdenes de centro copiado heredan el canal de la orden de trabajo vinculada
*/

-- =====================================================
-- FIX 1: Simplificar cálculo de Total Cobrado en KPIs
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
  -- Calcular período anterior
  v_dias_periodo := p_fecha_fin - p_fecha_inicio;
  v_fecha_fin_anterior := p_fecha_inicio - 1;
  v_fecha_inicio_anterior := v_fecha_fin_anterior - v_dias_periodo;

  RETURN QUERY
  WITH periodo_actual AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes,
      COALESCE(AVG(ot.total), 0) AS ticket_promedio
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  pagos_periodo_actual AS (
    SELECT
      COALESCE(SUM(otp.monto), 0) AS total_cobrado_ot
    FROM ordenes_trabajo_pagos otp
    JOIN ordenes_trabajo ot ON ot.id = otp.orden_id
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
      COUNT(DISTINCT cc.id) AS total_ordenes
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  pagos_copiado_actual AS (
    SELECT
      COALESCE(SUM(ccp.monto), 0) AS total_cobrado_cc
    FROM centro_copiado_ordenes_pagos ccp
    JOIN centro_copiado_ordenes cc ON cc.id = ccp.orden_copiado_id
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
    LEFT JOIN ordenes_trabajo_pagos otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.cliente_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = ot.cliente_id 
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
    ppa.total_cobrado_ot + pca.total_cobrado_cc AS total_cobrado,
    (pa.total_ventas + cca.total_ventas) - (ppa.total_cobrado_ot + pca.total_cobrado_cc) AS saldo_pendiente,
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
  CROSS JOIN pagos_periodo_actual ppa
  CROSS JOIN periodo_anterior pant
  CROSS JOIN centro_copiado_actual cca
  CROSS JOIN pagos_copiado_actual pca
  CROSS JOIN centro_copiado_anterior ccant
  CROSS JOIN tasa_cobro_calc tc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'KPIs generales de ventas con cálculo correcto y simplificado de Total Cobrado';

-- =====================================================
-- FIX 2: Eliminar "Centro de Copiado" como canal
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
    -- Órdenes de trabajo con su canal
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    
    UNION ALL
    
    -- Órdenes de centro copiado vinculadas: usar canal de la orden de trabajo
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    LEFT JOIN ordenes_trabajo ot ON cc.orden_trabajo_id = ot.id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NOT NULL
    
    UNION ALL
    
    -- Órdenes de centro copiado independientes: usar 'Mostrador' por defecto
    SELECT
      'Mostrador' AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
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

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal de venta real (Mostrador/WhatsApp/Web) - Centro de Copiado usa canal de orden vinculada o Mostrador por defecto';
