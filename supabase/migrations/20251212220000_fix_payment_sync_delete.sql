-- Description: Updates the payment sync function and trigger to handle DELETE events from ordenes_trabajo_pagos.
-- This ensures that when a payment is deleted from an order, the corresponding movement (and commission) is removed from treasury (cajas_movimientos).
-- IMPORTANT: Function must be SECURITY DEFINER to bypass RLS on cajas_movimientos, as regular users might not have explicit DELETE permissions there.

-- 1. Update the function to handle DELETE
CREATE OR REPLACE FUNCTION fn_sincronizar_pago_con_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL: Run as admin to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_medio RECORD;
  v_orden RECORD;
  v_concepto text;
BEGIN
  -- Handle DELETE operation
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM cajas_movimientos 
    WHERE referencia_tipo = 'pago_orden' 
    AND referencia_id = OLD.id;
    
    RETURN OLD;
  END IF;

  -- Handle INSERT operation (Existing logic)
  
  -- Solo procesar si tiene medio_cobro_id
  IF NEW.medio_cobro_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener medio de cobro y su caja
  -- (Al ser Security Definer, ahora puede ver todas las cajas y medios)
  SELECT mc.*, c.id as caja_id, c.nombre as caja_nombre
  INTO v_medio
  FROM medios_cobro mc
  LEFT JOIN cajas c ON mc.caja_id = c.id
  WHERE mc.id = NEW.medio_cobro_id;

  -- Si el medio no tiene caja asignada, salir
  IF v_medio.caja_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener información de la orden
  SELECT numero_orden INTO v_orden
  FROM ordenes_trabajo
  WHERE id = NEW.orden_id;

  v_concepto := 'Pago OT ' || COALESCE(v_orden.numero_orden, NEW.orden_id::text);

  -- Crear movimiento de ingreso en la caja
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    referencia_id,
    medio_cobro_id,
    comision_aplicada,
    notas,
    created_by
  ) VALUES (
    v_medio.caja_id,
    'ingreso',
    NEW.monto,
    v_concepto,
    NEW.fecha_pago::date,
    'pago_orden',
    NEW.id,
    NEW.medio_cobro_id,
    0,
    NEW.notas,
    NEW.created_by
  );

  -- Si hay comisión aplicada, crear movimiento de egreso
  IF NEW.comision_aplicada > 0 THEN
    INSERT INTO cajas_movimientos (
      caja_id,
      tipo_movimiento,
      monto,
      concepto,
      fecha,
      referencia_tipo,
      referencia_id,
      medio_cobro_id,
      comision_aplicada,
      notas,
      created_by
    ) VALUES (
      v_medio.caja_id,
      'egreso',
      NEW.comision_aplicada,
      'Comisión ' || v_medio.nombre || ' - ' || v_concepto,
      NEW.fecha_pago::date,
      'pago_orden',
      NEW.id,
      NEW.medio_cobro_id,
      NEW.comision_aplicada,
      'Comisión descontada automáticamente',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update the trigger to include DELETE events
DROP TRIGGER IF EXISTS trigger_sincronizar_pago_con_caja ON ordenes_trabajo_pagos;

CREATE TRIGGER trigger_sincronizar_pago_con_caja
  AFTER INSERT OR DELETE ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_sincronizar_pago_con_caja();
