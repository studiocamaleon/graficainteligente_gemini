/*
  # Agregar Estado a Items de Órdenes de Trabajo

  ## Descripción
  Agrega la columna 'estado' a la tabla ordenes_trabajo_items para permitir
  el seguimiento del estado de producción de cada item individual dentro de una orden.

  ## Nueva Columna
  - `estado`: Estado del item (pendiente, en_proceso, finalizado)
    - pendiente: Ningún paso de producción iniciado
    - en_proceso: Al menos un paso iniciado o completado
    - finalizado: Todos los pasos de producción completados

  ## Cambios Realizados
  1. Agrega columna estado con valor DEFAULT 'pendiente'
  2. Crea constraint CHECK para validar estados válidos
  3. Crea índice en columna estado para consultas eficientes
  4. Crea índice compuesto (orden_id, estado) para filtrado por orden

  ## Reglas de Negocio
  - El estado se actualiza automáticamente mediante triggers basados en el estado de los pasos
  - Un item está 'pendiente' cuando todos sus pasos están pendientes
  - Un item está 'en_proceso' cuando al menos un paso no está pendiente
  - Un item está 'finalizado' cuando todos sus pasos están completados

  ## Seguridad
  - La actualización de estado será manejada por triggers, no directamente por usuarios
  - Las políticas RLS existentes se aplican automáticamente
*/

-- =====================================================
-- 1. AGREGAR COLUMNA ESTADO
-- =====================================================

-- Agregar columna estado con valor por defecto 'pendiente'
ALTER TABLE ordenes_trabajo_items
ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente';

-- =====================================================
-- 2. CREAR CONSTRAINT DE VALIDACIÓN
-- =====================================================

-- Constraint para validar estados válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estado_item'
  ) THEN
    ALTER TABLE ordenes_trabajo_items
    ADD CONSTRAINT check_estado_item
    CHECK (estado IN ('pendiente', 'en_proceso', 'finalizado'));
  END IF;
END $$;

-- =====================================================
-- 3. CREAR ÍNDICES
-- =====================================================

-- Índice en columna estado para filtrado eficiente
CREATE INDEX IF NOT EXISTS idx_ordenes_items_estado
ON ordenes_trabajo_items(estado);

-- Índice compuesto para consultas por orden y estado
CREATE INDEX IF NOT EXISTS idx_ordenes_items_orden_estado
ON ordenes_trabajo_items(orden_id, estado);

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN ordenes_trabajo_items.estado IS 'Estado del item: pendiente (inicial), en_proceso, finalizado. Se actualiza automáticamente según el estado de los pasos de producción.';
