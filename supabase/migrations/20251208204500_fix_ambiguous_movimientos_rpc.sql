-- Corrije error de ambigüedad de columna "id" en fn_get_movimientos_caja
-- El problema ocurría porque el parámetro de retorno "id" entra en conflicto con las columnas "id" de las tablas consultadas si no se califican con alias.

CREATE OR REPLACE FUNCTION fn_get_movimientos_caja(
    p_caja_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    fecha DATE,
    tipo_movimiento TEXT,
    monto NUMERIC,
    concepto TEXT,
    notas TEXT,
    referencia_tipo TEXT,
    usuario_nombre TEXT,
    otro_caja_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
BEGIN
    -- 1. Verificar acceso: Usamos alias 'c' para evitar ambigüedad con variable de retorno 'id'
    SELECT c.company_id INTO v_company_id
    FROM cajas c
    WHERE c.id = p_caja_id;

    -- 2. Verificar perfil: Usamos alias 'prof' para evitar ambigüedad
    IF NOT EXISTS (
        SELECT 1 FROM profiles prof
        WHERE prof.id = v_user_id AND prof.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Access Denied: User not in company';
    END IF;

    -- 3. Query principal: Las referencias ya estaban calificadas, pero se mantienen así.
    RETURN QUERY
    SELECT 
        cm.id,
        cm.fecha,
        CASE 
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = p_caja_id THEN 'transferencia_saliente'
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = p_caja_id THEN 'transferencia_entrante'
            ELSE cm.tipo_movimiento
        END as tipo_movimiento,
        cm.monto,
        cm.concepto,
        cm.notas,
        cm.referencia_tipo,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) as usuario_nombre,
        CASE
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = p_caja_id THEN c_dest.nombre -- Saliente: mostramos destino
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = p_caja_id THEN c_orig.nombre -- Entrante: mostramos origen
            ELSE NULL
        END as otro_caja_nombre
    FROM cajas_movimientos cm
    LEFT JOIN profiles p ON p.id = cm.created_by
    LEFT JOIN cajas c_dest ON c_dest.id = cm.caja_destino_id
    LEFT JOIN cajas c_orig ON c_orig.id = cm.caja_id
    WHERE 
        (cm.caja_id = p_caja_id OR cm.caja_destino_id = p_caja_id)
    ORDER BY cm.fecha DESC, cm.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
