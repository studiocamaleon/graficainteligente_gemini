/*
  # Fix: Totales incorrectos al asociar Orden de Copiado con Orden de Trabajo

  ## Problema Identificado
  Cuando se crea una orden de trabajo con una orden de copiado asociada, los totales
  de la orden de trabajo NO incluyen el total de la orden de copiado.
  
  **Flujo actual (INCORRECTO):**
  1. Se crea OT con subtotal = suma de items propios ✅
  2. Se crea OC con su propio total ✅
  3. El total de OT NO incluye el total de OC ❌
  
  **Resultado:** 
  - orden.total en BD = subtotal_items (incorrecto)
  - Debería ser: subtotal_items + total_OC - descuentos
  
  ## Solución Implementada
  1. Función para recalcular total de OT basado en items + OC asociada
  2. Trigger automático que recalcula cuando se crea/modifica/elimina una OC
  3. Función manual para corregir órdenes existentes
  4. Query de verificación para detectar desbalances
  
  ## Cambios
  - Nueva función: fn_recalcular_total_orden_trabajo(orden_trabajo_id)
  - Nuevo trigger: trigger_recalcular_total_ot_on_oc_change
  - Nueva función pública: fn_recalcular_totales_todas_ordenes()
  - Corrección de órdenes existentes con totales incorrectos
*/

-- =====================================================
-- FUNCIÓN 1: Recalcular total de una orden de trabajo específica
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_total_orden_trabajo(p_orden_trabajo_id uuid)
RETURNS numeric AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos numeric;
  v_total_oc numeric;
  v_nuevo_total numeric;
BEGIN
  -- Obtener subtotal y descuentos de la orden de trabajo
  SELECT subtotal, total_descuentos
  INTO v_subtotal_ot, v_descuentos
  FROM ordenes_trabajo
  WHERE id = p_orden_trabajo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo % no encontrada', p_orden_trabajo_id;
  END IF;

  -- Calcular suma de todas las órdenes de copiado asociadas
  SELECT COALESCE(SUM(total), 0)
  INTO v_total_oc
  FROM centro_copiado_ordenes
  WHERE orden_trabajo_id = p_orden_trabajo_id;

  -- Calcular nuevo total: subtotal_items - descuentos + total_ordenes_copiado
  v_nuevo_total := v_subtotal_ot - v_descuentos + v_total_oc;

  -- Actualizar orden de trabajo
  UPDATE ordenes_trabajo
  SET total = v_nuevo_total,
      updated_at = NOW()
  WHERE id = p_orden_trabajo_id;

  RETURN v_nuevo_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN 2: Trigger function para recalcular automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_recalcular_total_ot()
RETURNS TRIGGER AS $$
DECLARE
  v_orden_trabajo_id uuid;
