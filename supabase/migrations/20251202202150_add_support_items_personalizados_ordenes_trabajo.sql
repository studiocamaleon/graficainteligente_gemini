/*
  # Agregar soporte para items personalizados en órdenes de trabajo
  
  ## Cambios
  1. Modificar ordenes_trabajo_items para soportar items sin producto_id
  2. Agregar campos necesarios para items personalizados:
     - tipo_item: 'catalogo' | 'personalizado'
     - descripcion: para items personalizados
     - tiempo_produccion_dias: estimación de tiempo
  
  3. Constraints:
     - Si tipo_item = 'catalogo', producto_id es obligatorio
     - Si tipo_item = 'personalizado', descripcion es obligatoria
  
  ## Impacto
  - Permite crear órdenes con items personalizados (fuera de catálogo)
  - Compatible con conversión de presupuestos que tienen items personalizados
  - No afecta items existentes (todos se marcan como 'catalogo')
*/

-- Paso 1: Permitir producto_id NULL
ALTER TABLE ordenes_trabajo_items
  ALTER COLUMN producto_id DROP NOT NULL;

-- Paso 2: Agregar columna tipo_item
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS tipo_item text NOT NULL DEFAULT 'catalogo';

-- Paso 3: Agregar constraint para tipo_item
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_tipo_item_valido;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_tipo_item_valido
    CHECK (tipo_item IN ('catalogo', 'personalizado'));

-- Paso 4: Agregar descripción (para personalizados)
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS descripcion text;

-- Paso 5: Agregar tiempo de producción (para personalizados)
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS tiempo_produccion_dias integer;

-- Paso 6: Constraint - si es personalizado, descripción es obligatoria
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_personalizado_requiere_descripcion;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_personalizado_requiere_descripcion
    CHECK (
      tipo_item = 'catalogo' OR 
      (tipo_item = 'personalizado' AND descripcion IS NOT NULL AND LENGTH(TRIM(descripcion)) > 0)
    );

-- Paso 7: Constraint - si es catálogo, producto_id es obligatorio
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_catalogo_requiere_producto_id;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_catalogo_requiere_producto_id
    CHECK (
      tipo_item = 'personalizado' OR
      (tipo_item = 'catalogo' AND producto_id IS NOT NULL)
    );

-- Paso 8: Actualizar todos los registros existentes a 'catalogo'
UPDATE ordenes_trabajo_items
SET tipo_item = 'catalogo'
WHERE tipo_item IS NULL OR tipo_item = '';

-- Paso 9: Actualizar índice de producto_id (ahora es condicional)
DROP INDEX IF EXISTS idx_ordenes_trabajo_items_producto_id;

CREATE INDEX idx_ordenes_trabajo_items_producto_id 
  ON ordenes_trabajo_items(producto_id) 
  WHERE producto_id IS NOT NULL;

-- Paso 10: Crear índice para items personalizados
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_tipo_item 
  ON ordenes_trabajo_items(tipo_item);

-- Comentarios
COMMENT ON COLUMN ordenes_trabajo_items.tipo_item IS
'Tipo de item: catalogo (producto del sistema) o personalizado (sin producto_id)';

COMMENT ON COLUMN ordenes_trabajo_items.descripcion IS
'Descripción detallada del item. Obligatoria para items personalizados.';

COMMENT ON COLUMN ordenes_trabajo_items.tiempo_produccion_dias IS
'Tiempo estimado de producción en días. Útil para items personalizados.';
