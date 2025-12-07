-- =============================================
-- MIGRATION: 20251207213000_enhance_cashflow_projection.sql
-- Description: Updates projection function to return granular breakdown of income/expenses.
-- =============================================

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
            (re.frequency = 'weekly' AND c.dow = re.day_of_week) OR
            (re.frequency = 'biweekly' AND c.dow = re.day_of_week AND MOD(EXTRACT(WEEK FROM c.fecha)::int, 2) = MOD(EXTRACT(WEEK FROM re.start_date)::int, 2)) OR 
            (re.frequency = 'monthly' AND c.dom = re.day_of_month) OR
            (re.frequency = 'yearly' AND EXTRACT(MONTH FROM c.fecha) = EXTRACT(MONTH FROM re.start_date) AND c.dom = re.day_of_month)
          )

        UNION ALL

        -- [INGRESO] Liquidaciones Pendientes
        SELECT 
            l.fecha_vencimiento::date as fecha,
            l.saldo_pendiente as monto,
            'liqui_in' as type
        FROM liquidaciones l
        WHERE l.company_id = p_company_id
          AND l.estado != 'cancelada'
          AND l.saldo_pendiente > 0
          AND l.fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [INGRESO] Ordenes en Proceso (WIP)
        SELECT 
            COALESCE(o.fecha_estimada_entrega::date, (o.created_at + interval '7 days')::date) as fecha,
            (o.total - COALESCE((SELECT SUM(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = o.id), 0)) as monto,
            'wip_in' as type
        FROM ordenes_trabajo o
        LEFT JOIN clients cl ON o.cliente_id = cl.id
        WHERE o.company_id = p_company_id
          AND o.estado NOT IN ('borrador', 'cotizacion', 'cancelado', 'completado')
          AND (o.total - COALESCE((SELECT SUM(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = o.id), 0)) > 0
          AND (cl.tiene_cuenta_corriente IS FALSE OR cl.tiene_cuenta_corriente IS NULL)
          AND COALESCE(o.fecha_estimada_entrega::date, (o.created_at + interval '7 days')::date) >= CURRENT_DATE

    ),
    daily_aggregated AS (
        SELECT 
            c.fecha,
            -- INGRESOS
            COALESCE(SUM(CASE WHEN m.type = 'cheque_in' THEN m.monto ELSE 0 END), 0) as ing_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'liqui_in' THEN m.monto ELSE 0 END), 0) as ing_liqui,
            COALESCE(SUM(CASE WHEN m.type = 'wip_in' THEN m.monto ELSE 0 END), 0) as ing_wip,
            -- EGRESOS
            COALESCE(SUM(CASE WHEN m.type = 'cheque_out' THEN m.monto ELSE 0 END), 0) as egr_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'tarjeta_out' THEN m.monto ELSE 0 END), 0) as egr_tarjetas,
            COALESCE(SUM(CASE WHEN m.type = 'recurring_out' THEN m.monto ELSE 0 END), 0) as egr_recurrentes
        FROM calendar c
        LEFT JOIN movements m ON c.fecha = m.fecha
        GROUP BY c.fecha
    )
    SELECT 
        da.fecha,
        da.ing_cheques,
        da.ing_liqui,
        da.ing_wip,
        da.egr_cheques,
        da.egr_tarjetas,
        da.egr_recurrentes,
        (da.ing_cheques + da.ing_liqui + da.ing_wip) as total_ingresos,
        (da.egr_cheques + da.egr_tarjetas + da.egr_recurrentes) as total_egresos,
        ((da.ing_cheques + da.ing_liqui + da.ing_wip) - (da.egr_cheques + da.egr_tarjetas + da.egr_recurrentes)) as saldo_diario,
        (v_saldo_inicial + SUM((da.ing_cheques + da.ing_liqui + da.ing_wip) - (da.egr_cheques + da.egr_tarjetas + da.egr_recurrentes)) OVER (ORDER BY da.fecha)) as saldo_acumulado
    FROM daily_aggregated da
    ORDER BY da.fecha;
END;
$$;
