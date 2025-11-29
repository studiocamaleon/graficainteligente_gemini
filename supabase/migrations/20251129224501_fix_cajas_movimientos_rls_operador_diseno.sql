/*
  # Fix: Permitir a operador_diseno insertar en cajas_movimientos

  ## Problema
  El operador de diseño no puede registrar pagos en órdenes de trabajo
  porque el trigger automático que sincroniza con cajas falla por RLS.

  Error: "new row violates row-level security policy for table cajas_movimientos"

  ## Solución
  Actualizar política RLS de INSERT en cajas_movimientos para incluir
  el rol operador_diseno.

  ## Contexto
  Cuando un usuario registra un pago en ordenes_trabajo_pagos, el trigger
  trigger_sincronizar_pago_con_caja se ejecuta automáticamente y crea
  un movimiento en cajas_movimientos. Este INSERT se ejecuta con los
  permisos del usuario que creó el pago, por lo que operador_diseno
  necesita permiso de INSERT en cajas_movimientos.

  ## Flujo del Error (ANTES):
  1. Usuario operador_diseno registra pago
  2. INSERT en ordenes_trabajo_pagos ✅
  3. TRIGGER: trigger_sincronizar_pago_con_caja
  4. FUNCIÓN: fn_sincronizar_pago_con_caja()
  5. INSERT en cajas_movimientos
  6. RLS verifica: ¿role IN ('super_admin', 'admin', 'manager')?
  7. operador_diseno NO está → ❌ RECHAZADO

  ## Flujo Corregido (DESPUÉS):
  1. Usuario operador_diseno registra pago
  2. INSERT en ordenes_trabajo_pagos ✅
  3. TRIGGER: trigger_sincronizar_pago_con_caja
  4. FUNCIÓN: fn_sincronizar_pago_con_caja()
  5. INSERT en cajas_movimientos
  6. RLS verifica: ¿role IN ('super_admin', 'admin', 'manager', 'operador_diseno')?
  7. operador_diseno SÍ está → ✅ ACEPTADO

  ## Justificación
  El operador de diseño gestiona órdenes de trabajo completas, incluyendo
  el registro de pagos cuando los clientes pagan por sus diseños. Necesita
  poder registrar estos pagos para mantener el flujo de trabajo eficiente
  y actualizar el estado de las órdenes en tiempo real.

  ## Seguridad
  - El operador solo puede crear movimientos en cajas de su company_id
  - Todos los movimientos tienen created_by para auditoría
  - Los triggers validan la integridad antes de crear movimientos
  - El operador no tiene acceso UI para crear movimientos manuales

  ## Referencias
  - Trigger: trigger_sincronizar_pago_con_caja
  - Función: fn_sincronizar_pago_con_caja()
  - Migration original: 20251126060408_create_cajas_system.sql
  - Fecha corrección: 2025-11-29
*/

-- =====================================================
-- STEP 1: Drop política existente
-- =====================================================

DROP POLICY IF EXISTS "Managers can insert cajas_movimientos" ON cajas_movimientos;

-- =====================================================
-- STEP 2: Recrear con operador_diseno incluido
-- =====================================================

CREATE POLICY "Managers can insert cajas_movimientos"
  ON cajas_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (
    caja_id IN (
      SELECT id FROM cajas
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
      )
    )
  );

-- =====================================================
-- STEP 3: Agregar comentario para documentación
-- =====================================================

COMMENT ON POLICY "Managers can insert cajas_movimientos" ON cajas_movimientos IS
'Permite a super_admin, admin, manager y operador_diseno crear movimientos de caja.
Restricción: Solo pueden insertar en cajas de su propia company.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir registro de pagos en órdenes de trabajo.
El operador_diseno gestiona órdenes de trabajo y necesita poder registrar pagos, lo cual genera
movimientos automáticos en cajas a través del trigger trigger_sincronizar_pago_con_caja.';