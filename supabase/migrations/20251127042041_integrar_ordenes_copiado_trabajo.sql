/*
  # Integración de Órdenes de Copiado con Órdenes de Trabajo

  1. Cambios en la Estructura
    - Agregar constraint único en `orden_trabajo_id` para asegurar 1:1
    - Crear índice para optimizar consultas
    - Agregar función para calcular totales consolidados
    - Crear trigger para actualizar totales automáticamente

  2. Funciones Auxiliares
    - `fn_calcular_total_consolidado_orden`: Calcula total OT + OC
    - `fn_actualizar_total_orden_trabajo`: Actualiza total cuando cambia OC

  3. Seguridad
    - Las políticas RLS existentes se mantienen
*/

-- Agregar constraint único para asegurar que una OT solo tenga una OC
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'centro_copiado_ordenes_orden_trabajo_id_unique'
  ) THEN
    ALTER TABLE centro_copiado_ordenes
    ADD CONSTRAINT centro_copiado_ordenes_orden_trabajo_id_unique
    UNIQUE (orden_trabajo_id);
  END IF;
END $$;

-- Crear índice para optimizar consultas de OC por OT
CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_orden_trabajo_id
ON centro_copiado_ordenes(orden_trabajo_id)
WHERE orden_trabajo_id IS NOT NULL;

-- Función para calcular el total consolidado de una orden de trabajo
CREATE OR REPLACE FUNCTION fn_calcular_total_consolidado_orden(p_orden_trabajo_id uuid)
RETURNS TABLE (
  subtotal_items numeric,
  subtotal_ordenes_copiado numeric,
  subtotal_total numeric,
  descuentos numeric,
  subtotal_con_descuentos numeric,
  iva numeric,
  total_final numeric
) AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos_ot numeric;
  v_subtotal_oc numeric;
  v_subtotal_combinado numeric;
  v_subtotal_con_desc numeric;
  v_iva_calculado numeric;
  v_total_calculado numeric;
BEGIN
  -- Obtener subtotal y descuentos de la orden de trabajo
  SELECT
    COALESCE(ot.subtotal, 0),
    COALESCE(ot.total_descuentos, 0)
  INTO v_subtotal_ot, v_descuentos_ot
  FROM ordenes_trabajo ot
  WHERE ot.id = p_orden_trabajo_id;

  -- Si no existe la orden, retornar ceros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Obtener total de la orden de copiado asociada (si existe)
  SELECT COALESCE(oc.total, 0)
  INTO v_subtotal_oc
  FROM centro_copiado_ordenes oc
  WHERE oc.orden_trabajo_id = p_orden_trabajo_id
  AND oc.estado != 'cancelada';

  -- Si no hay OC asociada, usar 0
  v_subtotal_oc := COALESCE(v_subtotal_oc, 0);

  -- Calcular subtotal combinado
  v_subtotal_combinado := v_subtotal_ot + v_subtotal_oc;

  -- Aplicar descuentos sobre el total combinado
  v_subtotal_con_desc := v_subtotal_combinado - v_descuentos_ot;

  -- Calcular IVA (21%) sobre el subtotal con descuentos
  -- Nota: El IVA se aplica según la configuración del cliente
  -- Por ahora calculamos el 21% pero se puede ajustar según necesidad
  v_iva_calculado := v_subtotal_con_desc * 0.21;

  -- Total final
  v_total_calculado := v_subtotal_con_desc + v_iva_calculado;

  -- Retornar todos los valores calculados
  RETURN QUERY SELECT
    v_subtotal_ot,
    v_subtotal_oc,
    v_subtotal_combinado,
    v_descuentos_ot,
    v_subtotal_con_desc,
    v_iva_calculado,
    v_total_calculado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar el total de la orden de trabajo cuando cambia la OC
CREATE OR REPLACE FUNCTION fn_actualizar_total_orden_trabajo()
RETURNS TRIGGER AS $$
DECLARE
  v_totales RECORD;
