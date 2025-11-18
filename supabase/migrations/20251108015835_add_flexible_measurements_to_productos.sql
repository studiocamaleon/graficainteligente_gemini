/*
  # Agregar Configuración Flexible de Medidas a Productos

  ## Descripción
  Esta migración adapta la tabla productos para soportar diferentes configuraciones
  de medidas según la categoría del producto:
  
  - **Impresion Laser**: Múltiples combinaciones de ancho/alto disponibles
  - **Impresion Gran Formato**: Solo ancho máximo (medida final se define en orden de trabajo)
  - **Materiales Rigidos**: Par único de ancho/alto (tamaño de placa)

  ## Cambios en la Tabla productos

  ### Nuevos Campos
  - `tipo_medida` (text): Tipo de configuración de medidas
    - 'medida_unica': Un solo par ancho/alto (default, compatible con datos existentes)
    - 'medidas_multiples': Múltiples combinaciones de ancho/alto (Impresion Laser)
    - 'ancho_maximo': Solo ancho máximo sin restricción de alto (Gran Formato)
  
  - `medidas_disponibles` (jsonb): Array de objetos {ancho: number, alto: number}
    - Para 'medidas_multiples': Array con múltiples combinaciones
    - Para 'medida_unica': null (se usan los campos medidas_ancho y medidas_alto)
    - Para 'ancho_maximo': null (se usa solo medidas_ancho)

  - `ancho_maximo` (numeric): Para productos de gran formato
    - Solo aplica cuando tipo_medida = 'ancho_maximo'

  ### Campos Existentes
  - `medidas_ancho` y `medidas_alto` se mantienen para compatibilidad
  - Se usan para tipo_medida = 'medida_unica' y 'ancho_maximo'

  ## Migración de Datos
  - Todos los productos existentes se configuran como tipo_medida = 'medida_unica'
  - Se mantienen los valores actuales de medidas_ancho y medidas_alto

  ## Constraints
  - Nueva constraint para validar tipo_medida
  - Constraint modificada para medidas positivas (solo aplica según tipo_medida)
  - Nuevas constraints para validar consistencia de datos según tipo_medida

  ## Índices
  - Nuevo índice en tipo_medida para optimizar filtros
*/

-- =====================================================
-- 1. AGREGAR NUEVOS CAMPOS
-- =====================================================

-- Agregar campo tipo_medida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productos' AND column_name = 'tipo_medida'
  ) THEN
    ALTER TABLE productos 
    ADD COLUMN tipo_medida text NOT NULL DEFAULT 'medida_unica';
  END IF;
END $$;

-- Agregar campo medidas_disponibles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productos' AND column_name = 'medidas_disponibles'
  ) THEN
    ALTER TABLE productos 
    ADD COLUMN medidas_disponibles jsonb DEFAULT NULL;
  END IF;
END $$;

-- Agregar campo ancho_maximo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productos' AND column_name = 'ancho_maximo'
  ) THEN
    ALTER TABLE productos 
    ADD COLUMN ancho_maximo numeric DEFAULT NULL;
  END IF;
END $$;

-- =====================================================
-- 2. ELIMINAR CONSTRAINTS ANTIGUAS Y AGREGAR NUEVAS
-- =====================================================

-- Eliminar constraint antigua de medidas positivas
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_medidas_positivas;

-- Agregar constraint para tipo_medida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_tipo_medida'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_tipo_medida 
    CHECK (tipo_medida IN ('medida_unica', 'medidas_multiples', 'ancho_maximo'));
  END IF;
END $$;

-- Constraint: Para medida_unica, ancho y alto deben ser positivos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_medida_unica_positivas'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_medida_unica_positivas 
    CHECK (
      tipo_medida != 'medida_unica' OR 
      (medidas_ancho > 0 AND medidas_alto > 0)
    );
  END IF;
END $$;

-- Constraint: Para ancho_maximo, solo ancho_maximo debe ser positivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_ancho_maximo_positivo'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_ancho_maximo_positivo 
    CHECK (
      tipo_medida != 'ancho_maximo' OR 
      ancho_maximo > 0
    );
  END IF;
END $$;

-- Constraint: Para medidas_multiples, medidas_disponibles debe tener al menos una medida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_medidas_multiples_not_empty'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_medidas_multiples_not_empty 
    CHECK (
      tipo_medida != 'medidas_multiples' OR 
      (medidas_disponibles IS NOT NULL AND jsonb_array_length(medidas_disponibles) > 0)
    );
  END IF;
END $$;

-- =====================================================
-- 3. CREAR ÍNDICE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_tipo_medida ON productos(tipo_medida);

-- =====================================================
-- 4. COMENTARIOS EN COLUMNAS
-- =====================================================

COMMENT ON COLUMN productos.tipo_medida IS 'Tipo de configuración de medidas: medida_unica (default), medidas_multiples (Impresion Laser), ancho_maximo (Gran Formato)';
COMMENT ON COLUMN productos.medidas_disponibles IS 'Array de combinaciones {ancho, alto} para tipo_medida = medidas_multiples';
COMMENT ON COLUMN productos.ancho_maximo IS 'Ancho máximo para tipo_medida = ancho_maximo (productos de gran formato)';
