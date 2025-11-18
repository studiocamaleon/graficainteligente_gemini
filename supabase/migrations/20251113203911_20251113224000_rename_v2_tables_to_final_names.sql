/*
  # Renombrar Tablas v2 a Nombres Definitivos
  
  ## Descripción
  Esta migración renombra todas las tablas con sufijo '_v2' a sus nombres definitivos,
  eliminando la nomenclatura temporal y estableciendo los nombres finales del sistema.
  
  ## Tablas que se Renombran
  
  ### 1. Tablas de Relaciones Polimórficas
  - `productos_tecnologias_v2` → `productos_tecnologias`
  - `productos_materiales_v2` → `productos_materiales_rel` (para no confundir con catálogo)
  - `productos_servicios_v2` → `productos_servicios`
  - `productos_acabados_v2` → `productos_acabados`
  
  ## Actualización de Componentes
  - Se renombran automáticamente todos los índices asociados
  - Se mantienen todas las políticas RLS
  - Se actualizan los comentarios de las tablas
*/

-- =====================================================
-- 1. RENOMBRAR productos_tecnologias_v2
-- =====================================================

ALTER TABLE IF EXISTS productos_tecnologias_v2 
  RENAME TO productos_tecnologias;

-- Renombrar índices asociados
ALTER INDEX IF EXISTS idx_productos_tecnologias_v2_producto 
  RENAME TO idx_productos_tecnologias_producto;

ALTER INDEX IF EXISTS idx_productos_tecnologias_v2_tecnologia_id 
  RENAME TO idx_productos_tecnologias_tecnologia_id;

-- Actualizar comentario
COMMENT ON TABLE productos_tecnologias IS
  'Relación polimórfica entre productos (cualquier tipo) y tecnologías de impresión';

-- =====================================================
-- 2. RENOMBRAR productos_materiales_v2
-- =====================================================

ALTER TABLE IF EXISTS productos_materiales_v2 
  RENAME TO productos_materiales_rel;

-- Renombrar índices asociados
ALTER INDEX IF EXISTS idx_productos_materiales_v2_producto 
  RENAME TO idx_productos_materiales_rel_producto;

ALTER INDEX IF EXISTS idx_productos_materiales_v2_material_id 
  RENAME TO idx_productos_materiales_rel_material_id;

-- Actualizar comentario
COMMENT ON TABLE productos_materiales_rel IS
  'Relación polimórfica entre productos (cualquier tipo) y materiales con variantes. Tabla separada del catálogo de materiales para evitar confusión.';

-- =====================================================
-- 3. RENOMBRAR productos_servicios_v2
-- =====================================================

ALTER TABLE IF EXISTS productos_servicios_v2 
  RENAME TO productos_servicios;

-- Renombrar índices asociados
ALTER INDEX IF EXISTS idx_productos_servicios_v2_producto 
  RENAME TO idx_productos_servicios_producto;

ALTER INDEX IF EXISTS idx_productos_servicios_v2_servicio_id 
  RENAME TO idx_productos_servicios_servicio_id;

-- Actualizar comentario
COMMENT ON TABLE productos_servicios IS
  'Relación polimórfica entre productos (cualquier tipo) y servicios disponibles';

-- =====================================================
-- 4. RENOMBRAR productos_acabados_v2
-- =====================================================

ALTER TABLE IF EXISTS productos_acabados_v2 
  RENAME TO productos_acabados;

-- Renombrar índices asociados
ALTER INDEX IF EXISTS idx_productos_acabados_v2_producto 
  RENAME TO idx_productos_acabados_producto;

ALTER INDEX IF EXISTS idx_productos_acabados_v2_acabado_id 
  RENAME TO idx_productos_acabados_acabado_id;

-- Actualizar comentario
COMMENT ON TABLE productos_acabados IS
  'Relación polimórfica entre productos (cualquier tipo) y acabados disponibles';

-- =====================================================
-- 5. ACTUALIZAR COMENTARIOS DE COLUMNAS
-- =====================================================

COMMENT ON COLUMN productos_tecnologias.producto_tipo IS
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_materiales_rel.producto_tipo IS
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_servicios.producto_tipo IS
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_acabados.producto_tipo IS
  'Tipo de producto: laser, gran_formato, materiales_rigidos';
