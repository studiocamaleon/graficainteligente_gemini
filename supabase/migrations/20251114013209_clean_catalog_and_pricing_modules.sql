/*
  # Limpieza Completa de Módulos de Catálogo y Pricing
  
  ## Descripción
  Esta migración elimina completamente todos los módulos de Catálogo y Pricing
  para permitir un rediseño desde cero. Incluye todas las tablas relacionadas
  con productos, precios, y sus relaciones.
  
  ## Tablas que se Eliminan
  
  ### Tablas Principales de Productos
  - `productos_impresion_laser` - Productos de impresión laser
  - `productos_gran_formato` - Productos de gran formato
  - `productos_materiales_rigidos` - Productos de materiales rígidos
  
  ### Tablas de Relaciones Polimórficas
  - `productos_tecnologias` - Relación productos-tecnologías
  - `productos_materiales_rel` - Relación productos-materiales
  - `productos_servicios` - Relación productos-servicios
  - `productos_acabados` - Relación productos-acabados
  
  ### Tablas de Configuración
  - `productos_rutas_plantillas` - Plantillas de rutas de producción
  - `productos_precios` - Precios de productos
  
  ## Notas Importantes
  - Esta operación es destructiva y eliminará todos los datos de productos
  - Las tablas base (tecnologias, materiales, servicios, acabados, etc.) se mantienen
  - Los módulos de Pedidos y Órdenes de Trabajo se mantienen intactos
*/

-- =====================================================
-- ELIMINAR TABLAS DE RELACIONES PRIMERO (por FKs)
-- =====================================================

DROP TABLE IF EXISTS productos_precios CASCADE;
DROP TABLE IF EXISTS productos_rutas_plantillas CASCADE;
DROP TABLE IF EXISTS productos_acabados CASCADE;
DROP TABLE IF EXISTS productos_servicios CASCADE;
DROP TABLE IF EXISTS productos_materiales_rel CASCADE;
DROP TABLE IF EXISTS productos_tecnologias CASCADE;

-- =====================================================
-- ELIMINAR TABLAS PRINCIPALES DE PRODUCTOS
-- =====================================================

DROP TABLE IF EXISTS productos_impresion_laser CASCADE;
DROP TABLE IF EXISTS productos_gran_formato CASCADE;
DROP TABLE IF EXISTS productos_materiales_rigidos CASCADE;

-- =====================================================
-- COMENTARIO FINAL
-- =====================================================

COMMENT ON SCHEMA public IS 
  'Limpieza completa realizada: Todos los módulos de Catálogo y Pricing han sido eliminados. Sistema listo para rediseño desde cero.';
