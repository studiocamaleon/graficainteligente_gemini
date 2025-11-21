/*
  # Triggers de Actualización Automática de Estados

  ## Descripción
  Crea funciones y triggers que actualizan automáticamente los estados de items y órdenes
  basándose en el estado de sus componentes (pasos y items respectivamente).

  ## Funciones Creadas

  ### 1. fn_actualizar_estado_item()
  Actualiza el estado de un item cuando cambia el estado de uno de sus pasos.
  - Cuenta pasos pendientes, en proceso y completados
  - Actualiza estado del item según las reglas de negocio

  ### 2. fn_actualizar_estado_orden()
  Actualiza el estado de una orden cuando cambia el estado de uno de sus items.
  - Cuenta items pendientes, en proceso y finalizados
  - Actualiza estado de la orden según las reglas de negocio
  - Respeta el estado 'cancelada' (no lo sobrescribe)

  ## Reglas de Negocio Implementadas

  ### Estados de Item:
  - pendiente: Todos los pasos están pendientes
  - en_proceso: Al menos un paso no está pendiente (en_proceso, completado u omitido)
  - finalizado: Todos los pasos están completados o omitidos

  ### Estados de Orden:
  - pendiente: Todos los items están pendientes
  - en_proceso: Al menos un item no está pendiente
  - finalizada: Todos los items están finalizados
  - cancelada: No se modifica automáticamente (es un estado terminal manual)

  ## Triggers Creados
  1. trigger_actualizar_estado_item: Se ejecuta después de UPDATE en ordenes_trabajo_items_rutas
  2. trigger_actualizar_estado_orden: Se ejecuta después de UPDATE en ordenes_trabajo_items

  ## Seguridad
  - Funciones con SECURITY DEFINER para bypass de RLS en actualizaciones automáticas
  - Solo triggers pueden llamar estas funciones
  - No expuestas directamente a usuarios
*/

-- =====================================================
-- 1. FUNCIÓN: ACTUALIZAR ESTADO DE ITEM
-- =====================================================

CREATE OR REPLACE FUNCTION fn_actualizar_estado_item()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pasos integer;
  v_pasos_pendientes integer;
  v_pasos_finalizados integer;
  v_nuevo_estado text;
BEGIN
  -- Contar pasos del item
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado_paso = 'pendiente'),
    COUNT(*) FILTER (WHERE estado_paso IN ('completado', 'omitido'))
  INTO v_total_pasos, v_pasos_pendientes, v_pasos_finalizados
  FROM ordenes_trabajo_items_rutas
  WHERE orden_item_id = NEW.orden_item_id;

  -- Si no hay pasos, mantener estado pendiente
  IF v_total_pasos = 0 THEN
    v_nuevo_estado := 'pendiente';
  -- Si todos los pasos están finalizados (completado u omitido)
  ELSIF v_pasos_finalizados = v_total_pasos THEN
    v_nuevo_estado := 'finalizado';
  -- Si todos los pasos están pendientes
  ELSIF v_pasos_pendientes = v_total_pasos THEN
    v_nuevo_estado := 'pendiente';
  -- En cualquier otro caso (al menos un paso iniciado pero no todos finalizados)
  ELSE
    v_nuevo_estado := 'en_proceso';
  END IF;

  -- Actualizar estado del item solo si cambió
  UPDATE ordenes_trabajo_items
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = NEW.orden_item_id
    AND estado != v_nuevo_estado;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. TRIGGER: ACTUALIZAR ESTADO DE ITEM
-- =====================================================

DROP TRIGGER IF EXISTS trigger_actualizar_estado_item ON ordenes_trabajo_items_rutas;

CREATE TRIGGER trigger_actualizar_estado_item
AFTER INSERT OR UPDATE OF estado_paso ON ordenes_trabajo_items_rutas
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_estado_item();

-- =====================================================
-- 3. FUNCIÓN: ACTUALIZAR ESTADO DE ORDEN
-- =====================================================

CREATE OR REPLACE FUNCTION fn_actualizar_estado_orden()
RETURNS TRIGGER AS $$
DECLARE
  v_total_items integer;
  v_items_pendientes integer;
  v_items_finalizados integer;
  v_nuevo_estado text;
  v_orden_id uuid;
  v_estado_actual text;
BEGIN
  -- Obtener orden_id
  SELECT orden_id INTO v_orden_id
  FROM ordenes_trabajo_items
  WHERE id = NEW.id;

  -- Obtener estado actual de la orden
  SELECT estado INTO v_estado_actual
  FROM ordenes_trabajo
  WHERE id = v_orden_id;

  -- No actualizar si la orden está cancelada
  IF v_estado_actual = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- Contar items de la orden
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'pendiente'),
    COUNT(*) FILTER (WHERE estado = 'finalizado')
  INTO v_total_items, v_items_pendientes, v_items_finalizados
  FROM ordenes_trabajo_items
  WHERE orden_id = v_orden_id;

  -- Si no hay items, mantener estado actual (no debería ocurrir)
  IF v_total_items = 0 THEN
    RETURN NEW;
  END IF;

  -- Determinar nuevo estado de la orden
  IF v_items_finalizados = v_total_items THEN
    -- Todos los items finalizados
    v_nuevo_estado := 'finalizada';
  ELSIF v_items_pendientes = v_total_items THEN
    -- Todos los items pendientes
    v_nuevo_estado := 'pendiente';
  ELSE
    -- Al menos un item en proceso o finalizado, pero no todos finalizados
    v_nuevo_estado := 'en_proceso';
  END IF;

  -- Actualizar estado de la orden solo si cambió
  UPDATE ordenes_trabajo
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = v_orden_id
    AND estado != v_nuevo_estado
    AND estado != 'cancelada'  -- Doble verificación
    AND estado != 'entregada';  -- No sobrescribir si ya fue entregada

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER: ACTUALIZAR ESTADO DE ORDEN
-- =====================================================

DROP TRIGGER IF EXISTS trigger_actualizar_estado_orden ON ordenes_trabajo_items;

CREATE TRIGGER trigger_actualizar_estado_orden
AFTER INSERT OR UPDATE OF estado ON ordenes_trabajo_items
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_estado_orden();

-- =====================================================
-- 5. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_actualizar_estado_item() IS 'Actualiza automáticamente el estado de un item basándose en el estado de sus pasos de producción';
COMMENT ON FUNCTION fn_actualizar_estado_orden() IS 'Actualiza automáticamente el estado de una orden basándose en el estado de sus items';
