-- Migración para corregir el error: column "caja_origen_id" of relation "cajas_movimientos" does not exist
-- 1. Se agrega la columna faltante.
-- 2. Se asegura que la función RPC apunte a esta columna (re-definición por seguridad).

-- 1. Agregar columna
ALTER TABLE cajas_movimientos 
ADD COLUMN IF NOT EXISTS caja_origen_id uuid REFERENCES cajas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cajas_movimientos_caja_origen_id ON cajas_movimientos(caja_origen_id);

-- 2. Refrescar la función (idéntica a la anterior, pero ahora la columna existe físicamente)
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
    -- Verificar política de acceso
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

  -- 3. Registrar Movimiento Egresos (Origen)
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

  -- 4. Registrar Movimiento Ingreso (Destino)
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto, 
    concepto,
    fecha,
    referencia_tipo,
    caja_origen_id, -- AHORA ESTA COLUMNA EXISTE
    notas,
    created_by
  ) VALUES (
    p_caja_destino_id,
    'transferencia', 
    p_monto, 
    p_concepto,
    CURRENT_DATE,
    'transferencia', 
    p_caja_origen_id,
    p_notas,
    v_user_id
  );

  -- 5. Actualizar saldos
  -- Origen
  UPDATE cajas 
  SET saldo_actual = saldo_actual - p_monto,
      updated_at = now()
  WHERE id = p_caja_origen_id;

  -- Destino
  UPDATE cajas 
  SET saldo_actual = saldo_actual + p_monto,
      updated_at = now()
  WHERE id = p_caja_destino_id;

END;
$$;
