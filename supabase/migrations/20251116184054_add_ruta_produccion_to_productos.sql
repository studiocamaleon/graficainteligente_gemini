/*
  # Agregar Relación de Rutas de Producción a Productos

  ## Descripción
  Este migration agrega el campo `ruta_produccion_id` a todas las tablas de productos
  para permitir la asignación de rutas de producción como plantillas reutilizables.

  ## Cambios en Tablas

  ### 1. productos_impresion_laser
  - Agregar columna `ruta_produccion_id` (uuid, nullable, foreign key)
  - Crear índice para optimizar consultas

  ### 2. productos_gran_formato
  - Agregar columna `ruta_produccion_id` (uuid, nullable, foreign key)
  - Crear índice para optimizar consultas

  ### 3. productos_materiales_rigidos
  - Agregar columna `ruta_produccion_id` (uuid, nullable, foreign key)
  - Crear índice para optimizar consultas

  ## Notas
  - El campo es nullable para permitir productos sin ruta asignada (configuración manual)
  - La foreign key usa ON DELETE SET NULL para no eliminar productos si se borra una ruta
  - Los índices facilitan consultas tipo "qué productos usan esta ruta"
*/

-- =====================================================
-- 1. PRODUCTOS IMPRESIÓN LÁSER
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_impresion_laser'
    AND column_name = 'ruta_produccion_id'
  ) THEN
    ALTER TABLE productos_impresion_laser
    ADD COLUMN ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_ruta_produccion_id
      ON productos_impresion_laser(ruta_produccion_id)
      WHERE ruta_produccion_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 2. PRODUCTOS GRAN FORMATO
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_gran_formato'
    AND column_name = 'ruta_produccion_id'
  ) THEN
    ALTER TABLE productos_gran_formato
    ADD COLUMN ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_ruta_produccion_id
      ON productos_gran_formato(ruta_produccion_id)
      WHERE ruta_produccion_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 3. PRODUCTOS MATERIALES RÍGIDOS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_materiales_rigidos'
    AND column_name = 'ruta_produccion_id'
  ) THEN
    ALTER TABLE productos_materiales_rigidos
    ADD COLUMN ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_ruta_produccion_id
      ON productos_materiales_rigidos(ruta_produccion_id)
      WHERE ruta_produccion_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 4. FUNCIÓN AUXILIAR: Obtener productos por ruta
-- =====================================================

CREATE OR REPLACE FUNCTION get_productos_using_ruta(p_ruta_id uuid)
RETURNS TABLE (
  tipo_producto text,
  producto_id uuid,
  nombre_producto text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 'impresion_laser'::text, id, nombre
  FROM productos_impresion_laser
  WHERE ruta_produccion_id = p_ruta_id

  UNION ALL

  SELECT 'gran_formato'::text, id, nombre
  FROM productos_gran_formato
  WHERE ruta_produccion_id = p_ruta_id

  UNION ALL

  SELECT 'materiales_rigidos'::text, id, nombre
  FROM productos_materiales_rigidos
  WHERE ruta_produccion_id = p_ruta_id;
$$;

-- =====================================================
-- 5. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION get_productos_using_ruta IS
  'Retorna todos los productos (de cualquier tipo) que están usando una ruta de producción específica.';
