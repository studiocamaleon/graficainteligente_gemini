/*
  # Fix: Inclusión de Órdenes de Centro de Copiado en Tesorería "Por Cobrar"

  ## Descripción
  Actualiza las funciones de tesorería para incluir los saldos pendientes
  de las órdenes de centro de copiado, no solo las órdenes de trabajo.

  ## Problema
  El módulo Tesorería → Por Cobrar solo mostraba saldos pendientes de ordenes_trabajo,
  pero no incluía las ordenes de centro_copiado_ordenes que también pueden tener
  saldo pendiente de cobro.

  ## Solución
  1. fn_calcular_saldos_pendientes_cobro: Agrega CTEs para centro_copiado_ordenes y sus pagos
  2. fn_obtener_detalle_por_cobrar: Usa UNION ALL para combinar ambas fuentes de órdenes
  3. Agrega campo tipo_orden para distinguir el origen ('trabajo' o 'copiado')

  ## Cambios Detallados
  - Incluye pagos de centro_copiado_ordenes_pagos
  - Calcula saldos pendientes de centro_copiado_ordenes
  - Combina ambas fuentes en los KPIs (Total, CC, Sin CC)
  - Muestra todas las órdenes pendientes en el detalle
*/

-- =====================================================
-- FUNCIÓN: Calcular saldos pendientes de cobro (CON CENTRO DE COPIADO)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_saldos_pendientes_cobro(p_company_id uuid)
RETURNS TABLE (
  total_pendiente numeric,
  total_cc numeric,
  total_sin_cc numeric,
  cantidad_ordenes_cc bigint,
  cantidad_ordenes_sin_cc bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden_trabajo AS (
    SELECT 
      orden_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos
    GROUP BY orden_id
  ),
  pagos_por_orden_copiado AS (
    SELECT 
      orden_copiado_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM centro_copiado_ordenes_pagos
    GROUP BY orden_copiado_id
  ),
  ordenes_trabajo_pendientes AS (
    SELECT 
      ot.id,
      ot.total,
      COALESCE(p.total_pagado, 0) as pagado,
      (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM ordenes_trabajo ot
    LEFT JOIN pagos_por_orden_trabajo p ON ot.id = p.orden_id
    LEFT JOIN clients c ON ot.cliente_id = c.id
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
  ),
  ordenes_copiado_pendientes AS (
    SELECT 
      cc.id,
      cc.total,
      COALESCE(pcc.total_pagado, 0) as pagado,
      (cc.total - COALESCE(pcc.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM centro_copiado_ordenes cc
    LEFT JOIN pagos_por_orden_copiado pcc ON cc.id = pcc.orden_copiado_id
    LEFT JOIN clients c ON cc.cliente_id = c.id
    WHERE cc.company_id = p_company_id
      AND cc.estado != 'cancelada'
      AND (cc.total - COALESCE(pcc.total_pagado, 0)) > 0
  ),
  todas_ordenes_pendientes AS (
    SELECT saldo_pendiente, tiene_cuenta_corriente FROM ordenes_trabajo_pendientes
    UNION ALL
    SELECT saldo_pendiente, tiene_cuenta_corriente FROM ordenes_copiado_pendientes
  )
  SELECT 
    COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
    COALESCE(SUM(CASE WHEN tiene_cuenta_corriente THEN saldo_pendiente ELSE 0 END), 0) as total_cc,
    COALESCE(SUM(CASE WHEN NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL THEN saldo_pendiente ELSE 0 END), 0) as total_sin_cc,
    COUNT(*) FILTER (WHERE tiene_cuenta_corriente) as cantidad_ordenes_cc,
    COUNT(*) FILTER (WHERE NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL) as cantidad_ordenes_sin_cc
  FROM todas_ordenes_pendientes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_calcular_saldos_pendientes_cobro IS 'Calcula saldos pendientes de cobro incluyendo órdenes de trabajo y centro de copiado';

-- =====================================================
-- FUNCIÓN: Obtener detalle de órdenes por cobrar (CON CENTRO DE COPIADO)
-- Primero DROP y luego CREATE porque cambia la firma de retorno
-- =====================================================

DROP FUNCTION IF EXISTS fn_obtener_detalle_por_cobrar(uuid, text);

CREATE FUNCTION fn_obtener_detalle_por_cobrar(
  p_company_id uuid,
  p_tipo_cliente text DEFAULT NULL
)
RETURNS TABLE (
  orden_id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  tiene_cuenta_corriente boolean,
  total numeric,
  pagado numeric,
  saldo_pendiente numeric,
  dias_transcurridos integer,
  estado text,
  tipo_orden text
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden_trabajo AS (
    SELECT 
      otp.orden_id,
      COALESCE(SUM(otp.monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos otp
    GROUP BY otp.orden_id
  ),
  pagos_por_orden_copiado AS (
    SELECT 
      ccop.orden_copiado_id,
      COALESCE(SUM(ccop.monto), 0) as total_pagado
    FROM centro_copiado_ordenes_pagos ccop
    GROUP BY ccop.orden_copiado_id
  )
  -- Órdenes de trabajo
  SELECT 
    ot.id as orden_id,
    ot.numero_orden,
    ot.fecha_creacion,
    ot.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    c.numero_documento as cliente_documento,
    COALESCE(c.tiene_cuenta_corriente, false) as tiene_cuenta_corriente,
    ot.total,
    COALESCE(p.total_pagado, 0) as pagado,
    (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
    (CURRENT_DATE - ot.fecha_creacion::date)::integer as dias_transcurridos,
    ot.estado,
    'trabajo'::text as tipo_orden
  FROM ordenes_trabajo ot
  LEFT JOIN pagos_por_orden_trabajo p ON ot.id = p.orden_id
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelado', 'borrador')
    AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )

  UNION ALL

  -- Órdenes de centro de copiado
  SELECT 
    cc.id as orden_id,
    cc.numero_orden,
    cc.fecha_solicitud as fecha_creacion,
    cc.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    c.numero_documento as cliente_documento,
    COALESCE(c.tiene_cuenta_corriente, false) as tiene_cuenta_corriente,
    cc.total,
    COALESCE(pcc.total_pagado, 0) as pagado,
    (cc.total - COALESCE(pcc.total_pagado, 0)) as saldo_pendiente,
    (CURRENT_DATE - cc.fecha_solicitud::date)::integer as dias_transcurridos,
    cc.estado,
    'copiado'::text as tipo_orden
  FROM centro_copiado_ordenes cc
  LEFT JOIN pagos_por_orden_copiado pcc ON cc.id = pcc.orden_copiado_id
  LEFT JOIN clients c ON cc.cliente_id = c.id
  WHERE cc.company_id = p_company_id
    AND cc.estado != 'cancelada'
    AND (cc.total - COALESCE(pcc.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )

  ORDER BY fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_obtener_detalle_por_cobrar IS 'Obtiene detalle de órdenes por cobrar incluyendo órdenes de trabajo y centro de copiado';
