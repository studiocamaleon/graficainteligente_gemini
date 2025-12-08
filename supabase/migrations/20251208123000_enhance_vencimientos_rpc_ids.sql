DROP FUNCTION IF EXISTS fn_get_vencimientos_pendientes(UUID);

CREATE OR REPLACE FUNCTION fn_get_vencimientos_pendientes(
    p_company_id UUID
)
RETURNS TABLE (
    origen TEXT,              -- 'recurrente', 'tarjeta', 'cheque'
    id_origen UUID,           -- ID of the source record
    descripcion TEXT,         -- Description or Concept
    proveedor TEXT,           -- Provider Name
    proveedor_id UUID,        -- Provider ID (for pre-filling logic)
    tipo_egreso_id UUID,      -- Category ID (for pre-filling logic)
    monto NUMERIC,            -- Amount due
    fecha_vencimiento DATE,   -- Due date
    estado TEXT,              -- 'vencido', 'hoy', 'proximo'
    dias_atraso INTEGER       -- Days overdue (>0) or days until due (<0)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_window_start DATE := CURRENT_DATE - INTERVAL '6 months'; -- Look back 6 months for unpaid recurring
    v_window_end DATE := CURRENT_DATE + INTERVAL '30 days';    -- Look ahead 30 days
BEGIN
    RETURN QUERY
    WITH pending_debts AS (
        -- [RECURRENTE] Ghost Expenses (Projected but NOT Paid)
        SELECT 
            'recurrente'::text as origen,
            re.id as id_origen,
            re.description as descripcion,
            COALESCE(p.nombre_fantasia, 'Sin Proveedor') as proveedor,
            re.provider_id as proveedor_id,
            re.tipo_egreso_id as tipo_egreso_id,
            re.amount as monto,
            c.fecha as fecha_vencimiento
        FROM recurring_expenses re
        LEFT JOIN providers p ON p.id = re.provider_id
        CROSS JOIN LATERAL (
            SELECT d::date as fecha
            FROM generate_series(GREATEST(re.start_date, v_window_start), LEAST(COALESCE(re.end_date, v_window_end), v_window_end), '1 day'::interval) d
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

        UNION ALL

        -- [TARJETA] Unpaid Summaries
        SELECT 
            'tarjeta'::text as origen,
            tr.id as id_origen,
            'Resumen ' || tc.nombre || ' (****' || COALESCE(tc.ultimos_4_digitos, '????') || ')' as descripcion,
            'Banco Emisor' as proveedor,
            NULL::uuid as proveedor_id, -- Generally no specific provider for Card Summary payment (it's the Bank)
            NULL::uuid as tipo_egreso_id, -- Usually defined by the user as "Pago Tarjeta"
            (tr.total_consumos - tr.total_pagado) as monto,
            tr.fecha_vencimiento
        FROM tarjetas_resumenes tr
        JOIN tarjetas_credito tc ON tc.id = tr.tarjeta_id
        WHERE tr.company_id = p_company_id
          AND tr.estado != 'pagado'
          AND tr.fecha_vencimiento <= v_window_end

        UNION ALL

        -- [CHEQUE] Issued Cheques Pending Debit
        SELECT 
            'cheque'::text as origen,
            cc.id as id_origen,
            'Cheque #' || cc.numero_cheque as descripcion,
            COALESCE(cc.destinatario, 'Portador') as proveedor,
            cc.proveedor_id as proveedor_id, -- Can be pre-filled
            NULL::uuid as tipo_egreso_id, -- Cheques don't have a single category usually
            cc.monto,
            cc.fecha_pago as fecha_vencimiento
        FROM cheques_cartera cc
        WHERE cc.company_id = p_company_id
          AND cc.direction = 'emitido'
          AND cc.estado = 'pendiente'
          AND cc.fecha_pago <= v_window_end
    )
    SELECT 
        pd.origen,
        pd.id_origen,
        pd.descripcion,
        pd.proveedor,
        pd.proveedor_id,
        pd.tipo_egreso_id,
        pd.monto,
        pd.fecha_vencimiento,
        CASE 
            WHEN pd.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
            WHEN pd.fecha_vencimiento = CURRENT_DATE THEN 'hoy'
            ELSE 'proximo'
        END as estado,
        (CURRENT_DATE - pd.fecha_vencimiento)::integer as dias_atraso
    FROM pending_debts pd
    ORDER BY pd.fecha_vencimiento ASC;
END;
$$;