BEGIN
  -- Solo procesar si hay orden_trabajo_id
  IF (TG_OP = 'DELETE' AND OLD.orden_trabajo_id IS NOT NULL) OR
     (TG_OP IN ('INSERT', 'UPDATE') AND NEW.orden_trabajo_id IS NOT NULL) THEN

    -- Obtener el ID de la orden de trabajo
    DECLARE
      v_orden_trabajo_id uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        v_orden_trabajo_id := OLD.orden_trabajo_id;
      ELSE
        v_orden_trabajo_id := NEW.orden_trabajo_id;
      END IF;

      -- Calcular totales consolidados
      SELECT * INTO v_totales
      FROM fn_calcular_total_consolidado_orden(v_orden_trabajo_id);

      -- Actualizar el total de la orden de trabajo
      -- Nota: Mantenemos subtotal y total_descuentos de la OT sin cambios
      -- Solo actualizamos el campo 'total' con el valor consolidado
      UPDATE ordenes_trabajo
      SET
        total = v_totales.total_final,
        updated_at = now()
      WHERE id = v_orden_trabajo_id;

    END;
  END IF;

  -- Para UPDATE, también verificar si cambió el orden_trabajo_id
  IF TG_OP = 'UPDATE' AND
     OLD.orden_trabajo_id IS DISTINCT FROM NEW.orden_trabajo_id THEN

    -- Actualizar la orden de trabajo anterior (si existe)
    IF OLD.orden_trabajo_id IS NOT NULL THEN
      SELECT * INTO v_totales
      FROM fn_calcular_total_consolidado_orden(OLD.orden_trabajo_id);

      UPDATE ordenes_trabajo
      SET
        total = v_totales.total_final,
        updated_at = now()
      WHERE id = OLD.orden_trabajo_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para actualizar totales automáticamente
DROP TRIGGER IF EXISTS trg_actualizar_total_orden_trabajo ON centro_copiado_ordenes;
CREATE TRIGGER trg_actualizar_total_orden_trabajo
AFTER INSERT OR UPDATE OR DELETE ON centro_copiado_ordenes
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_total_orden_trabajo();

-- Trigger adicional para actualizar cuando cambia el total de la OC
CREATE OR REPLACE FUNCTION fn_actualizar_total_cuando_cambia_total_oc()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si cambió el total o el estado y está asociada a una OT
  IF NEW.orden_trabajo_id IS NOT NULL AND
     (OLD.total IS DISTINCT FROM NEW.total OR OLD.estado IS DISTINCT FROM NEW.estado) THEN

    -- El trigger principal fn_actualizar_total_orden_trabajo se encargará
    -- Esta función es por si necesitamos lógica adicional
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_actualizar_total_cuando_cambia_total_oc ON centro_copiado_ordenes;
CREATE TRIGGER trg_actualizar_total_cuando_cambia_total_oc
AFTER UPDATE ON centro_copiado_ordenes
FOR EACH ROW
WHEN (OLD.total IS DISTINCT FROM NEW.total OR OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION fn_actualizar_total_cuando_cambia_total_oc();

-- Comentarios para documentación
COMMENT ON FUNCTION fn_calcular_total_consolidado_orden IS
'Calcula los totales consolidados de una orden de trabajo incluyendo su orden de copiado asociada. Los descuentos e IVA se aplican sobre el total consolidado.';

COMMENT ON FUNCTION fn_actualizar_total_orden_trabajo IS
'Trigger function que actualiza automáticamente el total de la orden de trabajo cuando se asocia, desasocia o modifica una orden de copiado.';

COMMENT ON CONSTRAINT centro_copiado_ordenes_orden_trabajo_id_unique ON centro_copiado_ordenes IS
'Asegura que una orden de trabajo solo pueda tener una orden de copiado asociada (relación 1:1).';