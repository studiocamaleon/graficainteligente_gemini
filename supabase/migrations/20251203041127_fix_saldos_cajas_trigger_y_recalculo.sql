/*
  # Corrección de Saldos de Cajas Post-Limpieza

  ## Problema
  Después de la limpieza de datos, las cajas mantienen saldos positivos porque:
  1. No se eliminaron todos los movimientos de cajas (solo los con referencia_tipo específica)
  2. El trigger actualizar_saldo_caja() solo se ejecuta en INSERT, no en DELETE
  3. Los saldos no se recalculan automáticamente al eliminar movimientos

  ## Solución
  1. Eliminar TODOS los movimientos de cajas
  2. Resetear todos los saldos a 0
  3. Agregar trigger para DELETE que también recalcule saldos
  4. Dejar el sistema listo para comenzar desde cero

  ## Importante
  Esta es una corrección a la migración de limpieza anterior.
  Asegura que el sistema esté completamente limpio sin saldos fantasma.
*/

-- =====================================================
-- 1. LIMPIAR TODOS LOS MOVIMIENTOS DE CAJAS
-- =====================================================

TRUNCATE TABLE cajas_movimientos CASCADE;

-- =====================================================
-- 2. RESETEAR TODOS LOS SALDOS DE CAJAS A 0
-- =====================================================

UPDATE cajas
SET saldo_actual = 0
WHERE saldo_actual != 0;

-- =====================================================
-- 3. MEJORAR TRIGGER PARA INCLUIR DELETE
-- =====================================================

-- Crear función para recalcular saldo cuando se eliminan movimientos
CREATE OR REPLACE FUNCTION actualizar_saldo_caja_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular nuevo saldo para la caja origen
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = OLD.caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = OLD.caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = OLD.caja_id OR caja_destino_id = OLD.caja_id;

  -- Actualizar saldo en la caja origen
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo
  WHERE id = OLD.caja_id;

  -- Si era transferencia, también actualizar caja destino
  IF OLD.tipo_movimiento = 'transferencia' AND OLD.caja_destino_id IS NOT NULL THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN tipo_movimiento = 'ingreso' THEN monto
          WHEN tipo_movimiento = 'egreso' THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_id = OLD.caja_destino_id THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = OLD.caja_destino_id THEN monto
          WHEN tipo_movimiento = 'ajuste' THEN monto
          ELSE 0
        END
      ), 0
    ) INTO v_nuevo_saldo
    FROM cajas_movimientos
    WHERE caja_id = OLD.caja_destino_id OR caja_destino_id = OLD.caja_destino_id;

    UPDATE cajas
    SET saldo_actual = v_nuevo_saldo
    WHERE id = OLD.caja_destino_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actualizar_saldo_caja_on_delete IS
'Recalcula el saldo de la caja cuando se elimina un movimiento';

-- Crear trigger para DELETE
DROP TRIGGER IF EXISTS trigger_actualizar_saldo_caja_on_delete ON cajas_movimientos;

CREATE TRIGGER trigger_actualizar_saldo_caja_on_delete
  AFTER DELETE ON cajas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_caja_on_delete();

-- =====================================================
-- 4. VERIFICACIÓN FINAL
-- =====================================================

DO $$
DECLARE
  v_total_movimientos integer;
  v_cajas_con_saldo integer;
  v_suma_saldos numeric;
BEGIN
  -- Contar movimientos
  SELECT COUNT(*) INTO v_total_movimientos FROM cajas_movimientos;
  
  -- Contar cajas con saldo diferente de 0
  SELECT COUNT(*) INTO v_cajas_con_saldo FROM cajas WHERE saldo_actual != 0;
  
  -- Sumar todos los saldos
  SELECT COALESCE(SUM(saldo_actual), 0) INTO v_suma_saldos FROM cajas;

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'CORRECCIÓN DE SALDOS DE CAJAS COMPLETADA';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Movimientos en cajas_movimientos: %', v_total_movimientos;
  RAISE NOTICE 'Cajas con saldo != 0: %', v_cajas_con_saldo;
  RAISE NOTICE 'Suma total de saldos: $%', v_suma_saldos;
  RAISE NOTICE '';
  
  IF v_total_movimientos = 0 AND v_cajas_con_saldo = 0 AND v_suma_saldos = 0 THEN
    RAISE NOTICE '✓ VERIFICACIÓN EXITOSA: Sistema completamente limpio';
    RAISE NOTICE '✓ Todas las cajas tienen saldo 0';
    RAISE NOTICE '✓ No hay movimientos registrados';
    RAISE NOTICE '✓ Trigger de DELETE agregado correctamente';
  ELSE
    RAISE WARNING '⚠ ADVERTENCIA: Algunos valores no están en 0';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
END $$;
