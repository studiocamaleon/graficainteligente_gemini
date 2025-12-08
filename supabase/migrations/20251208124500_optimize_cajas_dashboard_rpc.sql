CREATE OR REPLACE FUNCTION fn_get_cajas_dashboard(
    p_company_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    tipo TEXT,
    moneda TEXT,
    saldo_actual NUMERIC,
    es_principal BOOLEAN,
    is_active BOOLEAN,
    ingresos_hoy NUMERIC,
    egresos_hoy NUMERIC,
    movimientos_hoy INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nombre,
        c.tipo,
        c.moneda,
        c.saldo_actual,
        c.es_principal,
        c.is_active,
        COALESCE(sums.ingresos, 0) as ingresos_hoy,
        COALESCE(sums.egresos, 0) as egresos_hoy,
        COALESCE(sums.movimientos, 0)::integer as movimientos_hoy
    FROM cajas c
    LEFT JOIN (
        SELECT 
            cm.caja_id,
            SUM(CASE WHEN cm.tipo_movimiento = 'ingreso' THEN cm.monto ELSE 0 END) as ingresos,
            SUM(CASE WHEN cm.tipo_movimiento = 'egreso' THEN cm.monto ELSE 0 END) as egresos,
            COUNT(*) as movimientos
        FROM cajas_movimientos cm
        WHERE cm.fecha = p_date
        GROUP BY cm.caja_id
    ) sums ON sums.caja_id = c.id
    WHERE c.company_id = p_company_id
      AND c.is_active = true
    ORDER BY c.es_principal DESC, c.tipo, c.nombre;
END;
$$;
