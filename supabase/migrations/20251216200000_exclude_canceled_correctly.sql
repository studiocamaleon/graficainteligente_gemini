-- Migration: Exclude 'cancelada' orders from Finance and Production views
-- Description: Fixes bugs where 'cancelado' was used instead of 'cancelada', and adds missing filters.

-- 1. Update fn_ordenes_pendientes_facturacion (Add missing filter)
CREATE OR REPLACE FUNCTION fn_ordenes_pendientes_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_estado_facturacion text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_email text,
  cliente_whatsapp text,
  vendedor_id uuid,
  vendedor_nombre text,
  estado text,
  fecha_creacion timestamptz,
  fecha_estimada_entrega timestamptz,
  subtotal numeric,
  subtotal_iva numeric,
  total numeric,
  dias_pendiente integer,
  facturada boolean,
  numero_factura text,
  factura_storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- 1. Ordenes de Trabajo
  SELECT
    ot.id,
    ot.numero_orden,
    ot.cliente_id,
    c.razon_social as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    ot.vendedor_id,
    p.full_name as vendedor_nombre,
    ot.estado::text,
    ot.fecha_creacion,
    ot.fecha_estimada_entrega,
    ot.subtotal,
    ot.subtotal_iva,
    ot.total,
    EXTRACT(DAY FROM (now() - ot.fecha_creacion))::integer as dias_pendiente,
    ot.facturada,
    ot.numero_factura,
    ot.factura_storage_path
  FROM ordenes_trabajo ot
  INNER JOIN clients c ON c.id = ot.cliente_id
  INNER JOIN profiles p ON p.id = ot.vendedor_id
  WHERE ot.company_id = p_company_id
    AND ot.requiere_factura = true
    AND ot.estado != 'cancelada' -- FIX: Exclude canceled
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND ot.facturada = false)
      OR (p_estado_facturacion = 'facturada' AND ot.facturada = true)
    )
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)

  UNION ALL

  -- 2. Ordenes de Copiado Independientes
  SELECT
    oc.id,
    oc.numero_orden,
    oc.cliente_id,
    c.nombre_fantasia as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    oc.created_by as vendedor_id,
    p.full_name as vendedor_nombre,
    oc.estado::text,
    oc.created_at as fecha_creacion,
    oc.fecha_entrega_estimada::timestamptz,
    ROUND((oc.total / 1.21)::numeric, 2) as subtotal,
    (oc.total - ROUND((oc.total / 1.21)::numeric, 2)) as subtotal_iva,
    oc.total,
    EXTRACT(DAY FROM (now() - oc.created_at))::integer as dias_pendiente,
    (oc.numero_factura IS NOT NULL) as facturada,
    oc.numero_factura,
    oc.factura_storage_path
  FROM centro_copiado_ordenes oc
  LEFT JOIN clients c ON c.id = oc.cliente_id
  LEFT JOIN profiles p ON p.id = oc.created_by
  WHERE oc.company_id = p_company_id
    AND oc.requiere_factura = true
    AND oc.orden_trabajo_id IS NULL
    AND oc.estado != 'cancelada' -- FIX: Exclude canceled
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND oc.numero_factura IS NULL)
      OR (p_estado_facturacion = 'facturada' AND oc.numero_factura IS NOT NULL)
    )
    AND (p_fecha_desde IS NULL OR DATE(oc.created_at) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(oc.created_at) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR oc.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR oc.estado::text = p_estado)
  
  ORDER BY fecha_creacion DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_ordenes_pendientes_facturacion TO authenticated;


-- 2. Update fn_calcular_saldos_pendientes_cobro (Fix typo 'cancelado' -> 'cancelada')
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
      AND ot.estado NOT IN ('cancelada', 'borrador') -- FIX: 'cancelada'
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


-- 3. Update fn_obtener_detalle_por_cobrar (Fix typo 'cancelado' -> 'cancelada')
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
    AND ot.estado NOT IN ('cancelada', 'borrador') -- FIX: 'cancelada'
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


