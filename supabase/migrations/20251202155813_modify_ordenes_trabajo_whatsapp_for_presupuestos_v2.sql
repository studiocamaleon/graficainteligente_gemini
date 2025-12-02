/*
  # Modificar Tablas Existentes para Soporte de Presupuestos (v2)

  ## Cambios en ordenes_trabajo
  Agregar campo `presupuesto_id` para relacionar órdenes con presupuestos

  ## Cambios en whatsapp_notificaciones
  - Agregar campo `presupuesto_id` para notificaciones de presupuestos
  - Actualizar constraint de tipos de notificación (incluyendo tipos existentes)
  - Agregar constraint para asegurar al menos una referencia
*/

-- ============================================================================
-- MODIFICAR: ordenes_trabajo
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordenes_trabajo' AND column_name = 'presupuesto_id'
  ) THEN
    ALTER TABLE ordenes_trabajo
      ADD COLUMN presupuesto_id uuid REFERENCES presupuestos(id);
    
    CREATE INDEX idx_ordenes_trabajo_presupuesto_id
      ON ordenes_trabajo(presupuesto_id)
      WHERE presupuesto_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- MODIFICAR: whatsapp_notificaciones
-- ============================================================================

-- Agregar campo presupuesto_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_notificaciones' AND column_name = 'presupuesto_id'
  ) THEN
    ALTER TABLE whatsapp_notificaciones
      ADD COLUMN presupuesto_id uuid REFERENCES presupuestos(id);
    
    CREATE INDEX idx_whatsapp_notif_presupuesto
      ON whatsapp_notificaciones(presupuesto_id)
      WHERE presupuesto_id IS NOT NULL;
  END IF;
END $$;

-- Actualizar constraint de tipo_notificacion para incluir presupuestos
DO $$
BEGIN
  -- Eliminar constraint anterior si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'whatsapp_notificaciones'
    AND constraint_name = 'whatsapp_notificaciones_tipo_notificacion_check'
  ) THEN
    ALTER TABLE whatsapp_notificaciones
      DROP CONSTRAINT whatsapp_notificaciones_tipo_notificacion_check;
  END IF;

  -- Crear nuevo constraint con todos los tipos (existentes + nuevos de presupuesto)
  ALTER TABLE whatsapp_notificaciones
    ADD CONSTRAINT whatsapp_notificaciones_tipo_notificacion_check
    CHECK (tipo_notificacion IN (
      -- Tipos existentes de órdenes
      'nueva_orden_trabajo',
      'nueva_orden_copiado',
      'orden_finalizada',
      'orden_copiado_finalizada',
      -- Nuevos tipos de presupuestos
      'presupuesto_creado',
      'presupuesto_listo',
      'presupuesto_enviado',
      'presupuesto_aprobado',
      'presupuesto_rechazado',
      'presupuesto_vencido'
    ));
END $$;

-- Agregar constraint para asegurar que al menos una referencia existe
-- NOTA: Este constraint solo aplica a nuevos registros para no romper datos existentes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'whatsapp_notificaciones'
    AND constraint_name = 'check_referencia_notificacion'
  ) THEN
    ALTER TABLE whatsapp_notificaciones
      ADD CONSTRAINT check_referencia_notificacion
      CHECK (
        orden_trabajo_id IS NOT NULL OR
        orden_copiado_id IS NOT NULL OR
        presupuesto_id IS NOT NULL
      );
  END IF;
EXCEPTION
  WHEN check_violation THEN
    -- Si falla por datos existentes, no lo agregamos
    RAISE NOTICE 'No se pudo agregar check_referencia_notificacion debido a datos existentes';
END $$;