BEGIN
  -- Determinar qué orden de trabajo afectar
  IF TG_OP = 'DELETE' THEN
    v_orden_trabajo_id := OLD.orden_trabajo_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió la orden de trabajo asociada, recalcular ambas
    IF OLD.orden_trabajo_id IS DISTINCT FROM NEW.orden_trabajo_id THEN
      IF OLD.orden_trabajo_id IS NOT NULL THEN
        PERFORM fn_recalcular_total_orden_trabajo(OLD.orden_trabajo_id);
      END IF;
      IF NEW.orden_trabajo_id IS NOT NULL THEN
        PERFORM fn_recalcular_total_orden_trabajo(NEW.orden_trabajo_id);
      END IF;
      RETURN NEW;
    END IF;
    v_orden_trabajo_id := NEW.orden_trabajo_id;
  ELSE -- INSERT
    v_orden_trabajo_id := NEW.orden_trabajo_id;
  END IF;

  -- Recalcular total si hay orden de trabajo asociada
  IF v_orden_trabajo_id IS NOT NULL THEN
    PERFORM fn_recalcular_total_orden_trabajo(v_orden_trabajo_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Recalcular total en INSERT, UPDATE y DELETE de OC
-- =====================================================

DROP TRIGGER IF EXISTS trigger_recalcular_total_ot_on_oc_change ON centro_copiado_ordenes;

CREATE TRIGGER trigger_recalcular_total_ot_on_oc_change
  AFTER INSERT OR UPDATE OR DELETE ON centro_copiado_ordenes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalcular_total_ot();

-- =====================================================
-- FUNCIÓN 3: Recalcular todas las órdenes (para corrección masiva)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_totales_todas_ordenes()
RETURNS TABLE(
  orden_id uuid,
  numero_orden text,
  total_anterior numeric,
  total_nuevo numeric,
  diferencia numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH totales_calculados AS (
    SELECT 
      ot.id,
      ot.numero_orden,
      ot.total as total_actual,
      (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0)) as total_correcto
    FROM ordenes_trabajo ot
    LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
    GROUP BY ot.id, ot.numero_orden, ot.total, ot.subtotal, ot.total_descuentos
  )
  UPDATE ordenes_trabajo ot
  SET total = tc.total_correcto,
      updated_at = NOW()
  FROM totales_calculados tc
  WHERE ot.id = tc.id
    AND ABS(ot.total - tc.total_correcto) > 0.01
  RETURNING 
    ot.id,
    tc.numero_orden,
    tc.total_actual,
    tc.total_correcto,
    (tc.total_correcto - tc.total_actual) as diferencia;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN 4: Verificar órdenes con totales incorrectos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_verificar_totales_ordenes()
RETURNS TABLE(
  orden_id uuid,
  numero_orden text,
  subtotal_items numeric,
  total_descuentos numeric,
  total_ordenes_copiado numeric,
  total_en_bd numeric,
  total_calculado numeric,
  diferencia numeric,
  esta_correcto boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ot.id,
    ot.numero_orden,
    ot.subtotal,
    ot.total_descuentos,
    COALESCE(SUM(oc.total), 0) as total_oc,
    ot.total as total_bd,
    (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0)) as total_calc,
    (ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0))) as diff,
    ABS(ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0))) < 0.01 as correcto
  FROM ordenes_trabajo ot
  LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
  GROUP BY ot.id, ot.numero_orden, ot.subtotal, ot.total_descuentos, ot.total
  ORDER BY ot.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- EJECUTAR CORRECCIÓN DE ÓRDENES EXISTENTES
-- =====================================================

DO $$
DECLARE
  v_ordenes_corregidas int;
BEGIN
  -- Contar órdenes con problemas
  SELECT COUNT(*)
  INTO v_ordenes_corregidas
  FROM (
    SELECT 
      ot.id,
      ot.total,
      (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0)) as total_correcto
    FROM ordenes_trabajo ot
    LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
    GROUP BY ot.id, ot.total, ot.subtotal, ot.total_descuentos
    HAVING ABS(ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0))) > 0.01
  ) problemas;

  RAISE NOTICE 'Órdenes con totales incorrectos encontradas: %', v_ordenes_corregidas;

  -- Ejecutar corrección
  PERFORM fn_recalcular_totales_todas_ordenes();
  
  RAISE NOTICE 'Corrección completada. Se actualizaron % órdenes.', v_ordenes_corregidas;
END $$;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION fn_recalcular_total_orden_trabajo(uuid) IS 
'Recalcula el total de una orden de trabajo incluyendo items propios + órdenes de copiado asociadas - descuentos. Retorna el nuevo total.';

COMMENT ON FUNCTION trigger_recalcular_total_ot() IS 
'Trigger function que recalcula automáticamente el total de la OT cuando se crea/modifica/elimina una orden de copiado asociada.';

COMMENT ON FUNCTION fn_recalcular_totales_todas_ordenes() IS 
'Recalcula los totales de TODAS las órdenes de trabajo. Útil para corrección masiva. Retorna órdenes corregidas con diferencias.';

COMMENT ON FUNCTION fn_verificar_totales_ordenes() IS 
'Verifica los totales de todas las órdenes comparando BD vs calculado. Útil para auditoría y detección de problemas.';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Permitir que usuarios autenticados ejecuten la verificación
GRANT EXECUTE ON FUNCTION fn_verificar_totales_ordenes() TO authenticated;

-- La función de recalculo individual es SECURITY DEFINER, se puede llamar desde triggers