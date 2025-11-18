/*
  # Categorías del Sistema

  ## Descripción
  Esta migración implementa categorías del sistema que son globales, inmutables 
  y están disponibles para todas las empresas del sistema.

  ## Cambios Principales

  ### 1. Modificación de Tabla categorias
  - Agregar columna `is_system_category` (boolean, default false)
  - Modificar `company_id` para permitir NULL en categorías del sistema
  - Agregar constraint para asegurar consistencia de datos

  ### 2. Categorías del Sistema Predefinidas
  - "Impresion Laser": Para productos de impresión digital laser
  - "Impresion Gran Formato": Para productos de gran formato
  - "Materiales Rigidos": Para productos con materiales rígidos

  ### 3. Actualización de Políticas RLS
  - Permitir SELECT de categorías del sistema a todos los usuarios autenticados
  - Prevenir INSERT de categorías del sistema por usuarios normales
  - Prevenir UPDATE/DELETE de categorías del sistema

  ## Seguridad
  - Solo categorías del sistema pueden tener company_id NULL
  - Categorías del sistema no pueden ser modificadas ni eliminadas
  - Las políticas RLS protegen la integridad de las categorías del sistema

  ## Notas Importantes
  - Las categorías del sistema son visibles para todas las empresas
  - Cada empresa puede crear sus propias categorías adicionales
  - Las categorías del sistema tienen precedencia en el sistema de búsqueda
*/

-- =====================================================
-- 1. AGREGAR COLUMNA is_system_category
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categorias' AND column_name = 'is_system_category'
  ) THEN
    ALTER TABLE categorias ADD COLUMN is_system_category boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Crear índice para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_categorias_is_system ON categorias(is_system_category);

-- =====================================================
-- 2. MODIFICAR company_id PARA PERMITIR NULL
-- =====================================================

-- Eliminar la restricción NOT NULL de company_id
ALTER TABLE categorias ALTER COLUMN company_id DROP NOT NULL;

-- Agregar constraint: company_id debe ser NULL si y solo si is_system_category es true
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS check_system_category_company_id;
ALTER TABLE categorias ADD CONSTRAINT check_system_category_company_id 
  CHECK (
    (is_system_category = true AND company_id IS NULL) OR
    (is_system_category = false AND company_id IS NOT NULL)
  );

-- =====================================================
-- 3. ELIMINAR POLÍTICAS RLS ANTIGUAS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own company categorias" ON categorias;
DROP POLICY IF EXISTS "Users can insert own company categorias" ON categorias;
DROP POLICY IF EXISTS "Users can update own company categorias" ON categorias;
DROP POLICY IF EXISTS "Users can delete own company categorias" ON categorias;

-- =====================================================
-- 4. CREAR NUEVAS POLÍTICAS RLS
-- =====================================================

-- SELECT: Ver categorías del sistema + categorías de la propia empresa
CREATE POLICY "Users can view system and own company categorias"
  ON categorias FOR SELECT
  TO authenticated
  USING (
    is_system_category = true OR
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- INSERT: Solo categorías de la propia empresa, nunca del sistema
CREATE POLICY "Users can insert own company categorias only"
  ON categorias FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_category = false AND
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- UPDATE: Solo categorías de la propia empresa, nunca del sistema
CREATE POLICY "Users can update own company categorias only"
  ON categorias FOR UPDATE
  TO authenticated
  USING (
    is_system_category = false AND
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    is_system_category = false AND
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- DELETE: Solo categorías de la propia empresa, nunca del sistema
CREATE POLICY "Users can delete own company categorias only"
  ON categorias FOR DELETE
  TO authenticated
  USING (
    is_system_category = false AND
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 5. INSERTAR CATEGORÍAS DEL SISTEMA
-- =====================================================

-- Insertar solo si no existen (idempotente)
INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Impresion Laser',
    'Productos de impresión digital laser',
    '#3B82F6',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    NULL,
    'Impresion Gran Formato',
    'Productos de impresión en gran formato',
    '#10B981',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    NULL,
    'Materiales Rigidos',
    'Productos con materiales rígidos',
    '#F59E0B',
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. COMENTARIOS DESCRIPTIVOS
-- =====================================================

COMMENT ON COLUMN categorias.is_system_category IS 
  'Indica si la categoría es del sistema (global para todas las empresas). Las categorías del sistema no pueden modificarse ni eliminarse.';

COMMENT ON CONSTRAINT check_system_category_company_id ON categorias IS 
  'Asegura que las categorías del sistema tengan company_id NULL y las categorías de empresa tengan company_id NOT NULL.';
