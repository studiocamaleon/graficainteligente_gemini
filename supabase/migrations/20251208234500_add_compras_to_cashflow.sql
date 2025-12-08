-- Description: Updates fn_get_cashflow_projection to include pending bills (compras_proveedores) in the cashflow projection.
-- This ensures that "Facturas pendientes" from Accounts Payable are reflected in the projected outflows.

-- [FIX] Drop first to allow return type change
DROP FUNCTION IF EXISTS fn_get_cashflow_projection(UUID, INTEGER);

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
    egreso_compras NUMERIC,  -- [NEW] Added for pending bills
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

        -- [EGRESO] Facturas de Compra (Proveedores) -- [NEW SECTION]
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
          -- [OPTIONAL BUT GOOD] Exclude recurrentes manually closed in this period? 
          -- For simplicity in cashflow projection, we usually assume it happens unless explicitly closed.
          -- Ideally we should check recurring_executions, but querying it for every date in calendar might be heavy. 
          -- Leaving as is for now (Projected Ideal Scenario).

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
          AND estado NOT IN ('borrador', 'cotizacion', 'cancelado')
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
            COALESCE(SUM(CASE WHEN m.type = 'compra_out' THEN m.monto ELSE 0 END), 0) as egreso_compras -- [NEW COL AGG]
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
