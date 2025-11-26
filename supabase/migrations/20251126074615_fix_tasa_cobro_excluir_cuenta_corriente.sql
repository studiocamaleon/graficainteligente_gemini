/*
  # Ajuste: Tasa de Cobro Excluyendo Cuenta Corriente

  ## Problema

  La Tasa de Cobro estaba incluyendo órdenes de clientes con cuenta corriente,
  lo cual distorsiona la métrica porque estos clientes por naturaleza no pagan
  al momento de hacer el pedido, sino según su acuerdo de pago.

  ## Solución

  Modificar el cálculo de Tasa de Cobro para:
  1. Excluir del cálculo las órdenes de clientes con `tiene_cuenta_corriente = true`
  2. Solo calcular la tasa sobre órdenes de clientes que pagan al contado/parcial

  ## Lógica del Cálculo

  ### ANTES (Incorrecto):
  ```
  Tasa de Cobro = (Total Cobrado / Total Ventas) × 100
  ```
  Incluía todas las órdenes, distorsionando el porcentaje.

  ### DESPUÉS (Correcto):
  ```
  Total Ventas sin CC = SUM(ot.total) WHERE cliente.tiene_cuenta_corriente = false
  Total Cobrado sin CC = SUM(pagos) WHERE cliente.tiene_cuenta_corriente = false
  Tasa de Cobro = (Total Cobrado sin CC / Total Ventas sin CC) × 100
  ```

  ## Ejemplos

  ### Ejemplo 1: Sin el Filtro (Distorsionado)
  ```
  Orden A: Cliente con CC, $10,000, Cobrado: $0
  Orden B: Cliente sin CC, $5,000, Cobrado: $5,000
  
  Tasa = (5,000 / 15,000) × 100 = 33.3% ❌ (Muy bajo, distorsionado)
  ```

  ### Ejemplo 2: Con el Filtro (Correcto)
  ```
  Orden A: Cliente con CC, $10,000, Cobrado: $0 → EXCLUIDA
  Orden B: Cliente sin CC, $5,000, Cobrado: $5,000 → INCLUIDA
  
  Tasa = (5,000 / 5,000) × 100 = 100% ✅ (Refleja realidad)
  ```

  ## Notas Importantes

  - Las órdenes de clientes con CC se siguen incluyendo en "Total de Ventas" general
  - Solo se excluyen del cálculo de "Tasa de Cobro"
  - Las métricas "Total Cobrado" y "Saldo Pendiente" NO se modifican
  - La UI mostrará una aclaración: "(No incluye CC)"
*/

-- =====================================================
-- FUNCIÓN ACTUALIZADA: Tasa de Cobro sin CC
-- =====================================================

DROP FUNCTION IF EXISTS fn_reporte_ventas_kpis(uuid, date, date);

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
      -- ✅ CORREGIDO: Tasa de Cobro excluyendo clientes con cuenta corriente
      CASE
        WHEN COALESCE(SUM(CASE WHEN c.tiene_cuenta_corriente = false THEN ot.total ELSE 0 END), 0) > 0
        THEN (
          COALESCE(SUM(CASE WHEN c.tiene_cuenta_corriente = false THEN otp.monto ELSE 0 END), 0) /
          COALESCE(SUM(CASE WHEN c.tiene_cuenta_corriente = false THEN ot.total ELSE 0 END), 0) * 100
        )
        ELSE 0
      END AS tasa_cobro
    FROM ordenes_trabajo ot
    LEFT JOIN clients c ON ot.cliente_id = c.id
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

COMMENT ON FUNCTION fn_reporte_ventas_kpis IS 'Calcula KPIs principales de ventas. La Tasa de Cobro excluye clientes con cuenta corriente para reflejar correctamente la eficiencia de cobranza de clientes que pagan al contado/parcial.';
