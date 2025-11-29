/*
  # Fix: Corrección del nombre de columna cliente_id en fn_reporte_ventas_kpis

  ## Descripción
  La función fn_reporte_ventas_kpis estaba usando "client_id" cuando la columna
  correcta en ordenes_trabajo es "cliente_id". Esto causaba un error 42703.

  ## Cambios
  - Corrige todas las referencias de ot.client_id a ot.cliente_id
  - Mantiene toda la lógica de cálculo correcta implementada anteriormente
*/

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
      COALESCE(AVG(ot.total), 0) AS ticket_promedio,
      -- Total cobrado sin filtrar por estado completado
      COALESCE(SUM(otp.monto), 0) AS total_cobrado
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
      -- Total cobrado sin filtrar por estado
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
      -- CORRECCIÓN: usar cliente_id en lugar de client_id
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
    -- Total cobrado directo de los CTEs
    pa.total_cobrado + cca.total_cobrado_cc AS total_cobrado,
    -- Saldo pendiente = Total Ventas - Total Cobrado (simple)
    (pa.total_ventas + cca.total_ventas) - (pa.total_cobrado + cca.total_cobrado_cc) AS saldo_pendiente,
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

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'KPIs generales de ventas con cálculo correcto de cobrado, pendiente y nombre de columna cliente_id';
