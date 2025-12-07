-- Function to project cashflow daily
CREATE OR REPLACE FUNCTION fn_get_cashflow_projection(
    p_company_id UUID,
    p_days_to_project INTEGER DEFAULT 90
)
RETURNS TABLE (
    fecha DATE,
    ingresos NUMERIC,
    egresos NUMERIC,
    saldo_diario NUMERIC, -- Net change for the day
    saldo_acumulado NUMERIC -- Running balance
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_inicial NUMERIC;
BEGIN
    -- 1. Get Initial Balance (Current Liquid Assets)
    SELECT COALESCE(SUM(saldo), 0)
    INTO v_saldo_inicial
    FROM cajas
    WHERE company_id = p_company_id;

    -- 2. Generate Projection
    RETURN QUERY
    WITH calendar AS (
        SELECT i::date as fecha
        FROM generate_series(CURRENT_DATE, CURRENT_DATE + p_days_to_project, '1 day'::interval) i
    ),
    movements AS (
        -- Cheques Recibidos (Inflow)
        SELECT 
            fecha_pago::date as fecha,
            monto as monto_ingreso,
            0 as monto_egreso
        FROM cheques
        WHERE company_id = p_company_id
          AND direction = 'recibido'
          AND estado IN ('pendiente') -- Only future/pending checks count for projection flow? Or maybe 'pagado' if checks on hand? 
          -- Logic decision: 'pendiente' checks are receivables. 'pagado' checks (deposited) are already in Cajas (theoretically).
          -- If 'pendiente' means "on hand but not deposited" or "future date", we count them.
          AND fecha_pago >= CURRENT_DATE
        
        UNION ALL
        
        -- Cheques Emitidos (Outflow)
        SELECT 
            fecha_pago::date as fecha,
            0 as monto_ingreso,
            monto as monto_egreso
        FROM cheques
        WHERE company_id = p_company_id
          AND direction = 'emitido'
          AND estado IN ('pendiente') -- Only pending payments
          AND fecha_pago >= CURRENT_DATE

        UNION ALL

        -- Tarjetas Resumenes (Outflow)
        SELECT 
            fecha_vencimiento::date as fecha,
            0 as monto_ingreso,
            (total_consumos - total_pagado) as monto_egreso
        FROM tarjetas_resumenes
        WHERE company_id = p_company_id
          AND estado != 'pagado'
          AND fecha_vencimiento >= CURRENT_DATE
          
        -- TODO: Add Gastos Recurrentes (Future)
        -- TODO: Add Cuentas Por Cobrar (Clients with CC debt) - Harder to predict date.
    ),
    daily_aggregated AS (
        SELECT 
            c.fecha,
            COALESCE(SUM(m.monto_ingreso), 0) as ingresos,
            COALESCE(SUM(m.monto_egreso), 0) as egresos
        FROM calendar c
        LEFT JOIN movements m ON c.fecha = m.fecha
        GROUP BY c.fecha
    )
    SELECT 
        da.fecha,
        da.ingresos,
        da.egresos,
        (da.ingresos - da.egresos) as saldo_diario,
        (v_saldo_inicial + SUM(da.ingresos - da.egresos) OVER (ORDER BY da.fecha)) as saldo_acumulado
    FROM daily_aggregated da
    ORDER BY da.fecha;
END;
$$;
