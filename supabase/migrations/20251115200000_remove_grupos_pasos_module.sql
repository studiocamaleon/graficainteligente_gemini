/*
  # Eliminación del Módulo Grupos de Pasos

  ## Descripción
  Esta migración elimina completamente el módulo de "Grupos de Pasos" del sistema,
  incluyendo todas las tablas, columnas relacionadas, índices, constraints y políticas RLS.

  ## Tablas y Columnas Eliminadas

  ### 1. Tablas Principales
  - `grupos_pasos_items` - Tabla relacional de items de grupos de pasos
  - `grupos_pasos` - Tabla principal de grupos de pasos

  ### 2. Columnas en Tablas Relacionadas
  - `servicios_niveles_precio.grupo_paso_id`
  - `servicios_pasos.grupo_paso_id`
  - `acabados_niveles_precio.grupo_paso_id`
  - `acabados_pasos.grupo_paso_id`

  ## Seguridad
  - Se eliminan todas las políticas RLS asociadas
  - Se eliminan todos los índices relacionados
  - Se actualizan los constraints CHECK para reflejar la nueva estructura

  ## IMPORTANTE
  Esta migración es destructiva y eliminará todos los datos relacionados con grupos de pasos.
  Asegúrate de tener un respaldo de los datos si es necesario.
*/

-- =====================================================
-- PASO 1: Eliminar constraints y foreign keys
-- =====================================================

-- Eliminar constraints CHECK que referencian grupo_paso_id en servicios_niveles_precio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_paso_o_grupo'
    AND table_name = 'servicios_niveles_precio'
  ) THEN
    ALTER TABLE servicios_niveles_precio DROP CONSTRAINT check_paso_o_grupo;
  END IF;
END $$;

-- Eliminar constraints CHECK que referencian grupo_paso_id en servicios_pasos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_servicios_pasos_paso_o_grupo'
    AND table_name = 'servicios_pasos'
  ) THEN
    ALTER TABLE servicios_pasos DROP CONSTRAINT check_servicios_pasos_paso_o_grupo;
  END IF;
END $$;

-- Eliminar constraints CHECK que referencian grupo_paso_id en acabados_niveles_precio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_acabados_paso_o_grupo'
    AND table_name = 'acabados_niveles_precio'
  ) THEN
    ALTER TABLE acabados_niveles_precio DROP CONSTRAINT check_acabados_paso_o_grupo;
  END IF;
END $$;

-- Eliminar constraints CHECK que referencian grupo_paso_id en acabados_pasos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_acabados_pasos_paso_o_grupo'
    AND table_name = 'acabados_pasos'
  ) THEN
    ALTER TABLE acabados_pasos DROP CONSTRAINT check_acabados_pasos_paso_o_grupo;
  END IF;
END $$;

-- =====================================================
-- PASO 2: Eliminar columnas grupo_paso_id
-- =====================================================

-- Eliminar columna grupo_paso_id de servicios_niveles_precio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicios_niveles_precio'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE servicios_niveles_precio DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id de servicios_pasos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicios_pasos'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE servicios_pasos DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id de acabados_niveles_precio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acabados_niveles_precio'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE acabados_niveles_precio DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- Eliminar columna grupo_paso_id de acabados_pasos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acabados_pasos'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE acabados_pasos DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- =====================================================
-- PASO 3: Eliminar tablas grupos_pasos
-- =====================================================

-- Eliminar tabla grupos_pasos_items (relacional)
DROP TABLE IF EXISTS grupos_pasos_items CASCADE;

-- Eliminar tabla grupos_pasos (principal)
DROP TABLE IF EXISTS grupos_pasos CASCADE;

-- =====================================================
-- PASO 4: Recrear constraints CHECK sin grupo_paso_id
-- =====================================================

-- Recrear constraint para servicios_niveles_precio (solo paso_id requerido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_paso_required'
    AND table_name = 'servicios_niveles_precio'
  ) THEN
    ALTER TABLE servicios_niveles_precio
    ADD CONSTRAINT check_paso_required CHECK (paso_id IS NOT NULL);
  END IF;
END $$;

-- Recrear constraint para servicios_pasos (solo paso_id requerido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_servicios_pasos_paso_required'
    AND table_name = 'servicios_pasos'
  ) THEN
    ALTER TABLE servicios_pasos
    ADD CONSTRAINT check_servicios_pasos_paso_required CHECK (paso_id IS NOT NULL);
  END IF;
END $$;

-- Recrear constraint para acabados_niveles_precio (solo paso_id requerido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_acabados_paso_required'
    AND table_name = 'acabados_niveles_precio'
  ) THEN
    ALTER TABLE acabados_niveles_precio
    ADD CONSTRAINT check_acabados_paso_required CHECK (paso_id IS NOT NULL);
  END IF;
END $$;

-- Recrear constraint para acabados_pasos (solo paso_id requerido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_acabados_pasos_paso_required'
    AND table_name = 'acabados_pasos'
  ) THEN
    ALTER TABLE acabados_pasos
    ADD CONSTRAINT check_acabados_pasos_paso_required CHECK (paso_id IS NOT NULL);
  END IF;
END $$;

-- =====================================================
-- PASO 5: Limpiar índices huérfanos
-- =====================================================

-- Los índices en columnas grupo_paso_id ya fueron eliminados al eliminar las columnas
-- Pero por si acaso, verificamos y eliminamos cualquier índice huérfano

DROP INDEX IF EXISTS idx_servicios_pasos_grupo_paso_id;
DROP INDEX IF EXISTS idx_acabados_pasos_grupo_paso_id;
DROP INDEX IF EXISTS idx_grupos_pasos_items_grupo_paso_id;
DROP INDEX IF EXISTS idx_grupos_pasos_items_paso_id;
DROP INDEX IF EXISTS idx_grupos_pasos_items_orden;
DROP INDEX IF EXISTS idx_grupos_pasos_company_id;
DROP INDEX IF EXISTS idx_grupos_pasos_nombre;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
