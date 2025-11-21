/*
  # Agregar Campos de Seguimiento a Rutas de Items

  ## Descripción
  Agrega campos de seguimiento y estado a la tabla ordenes_trabajo_items_rutas
  para permitir el control completo del progreso de producción de cada paso.

  ## Nuevas Columnas
  - `estado_paso`: Estado del paso (pendiente, en_proceso, completado, omitido)
  - `fecha_inicio`: Timestamp de cuándo se inició el paso (nullable)
  - `fecha_fin`: Timestamp de cuándo se finalizó el paso (nullable)
  - `responsable_id`: ID del usuario responsable del paso (nullable, FK a profiles)
  - `notas`: Notas adicionales del operador sobre el paso (nullable)

  ## Estados de Paso
  - pendiente: Paso no iniciado (estado inicial)
  - en_proceso: Paso actualmente en ejecución
  - completado: Paso finalizado exitosamente
  - omitido: Paso que no se ejecutará (requiere justificación en notas)

  ## Cambios Realizados
  1. Agrega 5 nuevas columnas a ordenes_trabajo_items_rutas
  2. Crea constraint CHECK para validar estados válidos
  3. Crea índices para consultas eficientes
  4. Agrega foreign key a profiles para responsable

  ## Seguridad
  - RLS existente se aplica automáticamente
  - El módulo de producción será responsable de actualizar estos estados

  ## Notas Importantes
  - fecha_inicio se establece automáticamente al cambiar a 'en_proceso'
  - fecha_fin se establece al cambiar a 'completado' u 'omitido'
  - responsable_id permite asignar y rastrear quién trabaja en cada paso
*/

-- =====================================================
-- 1. AGREGAR NUEVAS COLUMNAS
-- =====================================================

-- Agregar columna estado_paso
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS estado_paso text NOT NULL DEFAULT 'pendiente';

-- Agregar columna fecha_inicio
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS fecha_inicio timestamptz;

-- Agregar columna fecha_fin
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS fecha_fin timestamptz;

-- Agregar columna responsable_id
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Agregar columna notas
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS notas text;

-- =====================================================
-- 2. CREAR CONSTRAINTS
-- =====================================================

-- Constraint para validar estados válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estado_paso_item_ruta'
  ) THEN
    ALTER TABLE ordenes_trabajo_items_rutas
    ADD CONSTRAINT check_estado_paso_item_ruta
    CHECK (estado_paso IN ('pendiente', 'en_proceso', 'completado', 'omitido'));
  END IF;
END $$;

-- =====================================================
-- 3. CREAR ÍNDICES
-- =====================================================

-- Índice en estado_paso para filtrado eficiente
CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_estado_paso
ON ordenes_trabajo_items_rutas(estado_paso);

-- Índice en responsable_id para consultas por responsable
CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_responsable
ON ordenes_trabajo_items_rutas(responsable_id);

-- Índice compuesto para consultas de pasos por item y estado
CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_item_estado
ON ordenes_trabajo_items_rutas(orden_item_id, estado_paso);

-- Índice para consultas de pasos en proceso
CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_en_proceso
ON ordenes_trabajo_items_rutas(estado_paso, fecha_inicio)
WHERE estado_paso = 'en_proceso';

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN ordenes_trabajo_items_rutas.estado_paso IS 'Estado del paso: pendiente (inicial), en_proceso, completado, omitido';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.fecha_inicio IS 'Fecha y hora de inicio del paso (se establece al pasar a en_proceso)';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.fecha_fin IS 'Fecha y hora de finalización del paso (se establece al completar u omitir)';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.responsable_id IS 'Usuario responsable de ejecutar este paso';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.notas IS 'Notas del operador sobre la ejecución del paso, justificación si fue omitido';
