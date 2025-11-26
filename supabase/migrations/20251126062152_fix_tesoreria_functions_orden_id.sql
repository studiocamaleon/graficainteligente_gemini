/*
  # Fix Tesorería Functions - orden_id References

  ## Descripción
  Corrige las referencias incorrectas a `orden_id` en las funciones de tesorería.
  La tabla `ordenes_trabajo` tiene columna `id`, no `orden_id`.

  ## Correcciones

  ### 1. fn_calcular_saldos_pendientes_cobro
  - Error: `LEFT JOIN pagos_por_orden p ON ot.orden_id = p.orden_id`
  - Fix: `LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id`

  ### 2. fn_obtener_detalle_por_cobrar
  - Función ya estaba correcta, solo se reaplica para asegurar consistencia

  ## Impacto
  - Permite calcular correctamente los saldos pendientes de cobro
  - Permite obtener el detalle de órdenes por cobrar sin ambigüedades
*/

-- =====================================================
-- FUNCIÓN: Calcular saldos pendientes de cobro
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
  WITH pagos_por_orden AS (
    SELECT 
      orden_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos
    GROUP BY orden_id
  ),
  ordenes_pendientes AS (
    SELECT 
      ot.id,
      ot.total,
      COALESCE(p.total_pagado, 0) as pagado,
      (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM ordenes_trabajo ot
    LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id
    LEFT JOIN clients c ON ot.cliente_id = c.id
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelado')
      AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
  )
  SELECT 
    COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
    COALESCE(SUM(CASE WHEN tiene_cuenta_corriente THEN saldo_pendiente ELSE 0 END), 0) as total_cc,
    COALESCE(SUM(CASE WHEN NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL THEN saldo_pendiente ELSE 0 END), 0) as total_sin_cc,
    COUNT(*) FILTER (WHERE tiene_cuenta_corriente) as cantidad_ordenes_cc,
    COUNT(*) FILTER (WHERE NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL) as cantidad_ordenes_sin_cc
  FROM ordenes_pendientes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener detalle de órdenes por cobrar
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_detalle_por_cobrar(
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
  estado text
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden AS (
    SELECT 
      otp.orden_id,
      COALESCE(SUM(otp.monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos otp
    GROUP BY otp.orden_id
  )
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
    EXTRACT(DAY FROM (CURRENT_DATE - ot.fecha_creacion::date))::integer as dias_transcurridos,
    ot.estado
  FROM ordenes_trabajo ot
  LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelado')
    AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )
  ORDER BY ot.fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;