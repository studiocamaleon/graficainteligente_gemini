-- Migración para FORZAR la actualización de fn_realizar_arqueo_caja
-- Se elimina primero la función para asegurar que la nueva versión limpia sea la que queda activa.

DROP FUNCTION IF EXISTS fn_realizar_arqueo_caja(uuid, numeric, text, jsonb);

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
BEGIN
    -- Get Context
    v_user_id := auth.uid();
    
    SELECT company_id INTO v_company_id
    FROM profiles WHERE id = v_user_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to a company';
    END IF;

    -- Get System Balance
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
        -- Create adjustment movement in cajas_movimientos
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
            CASE WHEN v_diferencia > 0 THEN 'ingreso' ELSE 'egreso' END,
            ABS(v_diferencia),
            'Ajuste automático por Arqueo de Caja',
            CURRENT_DATE,
            'ajuste',
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
