-- ============================================================================
-- MIGRATION: Fix History on Delete
-- 1. Make presupuesto_id nullable in history
-- 2. Update FK to ON DELETE SET NULL to preserve history
-- 3. Update trigger function to insert NULL id on DELETE
-- ============================================================================

-- 1. Modify Table Structure
ALTER TABLE "public"."presupuestos_historial" 
ALTER COLUMN "presupuesto_id" DROP NOT NULL;

-- 2. Modify Foreign Key
ALTER TABLE "public"."presupuestos_historial" 
DROP CONSTRAINT "presupuestos_historial_presupuesto_id_fkey";

ALTER TABLE "public"."presupuestos_historial"
ADD CONSTRAINT "presupuestos_historial_presupuesto_id_fkey" 
FOREIGN KEY ("presupuesto_id") 
REFERENCES "public"."presupuestos" ("id") 
ON DELETE SET NULL;

-- 3. Update Trigger Function to handle NULL ID on DELETE
CREATE OR REPLACE FUNCTION fn_presupuestos_registro_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion text;
  v_usuario_id uuid;
  v_detalles jsonb;
  v_presupuesto_id uuid;
BEGIN
  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'creado';
    v_usuario_id := NEW.created_by;
    v_presupuesto_id := NEW.id;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', NEW.numero_presupuesto,
      'cliente_id', NEW.cliente_id,
      'estado_inicial', NEW.estado
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_presupuesto_id := NEW.id;
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
    -- IMPORTANT: For DELETE, we set ID to NULL because the row is gone (or about to be unlinked)
    -- The FK is ON DELETE SET NULL, so this aligns with the table state
    v_presupuesto_id := NULL; 
    v_detalles := jsonb_build_object(
      'numero_presupuesto', OLD.numero_presupuesto,
      'estado_final', OLD.estado,
      'id_original', OLD.id -- Keep original ID in details
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
    v_presupuesto_id,
    v_accion,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.estado ELSE NULL END,
    v_usuario_id,
    v_detalles
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
