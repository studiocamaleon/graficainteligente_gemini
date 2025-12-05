-- Tabla para servicios adicionales (separada de items de inventario/producción)
CREATE TABLE IF NOT EXISTS ordenes_trabajo_servicios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid REFERENCES ordenes_trabajo(id) ON DELETE CASCADE NOT NULL,
  servicio_id uuid REFERENCES servicios(id), -- Opcional, referencia al servicio catálogo
  descripcion text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0, -- cantidad * precio
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_ots_orden_id ON ordenes_trabajo_servicios(orden_id);

-- RLS
ALTER TABLE ordenes_trabajo_servicios ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public read" ON ordenes_trabajo_servicios;
    CREATE POLICY "Public read" ON ordenes_trabajo_servicios FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Auth insert" ON ordenes_trabajo_servicios;
    CREATE POLICY "Auth insert" ON ordenes_trabajo_servicios FOR INSERT WITH CHECK (auth.uid() = created_by);
    
    DROP POLICY IF EXISTS "Auth update" ON ordenes_trabajo_servicios;
    CREATE POLICY "Auth update" ON ordenes_trabajo_servicios FOR UPDATE USING (auth.uid() = created_by);
    
    DROP POLICY IF EXISTS "Auth delete" ON ordenes_trabajo_servicios;
    CREATE POLICY "Auth delete" ON ordenes_trabajo_servicios FOR DELETE USING (auth.uid() = created_by);
END $$;

-- Trigger para recalcular total de la orden al insertar/borrar/update servicios
CREATE OR REPLACE FUNCTION trigger_recalcular_total_ot_servicios()
RETURNS TRIGGER AS $$
DECLARE
  v_orden_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_orden_id := OLD.orden_id;
  ELSE
    v_orden_id := NEW.orden_id;
  END IF;
  
  -- Llamamos a la función existente (que actualizaremos abajo)
  PERFORM fn_recalcular_total_orden_trabajo(v_orden_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_total_on_service ON ordenes_trabajo_servicios;
CREATE TRIGGER trigger_update_total_on_service
AFTER INSERT OR UPDATE OR DELETE ON ordenes_trabajo_servicios
FOR EACH ROW EXECUTE FUNCTION trigger_recalcular_total_ot_servicios();

-- Actualizar fn_recalcular_total_orden_trabajo para incluir la tabla de servicios
CREATE OR REPLACE FUNCTION fn_recalcular_total_orden_trabajo(p_orden_trabajo_id uuid)
RETURNS numeric AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos numeric;
  v_total_oc numeric;
  v_total_servicios numeric;
  v_nuevo_total numeric;
BEGIN
  -- Obtener subtotal (items) y descuentos de la orden de trabajo
  SELECT COALESCE(subtotal, 0), COALESCE(total_descuentos, 0)
  INTO v_subtotal_ot, v_descuentos
  FROM ordenes_trabajo
  WHERE id = p_orden_trabajo_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Orden de trabajo % no encontrada', p_orden_trabajo_id;
    RETURN 0;
  END IF;

  -- Obtener total servicios adicionales
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_total_servicios
  FROM ordenes_trabajo_servicios
  WHERE orden_id = p_orden_trabajo_id;

  -- Obtener total ordenes de copiado asociadas
  SELECT COALESCE(SUM(total), 0)
  INTO v_total_oc
  FROM centro_copiado_ordenes
  WHERE orden_trabajo_id = p_orden_trabajo_id;

  -- Calcular nuevo total: (subtotal_items + servicios) - descuentos + total_ordenes_copiado
  -- Nota: Asumimos que 'subtotal' en ordenes_trabajo SOLO contiene la suma de items de inventario.
  v_nuevo_total := v_subtotal_ot + v_total_servicios - v_descuentos + v_total_oc;

  -- Actualizar orden de trabajo
  UPDATE ordenes_trabajo
  SET total = v_nuevo_total,
      updated_at = NOW()
  WHERE id = p_orden_trabajo_id;

  RETURN v_nuevo_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
