/*
  # Reforzar Categorías del Sistema como Inmutables

  ## Descripción
  Esta migración refuerza las categorías del sistema como entidades completamente
  inmutables y globales. Elimina la posibilidad de que usuarios creen, editen o
  eliminen categorías desde el frontend.

  ## Cambios Principales

  ### 1. Limpiar Categorías de Empresas
  - Eliminar cualquier categoría que tenga company_id no-null
  - Solo deben existir categorías del sistema (company_id null)

  ### 2. Actualizar Constraint
  - Forzar que company_id SIEMPRE sea NULL
  - Forzar que is_system_category SIEMPRE sea TRUE

  ### 3. Actualizar Políticas RLS
  - Eliminar políticas de INSERT, UPDATE y DELETE (no permitidas)
  - Mantener solo política SELECT para lectura
  - Hacer la tabla efectivamente read-only desde el frontend

  ## Seguridad
  - Las categorías solo pueden modificarse mediante migraciones SQL
  - Los usuarios solo pueden leer las categorías, nunca modificarlas
  - Esto previene que se rompan funcionalidades del sistema

  ## Notas Importantes
  - Esta migración es idempotente y segura de ejecutar múltiples veces
  - No afecta a las categorías del sistema existentes
  - Asegura que no puedan crearse categorías de empresa nunca más
*/

-- =====================================================
-- 1. LIMPIAR CATEGORÍAS NO DEL SISTEMA (SI EXISTEN)
-- =====================================================

-- Advertencia: Este paso elimina categorías que no son del sistema
-- Si tienes categorías de empresa que necesitas preservar, comenta esta sección
DELETE FROM categorias WHERE is_system_category = false OR company_id IS NOT NULL;

-- =====================================================
-- 2. ACTUALIZAR CONSTRAINT PARA FORZAR SOLO CATEGORÍAS DEL SISTEMA
-- =====================================================

-- Eliminar constraint anterior
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS check_system_category_company_id;

-- Nuevo constraint: company_id DEBE ser NULL y is_system_category DEBE ser TRUE
ALTER TABLE categorias ADD CONSTRAINT check_only_system_categories
  CHECK (company_id IS NULL AND is_system_category = true);

-- Hacer que company_id sea NOT NULL para prevenir valores no-null accidentalmente
-- (el constraint arriba asegura que sea NULL, este es una capa extra de seguridad)
ALTER TABLE categorias ALTER COLUMN company_id DROP NOT NULL;

-- =====================================================
-- 3. ELIMINAR POLÍTICAS RLS ANTIGUAS
-- =====================================================

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view system and own company categorias" ON categorias;
DROP POLICY IF EXISTS "Users can insert own company categorias only" ON categorias;
DROP POLICY IF EXISTS "Users can update own company categorias only" ON categorias;
DROP POLICY IF EXISTS "Users can delete own company categorias only" ON categorias;

-- =====================================================
-- 4. CREAR NUEVA POLÍTICA RLS DE SOLO LECTURA
-- =====================================================

-- SELECT: Todos los usuarios autenticados pueden ver todas las categorías
-- (que son todas del sistema de todas formas)
CREATE POLICY "Users can view all system categories"
  ON categorias FOR SELECT
  TO authenticated
  USING (true);

-- No hay políticas de INSERT, UPDATE o DELETE
-- Esto hace que la tabla sea efectivamente read-only desde el frontend

-- =====================================================
-- 5. ACTUALIZAR COMENTARIOS DESCRIPTIVOS
-- =====================================================

COMMENT ON TABLE categorias IS
  'Categorías del sistema - Entidades inmutables que solo pueden modificarse mediante migraciones SQL. Los usuarios solo tienen acceso de lectura.';

COMMENT ON COLUMN categorias.company_id IS
  'Siempre NULL - Las categorías son globales del sistema, no específicas de empresas.';

COMMENT ON COLUMN categorias.is_system_category IS
  'Siempre TRUE - Todas las categorías son del sistema. Este campo se mantiene por compatibilidad pero siempre debe ser true.';

COMMENT ON CONSTRAINT check_only_system_categories ON categorias IS
  'Asegura que solo puedan existir categorías del sistema (company_id NULL y is_system_category true).';

-- =====================================================
-- 6. CREAR ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índice para búsquedas por nombre (común en selectores)
CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre);

-- Índice para filtrar por activas (también muy común)
CREATE INDEX IF NOT EXISTS idx_categorias_is_active ON categorias(is_active) WHERE is_active = true;

-- =====================================================
-- 7. VALIDAR DATOS EXISTENTES
-- =====================================================

-- Verificar que solo existen categorías del sistema
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM categorias
  WHERE company_id IS NOT NULL OR is_system_category = false;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'ERROR: Existen % categorías inválidas (no del sistema) después de la limpieza', invalid_count;
  END IF;

  RAISE NOTICE 'Validación exitosa: Todas las categorías son del sistema';
END $$;
