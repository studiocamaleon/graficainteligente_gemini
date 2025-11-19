/*
  # Reversión Completa de Normalización de Tintas

  ## Descripción
  Esta migración revierte completamente la normalización de tintas implementada en 
  20251119221742_fix_tintas_architecture_option_a.sql, devolviendo el sistema a usar
  valores de texto directos en lugar de foreign keys a una tabla tintas.

  ## Razón de la Reversión
  La normalización de tintas introduce complejidad innecesaria para un catálogo simple
  y estático de valores. Los valores de tintas son constantes del sistema y no requieren
  gestión dinámica por company.

  ## Arquitectura Revertida (Simplicidad)
  - `tecnologias.tintas`: text[] - Valores directos ['K', 'CMYK', 'CMYK+W', etc]
  - `productos_impresion_laser_tecnologias.tintas`: text[] - Valores directos
  - `productos_impresion_laser_precios.tinta`: text - Código de tinta directo
  - `tecnologias_tintas_pasos.tinta`: text - Código de tinta directo

  ## Cambios Realizados

  1. **Tabla `tecnologias_tintas_pasos`**
     - Migrar datos de tinta_id a tinta (text)
     - Eliminar FK y columna tinta_id
     - Restaurar columna tinta con CHECK constraint

  2. **Tabla `tecnologias`**
     - Migrar datos de tintas (uuid[]) a tintas (text[])
     - Reemplazar columna con tipo original

  3. **Tabla `productos_impresion_laser_tecnologias`**
     - Migrar datos de tintas (uuid[]) a tintas (text[])
     - Reemplazar columna con tipo original

  4. **Tabla `productos_impresion_laser_precios`**
     - Migrar datos de tinta_id (uuid) a tinta (text)
     - Eliminar FK
     - Cambiar columna a text con CHECK constraint

  5. **Tabla `tintas`**
     - Eliminar tabla completa con todas sus dependencias
*/

-- =====================================================
-- PASO 1: Revertir tecnologias_tintas_pasos
-- =====================================================

-- Agregar columna tinta temporal
ALTER TABLE tecnologias_tintas_pasos 
  ADD COLUMN IF NOT EXISTS tinta_temp text;

-- Migrar datos de tinta_id a tinta
UPDATE tecnologias_tintas_pasos ttp
SET tinta_temp = t.codigo
FROM tintas t
WHERE ttp.tinta_id = t.id
  AND ttp.tinta_temp IS NULL;

-- Eliminar FK y columna tinta_id
ALTER TABLE tecnologias_tintas_pasos 
  DROP CONSTRAINT IF EXISTS fk_tecnologias_tintas_pasos_tinta;

DROP INDEX IF EXISTS idx_tecnologias_tintas_pasos_tinta;

ALTER TABLE tecnologias_tintas_pasos 
  DROP COLUMN IF EXISTS tinta_id;

-- Renombrar y configurar columna tinta
ALTER TABLE tecnologias_tintas_pasos 
  RENAME COLUMN tinta_temp TO tinta;

ALTER TABLE tecnologias_tintas_pasos 
  ALTER COLUMN tinta SET NOT NULL;

-- Agregar CHECK constraint para valores válidos
ALTER TABLE tecnologias_tintas_pasos
  DROP CONSTRAINT IF EXISTS check_tinta_valida;

ALTER TABLE tecnologias_tintas_pasos
  ADD CONSTRAINT check_tinta_valida CHECK (
    tinta IN ('K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V')
  );

-- Recrear constraint de unicidad
ALTER TABLE tecnologias_tintas_pasos
  DROP CONSTRAINT IF EXISTS unique_tecnologia_tinta;

ALTER TABLE tecnologias_tintas_pasos
  ADD CONSTRAINT unique_tecnologia_tinta UNIQUE(tecnologia_id, tinta);

-- Recrear índice
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_tecnologia_tinta
  ON tecnologias_tintas_pasos(tecnologia_id, tinta);

COMMENT ON COLUMN tecnologias_tintas_pasos.tinta IS
  'Tipo de tinta: K, CMYK, CMYK+W, CMYK+V, o CMYK+W+V';

