/*
  # Fix: Guardar comisión aplicada en movimientos de cajas

  ## Problema
  La función fn_sincronizar_pago_con_caja estaba guardando comision_aplicada = 0
  en lugar de usar el valor real de NEW.comision_aplicada del pago.

  ## Solución
  1. Corregir la función para guardar la comisión en el movimiento de ingreso
  2. Actualizar movimientos existentes con las comisiones correctas

  ## Cambios
  - Línea 77: Cambiar `0` por `NEW.comision_aplicada`
  - Script para recalcular comisiones de movimientos existentes
*/

-- =====================================================
-- FUNCIÓN CORREGIDA: Sincronizar pago con caja
-- =====================================================

CREATE OR REPLACE FUNCTION fn_sincronizar_pago_con_caja()
RETURNS TRIGGER AS $$
DECLARE
  v_medio RECORD;
  v_orden RECORD;
  v_concepto text;
BEGIN
  -- Solo procesar si tiene medio_cobro_id
  IF NEW.medio_cobro_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener medio de cobro y su caja
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
  -- FIX: Ahora guarda la comisión aplicada correctamente
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
    NEW.comision_aplicada,  -- ← FIX: Era 0, ahora usa NEW.comision_aplicada
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- ACTUALIZAR MOVIMIENTOS EXISTENTES
-- =====================================================

-- Actualizar comisiones de movimientos existentes basados en los pagos
UPDATE cajas_movimientos cm
SET comision_aplicada = p.comision_aplicada
FROM ordenes_trabajo_pagos p
WHERE cm.referencia_tipo = 'pago_orden'
  AND cm.referencia_id = p.id
  AND cm.tipo_movimiento = 'ingreso'
  AND cm.comision_aplicada = 0
  AND p.comision_aplicada > 0;
