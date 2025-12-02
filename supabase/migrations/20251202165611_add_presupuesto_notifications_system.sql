/*
  # Sistema de notificaciones para presupuestos

  1. Extensión de tipos de notificaciones
    - Agregar tipos relacionados a presupuestos
    - presupuesto_aprobado
    - presupuesto_rechazado
    - presupuesto_por_vencer
    - presupuesto_vencido

  2. Extensión de referencias
    - Agregar 'presupuesto' a tipos de referencia

  3. Triggers
    - Notificar aprobación de presupuesto
    - Notificar rechazo de presupuesto
*/

-- Extender tipos de notificación (reemplazar constraint)
ALTER TABLE notificaciones_internas 
  DROP CONSTRAINT IF EXISTS notificaciones_internas_tipo_check;

ALTER TABLE notificaciones_internas 
  ADD CONSTRAINT notificaciones_internas_tipo_check 
  CHECK (tipo IN (
    'pausa_prolongada',
    'paso_completado',
    'orden_finalizada',
    'alerta_produccion',
    'sistema',
    'presupuesto_aprobado',
    'presupuesto_rechazado',
    'presupuesto_por_vencer',
    'presupuesto_vencido'
  ));

-- Extender tipos de referencia
ALTER TABLE notificaciones_internas 
  DROP CONSTRAINT IF EXISTS notificaciones_internas_referencia_tipo_check;

ALTER TABLE notificaciones_internas 
  ADD CONSTRAINT notificaciones_internas_referencia_tipo_check 
  CHECK (referencia_tipo IN (
    'orden_trabajo',
    'orden_item',
    'ruta_paso',
    'pausa',
    'presupuesto'
  ));

-- Función para notificar aprobación de presupuesto
CREATE OR REPLACE FUNCTION fn_notificar_aprobacion_presupuesto()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cliente_nombre text;
  v_usuarios_notificar uuid[];
BEGIN
  -- Solo proceder si el estado cambió a 'aprobado'
  IF NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado') THEN

    -- Obtener nombre del cliente
    SELECT razon_social INTO v_cliente_nombre
    FROM clients
    WHERE id = NEW.cliente_id;

    -- Obtener usuarios a notificar (vendedor y admin/super_admin de la empresa)
    SELECT ARRAY_AGG(DISTINCT p.id)
    INTO v_usuarios_notificar
    FROM profiles p
    WHERE p.company_id = NEW.company_id
      AND (
        p.id = NEW.vendedor_id OR
        p.role IN ('admin', 'super_admin')
      );

    -- Crear notificación para cada usuario
    IF v_usuarios_notificar IS NOT NULL THEN
      INSERT INTO notificaciones_internas (
        company_id,
        usuario_id,
        tipo,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id,
        metadata,
        leida
      )
      SELECT
        NEW.company_id,
        unnest(v_usuarios_notificar),
        'presupuesto_aprobado',
        'Presupuesto Aprobado',
        COALESCE(v_cliente_nombre, 'Cliente') || ' aprobó el presupuesto #' || NEW.numero_presupuesto,
        'presupuesto',
        NEW.id,
        jsonb_build_object(
          'presupuesto_id', NEW.id,
          'numero_presupuesto', NEW.numero_presupuesto,
          'cliente_id', NEW.cliente_id,
          'cliente_nombre', v_cliente_nombre,
          'total', NEW.total
        ),
        false;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Función para notificar rechazo de presupuesto
CREATE OR REPLACE FUNCTION fn_notificar_rechazo_presupuesto()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cliente_nombre text;
  v_usuarios_notificar uuid[];
  v_motivo text;
BEGIN
  -- Solo proceder si el estado cambió a 'rechazado'
  IF NEW.estado = 'rechazado' AND (OLD.estado IS NULL OR OLD.estado != 'rechazado') THEN

    -- Obtener nombre del cliente
    SELECT razon_social INTO v_cliente_nombre
    FROM clients
    WHERE id = NEW.cliente_id;

    -- Extraer motivo del rechazo (primeras líneas de observaciones)
    v_motivo := COALESCE(
      SUBSTRING(NEW.observaciones_cliente FROM 'MOTIVO: ([^\n]+)'),
      'Sin especificar'
    );

    -- Obtener usuarios a notificar (vendedor y admin/super_admin de la empresa)
    SELECT ARRAY_AGG(DISTINCT p.id)
    INTO v_usuarios_notificar
    FROM profiles p
    WHERE p.company_id = NEW.company_id
      AND (
        p.id = NEW.vendedor_id OR
        p.role IN ('admin', 'super_admin')
      );

    -- Crear notificación para cada usuario
    IF v_usuarios_notificar IS NOT NULL THEN
      INSERT INTO notificaciones_internas (
        company_id,
        usuario_id,
        tipo,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id,
        metadata,
        leida
      )
      SELECT
        NEW.company_id,
        unnest(v_usuarios_notificar),
        'presupuesto_rechazado',
        'Presupuesto Rechazado',
        COALESCE(v_cliente_nombre, 'Cliente') || ' rechazó el presupuesto #' || NEW.numero_presupuesto,
        'presupuesto',
        NEW.id,
        jsonb_build_object(
          'presupuesto_id', NEW.id,
          'numero_presupuesto', NEW.numero_presupuesto,
          'cliente_id', NEW.cliente_id,
          'cliente_nombre', v_cliente_nombre,
          'motivo_rechazo', v_motivo,
          'observaciones', NEW.observaciones_cliente
        ),
        false;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar triggers si existen
DROP TRIGGER IF EXISTS on_presupuesto_aprobado ON presupuestos;
DROP TRIGGER IF EXISTS on_presupuesto_rechazado ON presupuestos;

-- Crear trigger para aprobación
CREATE TRIGGER on_presupuesto_aprobado
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado'))
  EXECUTE FUNCTION fn_notificar_aprobacion_presupuesto();

-- Crear trigger para rechazo
CREATE TRIGGER on_presupuesto_rechazado
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'rechazado' AND (OLD.estado IS NULL OR OLD.estado != 'rechazado'))
  EXECUTE FUNCTION fn_notificar_rechazo_presupuesto();

-- Comentarios
COMMENT ON FUNCTION fn_notificar_aprobacion_presupuesto() IS
  'Crea notificaciones internas cuando un presupuesto es aprobado';

COMMENT ON FUNCTION fn_notificar_rechazo_presupuesto() IS
  'Crea notificaciones internas cuando un presupuesto es rechazado';

COMMENT ON TRIGGER on_presupuesto_aprobado ON presupuestos IS
  'Notifica al equipo cuando un presupuesto es aprobado';

COMMENT ON TRIGGER on_presupuesto_rechazado ON presupuestos IS
  'Notifica al equipo cuando un presupuesto es rechazado';
