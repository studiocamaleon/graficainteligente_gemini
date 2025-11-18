/*
  # Actualización de Estados de Órdenes de Trabajo

  ## Descripción
  Actualiza el enum de estados de órdenes de trabajo para simplificar el flujo:
  - Elimina: 'cotizacion', 'confirmado', 'en_produccion', 'completado'
  - Agrega: 'pendiente', 'en_proceso', 'finalizada'
  - Mantiene: 'borrador', 'cancelada'

  ## Cambios
  1. Eliminar el constraint check existente
  2. Actualizar los estados existentes al nuevo esquema
  3. Crear nuevo constraint check con los estados simplificados

  ## Mapeo de estados antiguos a nuevos
  - 'cotizacion' → 'pendiente'
  - 'confirmado' → 'pendiente'
  - 'en_produccion' → 'en_proceso'
  - 'completado' → 'finalizada'
  - 'cancelado' → 'cancelada'
  - 'borrador' → 'borrador' (sin cambios)
*/

-- Eliminar el constraint check existente
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ordenes_trabajo_estado_check'
  ) THEN
    ALTER TABLE ordenes_trabajo DROP CONSTRAINT ordenes_trabajo_estado_check;
  END IF;
END $$;

-- Actualizar estados existentes al nuevo esquema
UPDATE ordenes_trabajo
SET estado = CASE estado
  WHEN 'cotizacion' THEN 'pendiente'
  WHEN 'confirmado' THEN 'pendiente'
  WHEN 'en_produccion' THEN 'en_proceso'
  WHEN 'completado' THEN 'finalizada'
  WHEN 'cancelado' THEN 'cancelada'
  ELSE estado
END
WHERE estado IN ('cotizacion', 'confirmado', 'en_produccion', 'completado', 'cancelado');

-- Crear nuevo constraint check con los estados simplificados
ALTER TABLE ordenes_trabajo
ADD CONSTRAINT ordenes_trabajo_estado_check
CHECK (estado IN ('borrador', 'pendiente', 'en_proceso', 'finalizada', 'cancelada'));