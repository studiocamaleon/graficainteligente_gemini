/*
  # Permitir precios NULL para items pendientes de cotización
  
  1. Cambios en presupuestos_items
    - Hacer precio_unitario_final y precio_total NULL-able
    - Actualizar constraint check_precios_positivos para permitir NULL
    - Agregar índice para búsqueda rápida de items sin precio
  
  2. Funcionalidad
    - Los items pueden crearse sin precio asignado (pendientes de cotización)
    - La cantidad siempre es obligatoria
    - precio_base, precio_servicios y precio_acabados mantienen DEFAULT 0
  
  3. Notas de seguridad
    - El constraint valida que si hay valor, debe ser >= 0
    - Se mantiene integridad referencial
    - RLS existente se mantiene intacto
*/

-- ============================================================================
-- 1. Remover constraint antiguo
-- ============================================================================
ALTER TABLE presupuestos_items 
  DROP CONSTRAINT IF EXISTS check_precios_positivos;

-- ============================================================================
-- 2. Hacer precio_unitario_final y precio_total nullable
-- ============================================================================
ALTER TABLE presupuestos_items 
  ALTER COLUMN precio_unitario_final DROP NOT NULL,
  ALTER COLUMN precio_unitario_final DROP DEFAULT,
  ALTER COLUMN precio_total DROP NOT NULL,
  ALTER COLUMN precio_total DROP DEFAULT;

-- ============================================================================
-- 3. Nuevo constraint que permite NULL pero si hay valor debe ser >= 0
-- ============================================================================
ALTER TABLE presupuestos_items 
  ADD CONSTRAINT check_precios_positivos CHECK (
    precio_base >= 0 AND
    precio_servicios >= 0 AND
    precio_acabados >= 0 AND
    (precio_unitario_final IS NULL OR precio_unitario_final >= 0) AND
    (precio_total IS NULL OR precio_total >= 0)
  );

-- ============================================================================
-- 4. Índice para búsqueda rápida de items sin precio
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_presupuestos_items_sin_precio 
  ON presupuestos_items(presupuesto_id) 
  WHERE precio_unitario_final IS NULL OR precio_total IS NULL;

-- ============================================================================
-- 5. Comentarios para documentación
-- ============================================================================
COMMENT ON COLUMN presupuestos_items.precio_unitario_final IS 
  'Precio unitario final. NULL indica que el item está pendiente de cotización';

COMMENT ON COLUMN presupuestos_items.precio_total IS 
  'Precio total del item (cantidad * precio_unitario_final). NULL indica pendiente de cotización';
