/*
  # Fix: Corregir referencias de client_id a cliente_id en funciones de reportes

  ## Descripción
  Las funciones de reportes estaban usando `client_id` pero la columna correcta
  en las tablas es `cliente_id` (en español).

  ## Funciones Corregidas
  1. fn_reporte_tasa_sena() - Corregir referencias a cliente_id
  2. fn_reporte_ventas_kpis() - Corregir referencias a cliente_id

  ## Cambios
  - client_id → cliente_id en todas las referencias
*/

-- =====================================================
-- CORREGIR: fn_reporte_tasa_sena
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_tasa_sena(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_cobrado numeric,
  saldo_pendiente numeric,
  total_ordenes bigint,
  ordenes_con_sena bigint,
  ordenes_sin_sena bigint,
  tasa_sena_promedio numeric,
  porcentaje_ordenes_con_sena numeric,
  monto_sena_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_con_pagos AS (
    SELECT
      ot.id AS orden_id,
      ot.total AS total_orden,
      COALESCE(SUM(otp.monto), 0) AS pagado
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
    GROUP BY ot.id, ot.total
  ),
  ordenes_copiado_con_pagos AS (
    SELECT
      cc.id AS orden_id,
      cc.total AS total_orden,
      COALESCE(SUM(ccp.monto), 0) AS pagado
    FROM centro_copiado_ordenes cc
    LEFT JOIN centro_copiado_ordenes_pagos ccp ON cc.id = ccp.orden_copiado_id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
      AND (cc.cliente_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = cc.cliente_id 
        AND cl.tiene_cuenta_corriente = true
      ))
    GROUP BY cc.id, cc.total
  ),
  todas_ordenes AS (
    SELECT orden_id, total_orden, pagado FROM ordenes_con_pagos
    UNION ALL
    SELECT orden_id, total_orden, pagado FROM ordenes_copiado_con_pagos
  ),
  analisis_ordenes AS (
    SELECT
      total_orden,
      pagado,
      CASE
        WHEN total_orden > 0 THEN (pagado / total_orden * 100)
        ELSE 0
      END AS tasa_orden,
      CASE WHEN pagado > 0 THEN 1 ELSE 0 END AS tiene_sena
    FROM todas_ordenes
  )
  SELECT
    COALESCE(SUM(total_orden), 0) AS total_ventas,
    COALESCE(SUM(pagado), 0) AS total_cobrado,
    COALESCE(SUM(total_orden - pagado), 0) AS saldo_pendiente,
    COUNT(*)::bigint AS total_ordenes,
    COALESCE(SUM(tiene_sena), 0)::bigint AS ordenes_con_sena,
    (COUNT(*) - COALESCE(SUM(tiene_sena), 0))::bigint AS ordenes_sin_sena,
    COALESCE(AVG(tasa_orden), 0) AS tasa_sena_promedio,
    CASE
      WHEN COUNT(*) > 0 THEN (COALESCE(SUM(tiene_sena), 0)::numeric / COUNT(*) * 100)
      ELSE 0
    END AS porcentaje_ordenes_con_sena,
    CASE
      WHEN COALESCE(SUM(tiene_sena), 0) > 0 
      THEN (SUM(CASE WHEN tiene_sena = 1 THEN pagado ELSE 0 END) / SUM(tiene_sena))
      ELSE 0
    END AS monto_sena_promedio
  FROM analisis_ordenes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_tasa_sena IS 
  'Retorna análisis completo de tasa de seña vs meta del 50%, excluyendo órdenes de cuenta corriente';

-- =====================================================
-- CORREGIR: fn_reporte_ventas_kpis
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

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 
  'KPIs principales de ventas con tasa de cobro (excluyendo cuenta corriente)';
