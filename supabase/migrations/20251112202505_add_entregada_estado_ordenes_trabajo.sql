/*
  # Agregar Estado 'Entregada' a Órdenes de Trabajo

  ## Descripción
  Agrega el estado 'entregada' al flujo de órdenes de trabajo como estado final posterior a 'finalizada'.
  
  ## Cambios Realizados
  1. Elimina el constraint check existente de estados
  2. Agrega el nuevo constraint incluyendo el estado 'entregada'
  
  ## Estados Disponibles
  - borrador: Orden en construcción, no confirmada
  - pendiente: Orden confirmada pero sin iniciar producción
  - en_proceso: Orden en proceso de producción
  - finalizada: Trabajo completado pero no entregado al cliente
  - entregada: Trabajo completado y entregado al cliente
  - cancelada: Orden cancelada
  
  ## Notas Importantes
  - El estado 'entregada' debe establecerse solo después de 'finalizada'
  - Las validaciones de transición de estado se manejan en la capa de aplicación
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

-- Crear nuevo constraint check incluyendo el estado 'entregada'
ALTER TABLE ordenes_trabajo
ADD CONSTRAINT ordenes_trabajo_estado_check
CHECK (estado IN ('borrador', 'pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'));

-- Crear índice para optimizar consultas por estado (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_ordenes_trabajo_estado'
  ) THEN
    CREATE INDEX idx_ordenes_trabajo_estado ON ordenes_trabajo(estado);
  END IF;
END $$;

-- Crear índice compuesto para optimizar consultas por company_id y estado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_ordenes_trabajo_company_estado'
  ) THEN
    CREATE INDEX idx_ordenes_trabajo_company_estado ON ordenes_trabajo(company_id, estado);
  END IF;
END $$;