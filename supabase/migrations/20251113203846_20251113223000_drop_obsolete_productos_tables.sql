/*
  # Eliminar Tablas Obsoletas de Productos
  
  ## Descripción
  Esta migración elimina todas las tablas obsoletas del sistema de productos,
  incluyendo la tabla principal 'productos' y sus tablas de relaciones que han
  sido reemplazadas por tablas específicas y con patrón polimórfico (v2).
  
  ## Tablas que se Eliminan
  
  ### 1. Tabla Principal Obsoleta
  - `productos` - Reemplazada por productos_impresion_laser, productos_gran_formato, productos_materiales_rigidos
  
  ### 2. Tablas de Relaciones Obsoletas
  - `productos_tecnologias` (sin v2) - Reemplazada por productos_tecnologias_v2
  - `productos_materiales` (sin v2) - Reemplazada por productos_materiales_v2
  - `productos_servicios` (sin v2) - Reemplazada por productos_servicios_v2
  - `productos_acabados` (sin v2) - Reemplazada por productos_acabados_v2
  
  ### 3. Otras Tablas Obsoletas
  - `productos_pricing` - Diferente de productos_precios, si existe se elimina
  - `productos_rutas_produccion` - Reemplazada por productos_rutas_plantillas
  - `productos_rutas_produccion_backup` - Tabla de respaldo temporal
  
  ## IMPORTANTE
  Esta migración asume que:
  - Ya no hay datos en la tabla 'productos' antigua
  - Todos los productos están en las tablas específicas nuevas
  - Las relaciones usan las tablas v2
*/

-- =====================================================
-- 1. ELIMINAR TABLA productos_rutas_produccion_backup
-- =====================================================

DROP TABLE IF EXISTS productos_rutas_produccion_backup CASCADE;

-- =====================================================
-- 2. ELIMINAR TABLA productos_rutas_produccion
-- =====================================================

DROP TABLE IF EXISTS productos_rutas_produccion CASCADE;

-- =====================================================
-- 3. ELIMINAR TABLA productos_pricing (SI EXISTE)
-- =====================================================

DROP TABLE IF EXISTS productos_pricing CASCADE;

-- =====================================================
-- 4. ELIMINAR TABLAS DE RELACIONES ANTIGUAS
-- =====================================================

-- Eliminar productos_acabados (sin v2)
DROP TABLE IF EXISTS productos_acabados CASCADE;

-- Eliminar productos_servicios (sin v2)
DROP TABLE IF EXISTS productos_servicios CASCADE;

-- Eliminar productos_materiales (sin v2)
DROP TABLE IF EXISTS productos_materiales CASCADE;

-- Eliminar productos_tecnologias (sin v2)
DROP TABLE IF EXISTS productos_tecnologias CASCADE;

-- =====================================================
-- 5. ELIMINAR TABLA productos PRINCIPAL
-- =====================================================

-- Esta es la tabla principal antigua que ya no se usa
DROP TABLE IF EXISTS productos CASCADE;

-- =====================================================
-- 6. COMENTARIOS
-- =====================================================

COMMENT ON DATABASE postgres IS
  'Tablas obsoletas eliminadas: productos, productos_tecnologias, productos_materiales, productos_servicios, productos_acabados, productos_pricing, productos_rutas_produccion. Reemplazadas por: productos_impresion_laser, productos_gran_formato, productos_materiales_rigidos y sus relaciones polimórficas v2.';
