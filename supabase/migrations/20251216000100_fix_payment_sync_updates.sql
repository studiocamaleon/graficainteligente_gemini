-- Migration to fix payment sync updates and add OC payment sync
-- Created at 2025-12-16

-- ============================================================================
-- 1. UPDATE fn_sincronizar_pago_con_caja to handle UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sincronizar_pago_con_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL: Run as admin to bypass RLS on cajas_movimientos
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

  -- Handle UPDATE operation
  IF (TG_OP = 'UPDATE') THEN
    -- If amount, payment method, or commission changed, we update the movement
    IF (NEW.monto <> OLD.monto) OR 
       (NEW.medio_cobro_id <> OLD.medio_cobro_id) OR 
       (NEW.comision_aplicada <> OLD.comision_aplicada) OR
       (NEW.fecha_pago <> OLD.fecha_pago) THEN

       -- First, delete the old movement (simplest way to handle potential Caja change)
       DELETE FROM cajas_movimientos 
       WHERE referencia_tipo = 'pago_orden' 
       AND referencia_id = OLD.id;
       
       -- Then proceed to insert as if it were new (fallthrough to INSERT logic below)
    ELSE
       RETURN NEW; -- No relevant changes
    END IF;
  END IF;

  -- Handle INSERT operation (or Re-Insert from Update)
  
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
    0, -- La comisión se registra aparte si es > 0, aqui va 0 para no duplicar en el neto si se usara asi
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

-- Refrescar el trigger para incluir UPDATE
DROP TRIGGER IF EXISTS trigger_sincronizar_pago_con_caja ON ordenes_trabajo_pagos;

CREATE TRIGGER trigger_sincronizar_pago_con_caja
  AFTER INSERT OR UPDATE OR DELETE ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_sincronizar_pago_con_caja();


-- ============================================================================
-- 2. CREATE fn_sincronizar_pago_oc_con_caja for Ordenes de Copiado
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sincronizar_pago_oc_con_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL: Run as admin to bypass RLS on cajas_movimientos
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
    WHERE referencia_tipo = 'pago_orden_copiado' 
    AND referencia_id = OLD.id;
    
    RETURN OLD;
  END IF;

  -- Handle UPDATE operation
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.monto <> OLD.monto) OR 
       (NEW.medio_cobro_id <> OLD.medio_cobro_id) OR 
       (NEW.comision_aplicada <> OLD.comision_aplicada) OR
       (NEW.fecha_pago <> OLD.fecha_pago) THEN

       DELETE FROM cajas_movimientos 
       WHERE referencia_tipo = 'pago_orden_copiado' 
       AND referencia_id = OLD.id;
       
       -- Fallthrough to INSERT
    ELSE
       RETURN NEW;
    END IF;
  END IF;

  -- Handle INSERT operation
  
  IF NEW.medio_cobro_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT mc.*, c.id as caja_id, c.nombre as caja_nombre
  INTO v_medio
  FROM medios_cobro mc
  LEFT JOIN cajas c ON mc.caja_id = c.id
  WHERE mc.id = NEW.medio_cobro_id;

  IF v_medio.caja_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener información de la orden de copiado
  SELECT numero_orden INTO v_orden
  FROM centro_copiado_ordenes
  WHERE id = NEW.orden_copiado_id;

  v_concepto := 'Pago OC ' || COALESCE(v_orden.numero_orden, 'N/A');

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
    'pago_orden_copiado', -- Tipo específico para OC
    NEW.id,
    NEW.medio_cobro_id,
    0,
    NEW.notas,
    NEW.created_by
  );

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
      'pago_orden_copiado',
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

-- Create Trigger for Centro Copiado Ordenes Pagos
DROP TRIGGER IF EXISTS trigger_sincronizar_pago_oc_con_caja ON centro_copiado_ordenes_pagos;

CREATE TRIGGER trigger_sincronizar_pago_oc_con_caja
  AFTER INSERT OR UPDATE OR DELETE ON centro_copiado_ordenes_pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_sincronizar_pago_oc_con_caja();
