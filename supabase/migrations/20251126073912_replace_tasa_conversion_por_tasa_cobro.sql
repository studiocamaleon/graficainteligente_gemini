/*
  # Reemplazo de Tasa de Conversión por Tasa de Cobro

  ## Descripción
  Se reemplaza la métrica "Tasa de Conversión" por "Tasa de Cobro" en el módulo
  de Reportes de Finanzas para proporcionar una métrica más relevante y alineada
  con el enfoque financiero del reporte.

  ## Cambio Realizado

  ### Métrica Anterior: Tasa de Conversión
  - **Medía:** Porcentaje de cotizaciones convertidas en órdenes activas
  - **Fórmula:** (Órdenes Activas / Total Cotizaciones) × 100
  - **Utilidad:** Métrica de eficacia del proceso de ventas

  ### Métrica Nueva: Tasa de Cobro
  - **Mide:** Porcentaje del total facturado que se ha cobrado
  - **Fórmula:** (Total Cobrado / Total de Ventas) × 100
  - **Utilidad:** Métrica de salud financiera y eficiencia de cobranza

  ## Ejemplos de Cálculo

  ### Ejemplo 1: Cobro Completo
  - Total Ventas: $10,000
  - Total Cobrado: $10,000
  - Tasa de Cobro: (10,000 / 10,000) × 100 = 100%

  ### Ejemplo 2: Cobro Parcial
  - Total Ventas: $20,000
  - Total Cobrado: $13,500
  - Tasa de Cobro: (13,500 / 20,000) × 100 = 67.5%

  ### Ejemplo 3: Sin Cobros
  - Total Ventas: $5,000
  - Total Cobrado: $0
  - Tasa de Cobro: (0 / 5,000) × 100 = 0%

  ## Beneficios

  1. **Mayor Relevancia Financiera:**
     - Indica flujo de caja real
     - Muestra eficiencia de cobranza
     - Directamente relacionado con liquidez

  2. **Coherencia con Otras Métricas:**
     - Se alinea con Total de Ventas y Total Cobrado
     - Complementa la información de Saldo Pendiente
     - Fácil de interpretar para usuarios

  3. **Insights Accionables:**
     - Tasa baja (< 50%): Problemas de cobranza
     - Tasa media (50-80%): Normal con pagos parciales
     - Tasa alta (> 80%): Excelente gestión de cobranza

  ## Impacto

  - Campo renombrado: tasa_conversion → tasa_cobro
  - Cambio en cálculo SQL
  - Sin cambios en estructura de datos
  - Performance mejorado (cálculo más simple)
*/

-- =====================================================
-- PASO 1: Eliminar función anterior
-- =====================================================

DROP FUNCTION IF EXISTS fn_reporte_ventas_kpis(uuid, date, date);

-- =====================================================
-- PASO 2: Crear función con Tasa de Cobro
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
      COALESCE(SUM(otp.monto), 0) AS total_cobrado,
      COALESCE(SUM(ot.total), 0) - COALESCE(SUM(otp.monto), 0) AS saldo_pendiente,
      -- ✅ NUEVO: Tasa de Cobro = (Total Cobrado / Total Ventas) × 100
      CASE
        WHEN COALESCE(SUM(ot.total), 0) > 0
        THEN (COALESCE(SUM(otp.monto), 0) / COALESCE(SUM(ot.total), 0) * 100)
        ELSE 0
      END AS tasa_cobro
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
    pa.tasa_cobro AS tasa_cobro,
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

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'Calcula KPIs principales de ventas incluyendo tasa de cobro (% del total facturado que se ha cobrado efectivamente)';
