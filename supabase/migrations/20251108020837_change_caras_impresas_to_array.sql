/*
  # Cambiar caras_impresas a array para múltiples opciones

  ## Descripción
  Esta migración modifica el campo caras_impresas en la tabla productos
  para permitir múltiples opciones de impresión simultáneas.

  ## Cambios

  ### Modificación de caras_impresas
  - Cambia de tipo `text` a `text[]` (array de texto)
  - Permite seleccionar una o ambas opciones: 'solo_frente' y/o 'frente_y_dorso'
  - Migra datos existentes al nuevo formato array

  ## Migración de Datos
  - Convierte valores únicos existentes a arrays de un elemento
  - Mantiene compatibilidad con datos actuales

  ## Constraints
  - Valida que el array contenga al menos una opción
  - Valida que solo contenga valores permitidos
*/

-- =====================================================
-- 1. CREAR NUEVA COLUMNA TEMPORAL
-- =====================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS caras_impresas_new text[];

-- =====================================================
-- 2. MIGRAR DATOS EXISTENTES
-- =====================================================

UPDATE productos 
SET caras_impresas_new = ARRAY[caras_impresas]
WHERE caras_impresas IS NOT NULL;

-- =====================================================
-- 3. ELIMINAR COLUMNA ANTIGUA Y RENOMBRAR
-- =====================================================

ALTER TABLE productos DROP COLUMN IF EXISTS caras_impresas;
ALTER TABLE productos RENAME COLUMN caras_impresas_new TO caras_impresas;

-- =====================================================
-- 4. ESTABLECER DEFAULT Y NOT NULL
-- =====================================================

ALTER TABLE productos 
ALTER COLUMN caras_impresas SET DEFAULT ARRAY['solo_frente'::text];

ALTER TABLE productos 
ALTER COLUMN caras_impresas SET NOT NULL;

-- =====================================================
-- 5. AGREGAR CONSTRAINTS
-- =====================================================

-- Constraint: El array debe tener al menos un elemento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_caras_impresas_not_empty'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_caras_impresas_not_empty 
    CHECK (array_length(caras_impresas, 1) > 0);
  END IF;
END $$;

-- Constraint: Solo valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_caras_impresas_valid_values'
  ) THEN
    ALTER TABLE productos 
    ADD CONSTRAINT check_caras_impresas_valid_values 
    CHECK (
      caras_impresas <@ ARRAY['solo_frente', 'frente_y_dorso']::text[]
    );
  END IF;
END $$;

-- =====================================================
-- 6. COMENTARIO EN COLUMNA
-- =====================================================

COMMENT ON COLUMN productos.caras_impresas IS 'Opciones de impresión disponibles para el producto: solo_frente, frente_y_dorso, o ambas';
