/*
  # Fix: Sistema de actualización de saldos de cajas

  ## Problema Identificado
  Los saldos de las cajas no se están actualizando correctamente a pesar de que:
  - Los pagos SÍ crean movimientos en cajas_movimientos ✅
  - Los triggers están activos ✅
  - El problema: El trigger actualizar_saldo_caja() tiene lógica incorrecta
  
  ## Diagnóstico
  Caja "Mercado Pago" (b83dc9b4-829b-4c90-b7e2-528f75243328):
  - Saldo en tabla: 0
  - Saldo calculado de movimientos: 23,382.83
  - Diferencia: -23,382.83
  
  ## Solución
  1. Crear función de recalculo manual de saldos
  2. Mejorar trigger para soportar UPDATE y DELETE
  3. Ejecutar recalculo para corregir saldos actuales
  
  ## Cambios
  - Nueva función: fn_recalcular_saldos_cajas()
  - Nueva función: fn_recalcular_saldo_caja_especifica(caja_id)
  - Mejorado trigger: actualizar_saldo_caja() ahora soporta UPDATE y DELETE
  - Ejecutar recalculo de todas las cajas
*/

-- =====================================================
-- FUNCIÓN 1: Recalcular saldo de una caja específica
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_saldo_caja_especifica(p_caja_id uuid)
RETURNS numeric AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular saldo sumando todos los movimientos
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = p_caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = p_caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = p_caja_id OR caja_destino_id = p_caja_id;

  -- Actualizar el saldo en la tabla
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo,
      updated_at = NOW()
  WHERE id = p_caja_id;

  RETURN v_nuevo_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN 2: Recalcular saldos de todas las cajas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_saldos_cajas()
RETURNS TABLE(caja_id uuid, caja_nombre text, saldo_anterior numeric, saldo_nuevo numeric) AS $$
BEGIN
  RETURN QUERY
  WITH saldos_calculados AS (
    SELECT 
      c.id,
      c.nombre,
      c.saldo_actual as saldo_anterior,
      COALESCE(
        SUM(
          CASE
            WHEN cm.tipo_movimiento = 'ingreso' THEN cm.monto
            WHEN cm.tipo_movimiento = 'egreso' THEN -cm.monto
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = c.id THEN -cm.monto
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = c.id THEN cm.monto
            WHEN cm.tipo_movimiento = 'ajuste' THEN cm.monto
            ELSE 0
          END
        ), 0
      ) as saldo_nuevo
    FROM cajas c
    LEFT JOIN cajas_movimientos cm ON (cm.caja_id = c.id OR cm.caja_destino_id = c.id)
    GROUP BY c.id, c.nombre, c.saldo_actual
  )
  UPDATE cajas c
  SET saldo_actual = sc.saldo_nuevo,
      updated_at = NOW()
  FROM saldos_calculados sc
  WHERE c.id = sc.id
  RETURNING c.id, sc.nombre, sc.saldo_anterior, sc.saldo_nuevo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN 3: Trigger mejorado para actualizar saldo
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_saldo_caja_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_caja_id_afectada uuid;
  v_caja_destino_id_afectada uuid;
BEGIN
  -- Determinar qué caja(s) actualizar según la operación
  IF TG_OP = 'DELETE' THEN
    v_caja_id_afectada := OLD.caja_id;
    v_caja_destino_id_afectada := OLD.caja_destino_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- En UPDATE, podría cambiar la caja, así que recalculamos ambas (vieja y nueva)
    v_caja_id_afectada := OLD.caja_id;
    v_caja_destino_id_afectada := OLD.caja_destino_id;
    
    -- También actualizar las nuevas cajas si cambiaron
    IF NEW.caja_id IS DISTINCT FROM OLD.caja_id THEN
      PERFORM fn_recalcular_saldo_caja_especifica(NEW.caja_id);
    END IF;
    
    IF NEW.caja_destino_id IS DISTINCT FROM OLD.caja_destino_id THEN
      PERFORM fn_recalcular_saldo_caja_especifica(NEW.caja_destino_id);
    END IF;
  ELSE -- INSERT
    v_caja_id_afectada := NEW.caja_id;
    v_caja_destino_id_afectada := NEW.caja_destino_id;
  END IF;

  -- Recalcular saldo de caja principal
  IF v_caja_id_afectada IS NOT NULL THEN
    PERFORM fn_recalcular_saldo_caja_especifica(v_caja_id_afectada);
  END IF;

  -- Recalcular saldo de caja destino (si existe)
  IF v_caja_destino_id_afectada IS NOT NULL THEN
    PERFORM fn_recalcular_saldo_caja_especifica(v_caja_destino_id_afectada);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Reemplazar el trigger existente
-- =====================================================

DROP TRIGGER IF EXISTS trigger_actualizar_saldo_caja ON cajas_movimientos;

CREATE TRIGGER trigger_actualizar_saldo_caja
  AFTER INSERT OR UPDATE OR DELETE ON cajas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_caja_v2();

-- =====================================================
-- Ejecutar recalculo de todos los saldos
-- =====================================================

SELECT * FROM fn_recalcular_saldos_cajas();

-- =====================================================
-- Comentarios de documentación
-- =====================================================

COMMENT ON FUNCTION fn_recalcular_saldo_caja_especifica(uuid) IS 
'Recalcula el saldo de una caja específica basándose en todos sus movimientos. Retorna el nuevo saldo.';

COMMENT ON FUNCTION fn_recalcular_saldos_cajas() IS 
'Recalcula los saldos de TODAS las cajas. Retorna tabla con saldos anteriores y nuevos para auditoría.';

COMMENT ON FUNCTION actualizar_saldo_caja_v2() IS 
'Trigger function mejorada que recalcula saldos en INSERT, UPDATE y DELETE de movimientos.';