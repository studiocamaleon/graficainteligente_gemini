/*
  # Seguridad: Restricción de Visibilidad de Cajas por Rol

  ## Objetivo
  Limitar el acceso a la información financiera según el rol del usuario:

  1. **Super Admin, Admin, Manager**:
     - Acceso TOTAL a todas las cajas y movimientos.

  2. **Operador de Diseño**:
     - Acceso LIMITADO solo a cajas operativas de efectivo.
     - Regla: `tipo = 'efectivo'` Y `es_principal = false`.
     - NO ve Bancos, NO ve Pasarelas, NO ve Caja Fuerte (Principal).

  3. **Operador Taller / Viewer**:
     - SIN ACCESO a ninguna caja.

  ## Cambios
  - Se actualizan las políticas RLS de `cajas` y `cajas_movimientos`.
*/

-- =====================================================
-- 1. Actualizar RLS en tabla 'cajas'
-- =====================================================

DROP POLICY IF EXISTS "Users can view own company cajas" ON cajas;

CREATE POLICY "Role based view access for cajas"
  ON cajas FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Grupo 1: Acceso Total
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager')
      )
      OR
      -- Grupo 2: Operador Diseño (Solo efectivo operativo)
      (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role = 'operador_diseno'
        )
        AND tipo = 'efectivo'
        AND es_principal = false
      )
    )
  );

-- =====================================================
-- 2. Actualizar RLS en tabla 'cajas_movimientos'
-- =====================================================
-- La política anterior confiaba en filtrar por 'cajas', pero para mayor seguridad
-- y performance, replicamos la lógica restrictiva explícitamente o confiamos en el JOIN seguro.
-- Dado que RLS aplica al JOIN, si el usuario no puede ver la caja X en 'cajas',
-- tampoco debería poder ver sus movimientos si filtramos con `caja_id IN (SELECT id FROM cajas)`.

DROP POLICY IF EXISTS "Users can view own company cajas_movimientos" ON cajas_movimientos;

CREATE POLICY "Role based view access for cajas_movimientos"
  ON cajas_movimientos FOR SELECT
  TO authenticated
  USING (
    caja_id IN (
      SELECT id FROM cajas -- Esto usa la política de arriba automáticamente
    )
  );

-- =====================================================
-- 3. Actualizar Permisos de 'fn_get_cajas_dashboard'
-- =====================================================
-- Dado que la funcion es SECURITY DEFINER, salta RLS.
-- Debemos agregar el filtro de seguridad DENTRO de la función.

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
    -- Obtener rol del usuario actual
    SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();

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
      AND (
        -- Lógica de seguridad replicada
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
