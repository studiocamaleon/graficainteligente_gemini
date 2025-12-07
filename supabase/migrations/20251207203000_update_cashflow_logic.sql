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
    v_end_date DATE;
BEGIN
    -- 1. Get Initial Balance (Current Liquid Assets)
    SELECT COALESCE(SUM(saldo), 0)
    INTO v_saldo_inicial
    FROM cajas
    WHERE company_id = p_company_id;

    v_end_date := CURRENT_DATE + p_days_to_project;

    -- 2. Generate Projection
    RETURN QUERY
    WITH calendar AS (
        SELECT i::date as fecha, 
               EXTRACT(DOW FROM i::date) as dow,
               EXTRACT(DAY FROM i::date) as dom
        FROM generate_series(CURRENT_DATE, v_end_date, '1 day'::interval) i
    ),
    movements AS (
        -- [INGRESO] Cheques Recibidos (Inflow)
        SELECT 
            fecha_pago::date as fecha,
            monto as monto_ingreso,
            0::numeric as monto_egreso
        FROM cheques
        WHERE company_id = p_company_id
          AND direction = 'recibido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL
        
        -- [EGRESO] Cheques Emitidos (Outflow)
        SELECT 
            fecha_pago::date as fecha,
            0::numeric as monto_ingreso,
            monto as monto_egreso
        FROM cheques
        WHERE company_id = p_company_id
          AND direction = 'emitido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Tarjetas Resumenes (Outflow)
        SELECT 
            fecha_vencimiento::date as fecha,
            0::numeric as monto_ingreso,
            (total_consumos - total_pagado) as monto_egreso
        FROM tarjetas_resumenes
        WHERE company_id = p_company_id
          AND estado != 'pagado'
          AND fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Gastos Recurrentes (Recurring Expenses)
        SELECT 
            c.fecha,
            0::numeric as monto_ingreso,
            re.amount as monto_egreso
        FROM recurring_expenses re
        CROSS JOIN calendar c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          AND c.fecha >= re.start_date
          AND (re.end_date IS NULL OR c.fecha <= re.end_date)
          AND (
            (re.frequency = 'weekly' AND c.dow = re.day_of_week) OR
            (re.frequency = 'biweekly' AND c.dow = re.day_of_week AND MOD(EXTRACT(WEEK FROM c.fecha)::int, 2) = MOD(EXTRACT(WEEK FROM re.start_date)::int, 2)) OR -- Simplistic biweekly
            (re.frequency = 'monthly' AND c.dom = re.day_of_month) OR
            (re.frequency = 'yearly' AND EXTRACT(MONTH FROM c.fecha) = EXTRACT(MONTH FROM re.start_date) AND c.dom = re.day_of_month)
          )

        UNION ALL

        -- [INGRESO] Cuentas por Cobrar (Liquidaciones Pendientes)
        SELECT 
            l.fecha_vencimiento::date as fecha,
            l.saldo_pendiente as monto_ingreso,
            0::numeric as monto_egreso
        FROM liquidaciones l
        WHERE l.company_id = p_company_id
          AND l.estado != 'cancelada'
          AND l.saldo_pendiente > 0
          AND l.fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [INGRESO] Ordenes en Proceso (WIP) - Solo clientes SIN Cuenta Corriente (Mostrador/Web)
        -- Asumimos cobro en Fecha de Entrega Estimada, o T+7 si es nula.
        SELECT 
            COALESCE(o.fecha_estimada_entrega::date, (o.created_at + interval '7 days')::date) as fecha,
            (o.total - COALESCE((SELECT SUM(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = o.id), 0)) as monto_ingreso,
            0::numeric as monto_egreso
        FROM ordenes_trabajo o
        LEFT JOIN clients cl ON o.cliente_id = cl.id
        WHERE o.company_id = p_company_id
          AND o.estado NOT IN ('borrador', 'cotizacion', 'cancelado', 'completado') -- Ordenes activas
          AND (o.total - COALESCE((SELECT SUM(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = o.id), 0)) > 0
          AND (cl.tiene_cuenta_corriente IS FALSE OR cl.tiene_cuenta_corriente IS NULL)
          AND COALESCE(o.fecha_estimada_entrega::date, (o.created_at + interval '7 days')::date) >= CURRENT_DATE

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
