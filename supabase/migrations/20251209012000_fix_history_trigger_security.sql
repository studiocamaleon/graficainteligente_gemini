-- Make the history logging function SECURITY DEFINER to bypass RLS during trigger execution
-- This allows the AFTER DELETE trigger to insert into presupuestos_historial even if the
-- parent presupuesto row is already gone (which causes the normal RLS check to fail).

CREATE OR REPLACE FUNCTION fn_presupuestos_registro_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS constraints on the history table
SET search_path = public -- Secure search path
AS $$
DECLARE
  v_accion text;
  v_usuario_id uuid;
  v_detalles jsonb;
BEGIN
  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'creado';
    v_usuario_id := NEW.created_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', NEW.numero_presupuesto,
      'cliente_id', NEW.cliente_id,
      'estado_inicial', NEW.estado
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar tipo de cambio
    IF OLD.estado != NEW.estado THEN
      v_accion := 'cambio_estado';
    ELSE
      v_accion := 'modificado';
    END IF;
    v_usuario_id := NEW.updated_by;
    v_detalles := jsonb_build_object(
      'cambios', jsonb_build_object(
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado,
        'total_anterior', OLD.total,
        'total_nuevo', NEW.total
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'eliminado';
    v_usuario_id := OLD.updated_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', OLD.numero_presupuesto,
      'estado_final', OLD.estado
    );
  END IF;

  -- Insertar en historial
  INSERT INTO presupuestos_historial (
    presupuesto_id,
    accion,
    estado_anterior,
    estado_nuevo,
    usuario_id,
    detalles
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_accion,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.estado ELSE NULL END,
    v_usuario_id,
    v_detalles
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
