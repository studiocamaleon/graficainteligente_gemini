-- Split overdue income in cashflow v2 into WIP vs Other (cheques + liquidaciones)
-- Keep total_ingreso_vencido for backwards compatibility.

DROP FUNCTION IF EXISTS fn_get_cashflow_projection_v2(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION fn_get_cashflow_projection_v2(
    p_company_id UUID,
    p_days_to_project INTEGER DEFAULT 90,
    p_collection_basis TEXT DEFAULT 'total'
)
RETURNS TABLE (
    fecha DATE,
    ingreso_cheques NUMERIC,
    ingreso_liquidaciones NUMERIC,
    ingreso_wip NUMERIC,
    egreso_cheques NUMERIC,
    egreso_tarjetas NUMERIC,
    egreso_recurrentes NUMERIC,
    egreso_compras NUMERIC,
    ingreso_wip_vencido NUMERIC,
    ingreso_otros_vencidos NUMERIC,
    total_ingreso_vencido NUMERIC,
    total_egreso_vencido NUMERIC,
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
    v_window_start_recurring DATE := CURRENT_DATE - INTERVAL '6 months';
    v_collection_basis TEXT := CASE
        WHEN LOWER(COALESCE(p_collection_basis, 'total')) IN ('total', 'cobrable')
            THEN LOWER(COALESCE(p_collection_basis, 'total'))
        ELSE 'total'
    END;
BEGIN
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
        SELECT
            GREATEST(fecha_pago::date, CURRENT_DATE) as fecha,
            monto as monto,
            'cheque_in' as type,
            (fecha_pago::date < CURRENT_DATE) as is_overdue
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'recibido'
          AND estado IN ('pendiente')

        UNION ALL

        SELECT
            GREATEST(fecha_pago::date, CURRENT_DATE) as fecha,
            monto as monto,
            'cheque_out' as type,
            (fecha_pago::date < CURRENT_DATE) as is_overdue
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'emitido'
          AND estado IN ('pendiente')

        UNION ALL

        SELECT
            GREATEST(fecha_vencimiento::date, CURRENT_DATE) as fecha,
            (total_consumos - total_pagado) as monto,
            'tarjeta_out' as type,
            (fecha_vencimiento::date < CURRENT_DATE) as is_overdue
        FROM tarjetas_resumenes
        WHERE company_id = p_company_id
          AND estado != 'pagado'

        UNION ALL

        SELECT
            GREATEST(cp.fecha_vencimiento::date, CURRENT_DATE) as fecha,
            (cp.monto_total - COALESCE((SELECT SUM(e.monto) FROM egresos e WHERE e.compra_id = cp.id), 0)) as monto,
            'compra_out' as type,
            (cp.fecha_vencimiento::date < CURRENT_DATE) as is_overdue
        FROM compras_proveedores cp
        WHERE company_id = p_company_id
          AND cp.estado != 'pagado'

        UNION ALL

        SELECT
            c.fecha,
            re.amount as monto,
            'recurring_out' as type,
            false as is_overdue
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

        SELECT
            CURRENT_DATE as fecha,
            re.amount as monto,
            'recurring_out' as type,
            true as is_overdue
        FROM recurring_expenses re
        CROSS JOIN LATERAL (
            SELECT d::date as fecha
            FROM generate_series(GREATEST(re.start_date, v_window_start_recurring), CURRENT_DATE - INTERVAL '1 day', '1 day'::interval) d
            WHERE
                (re.frequency = 'weekly' AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM d)::int, 2) = 0 AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency = 'monthly' AND EXTRACT(DAY FROM d) = re.day_of_month) OR
                (re.frequency = 'quarterly' AND EXTRACT(DAY FROM d) = re.day_of_month AND MOD(EXTRACT(MONTH FROM d)::int - 1, 3) = 0) OR
                (re.frequency = 'yearly' AND EXTRACT(DAY FROM d) = re.day_of_month AND EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM re.start_date))
        ) c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM egresos e
              WHERE e.recurrente_id = re.id
                AND (
                  (re.frequency IN ('monthly', 'quarterly', 'yearly') AND
                   EXTRACT(MONTH FROM e.fecha) = EXTRACT(MONTH FROM c.fecha) AND
                   EXTRACT(YEAR FROM e.fecha) = EXTRACT(YEAR FROM c.fecha))
                  OR
                  (re.frequency NOT IN ('monthly', 'quarterly', 'yearly') AND e.fecha = c.fecha)
                )
          )
          AND NOT EXISTS (
              SELECT 1 FROM recurring_executions rex
              WHERE rex.recurring_id = re.id
                AND rex.periodo = c.fecha
                AND rex.estado = 'cerrado'
          )

        UNION ALL

        SELECT
            GREATEST(fecha_vencimiento::date, CURRENT_DATE) as fecha,
            saldo_pendiente as monto,
            'liquidacion_in' as type,
            (fecha_vencimiento::date < CURRENT_DATE) as is_overdue
        FROM liquidaciones
        WHERE company_id = p_company_id
          AND estado IN ('pendiente', 'pagada_parcial', 'vencida')

        UNION ALL

        SELECT
            GREATEST(COALESCE(fecha_estimada_entrega, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0))) as monto,
            'wip_in' as type,
            (COALESCE(fecha_estimada_entrega, CURRENT_DATE)::date < CURRENT_DATE) as is_overdue
        FROM ordenes_trabajo ot
        WHERE company_id = p_company_id
          AND estado NOT IN ('borrador', 'cotizacion', 'cancelada')
          AND (v_collection_basis = 'total' OR estado IN ('finalizada', 'entregada'))
          AND NOT EXISTS (
              SELECT 1 FROM clients c
              WHERE c.id = ot.cliente_id
                AND c.tiene_cuenta_corriente = true
          )

        UNION ALL

        SELECT
            GREATEST(COALESCE(fecha_entrega_estimada, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0))) as monto,
            'wip_in' as type,
            (COALESCE(fecha_entrega_estimada, CURRENT_DATE)::date < CURRENT_DATE) as is_overdue
        FROM centro_copiado_ordenes cco
        WHERE company_id = p_company_id
          AND estado NOT IN ('cancelada')
          AND (v_collection_basis = 'total' OR estado IN ('finalizada', 'entregada'))
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
            COALESCE(SUM(CASE WHEN m.type = 'cheque_in' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as ingreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'liquidacion_in' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as ingreso_liquidaciones,
            COALESCE(SUM(CASE WHEN m.type = 'wip_in' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as ingreso_wip,
            COALESCE(SUM(CASE WHEN m.type = 'cheque_out' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as egreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'tarjeta_out' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as egreso_tarjetas,
            COALESCE(SUM(CASE WHEN m.type = 'recurring_out' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as egreso_recurrentes,
            COALESCE(SUM(CASE WHEN m.type = 'compra_out' AND NOT m.is_overdue THEN m.monto ELSE 0 END), 0) as egreso_compras,
            COALESCE(SUM(CASE WHEN m.is_overdue AND m.type = 'wip_in' THEN m.monto ELSE 0 END), 0) as ingreso_wip_vencido,
            COALESCE(SUM(CASE WHEN m.is_overdue AND m.type IN ('cheque_in', 'liquidacion_in') THEN m.monto ELSE 0 END), 0) as ingreso_otros_vencidos,
            COALESCE(SUM(CASE WHEN m.is_overdue AND m.type IN ('cheque_out', 'tarjeta_out', 'compra_out', 'recurring_out') THEN m.monto ELSE 0 END), 0) as total_egreso_vencido
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
            da.ingreso_wip_vencido,
            da.ingreso_otros_vencidos,
            (da.ingreso_wip_vencido + da.ingreso_otros_vencidos) as total_ingreso_vencido,
            da.total_egreso_vencido,
            (da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip + da.ingreso_wip_vencido + da.ingreso_otros_vencidos) as total_ingresos,
            (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras + da.total_egreso_vencido) as total_egresos,
            ((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip + da.ingreso_wip_vencido + da.ingreso_otros_vencidos) -
            (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras + da.total_egreso_vencido)) as saldo_diario,
            SUM((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip + da.ingreso_wip_vencido + da.ingreso_otros_vencidos) -
            (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras + da.total_egreso_vencido))
              OVER (ORDER BY da.fecha) + v_saldo_inicial as saldo_acumulado
        FROM daily_agg da
    )
    SELECT * FROM running_balance rb ORDER BY rb.fecha;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_cashflow_projection_v2(UUID, INTEGER, TEXT) TO authenticated;
