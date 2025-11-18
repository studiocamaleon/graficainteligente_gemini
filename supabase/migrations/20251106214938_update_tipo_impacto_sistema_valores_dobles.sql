/*
  # Actualización del Sistema de Tipos de Impacto - Valores Dobles
  
  ## Descripción
  Esta migración extiende el sistema de tipos de impacto para soportar valores dobles
  en los tipos de impacto combinados. Agrega un nuevo tipo de impacto "fijo_minuto" 
  y un campo secundario para almacenar el segundo valor en los tipos combinados.

  ## Cambios Principales

  ### 1. Nuevas Columnas
  - `servicios.valor_impacto_secundario` (numeric, nullable)
  - `acabados.valor_impacto_secundario` (numeric, nullable)
  - `servicios_niveles_precio.valor_impacto_secundario` (numeric, nullable)
  - `acabados_niveles_precio.valor_impacto_secundario` (numeric, nullable)

  ### 2. Actualizaciones de Constraints
  - Agregar 'fijo_minuto' a las opciones válidas de tipo_impacto en todas las tablas
  - Las constraints CHECK se actualizan para incluir el nuevo tipo

  ## Tipos de Impacto Soportados

  ### Tipos Simples (valor_impacto)
  - sin_impacto: No requiere valor
  - precio_fijo: Valor fijo en $
  - por_unidad: Valor por unidad
  - por_minuto: Valor por minuto
  - porcentual: Valor en porcentaje (%)
  - por_mt2: Valor por metro cuadrado
  - por_mt_lineal: Valor por metro lineal

  ### Tipos Combinados (valor_impacto + valor_impacto_secundario)
  - fijo_porcentual: Valor fijo ($) + Porcentaje (%)
  - fijo_mt2: Valor fijo ($) + Valor por mt2 ($)
  - fijo_mt_lineal: Valor fijo ($) + Valor por metro lineal ($)
  - fijo_minuto: Valor fijo ($) + Valor por minuto ($)

  ## Notas Importantes
  - El campo valor_impacto_secundario es nullable
  - Solo se debe usar cuando el tipo_impacto sea combinado
  - Para tipos simples, valor_impacto_secundario debe ser NULL
  - Todos los datos existentes permanecen intactos
  - La migración es completamente retrocompatible

  ## Seguridad
  - No modifica políticas RLS existentes
  - Los nuevos campos heredan las políticas de las tablas
*/

-- =====================================================
-- 1. ACTUALIZAR TABLA SERVICIOS
-- =====================================================

-- Agregar columna para valor secundario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicios' AND column_name = 'valor_impacto_secundario'
  ) THEN
    ALTER TABLE servicios ADD COLUMN valor_impacto_secundario numeric;
  END IF;
END $$;

-- Actualizar constraint para incluir nuevo tipo de impacto
ALTER TABLE servicios DROP CONSTRAINT IF EXISTS check_tipo_impacto;
ALTER TABLE servicios ADD CONSTRAINT check_tipo_impacto CHECK (
  tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'
  )
);

-- =====================================================
-- 2. ACTUALIZAR TABLA ACABADOS
-- =====================================================

-- Agregar columna para valor secundario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acabados' AND column_name = 'valor_impacto_secundario'
  ) THEN
    ALTER TABLE acabados ADD COLUMN valor_impacto_secundario numeric;
  END IF;
END $$;

-- Actualizar constraint para incluir nuevo tipo de impacto
ALTER TABLE acabados DROP CONSTRAINT IF EXISTS check_acabados_tipo_impacto;
ALTER TABLE acabados ADD CONSTRAINT check_acabados_tipo_impacto CHECK (
  tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'
  )
);

-- =====================================================
-- 3. ACTUALIZAR TABLA SERVICIOS_NIVELES_PRECIO
-- =====================================================

-- Agregar columna para valor secundario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicios_niveles_precio' AND column_name = 'valor_impacto_secundario'
  ) THEN
    ALTER TABLE servicios_niveles_precio ADD COLUMN valor_impacto_secundario numeric;
  END IF;
END $$;

-- Actualizar constraint para incluir nuevo tipo de impacto
ALTER TABLE servicios_niveles_precio DROP CONSTRAINT IF EXISTS check_nivel_tipo_impacto;
ALTER TABLE servicios_niveles_precio ADD CONSTRAINT check_nivel_tipo_impacto CHECK (
  tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'
  )
);

-- =====================================================
-- 4. ACTUALIZAR TABLA ACABADOS_NIVELES_PRECIO
-- =====================================================

-- Agregar columna para valor secundario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acabados_niveles_precio' AND column_name = 'valor_impacto_secundario'
  ) THEN
    ALTER TABLE acabados_niveles_precio ADD COLUMN valor_impacto_secundario numeric;
  END IF;
END $$;

-- Actualizar constraint para incluir nuevo tipo de impacto
ALTER TABLE acabados_niveles_precio DROP CONSTRAINT IF EXISTS check_acabados_nivel_tipo_impacto;
ALTER TABLE acabados_niveles_precio ADD CONSTRAINT check_acabados_nivel_tipo_impacto CHECK (
  tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'
  )
);

-- =====================================================
-- 5. ÍNDICES ADICIONALES (Opcional, para optimización)
-- =====================================================

-- Índices para búsquedas por tipo de impacto combinado
CREATE INDEX IF NOT EXISTS idx_servicios_tipo_impacto_combinado 
  ON servicios(tipo_impacto) 
  WHERE tipo_impacto IN ('fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto');

CREATE INDEX IF NOT EXISTS idx_acabados_tipo_impacto_combinado 
  ON acabados(tipo_impacto) 
  WHERE tipo_impacto IN ('fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto');

-- =====================================================
-- 6. COMENTARIOS EN LAS COLUMNAS (Documentación)
-- =====================================================

COMMENT ON COLUMN servicios.valor_impacto IS 
  'Valor principal del impacto. Para tipos combinados, este es el valor fijo.';

COMMENT ON COLUMN servicios.valor_impacto_secundario IS 
  'Valor secundario para tipos de impacto combinados (porcentaje, valor por mt2, valor por metro lineal, o valor por minuto). NULL para tipos simples.';

COMMENT ON COLUMN acabados.valor_impacto IS 
  'Valor principal del impacto. Para tipos combinados, este es el valor fijo.';

COMMENT ON COLUMN acabados.valor_impacto_secundario IS 
  'Valor secundario para tipos de impacto combinados (porcentaje, valor por mt2, valor por metro lineal, o valor por minuto). NULL para tipos simples.';

COMMENT ON COLUMN servicios_niveles_precio.valor_impacto IS 
  'Valor principal del impacto del nivel. Para tipos combinados, este es el valor fijo.';

COMMENT ON COLUMN servicios_niveles_precio.valor_impacto_secundario IS 
  'Valor secundario para tipos de impacto combinados en el nivel de precio. NULL para tipos simples.';

COMMENT ON COLUMN acabados_niveles_precio.valor_impacto IS 
  'Valor principal del impacto del nivel. Para tipos combinados, este es el valor fijo.';

COMMENT ON COLUMN acabados_niveles_precio.valor_impacto_secundario IS 
  'Valor secundario para tipos de impacto combinados en el nivel de precio. NULL para tipos simples.';
