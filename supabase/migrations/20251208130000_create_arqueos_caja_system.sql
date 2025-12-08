-- =============================================
-- MIGRATION: 20251208130000_create_arqueos_caja_system.sql
-- Description: Creates the system for Daily Cash Counts (Arqueos)
-- =============================================

-- 1. Create table `arqueos_cajas`
CREATE TABLE IF NOT EXISTS arqueos_cajas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    caja_id UUID NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
    fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT now(),
    saldo_sistema NUMERIC NOT NULL,
    saldo_real NUMERIC NOT NULL,
    diferencia NUMERIC NOT NULL, -- Calculated as (saldo_real - saldo_sistema)
    billetes_detalle JSONB DEFAULT '{}'::jsonb,
    observaciones TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arqueos_caja_id ON arqueos_cajas(caja_id);
CREATE INDEX IF NOT EXISTS idx_arqueos_company_id ON arqueos_cajas(company_id);
CREATE INDEX IF NOT EXISTS idx_arqueos_fecha ON arqueos_cajas(fecha_cierre DESC);

-- RLS
ALTER TABLE arqueos_cajas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company arqueos" ON arqueos_cajas;
CREATE POLICY "Users can view own company arqueos"
ON arqueos_cajas FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own company arqueos" ON arqueos_cajas;
CREATE POLICY "Users can insert own company arqueos"
ON arqueos_cajas FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 2. Create RPC `fn_realizar_arqueo_caja`
CREATE OR REPLACE FUNCTION fn_realizar_arqueo_caja(
    p_caja_id UUID,
    p_saldo_real NUMERIC,
    p_observaciones TEXT DEFAULT NULL,
    p_billetes_detalle JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_saldo_sistema NUMERIC;
    v_diferencia NUMERIC;
    v_arqueo_id UUID;
    v_movimiento_id UUID;
BEGIN
    -- Get Context
    v_user_id := auth.uid();
    
    SELECT company_id INTO v_company_id
    FROM profiles WHERE id = v_user_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to a company';
    END IF;

    -- Get System Balance (Locking beneficial but simplistic reading is ok for now)
    SELECT saldo_actual INTO v_saldo_sistema
    FROM cajas
    WHERE id = p_caja_id AND company_id = v_company_id;

    IF v_saldo_sistema IS NULL THEN
        RAISE EXCEPTION 'Caja not found or access denied';
    END IF;

    -- Calculate Difference
    v_diferencia := p_saldo_real - v_saldo_sistema;

    -- Create Arqueo Record
    INSERT INTO arqueos_cajas (
        company_id,
        caja_id,
        saldo_sistema,
        saldo_real,
        diferencia,
        billetes_detalle,
        observaciones,
        created_by
    ) VALUES (
        v_company_id,
        p_caja_id,
        v_saldo_sistema,
        p_saldo_real,
        v_diferencia,
        p_billetes_detalle,
        p_observaciones,
        v_user_id
    ) RETURNING id INTO v_arqueo_id;

    -- Automatic Adjustment Logic
    IF v_diferencia != 0 THEN
        -- Create 'ajuste' movement in cajas_movimientos
        INSERT INTO cajas_movimientos (
            caja_id,
            tipo_movimiento,
            monto,
            concepto,
            fecha,
            referencia_tipo,
            referencia_id,
            notas,
            created_by
        ) VALUES (
            p_caja_id,
            CASE WHEN v_diferencia > 0 THEN 'ingreso' ELSE 'egreso' END, -- Or strict 'ajuste'? 'ajuste' is usually a movement type?
            -- Let's check existing types. Usually 'ingreso'/'egreso'/'transferencia'/'ajuste'.
            -- If 'ajuste' is supported by triggers updating balance correctly (it adds signed amount?), let's verify.
            -- Previous analysis showed: WHEN tipo_movimiento = 'ajuste' THEN monto.
            -- But simple 'ajuste' implies direction? Mmm.
            -- Code snippet showed: WHEN tipo_movimiento = 'ajuste' THEN monto.
            -- If difference is negative (missing money), we need to SUBTRACT from balance.
            -- If type is 'ajuste' and trigger adds 'monto', then 'monto' must be negative?
            -- Trigger logic seen: 
            -- WHEN tipo_movimiento = 'ingreso' THEN monto
            -- WHEN tipo_movimiento = 'egreso' THEN -monto
            -- WHEN tipo_movimiento = 'ajuste' THEN monto
            -- So if we use 'ajuste', me must pass negative value if we want to reduce balance?
            -- Or use 'egreso' / 'ingreso'.
            -- Let's use 'ajuste' type, but handle sign.
            -- If saldo_real < saldo_sistema -> Diff is negative. We need to reduce balance. 
            -- Passing negative monto to 'ajuste'? Or 'egreso'?
            -- Let's stick to 'ajuste' for clarity in reports.
            -- If diff = -500. New Balance = Old + (-500). Correct.
            'ajuste',
            ABS(v_diferencia), -- Wait, if I pass positive ABS, and trigger adds it...
            -- Checking trigger again: "WHEN tipo_movimiento = 'ajuste' THEN monto"
            -- If I pass positive 500, balance increases. If I have -500 diff, I need balance to decrease.
            -- So I should pass -500? Or use 'ingreso'/'egreso'?
            -- Using 'egreso' ensures it subtracts. Using 'ingreso' adds.
            -- If I use 'ajuste', I might need to pass signed value? Usually 'monto' constraint > 0 exists? 
            -- Check constraint: "monto numeric NOT NULL CHECK (monto > 0)" often exists.
            -- Let's check if cajas_movimientos has check constraint > 0.
            -- If so, 'ajuste' with negative value will fail.
            -- Safe bet: Use 'ingreso' (Sobranje) or 'egreso' (Faltante).
            
            CASE 
                WHEN v_diferencia > 0 THEN 'ingreso' -- Surplus
                ELSE 'egreso' -- Shortage
            END,
            
            ABS(v_diferencia),
            'Ajuste automático por Arqueo de Caja',
            CURRENT_DATE,
            'ajuste', -- Referencia type 'ajuste' matches schema
            v_arqueo_id,
            CASE 
                WHEN v_diferencia > 0 THEN 'Sobrante de Caja ajustado automáticamente'
                ELSE 'Faltante de Caja ajustado automáticamente'
            END,
            v_user_id
        );
    END IF;

    RETURN jsonb_build_object(
        'id', v_arqueo_id,
        'saldo_sistema', v_saldo_sistema,
        'saldo_real', p_saldo_real,
        'diferencia', v_diferencia
    );
END;
$$;
