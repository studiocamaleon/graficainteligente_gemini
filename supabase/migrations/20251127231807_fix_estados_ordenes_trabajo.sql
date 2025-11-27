/*
  # Corregir Estados de Órdenes de Trabajo

  ## Descripción
  Esta migración corrige la inconsistencia entre los estados definidos en la base de datos
  y los estados realmente utilizados en el código de la aplicación.

  ## Problema
  El constraint actual define estados que NO se usan:
  - 'borrador', 'cotizacion', 'confirmado', 'en_produccion', 'completado', 'cancelado'

  La aplicación usa estados diferentes:
  - 'pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'

  ## Solución
  - Eliminar constraint incorrecto
  - Crear nuevo constraint con los estados reales utilizados en la aplicación

  ## Flujo de Estados Correcto
  1. 'pendiente' - Estado inicial de la orden
  2. 'en_proceso' - Orden en producción
  3. 'finalizada' - Trabajo completado (aquí se establece fecha_completado)
  4. 'entregada' - Orden entregada al cliente (mantiene fecha_completado)
  5. 'cancelada' - Orden cancelada

  ## Impacto
  - Alinea la base de datos con el código de la aplicación
  - No afecta datos existentes (base de datos limpia)
  - Permite que el trigger de fecha_completado funcione correctamente
*/

-- =====================================================
-- 1. ELIMINAR CONSTRAINT INCORRECTO
-- =====================================================

ALTER TABLE ordenes_trabajo 
DROP CONSTRAINT IF EXISTS check_estado;

-- =====================================================
-- 2. CREAR CONSTRAINT CORRECTO
-- =====================================================

ALTER TABLE ordenes_trabajo 
ADD CONSTRAINT check_estado 
CHECK (estado IN ('pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'));

-- Agregar comentario descriptivo
COMMENT ON CONSTRAINT check_estado ON ordenes_trabajo IS 
'Estados válidos: pendiente (inicial), en_proceso (producción), finalizada (completada), entregada (al cliente), cancelada';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Query para verificar el nuevo constraint (ejecutar manualmente si necesario)
-- SELECT
--   conname as constraint_name,
--   pg_get_constraintdef(oid) as constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'ordenes_trabajo'::regclass
--   AND conname = 'check_estado';