-- =====================================================
-- PASO 2: Revertir tecnologias.tintas
-- =====================================================

-- Agregar columna temporal
ALTER TABLE tecnologias 
  ADD COLUMN IF NOT EXISTS tintas_temp text[];

-- Migrar datos de uuid[] a text[]
UPDATE tecnologias tec
SET tintas_temp = (
  SELECT array_agg(t.codigo ORDER BY idx)
  FROM unnest(tec.tintas) WITH ORDINALITY AS u(tinta_id, idx)
  JOIN tintas t ON t.id = u.tinta_id
)
WHERE tec.tintas IS NOT NULL 
  AND array_length(tec.tintas, 1) > 0
  AND tec.tintas_temp IS NULL;

-- Eliminar triggers de validación
DROP TRIGGER IF EXISTS trg_validar_tintas_tecnologia ON tecnologias;

-- Eliminar índice GIN
DROP INDEX IF EXISTS idx_tecnologias_tintas_gin;

-- Eliminar columna vieja y renombrar
ALTER TABLE tecnologias 
  DROP COLUMN IF EXISTS tintas;

ALTER TABLE tecnologias 
  RENAME COLUMN tintas_temp TO tintas;

-- Configurar defaults y NOT NULL
ALTER TABLE tecnologias 
  ALTER COLUMN tintas SET DEFAULT ARRAY[]::text[];

ALTER TABLE tecnologias 
  ALTER COLUMN tintas SET NOT NULL;

-- Recrear índice GIN para búsquedas
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_gin 
  ON tecnologias USING GIN (tintas);

COMMENT ON COLUMN tecnologias.tintas IS 
  'Array de códigos de tintas disponibles para esta tecnología (K, CMYK, CMYK+W, etc)';

-- =====================================================
-- PASO 3: Revertir productos_impresion_laser_tecnologias
-- =====================================================

-- Agregar columna temporal
ALTER TABLE productos_impresion_laser_tecnologias 
  ADD COLUMN IF NOT EXISTS tintas_temp text[];

-- Migrar datos de uuid[] a text[]
UPDATE productos_impresion_laser_tecnologias plt
SET tintas_temp = (
  SELECT array_agg(t.codigo ORDER BY idx)
  FROM unnest(plt.tintas) WITH ORDINALITY AS u(tinta_id, idx)
  JOIN tintas t ON t.id = u.tinta_id
)
WHERE plt.tintas IS NOT NULL 
  AND array_length(plt.tintas, 1) > 0
  AND plt.tintas_temp IS NULL;

-- Eliminar triggers de validación
DROP TRIGGER IF EXISTS trg_validar_tintas_pl_tecnologia ON productos_impresion_laser_tecnologias;

-- Eliminar índice GIN
DROP INDEX IF EXISTS idx_pl_tecnologias_tintas_gin;

-- Eliminar columna vieja y renombrar
ALTER TABLE productos_impresion_laser_tecnologias 
  DROP COLUMN IF EXISTS tintas;

ALTER TABLE productos_impresion_laser_tecnologias 
  RENAME COLUMN tintas_temp TO tintas;

-- Configurar defaults y NOT NULL
ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas SET DEFAULT ARRAY[]::text[];

ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas SET NOT NULL;

-- Recrear índice GIN
CREATE INDEX IF NOT EXISTS idx_pl_tecnologias_tintas_gin 
  ON productos_impresion_laser_tecnologias USING GIN (tintas);

COMMENT ON COLUMN productos_impresion_laser_tecnologias.tintas IS 
  'Array de códigos de tintas seleccionadas para este producto (K, CMYK, etc)';

-- =====================================================
-- PASO 4: Revertir productos_impresion_laser_precios
-- =====================================================

-- Agregar columna temporal
ALTER TABLE productos_impresion_laser_precios 
  ADD COLUMN IF NOT EXISTS tinta_temp text;

-- Migrar datos de tinta_id (uuid) a tinta (text)
UPDATE productos_impresion_laser_precios plp
SET tinta_temp = t.codigo
FROM tintas t
WHERE plp.tinta_id = t.id
  AND plp.tinta_temp IS NULL;

