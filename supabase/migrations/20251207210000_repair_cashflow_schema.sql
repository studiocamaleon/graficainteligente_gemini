-- =============================================
-- MIGRATION: 20251207210000_repair_cashflow_schema.sql
-- Description: Ensures missing tables exist and fixes column names in the projection function.
-- =============================================
/*
  # Repair Cashflow Schema
  1. Ensure `recurring_expenses` exists.
  2. Ensure `cheques` exists.
  3. Update `fn_get_cashflow_projection` to use `saldo_actual` instead of `saldo`.
*/

-- 1. Ensure Recurring Expenses Table Exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'recurring_frequency') THEN
        CREATE TYPE recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ARS',
    provider_id UUID REFERENCES providers(id),
    tipo_egreso_id UUID REFERENCES tipos_egreso(id) NOT NULL,
    frequency recurring_frequency NOT NULL,
    day_of_month INTEGER,
    day_of_week INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for recurring_expenses
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'Users can view their company recurring expenses'
    ) THEN
        CREATE POLICY "Users can view their company recurring expenses" ON recurring_expenses
            FOR SELECT USING (company_id = (select company_id from profiles where id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'Users can manage their company recurring expenses'
    ) THEN
        CREATE POLICY "Users can manage their company recurring expenses" ON recurring_expenses
            FOR ALL USING (company_id = (select company_id from profiles where id = auth.uid()));
    END IF;
END $$;


-- 2. Ensure Cheques Table Exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'cheque_type') THEN
        CREATE TYPE cheque_type AS ENUM ('fisico', 'echeq');
    END IF;
    IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'cheque_status') THEN
        CREATE TYPE cheque_status AS ENUM ('pendiente', 'pagado', 'anulado', 'vencido');
    END IF;
    IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'cheque_direction') THEN
        CREATE TYPE cheque_direction AS ENUM ('emitido', 'recibido');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS cheques (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) NOT NULL,
    tipo cheque_type NOT NULL,
    direction cheque_direction NOT NULL DEFAULT 'emitido',
    numero_cheque TEXT NOT NULL,
    banco TEXT NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_pago DATE NOT NULL,
    monto NUMERIC NOT NULL,
    destinatario TEXT,
    proveedor_id UUID REFERENCES providers(id),
    client_id UUID REFERENCES clients(id),
    orden_id UUID REFERENCES ordenes_trabajo(id),
    estado cheque_status DEFAULT 'pendiente',
    descripcion TEXT,
    comprobante_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for cheques
ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cheques' AND policyname = 'Users can view their company cheques'
    ) THEN
        CREATE POLICY "Users can view their company cheques" ON cheques
            FOR SELECT USING (company_id = (select company_id from profiles where id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cheques' AND policyname = 'Users can manage their company cheques'
    ) THEN
        CREATE POLICY "Users can manage their company cheques" ON cheques
            FOR ALL USING (company_id = (select company_id from profiles where id = auth.uid()));
    END IF;
END $$;


-- 3. Fix RPC Function with correct column name (saldo_actual)
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
    -- FIXED: Changed 'saldo' to 'saldo_actual'
    SELECT COALESCE(SUM(saldo_actual), 0)
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
        SELECT 
            COALESCE(o.fecha_estimada_entrega::date, (o.created_at + interval '7 days')::date) as fecha,
            (o.total - COALESCE((SELECT SUM(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = o.id), 0)) as monto_ingreso,
            0::numeric as monto_egreso
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
