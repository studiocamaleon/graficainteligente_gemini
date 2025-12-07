-- Function to get clients with their current account balance efficiently
CREATE OR REPLACE FUNCTION fn_get_clientes_con_saldo(
    p_company_id UUID,
    p_search_term TEXT DEFAULT '',
    p_estado_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nombre_fantasia TEXT,
    razon_social TEXT,
    numero_documento TEXT,
    acuerdo_pago TEXT,
    dia_cierre_semanal INTEGER,
    dia_cierre_mensual INTEGER,
    usa_ultimo_dia_mes BOOLEAN,
    dias_vencimiento_config INTEGER,
    tiene_cuenta_corriente BOOLEAN,
    saldo_actual NUMERIC,
    estado_cc TEXT,
    dias_vencimiento INTEGER,
    fecha_ultima_liquidacion DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH saldos AS (
        -- Calculate balance for all clients in company
        SELECT 
            m.cliente_id,
            SUM(m.saldo_acumulado) as ultimo_saldo -- This logic is wrong for getting current balance, we need the last movement's balance or sum of debe/haber
        FROM cuentas_corrientes_movimientos m
        WHERE m.company_id = p_company_id
        -- We actually need the LATEST row per client to get the running balance
        -- Or simply SUM(debe - haber) if we trust the ledger
        GROUP BY m.cliente_id
    ),
    client_balances AS (
        SELECT 
            c.id,
            c.nombre_fantasia,
            c.razon_social,
            c.numero_documento,
            c.acuerdo_pago,
            c.dia_cierre_semanal,
            c.dia_cierre_mensual,
            c.usa_ultimo_dia_mes,
            c.dias_vencimiento as dias_vencimiento_config,
            c.tiene_cuenta_corriente,
            -- Calculate precise balance: Total Debe - Total Haber is safer than relying on last row order if not strictly enforced
            COALESCE((
                SELECT SUM(ccm.monto_debe - ccm.monto_haber)
                FROM cuentas_corrientes_movimientos ccm
                WHERE ccm.cliente_id = c.id AND ccm.company_id = p_company_id
            ), 0) as saldo_calc
        FROM clients c
        WHERE c.company_id = p_company_id
          AND c.is_active = true
          AND c.tiene_cuenta_corriente = true
    ),
    liquidaciones_info AS (
        SELECT 
            l.cliente_id,
            MIN(l.fecha_vencimiento) as fecha_vencimiento_mas_antigua,
            MAX(l.fecha_vencimiento) as ultima_fecha_liquidacion
        FROM liquidaciones l
        WHERE l.company_id = p_company_id
          AND l.estado != 'cancelada'
          AND l.saldo_pendiente > 0
        GROUP BY l.cliente_id
    )
    SELECT 
        c.id,
        c.nombre_fantasia,
        c.razon_social,
        c.numero_documento,
        c.acuerdo_pago::TEXT,
        c.dia_cierre_semanal,
        c.dia_cierre_mensual,
        c.usa_ultimo_dia_mes,
        c.dias_vencimiento_config,
        c.tiene_cuenta_corriente,
        c.saldo_calc as saldo_actual,
        CASE 
            WHEN li.fecha_vencimiento_mas_antigua < CURRENT_DATE THEN 'vencido'
            WHEN li.fecha_vencimiento_mas_antigua <= (CURRENT_DATE + interval '3 days') THEN 'proximo_vencer'
            ELSE 'al_dia'
        END as estado_cc,
        CASE 
            WHEN li.fecha_vencimiento_mas_antigua IS NOT NULL THEN 
                (li.fecha_vencimiento_mas_antigua - CURRENT_DATE)::INTEGER
            ELSE NULL 
        END as dias_vencimiento,
        li.ultima_fecha_liquidacion
    FROM client_balances c
    LEFT JOIN liquidaciones_info li ON c.id = li.cliente_id
    WHERE 
        (p_search_term = '' OR 
         c.nombre_fantasia ILIKE '%' || p_search_term || '%' OR
         c.razon_social ILIKE '%' || p_search_term || '%' OR
         c.numero_documento ILIKE '%' || p_search_term || '%')
    AND
        (p_estado_filter IS NULL OR 
         (CASE 
            WHEN li.fecha_vencimiento_mas_antigua < CURRENT_DATE THEN 'vencido'
            WHEN li.fecha_vencimiento_mas_antigua <= (CURRENT_DATE + interval '3 days') THEN 'proximo_vencer'
            ELSE 'al_dia'
          END) = p_estado_filter
        );
END;
$$;
