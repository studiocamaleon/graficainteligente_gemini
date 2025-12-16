-- Add 'pago_orden_copiado' to the allowed values for referencia_tipo in cajas_movimientos
-- Including all previous values: 'pago_orden', 'pago_copiado', 'gasto', 'egreso', 'transferencia', 'ajuste', 'ingreso_manual'

DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE cajas_movimientos
  DROP CONSTRAINT IF EXISTS cajas_movimientos_referencia_tipo_check;

  -- Re-add the constraint with the new value included
  ALTER TABLE cajas_movimientos
  ADD CONSTRAINT cajas_movimientos_referencia_tipo_check
  CHECK (referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'egreso', 'transferencia', 'ajuste', 'ingreso_manual', 'pago_orden_copiado'));
END $$;
