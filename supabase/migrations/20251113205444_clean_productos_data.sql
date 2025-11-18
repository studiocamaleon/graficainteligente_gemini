/*
  # Limpiar Datos de Tablas de Productos

  ## Descripción
  Esta migración elimina todos los datos existentes en las tablas de productos
  y sus relaciones para permitir comenzar desde cero con la estructura correcta.

  ## Tablas Limpiadas
  1. productos_precios - Precios de productos
  2. productos_tecnologias - Relaciones producto-tecnología
  3. productos_materiales_rel - Relaciones producto-material
  4. productos_servicios - Relaciones producto-servicio
  5. productos_acabados - Relaciones producto-acabado
  6. productos_impresion_laser - Productos de impresión laser
  7. productos_gran_formato - Productos de gran formato
  8. productos_materiales_rigidos - Productos de materiales rígidos

  ## Seguridad
  Esta migración es DESTRUCTIVA y eliminará todos los productos existentes.
  Se ejecuta solo si las tablas existen para evitar errores.
*/

-- =====================================================
-- ELIMINAR DATOS DE TABLAS RELACIONALES (en orden de dependencias)
-- =====================================================

-- Limpiar precios (depende de productos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_precios'
  ) THEN
    DELETE FROM productos_precios;
    RAISE NOTICE 'Tabla productos_precios limpiada';
  END IF;
END $$;

-- Limpiar tecnologías (depende de productos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_tecnologias'
  ) THEN
    DELETE FROM productos_tecnologias;
    RAISE NOTICE 'Tabla productos_tecnologias limpiada';
  END IF;
END $$;

-- Limpiar materiales (depende de productos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_materiales_rel'
  ) THEN
    DELETE FROM productos_materiales_rel;
    RAISE NOTICE 'Tabla productos_materiales_rel limpiada';
  END IF;
END $$;

-- Limpiar servicios (depende de productos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_servicios'
  ) THEN
    DELETE FROM productos_servicios;
    RAISE NOTICE 'Tabla productos_servicios limpiada';
  END IF;
END $$;

-- Limpiar acabados (depende de productos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_acabados'
  ) THEN
    DELETE FROM productos_acabados;
    RAISE NOTICE 'Tabla productos_acabados limpiada';
  END IF;
END $$;

-- =====================================================
-- ELIMINAR DATOS DE TABLAS DE PRODUCTOS PRINCIPALES
-- =====================================================

-- Limpiar productos de impresión laser
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_impresion_laser'
  ) THEN
    DELETE FROM productos_impresion_laser;
    RAISE NOTICE 'Tabla productos_impresion_laser limpiada';
  END IF;
END $$;

-- Limpiar productos de gran formato
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_gran_formato'
  ) THEN
    DELETE FROM productos_gran_formato;
    RAISE NOTICE 'Tabla productos_gran_formato limpiada';
  END IF;
END $$;

-- Limpiar productos de materiales rígidos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'productos_materiales_rigidos'
  ) THEN
    DELETE FROM productos_materiales_rigidos;
    RAISE NOTICE 'Tabla productos_materiales_rigidos limpiada';
  END IF;
END $$;

-- =====================================================
-- RESUMEN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Limpieza completada. Todas las tablas de productos están vacías.';
  RAISE NOTICE '📝 Ahora puedes crear productos desde cero usando los nuevos hooks correctos.';
END $$;
