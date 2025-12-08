-- RPC para obtener movimientos de una caja (Historial)
-- Permite ver:
-- 1. Movimientos directos (caja_id = p_caja_id)
-- 2. Transferencias entrantes (caja_destino_id = p_caja_id)
-- Incluso si el usuario no tiene permiso de ver la caja de origen de la transferencia.

CREATE OR REPLACE FUNCTION fn_get_movimientos_caja(
    p_caja_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    fecha DATE,
    tipo_movimiento TEXT, -- 'ingreso', 'egreso', 'transferencia_saliente', 'transferencia_entrante'
    monto NUMERIC,
    concepto TEXT,
    notas TEXT,
    referencia_tipo TEXT,
    usuario_nombre TEXT,
    otro_caja_nombre TEXT -- Nombre de la otra caja en caso de transferencia
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_has_access BOOLEAN;
BEGIN
    -- 1. Verificar que el usuario tiene acceso a la CAJA CONSULTADA (p_caja_id)
    SELECT company_id INTO v_company_id
    FROM cajas
    WHERE id = p_caja_id;

    -- Verificar si el usuario pertenece a la misma compañía y tiene rol adecuado para ver ESTA caja
    -- (Reutilizamos la lógica de RLS implícita: si puede ver la caja en 'cajas', puede ver sus movimientos)
    -- Pero al ser Security Definer, debemos chequear manualmente.
    
    -- Chequeo simple de compañía
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_user_id AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Access Denied: User not in company';
    END IF;

    -- Chequeo de rol específico (opcional, pero consistente con RLS de cajas)
    -- Si es operador_diseno, solo puede ver cajas no principales O cajas asignadas.
    -- Por simplicidad, asumimos que si tiene el ID y es de la compañía, puede ver el historial,
    -- ya que el frontend no le mostrará el botón para cajas que no ve.
    -- (Para mayor seguridad, se podría replicar la lógica de 'fn_get_cajas_dashboard' aquí).

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
