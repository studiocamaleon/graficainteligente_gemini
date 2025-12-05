/*
  # Eliminación de grupo_paso_id de tablas de rutas y órdenes

  ## Descripción
  Esta migración elimina las columnas grupo_paso_id de las tablas relacionadas con
  rutas de producción, pedidos y órdenes de trabajo, completando la eliminación
  del sistema de grupos de pasos del sistema.

  ## Tablas Afectadas
  - productos_rutas_plantillas
  - pedidos_rutas_resueltas
  - ordenes_trabajo_items_rutas

  ## Cambios Realizados

  ### 1. Eliminación de Columnas
  - Eliminar columna `grupo_paso_id` de cada tabla

  ### 2. Actualización de Constraints
  - Actualizar o eliminar constraints CHECK que referencian grupo_paso_id

  ## Seguridad
  - No hay cambios en las políticas RLS
  - Las tablas mantienen su estructura de seguridad existente

  ## IMPORTANTE
  Esta migración puede eliminar datos en las columnas grupo_paso_id.
  Como el sistema de grupos de pasos ya no se usa, esto es seguro.
*/

-- =====================================================
-- PASO 1: productos_rutas_plantillas
-- =====================================================

-- Eliminar constraint CHECK si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%check%paso%'
    AND table_name = 'productos_rutas_plantillas'
  ) THEN
    ALTER TABLE productos_rutas_plantillas DROP CONSTRAINT IF EXISTS check_paso_o_grupo_paso;
    ALTER TABLE productos_rutas_plantillas DROP CONSTRAINT IF EXISTS check_paso_required;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_rutas_plantillas'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE productos_rutas_plantillas DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- =====================================================
-- PASO 2: pedidos_rutas_resueltas
-- =====================================================

-- Eliminar constraint CHECK si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%check%paso%'
    AND table_name = 'pedidos_rutas_resueltas'
  ) THEN
    ALTER TABLE pedidos_rutas_resueltas DROP CONSTRAINT IF EXISTS check_paso_o_grupo_paso;
    ALTER TABLE pedidos_rutas_resueltas DROP CONSTRAINT IF EXISTS check_paso_required;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos_rutas_resueltas'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE pedidos_rutas_resueltas DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- =====================================================
-- PASO 3: ordenes_trabajo_items_rutas
-- =====================================================

-- Eliminar constraint CHECK si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%check%paso%'
    AND table_name = 'ordenes_trabajo_items_rutas'
  ) THEN
    ALTER TABLE ordenes_trabajo_items_rutas DROP CONSTRAINT IF EXISTS check_paso_o_grupo_paso;
    ALTER TABLE ordenes_trabajo_items_rutas DROP CONSTRAINT IF EXISTS check_paso_required;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordenes_trabajo_items_rutas'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE ordenes_trabajo_items_rutas DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- =====================================================
-- COMENTARIOS ACTUALIZADOS
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos_rutas_plantillas') THEN
    COMMENT ON TABLE productos_rutas_plantillas IS
      'Plantillas de rutas de producción para productos. Define el flujo de pasos de producción que se aplicará a los pedidos de cada producto.';
  END IF;
END $$;

COMMENT ON TABLE pedidos_rutas_resueltas IS
  'Rutas de producción resueltas para cada pedido. Almacena la secuencia de pasos específica que se ejecutará para producir cada pedido.';

COMMENT ON TABLE ordenes_trabajo_items_rutas IS
  'Rutas de producción asociadas a cada item de orden de trabajo. Define los pasos de producción que deben seguirse para cada item.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
