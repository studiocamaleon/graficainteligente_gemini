/*
  # Extensión de productos_precios para soporte de Gran Formato

  ## Descripción
  Esta migración extiende la tabla productos_precios para soportar precios basados en
  materiales y variantes, necesarios para productos de Impresión Gran Formato.

  ## Cambios Realizados

  ### 1. Nuevos Campos en productos_precios
  - `material_id` (uuid, nullable, foreign key to materiales)
    - Permite asociar un precio específico a un material del producto
  - `variante_nombre` (text, nullable)
    - Permite especificar la variante del material (ej: "Brillante", "Mate")
  - `rango_min` (numeric, nullable)
    - Valor mínimo del rango de cantidad (para productos con rangos)
  - `rango_max` (numeric, nullable)
    - Valor máximo del rango de cantidad (null = ilimitado)

  ### 2. Modificación del Constraint Único
  - Se elimina el constraint actual `unique_precio_combinacion`
  - Se crea nuevo constraint que incluye material_id y variante_nombre
  - Permite múltiples combinaciones según el contexto del producto

  ### 3. Nuevos Índices
  - Índice en material_id para optimizar consultas
  - Índice compuesto para búsquedas por material y variante

  ## Compatibilidad
  - Los campos nuevos son opcionales (nullable) para mantener compatibilidad
  - Productos de Impresión Laser seguirán usando la estructura actual
  - Productos de Gran Formato usarán los campos adicionales de material

  ## Notas Importantes
  - Para Impresión Laser: material_id, variante_nombre, rango_min, rango_max serán NULL
  - Para Gran Formato sin rangos: rango_min y rango_max serán NULL, cantidad será el valor fijo
  - Para Gran Formato con rangos: cantidad contendrá el valor mínimo del rango
*/

-- =====================================================
-- AGREGAR NUEVOS CAMPOS
-- =====================================================

DO $$
BEGIN
  -- Agregar material_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_precios' AND column_name = 'material_id'
  ) THEN
    ALTER TABLE productos_precios
      ADD COLUMN material_id uuid REFERENCES materiales(id) ON DELETE RESTRICT;
  END IF;

  -- Agregar variante_nombre
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_precios' AND column_name = 'variante_nombre'
  ) THEN
    ALTER TABLE productos_precios
      ADD COLUMN variante_nombre text;
  END IF;

  -- Agregar rango_min
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_precios' AND column_name = 'rango_min'
  ) THEN
    ALTER TABLE productos_precios
      ADD COLUMN rango_min numeric;
  END IF;

  -- Agregar rango_max
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_precios' AND column_name = 'rango_max'
  ) THEN
    ALTER TABLE productos_precios
      ADD COLUMN rango_max numeric;
  END IF;
END $$;

-- =====================================================
-- MODIFICAR CONSTRAINT ÚNICO
-- =====================================================

-- Eliminar constraint anterior si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_combinacion'
  ) THEN
    ALTER TABLE productos_precios DROP CONSTRAINT unique_precio_combinacion;
  END IF;
END $$;

-- Crear nuevo constraint único que incluye todos los campos relevantes
ALTER TABLE productos_precios
  ADD CONSTRAINT unique_precio_combinacion_completa UNIQUE NULLS NOT DISTINCT (
    producto_id,
    tecnologia_id,
    tipo_tinta,
    cara_impresion,
    material_id,
    variante_nombre,
    cantidad,
    rango_min,
    rango_max
  );

-- =====================================================
-- NUEVOS ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_precios_material_id
  ON productos_precios(material_id);

CREATE INDEX IF NOT EXISTS idx_productos_precios_material_variante
  ON productos_precios(material_id, variante_nombre);

CREATE INDEX IF NOT EXISTS idx_productos_precios_rangos
  ON productos_precios(rango_min, rango_max);

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN productos_precios.material_id IS
  'ID del material (nullable). Para productos de Gran Formato que tienen precios por material';

COMMENT ON COLUMN productos_precios.variante_nombre IS
  'Nombre de la variante del material (nullable). Ej: Brillante, Mate, Adhesivo';

COMMENT ON COLUMN productos_precios.rango_min IS
  'Valor mínimo del rango de cantidad (nullable). Para productos con precios por rangos';

COMMENT ON COLUMN productos_precios.rango_max IS
  'Valor máximo del rango de cantidad (nullable). NULL indica rango ilimitado (ej: 100+)';
