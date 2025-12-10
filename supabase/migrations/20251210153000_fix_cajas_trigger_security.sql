/*
  # Fix: Permitir actualización de saldos de caja por trigger (Security Definer)

  ## Problema
  Cuando un `operador_diseno` registra un pago, se crea un movimiento en `cajas_movimientos`.
  Esto dispara el trigger `actualizar_saldo_caja`, que intenta hacer un UPDATE en la tabla `cajas`.
  Como el trigger se ejecuta con los permisos del usuario (SECURITY INVOKER) y el `operador_diseno`
  no tiene permisos de UPDATE en `cajas` (solo lectura), la operación falla.

  ## Solución
  Convertir la función `actualizar_saldo_caja` a `SECURITY DEFINER`.
  Esto hace que la función se ejecute con los permisos del role que la creó (postgres/admin),
  permitiendo actualizar el saldo de la caja sin dar permisos explícitos de UPDATE al usuario.
*/

CREATE OR REPLACE FUNCTION actualizar_saldo_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecutar con privilegios de creador
SET search_path = public -- Buena práctica seguridad
AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular nuevo saldo sumando todos los movimientos
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = NEW.caja_id OR caja_destino_id = NEW.caja_id;

  -- Actualizar saldo en la caja
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo
  WHERE id = NEW.caja_id;

  -- Si es transferencia, también actualizar caja destino
  IF NEW.tipo_movimiento = 'transferencia' AND NEW.caja_destino_id IS NOT NULL THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN tipo_movimiento = 'ingreso' THEN monto
          WHEN tipo_movimiento = 'egreso' THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_destino_id THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_destino_id THEN monto
          WHEN tipo_movimiento = 'ajuste' THEN monto
          ELSE 0
        END
      ), 0
    ) INTO v_nuevo_saldo
    FROM cajas_movimientos
    WHERE caja_id = NEW.caja_destino_id OR caja_destino_id = NEW.caja_destino_id;

    UPDATE cajas
    SET saldo_actual = v_nuevo_saldo
    WHERE id = NEW.caja_destino_id;
  END IF;

  RETURN NEW;
END;
$$;
