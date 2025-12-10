/*
  # Fix: Make Sync Trigger Security Definer and Update Policies

  ## Critical Issue
  The `operador_diseno` can now INSERT into `cajas_movimientos`, BUT they cannot "see" (SELECT)
  certain `cajas` (like Banks or Gateways) due to strict RLS in `20251208140000_secure_cajas_visibility`.

  When they register a payment (e.g., via MP or Bank Transfer), the trigger `fn_sincronizar_pago_con_caja`
  tries to INSERT a movement linked to that restricted box.
  Postgres checks the FK constraint (`caja_id`) or the RLS policy USING clause, which often requires visibility.
  Since the user cannot see the box, the operation fails as if the box didn't exist or permission was denied.

  ## Solution
  1. Make `fn_sincronizar_pago_con_caja` SECURITY DEFINER.
     This ensures the INSERT into `cajas_movimientos` happens with the privileges of the function creator (admin),
     bypassing the visibility check on `cajas`.

  2. Ensure `cajas_movimientos` policy allows the INSERT contextually (already done, but double check not needed if function bypasses).
     Actually, if the function is SECURITY DEFINER, the RLS on `cajas_movimientos` for the INSERT *inside the function*
     will be checked against the owner's RLS (which usually bypasses or has full access), OR if the table has RLS enabled,
     we need to make sure the owner can insert. Usually `postgres` or `service_role` bypasses RLS.

  ## Safety
  This is safe because the trigger is only fired by `ordenes_trabajo_pagos`, which has its own RLS.
  We are trusting the code logic to correctly link the caja.
*/

CREATE OR REPLACE FUNCTION fn_sincronizar_pago_con_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Execute with admin privileges to see all boxes
SET search_path = public
AS $$
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
    NEW.comision_aplicada,
    NEW.notas,
    NEW.created_by -- Maintain original user as creator
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
