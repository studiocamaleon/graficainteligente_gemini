-- RPC Actualizado: fn_get_vencimientos_pendientes
-- Ahora soporta:
-- 1. Gastos Recurrentes con Lógica de Saldo (Estimado - Pagado).
-- 2. Cierres Manuales (Ignorar saldo restante si el período se marcó como cerrado).
-- 3. Compras Manuales / Facturas Pendientes (compras_proveedores).
-- 4. Tarjetas y Cheques (Existentes).

-- DROP necesario porque cambió el tipo de retorno (TABLE structure)
DROP FUNCTION IF EXISTS fn_get_vencimientos_pendientes(UUID);

CREATE OR REPLACE FUNCTION fn_get_vencimientos_pendientes(
    p_company_id UUID
)
RETURNS TABLE (
    origen TEXT,              -- 'recurrente', 'compra', 'tarjeta', 'cheque'
    id_origen UUID,           -- ID del registro origen
    descripcion TEXT,         -- Descripción
    proveedor TEXT,           -- Nombre proveedor
    monto_total NUMERIC,      -- Monto original / estimado
    monto_pagado NUMERIC,     -- Lo que ya se pagó
    monto_pendiente NUMERIC,  -- Lo que falta pagar
    fecha_vencimiento DATE,   -- Fecha de vencimiento
    periodo_ref DATE,         -- Para recurrentes: fecha del período (ej: 01/01/2025). Para otros: null o fecha_venc.
    estado TEXT,              -- 'vencido', 'hoy', 'proximo'
    dias_atraso INTEGER       -- Días de diferencia
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_window_start DATE := CURRENT_DATE - INTERVAL '6 months';
    v_window_end DATE := CURRENT_DATE + INTERVAL '60 days';
BEGIN
    RETURN QUERY
    WITH pending_debts AS (
        -- 1. [RECURRENTE] Gastos Flexibles (Proyectado - Pagado)
        SELECT 
            'recurrente'::text as origen,
            re.id as id_origen,
            re.description as descripcion,
            COALESCE(p.nombre_fantasia, 'Sin Proveedor') as proveedor,
            re.amount as monto_total,
            -- Calcular pagado para este período específico
            COALESCE((
                SELECT SUM(e.monto)
                FROM egresos e
                WHERE e.recurrente_id = re.id
                -- Coincidencia flexible de fecha (mismo mes/año para mensuales)
                AND (
                    (re.frequency::text IN ('monthly', 'quarterly', 'yearly') AND 
                     date_trunc('month', e.fecha) = date_trunc('month', c.fecha))
                    OR
                    (re.frequency::text NOT IN ('monthly', 'quarterly', 'yearly') AND 
                     e.fecha = c.fecha)
                )
            ), 0) as monto_pagado,
            c.fecha as fecha_vencimiento,
            c.fecha as periodo_ref
        FROM recurring_expenses re
        LEFT JOIN providers p ON p.id = re.provider_id
        CROSS JOIN LATERAL (
            -- Generación de fechas de vencimiento teóricas
            SELECT d::date as fecha
            FROM generate_series(GREATEST(re.start_date, v_window_start), LEAST(COALESCE(re.end_date, v_window_end), v_window_end), '1 day'::interval) d
            WHERE 
                (re.frequency::text = 'weekly' AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency::text = 'biweekly' AND MOD(EXTRACT(WEEK FROM d)::int, 2) = 0 AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency::text = 'monthly' AND EXTRACT(DAY FROM d) = re.day_of_month) OR
                (re.frequency::text = 'quarterly' AND EXTRACT(DAY FROM d) = re.day_of_month AND MOD(EXTRACT(MONTH FROM d)::int - 1, 3) = 0) OR
                (re.frequency::text = 'yearly' AND EXTRACT(DAY FROM d) = re.day_of_month AND EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM re.start_date))
        ) c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          -- FILTRO CLAVE: Excluir si está marcado como "Cerrado Manualmente" en recurring_executions
          AND NOT EXISTS (
              SELECT 1 FROM recurring_executions rx
              WHERE rx.recurring_id = re.id
              AND (
                  -- Coincidencia de período
                  (re.frequency::text IN ('monthly', 'quarterly', 'yearly') AND 
                   date_trunc('month', rx.periodo) = date_trunc('month', c.fecha))
                  OR
                  (re.frequency::text NOT IN ('monthly', 'quarterly', 'yearly') AND 
                   rx.periodo = c.fecha)
              )
              AND rx.estado = 'cerrado'
          )

        UNION ALL

        -- 2. [COMPRA] Facturas Manuales Pendientes
        SELECT 
            'compra'::text as origen,
            cp.id as id_origen,
            cp.descripcion || COALESCE(' - ' || cp.numero_factura, '') as descripcion,
            COALESCE(p.nombre_fantasia, 'Sin Proveedor') as proveedor,
            cp.monto_total,
            COALESCE((SELECT SUM(e.monto) FROM egresos e WHERE e.compra_id = cp.id), 0) as monto_pagado,
            cp.fecha_vencimiento,
            NULL::date as periodo_ref
        FROM compras_proveedores cp
        LEFT JOIN providers p ON p.id = cp.provider_id
        WHERE cp.company_id = p_company_id
          AND cp.estado != 'pagado'
        
        UNION ALL

        -- 3. [TARJETA] Resúmenes
        SELECT 
            'tarjeta'::text as origen,
            tr.id as id_origen,
            'Resumen ' || tc.nombre || ' ****' || COALESCE(tc.ultimos_4_digitos, '') as descripcion,
            'Banco Emisor' as proveedor,
            tr.total_consumos as monto_total,
            tr.total_pagado as monto_pagado,
            tr.fecha_vencimiento,
            NULL::date as periodo_ref
        FROM tarjetas_resumenes tr
        JOIN tarjetas_credito tc ON tc.id = tr.tarjeta_id
        WHERE tr.company_id = p_company_id
          AND tr.estado != 'pagado'
          AND tr.fecha_vencimiento <= v_window_end

        UNION ALL

        -- 4. [CHEQUE] Cheques Emitidos Pendientes
        SELECT 
            'cheque'::text as origen,
            cc.id as id_origen,
            'Cheque #' || cc.numero_cheque as descripcion,
            COALESCE(cc.destinatario, 'Portador') as proveedor,
            cc.monto as monto_total,
            0::numeric as monto_pagado,
            cc.fecha_pago as fecha_vencimiento,
            NULL::date as periodo_ref
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
        pd.monto_total,
        pd.monto_pagado,
        (pd.monto_total - pd.monto_pagado) as monto_pendiente,
        pd.fecha_vencimiento,
        pd.periodo_ref,
        CASE 
            WHEN pd.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
            WHEN pd.fecha_vencimiento = CURRENT_DATE THEN 'hoy'
            ELSE 'proximo'
        END as estado,
        (CURRENT_DATE - pd.fecha_vencimiento)::integer as dias_atraso
    FROM pending_debts pd
    WHERE (pd.monto_total - pd.monto_pagado) > 0
    ORDER BY pd.fecha_vencimiento ASC;
END;
$$;
