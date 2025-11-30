/*
  # Fix cajas_movimientos referencia_tipo constraint

  ## Descripción
  Agrega 'egreso' como valor válido en la restricción referencia_tipo de cajas_movimientos
  para permitir que los egresos registren movimientos correctamente.

  ## Cambios
  - Elimina la restricción existente cajas_movimientos_referencia_tipo_check
  - Crea nueva restricción incluyendo 'egreso' en los valores permitidos

  ## Razón
  El sistema de egresos necesita registrar movimientos con referencia_tipo = 'egreso'
  pero la restricción original no lo incluía, causando errores al registrar gastos.
*/

-- Eliminar restricción existente
ALTER TABLE cajas_movimientos
  DROP CONSTRAINT IF EXISTS cajas_movimientos_referencia_tipo_check;

-- Crear nueva restricción con 'egreso' incluido
ALTER TABLE cajas_movimientos
  ADD CONSTRAINT cajas_movimientos_referencia_tipo_check
  CHECK (
    referencia_tipo IS NULL OR
    referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste', 'egreso')
  );