-- Eliminar FK
ALTER TABLE productos_impresion_laser_precios
  DROP CONSTRAINT IF EXISTS fk_pl_precios_tinta;

DROP INDEX IF EXISTS idx_pl_precios_tinta;

-- Eliminar columna vieja
ALTER TABLE productos_impresion_laser_precios 
  DROP COLUMN IF EXISTS tinta_id;

-- Renombrar columna temporal
ALTER TABLE productos_impresion_laser_precios 
  RENAME COLUMN tinta_temp TO tinta;

-- Configurar NOT NULL
ALTER TABLE productos_impresion_laser_precios 
  ALTER COLUMN tinta SET NOT NULL;

-- Agregar CHECK constraint
ALTER TABLE productos_impresion_laser_precios
  ADD CONSTRAINT check_tinta_valida_precios CHECK (
    tinta IN ('K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V')
  );

-- Crear índice en tinta
CREATE INDEX IF NOT EXISTS idx_pl_precios_tinta 
  ON productos_impresion_laser_precios(tinta);

-- Actualizar constraint de unicidad si existe
ALTER TABLE productos_impresion_laser_precios
  DROP CONSTRAINT IF EXISTS unique_producto_medida_tinta_cantidad_cara;

ALTER TABLE productos_impresion_laser_precios
  ADD CONSTRAINT unique_producto_medida_tinta_cantidad_cara 
  UNIQUE(producto_laser_id, medida_ancho, medida_alto, tinta, cantidad, cara_impresa);

COMMENT ON COLUMN productos_impresion_laser_precios.tinta IS 
  'Código de tinta (K, CMYK, CMYK+W, CMYK+V, CMYK+W+V)';

-- =====================================================
-- PASO 5: Eliminar funciones relacionadas con tintas
-- =====================================================

DROP FUNCTION IF EXISTS get_tintas_info(uuid[]);
DROP FUNCTION IF EXISTS validar_tintas_tecnologia();

-- =====================================================
-- PASO 6: Eliminar tabla tintas
-- =====================================================

-- Esta tabla tiene CASCADE en sus relaciones, pero ya eliminamos las FK manualmente
DROP TABLE IF EXISTS tintas CASCADE;

-- =====================================================
-- PASO 7: Actualizar función de completitud
-- =====================================================

-- Actualizar la función para trabajar con códigos de texto
CREATE OR REPLACE FUNCTION check_tecnologia_tintas_completitud(p_tecnologia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tintas_esperadas text[];
  v_tintas_configuradas text[];
BEGIN
  -- Obtener las tintas configuradas para la tecnología
  SELECT tintas INTO v_tintas_esperadas
  FROM tecnologias
  WHERE id = p_tecnologia_id;

  -- Si no existe la tecnología, retornar false
  IF v_tintas_esperadas IS NULL THEN
    RETURN false;
  END IF;

  -- Si no hay tintas configuradas, retornar false
  IF array_length(v_tintas_esperadas, 1) IS NULL OR array_length(v_tintas_esperadas, 1) = 0 THEN
    RETURN false;
  END IF;

  -- Obtener las tintas que ya tienen paso asignado
  SELECT array_agg(tinta) INTO v_tintas_configuradas
  FROM tecnologias_tintas_pasos
  WHERE tecnologia_id = p_tecnologia_id;

  -- Si no hay configuraciones, retornar false
  IF v_tintas_configuradas IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar que todas las tintas esperadas estén configuradas
  -- Retorna true solo si ambos arrays contienen los mismos elementos
  RETURN (
    SELECT COUNT(*) = array_length(v_tintas_esperadas, 1)
    FROM unnest(v_tintas_esperadas) AS tinta
    WHERE tinta = ANY(v_tintas_configuradas)
  );
END;
$$;

COMMENT ON FUNCTION check_tecnologia_tintas_completitud IS
  'Verifica si todas las tintas de una tecnología tienen un paso de producción asignado. Retorna true solo si está completa.';
