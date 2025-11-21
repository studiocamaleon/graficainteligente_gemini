/*
  # Corrección de Arquitectura de Tintas en Productos Talonarios

  Este archivo corrige la inconsistencia arquitectónica en la tabla productos_talonarios_precios.
  La tabla fue creada con tinta_id (uuid) después de que se revirtió la normalización de tintas
  en todo el sistema, cuando debería usar tinta (text) para ser consistente.

  ## Cambios Realizados

  1. **Tabla productos_talonarios_precios**
     - Migrar de tinta_id (uuid) a tinta (text)
     - Agregar CHECK constraint para valores válidos de tintas
     - Actualizar constraint de unicidad para usar tinta en lugar de tinta_id
     - Crear índice en columna tinta para optimizar búsquedas

  ## Arquitectura Post-Reversión

  - tecnologias.tintas: text[] - Array de códigos de tintas
  - productos_talonarios_tecnologias.tintas: text[] - Tintas seleccionadas
  - productos_talonarios_precios.tinta: text - Código de tinta directo
  - Valores válidos: 'K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V'
*/

-- =====================================================
-- PASO 1: Agregar columna temporal
-- =====================================================

ALTER TABLE productos_talonarios_precios
  ADD COLUMN IF NOT EXISTS tinta_temp text;

-- =====================================================
-- PASO 2: Migrar datos existentes (si los hay)
-- =====================================================

-- Intentar migrar desde tecnologias_tintas_pasos si existe la relación
-- Nota: Es probable que no haya datos todavía debido al error de inserción
UPDATE productos_talonarios_precios ptp
SET tinta_temp = ttp.tinta
FROM tecnologias_tintas_pasos ttp
WHERE ptp.tinta_id = ttp.id::text::uuid
  AND ptp.tinta_temp IS NULL;

-- Si no funcionó la migración anterior, dejar NULL para que se pueda volver a ingresar

-- =====================================================
-- PASO 3: Eliminar columna vieja y renombrar
-- =====================================================

-- Eliminar constraint de unicidad viejo
ALTER TABLE productos_talonarios_precios
  DROP CONSTRAINT IF EXISTS unique_precio_talonario_configuracion;

-- Eliminar índice si existe
DROP INDEX IF EXISTS idx_pt_precios_tinta_id;

-- Eliminar columna tinta_id
ALTER TABLE productos_talonarios_precios
  DROP COLUMN IF EXISTS tinta_id;

-- Renombrar columna temporal
ALTER TABLE productos_talonarios_precios
  RENAME COLUMN tinta_temp TO tinta;

-- =====================================================
-- PASO 4: Configurar constraints y defaults
-- =====================================================

-- Configurar NOT NULL
ALTER TABLE productos_talonarios_precios
  ALTER COLUMN tinta SET NOT NULL;

-- Agregar CHECK constraint para valores válidos
ALTER TABLE productos_talonarios_precios
  ADD CONSTRAINT check_tinta_valida_talonarios CHECK (
    tinta IN ('K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V')
  );

-- =====================================================
-- PASO 5: Crear índice y constraints de unicidad
-- =====================================================

-- Crear índice en tinta para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_pt_precios_tinta
  ON productos_talonarios_precios(tinta);

-- Recrear constraint de unicidad con el campo correcto
ALTER TABLE productos_talonarios_precios
  ADD CONSTRAINT unique_precio_talonario_configuracion
  UNIQUE (
    producto_talonario_id,
    medida_ancho,
    medida_alto,
    tinta,
    cantidad,
    tipo_copia
  );

-- =====================================================
-- PASO 6: Actualizar comentarios
-- =====================================================

COMMENT ON COLUMN productos_talonarios_precios.tinta IS
  'Código de tinta utilizada (K, CMYK, CMYK+W, CMYK+V, CMYK+W+V) - consistente con arquitectura post-reversión';