-- 4. Update fn_get_cashflow_projection (Fix typo 'cancelado' -> 'cancelada')
CREATE OR REPLACE FUNCTION fn_get_cashflow_projection(
    p_company_id UUID,
    p_days_to_project INTEGER DEFAULT 90
)
RETURNS TABLE (
    fecha DATE,
    -- INGRESO BREAKDOWN
    ingreso_cheques NUMERIC,
    ingreso_liquidaciones NUMERIC,
    ingreso_wip NUMERIC,
    -- EGRESO BREAKDOWN
    egreso_cheques NUMERIC,
    egreso_tarjetas NUMERIC,
    egreso_recurrentes NUMERIC,
    egreso_compras NUMERIC,
    -- TOTALS
    total_ingresos NUMERIC,
    total_egresos NUMERIC,
    saldo_diario NUMERIC,
    saldo_acumulado NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_inicial NUMERIC;
    v_end_date DATE;
BEGIN
    -- 1. Get Initial Balance
    SELECT COALESCE(SUM(saldo_actual), 0)
    INTO v_saldo_inicial
    FROM cajas
    WHERE company_id = p_company_id;

    v_end_date := CURRENT_DATE + p_days_to_project;

    RETURN QUERY
    WITH calendar AS (
        SELECT i::date as fecha, 
               EXTRACT(DOW FROM i::date) as dow,
               EXTRACT(DAY FROM i::date) as dom
        FROM generate_series(CURRENT_DATE, v_end_date, '1 day'::interval) i
    ),
    movements AS (
        -- [INGRESO] Cheques Recibidos
        SELECT 
            fecha_pago::date as fecha,
            monto as monto,
            'cheque_in' as type
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'recibido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL
        
        -- [EGRESO] Cheques Emitidos
        SELECT 
            fecha_pago::date as fecha,
            monto as monto,
            'cheque_out' as type
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'emitido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Tarjetas Resumenes
        SELECT 
            fecha_vencimiento::date as fecha,
            (total_consumos - total_pagado) as monto,
            'tarjeta_out' as type
        FROM tarjetas_resumenes
        WHERE company_id = p_company_id
          AND estado != 'pagado'
          AND fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Facturas de Compra (Proveedores)
        SELECT 
            cp.fecha_vencimiento::date as fecha,
            (cp.monto_total - COALESCE((SELECT SUM(e.monto) FROM egresos e WHERE e.compra_id = cp.id), 0)) as monto,
            'compra_out' as type
        FROM compras_proveedores cp
        WHERE cp.company_id = p_company_id
          AND cp.estado != 'pagado'
          AND cp.fecha_vencimiento >= CURRENT_DATE
        
        UNION ALL

        -- [EGRESO] Gastos Recurrentes
        SELECT 
            c.fecha,
            re.amount as monto,
            'recurring_out' as type
        FROM recurring_expenses re
        CROSS JOIN calendar c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          AND c.fecha >= re.start_date
          AND (re.end_date IS NULL OR c.fecha <= re.end_date)
          AND (
            (re.frequency = 'weekly' AND EXTRACT(DOW FROM c.fecha) = re.day_of_week) OR
            (re.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM c.fecha)::int, 2) = 0 AND EXTRACT(DOW FROM c.fecha) = re.day_of_week) OR
            (re.frequency = 'monthly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month) OR
            (re.frequency = 'quarterly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month AND MOD(EXTRACT(MONTH FROM c.fecha)::int - 1, 3) = 0) OR
            (re.frequency = 'yearly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month AND EXTRACT(MONTH FROM c.fecha) = EXTRACT(MONTH FROM re.start_date))
          )
          AND NOT EXISTS (
              SELECT 1 FROM recurring_executions rex 
              WHERE rex.recurring_id = re.id 
              AND rex.periodo = c.fecha 
              AND rex.estado = 'cerrado'
          )

        UNION ALL

        -- [INGRESO] Liquidaciones (Cuentas Corrientes)
        SELECT 
            fecha_vencimiento::date as fecha,
            saldo_pendiente as monto,
            'liquidacion_in' as type
        FROM liquidaciones
        WHERE company_id = p_company_id
          AND estado IN ('pendiente', 'pagada_parcial', 'vencida')
          AND fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [INGRESO] WIP Orders (Ordenes Trabajo)
        SELECT 
            GREATEST(COALESCE(fecha_estimada_entrega, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0))) as monto,
            'wip_in' as type
        FROM ordenes_trabajo ot
        WHERE company_id = p_company_id
          AND estado NOT IN ('borrador', 'cotizacion', 'cancelada') -- FIX: 'cancelada'
          AND NOT EXISTS (
              SELECT 1 FROM clients c 
              WHERE c.id = ot.cliente_id 
              AND c.tiene_cuenta_corriente = true
          )
        
        UNION ALL

        -- [INGRESO] WIP Orders (Centro Copiado)
        SELECT 
            GREATEST(COALESCE(fecha_entrega_estimada, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0))) as monto,
            'wip_in' as type
        FROM centro_copiado_ordenes cco
        WHERE company_id = p_company_id
          AND estado NOT IN ('cancelada')
          AND orden_trabajo_id IS NULL 
          AND NOT EXISTS (
              SELECT 1 FROM clients c 
              WHERE c.id = cco.cliente_id 
              AND c.tiene_cuenta_corriente = true
          )
    ),
    daily_agg AS (
        SELECT 
            c.fecha,
            COALESCE(SUM(CASE WHEN m.type = 'cheque_in' THEN m.monto ELSE 0 END), 0) as ingreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'liquidacion_in' THEN m.monto ELSE 0 END), 0) as ingreso_liquidaciones,
            COALESCE(SUM(CASE WHEN m.type = 'wip_in' THEN m.monto ELSE 0 END), 0) as ingreso_wip,
            COALESCE(SUM(CASE WHEN m.type = 'cheque_out' THEN m.monto ELSE 0 END), 0) as egreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'tarjeta_out' THEN m.monto ELSE 0 END), 0) as egreso_tarjetas,
            COALESCE(SUM(CASE WHEN m.type = 'recurring_out' THEN m.monto ELSE 0 END), 0) as egreso_recurrentes,
            COALESCE(SUM(CASE WHEN m.type = 'compra_out' THEN m.monto ELSE 0 END), 0) as egreso_compras
        FROM calendar c
        LEFT JOIN movements m ON m.fecha = c.fecha
        GROUP BY c.fecha
    ),
    running_balance AS (
        SELECT 
            da.fecha,
            da.ingreso_cheques,
            da.ingreso_liquidaciones,
            da.ingreso_wip,
            da.egreso_cheques,
            da.egreso_tarjetas,
            da.egreso_recurrentes,
            da.egreso_compras,
            (da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) as total_ingresos,
            (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras) as total_egresos,
            ((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) - (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras)) as saldo_diario,
            SUM((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) - (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras)) OVER (ORDER BY da.fecha) + v_saldo_inicial as saldo_acumulado
        FROM daily_agg da
    )
    SELECT * FROM running_balance rb ORDER BY rb.fecha;
END;
$$;
