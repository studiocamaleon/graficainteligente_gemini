-- Refactorizar Transferencias a Modelo de Fila Única y arreglar Dashboard
-- 1. fn_realizar_transferencia_caja: Solo inserta 1 fila. El trigger se encarga de actualizar ambos saldos.
-- 2. fn_get_cajas_dashboard: Se suma lo entrante por transferencias (caja_destino_id).

-- 1. FIX RPC Transferencia
CREATE OR REPLACE FUNCTION fn_realizar_transferencia_caja(
  p_caja_origen_id uuid,
  p_caja_destino_id uuid,
  p_monto numeric,
  p_concepto text,
  p_notas text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_saldo_origen numeric;
BEGIN
  -- 1. Verificar acceso a CAJA ORIGEN y obtener company_id
  SELECT c.company_id, c.saldo_actual INTO v_company_id, v_saldo_origen
  FROM cajas c
  WHERE c.id = p_caja_origen_id
  AND (
    c.company_id IN (SELECT p.company_id FROM profiles p WHERE p.id = v_user_id)
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso sobre la caja de origen o no existe.';
  END IF;

  -- 2. Validaciones básicas
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0.';
  END IF;

  IF v_saldo_origen < p_monto THEN
    RAISE EXCEPTION 'Saldo insuficiente en la caja de origen.';
  END IF;

  -- 3. Registrar Transacción (Única fila)
  -- El trigger 'actualizar_saldo_caja' detectará 'transferencia' y:
  --   - Restará a caja_id (Origen)
  --   - Sumará a caja_destino_id (Destino)
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    caja_destino_id,
    notas,
    created_by
  ) VALUES (
    p_caja_origen_id,
    'transferencia',
    p_monto,
    p_concepto,
    CURRENT_DATE,
    'transferencia',
    p_caja_destino_id,
    p_notas,
    v_user_id
  );

  -- NO ACTUALIZAR SALDOS MANUALMENTE (El trigger lo hace)

END;
$$;


-- 2. FIX Dashboard (Incluir transferencias entrantes)
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
DECLARE
    v_user_role text;
BEGIN
    SELECT p.role INTO v_user_role FROM profiles p WHERE p.id = auth.uid();

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
            caja_id_grouped,
            SUM(ingreso) as ingresos,
            SUM(egreso) as egresos,
            SUM(count_mov) as movimientos
        FROM (
            -- Movimientos donde la caja es la principal (caja_id)
            SELECT 
                cm.caja_id as caja_id_grouped,
                SUM(CASE WHEN cm.tipo_movimiento = 'ingreso' THEN cm.monto ELSE 0 END) as ingreso,
                SUM(CASE 
                    WHEN cm.tipo_movimiento = 'egreso' THEN cm.monto 
                    WHEN cm.tipo_movimiento = 'transferencia' THEN cm.monto -- Egreso por transferencia
                    ELSE 0 
                END) as egreso,
                COUNT(*) as count_mov
            FROM cajas_movimientos cm
            WHERE cm.fecha = p_date
            GROUP BY cm.caja_id

            UNION ALL

            -- Movimientos donde la caja es DESTINO de una transferencia
            SELECT 
                cm.caja_destino_id as caja_id_grouped,
                SUM(cm.monto) as ingreso, -- Entra dinero
                0 as egreso,
                COUNT(*) as count_mov
            FROM cajas_movimientos cm
            WHERE cm.fecha = p_date 
              AND cm.tipo_movimiento = 'transferencia'
              AND cm.caja_destino_id IS NOT NULL
            GROUP BY cm.caja_destino_id
        ) combined
        GROUP BY caja_id_grouped
    ) sums ON sums.caja_id_grouped = c.id
    WHERE c.company_id = p_company_id
      AND c.is_active = true
      AND (
        v_user_role IN ('super_admin', 'admin', 'manager')
        OR
        (
            v_user_role = 'operador_diseno' 
            AND c.tipo = 'efectivo' 
            AND c.es_principal = false
        )
      )
    ORDER BY c.es_principal DESC, c.tipo, c.nombre;
END;
$$;
