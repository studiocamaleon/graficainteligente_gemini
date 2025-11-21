/*
  # Eliminar Estado 'Borrador' de Órdenes de Trabajo

  ## Descripción
  Elimina el estado 'borrador' del sistema de órdenes de trabajo.
  Todas las órdenes que se crean en el sistema son órdenes confirmadas por clientes,
  por lo que el estado inicial será 'pendiente'.

  ## Cambios Realizados
  1. Actualiza todas las órdenes existentes con estado 'borrador' a 'pendiente'
  2. Elimina el constraint check existente de estados
  3. Crea nuevo constraint sin el estado 'borrador'
  4. Actualiza el valor DEFAULT de la columna estado a 'pendiente'

  ## Estados Finales Disponibles
  - pendiente: Orden confirmada pero sin iniciar producción (ESTADO INICIAL)
  - en_proceso: Orden en proceso de producción
  - finalizada: Trabajo completado pero no entregado al cliente
  - entregada: Trabajo completado y entregado al cliente
  - cancelada: Orden cancelada

  ## Notas Importantes
  - Este cambio es compatible con órdenes existentes
  - Las transiciones de estado se validan en la capa de aplicación
  - Los triggers automáticos manejan las transiciones pendiente → en_proceso → finalizada
*/

-- =====================================================
-- 1. ACTUALIZAR ÓRDENES EXISTENTES
-- =====================================================

-- Actualizar todas las órdenes con estado 'borrador' a 'pendiente'
UPDATE ordenes_trabajo
SET estado = 'pendiente'
WHERE estado = 'borrador';

-- =====================================================
-- 2. ACTUALIZAR CONSTRAINT DE ESTADOS
-- =====================================================

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

-- Crear nuevo constraint check SIN el estado 'borrador'
ALTER TABLE ordenes_trabajo
ADD CONSTRAINT ordenes_trabajo_estado_check
CHECK (estado IN ('pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'));

-- =====================================================
-- 3. ACTUALIZAR VALOR DEFAULT
-- =====================================================

-- Cambiar el valor DEFAULT de 'borrador' a 'pendiente'
ALTER TABLE ordenes_trabajo
ALTER COLUMN estado SET DEFAULT 'pendiente';

-- =====================================================
-- 4. VERIFICACIÓN
-- =====================================================

-- Comentario de verificación
COMMENT ON COLUMN ordenes_trabajo.estado IS 'Estado de la orden: pendiente (inicial), en_proceso, finalizada, entregada, cancelada';
