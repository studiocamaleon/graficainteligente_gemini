/*
  # Accounts Payable Module Schema
  
  1. Changes to Egresos
     - Add `recurrente_id` to link realized payments to their recurring definition.
     - Add `periodo_devengado` to track which month/period is being paid.

  2. New RPC: fn_get_vencimientos_pendientes
     - Consolidates pending debts from:
       a) Recurring Expenses (Ghost projections)
       b) Credit Card Summaries
       c) Issued Cheques
*/

-- 1. Modify Egresos
ALTER TABLE egresos 
ADD COLUMN IF NOT EXISTS recurrente_id uuid REFERENCES recurring_expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS periodo_devengado date; -- Typically the 1st of the month for monthly expenses

CREATE INDEX IF NOT EXISTS idx_egresos_recurrente ON egresos(recurrente_id);

-- 2. Create Vencimientos RPC
CREATE OR REPLACE FUNCTION fn_get_vencimientos_pendientes(
    p_company_id UUID
)
RETURNS TABLE (
    origen TEXT,              -- 'recurrente', 'tarjeta', 'cheque'
    id_origen UUID,           -- ID of the source record
    descripcion TEXT,         -- Description or Concept
    proveedor TEXT,           -- Provider Name
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
            re.amount as monto,
            c.fecha as fecha_vencimiento
        FROM recurring_expenses re
        LEFT JOIN providers p ON p.id = re.provider_id
        CROSS JOIN LATERAL (
            -- Subquery to generate relevant dates for this expense based on frequency
            -- We simulate a calendar generation on the fly for the relevant window
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
          -- CRITICAL: Exclude if an Egreso already exists for this recurrence and period
          -- We assume 'periodo_devengado' matches 'fecha_vencimiento' (or close enough) logic for now
          -- Or simpler: check if an egreso exists linked to this recurrente_id with date in same month
          AND NOT EXISTS (
              SELECT 1 FROM egresos e
              WHERE e.recurrente_id = re.id
              AND (
                  -- Matching month/year for monthly/quarterly/yearly
                  (re.frequency IN ('monthly', 'quarterly', 'yearly') AND 
                   EXTRACT(MONTH FROM e.fecha) = EXTRACT(MONTH FROM c.fecha) AND 
                   EXTRACT(YEAR FROM e.fecha) = EXTRACT(YEAR FROM c.fecha))
                  OR
                  -- Matching week for weekly (approx) - simpler: match exact date +- 3 days? 
                  -- For now, strict: Monthly is the main use case.
                  (re.frequency NOT IN ('monthly', 'quarterly', 'yearly') AND e.fecha = c.fecha)
              )
          )

        UNION ALL

        -- [TARJETA] Unpaid Summaries
        SELECT 
            'tarjeta'::text as origen,
            tr.id as id_origen,
            'Resumen ' || tc.brand || ' ****' || tc.last_four_digits as descripcion,
            'Banco Emsior' as proveedor, -- Could be improved with Bank info
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
            cc.monto,
            cc.fecha_pago as fecha_vencimiento
        FROM cheques_cartera cc
        WHERE cc.company_id = p_company_id
          AND cc.direction = 'emitido'
          AND cc.estado = 'pendiente'
          AND cc.fecha_pago <= v_window_end
    )
    SELECT 
        origen,
        id_origen,
        descripcion,
        proveedor,
        monto,
        fecha_vencimiento,
        CASE 
            WHEN fecha_vencimiento < CURRENT_DATE THEN 'vencido'
            WHEN fecha_vencimiento = CURRENT_DATE THEN 'hoy'
            ELSE 'proximo'
        END as estado,
        (CURRENT_DATE - fecha_vencimiento)::integer as dias_atraso
    FROM pending_debts
    ORDER BY fecha_vencimiento ASC;
END;
$$;
