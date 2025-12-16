-- Fix: Recalculate Order Total including IVA (subtotal_iva)
-- Description: Updates recalculation functions to include subtotal_iva in the final total.

-- =====================================================
-- FUNCIÓN 1: Recalcular total de una orden de trabajo específica
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_total_orden_trabajo(p_orden_trabajo_id uuid)
RETURNS numeric AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos numeric;
  v_subtotal_iva numeric;
  v_total_oc numeric;
  v_nuevo_total numeric;
BEGIN
  -- Obtener subtotal, descuentos y IVA de la orden de trabajo
  SELECT subtotal, total_descuentos, COALESCE(subtotal_iva, 0)
  INTO v_subtotal_ot, v_descuentos, v_subtotal_iva
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

  -- Calcular nuevo total: subtotal_items - descuentos + total_ordenes_copiado + IVA
  v_nuevo_total := v_subtotal_ot - v_descuentos + v_total_oc + v_subtotal_iva;

  -- Actualizar orden de trabajo
  UPDATE ordenes_trabajo
  SET total = v_nuevo_total,
      updated_at = NOW()
  WHERE id = p_orden_trabajo_id;

  RETURN v_nuevo_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
      (ot.subtotal - ot.total_descuentos + COALESCE(ot.subtotal_iva, 0) + COALESCE(SUM(oc.total), 0)) as total_correcto
    FROM ordenes_trabajo ot
    LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
    GROUP BY ot.id, ot.numero_orden, ot.total, ot.subtotal, ot.total_descuentos, ot.subtotal_iva
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

DROP FUNCTION IF EXISTS fn_verificar_totales_ordenes();

CREATE OR REPLACE FUNCTION fn_verificar_totales_ordenes()
RETURNS TABLE(
  orden_id uuid,
  numero_orden text,
  subtotal_items numeric,
  total_descuentos numeric,
  subtotal_iva numeric,
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
    COALESCE(ot.subtotal_iva, 0) as subtotal_iva,
    COALESCE(SUM(oc.total), 0) as total_oc,
    ot.total as total_bd,
    (ot.subtotal - ot.total_descuentos + COALESCE(ot.subtotal_iva, 0) + COALESCE(SUM(oc.total), 0)) as total_calc,
    (ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(ot.subtotal_iva, 0) + COALESCE(SUM(oc.total), 0))) as diff,
    ABS(ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(ot.subtotal_iva, 0) + COALESCE(SUM(oc.total), 0))) < 0.01 as correcto
  FROM ordenes_trabajo ot
  LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
  GROUP BY ot.id, ot.numero_orden, ot.subtotal, ot.total_descuentos, ot.subtotal_iva, ot.total
  ORDER BY ot.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
