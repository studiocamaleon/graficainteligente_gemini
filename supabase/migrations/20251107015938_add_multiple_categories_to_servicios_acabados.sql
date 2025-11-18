/*
  # Agregar Múltiples Categorías a Servicios y Acabados

  ## Descripción
  Esta migración permite que los servicios y acabados puedan tener múltiples categorías
  en lugar de una sola. Se implementa mediante tablas relacionales muchos-a-muchos.

  ## Cambios Principales

  ### 1. Nuevas Tablas Relacionales
  - `servicios_categorias`: Relaciona servicios con múltiples categorías
  - `acabados_categorias`: Relaciona acabados con múltiples categorías

  ### 2. Migración de Datos Existentes
  - Los datos existentes se migran automáticamente a las nuevas tablas relacionales
  - Se mantiene la compatibilidad con datos anteriores

  ### 3. Eliminación de Columnas Antiguas
  - Se eliminan las columnas `categoria_id` de servicios y acabados
  - Se eliminan las foreign keys y constraints relacionadas

  ## Nuevas Tablas

  ### servicios_categorias
  - `id` (uuid, primary key)
  - `servicio_id` (uuid, foreign key to servicios)
  - `categoria_id` (uuid, foreign key to categorias)
  - `created_at` (timestamptz)
  - UNIQUE constraint en (servicio_id, categoria_id)

  ### acabados_categorias
  - `id` (uuid, primary key)
  - `acabado_id` (uuid, foreign key to acabados)
  - `categoria_id` (uuid, foreign key to categorias)
  - `created_at` (timestamptz)
  - UNIQUE constraint en (acabado_id, categoria_id)

  ## Seguridad
  - Se habilita RLS en ambas tablas nuevas
  - Las políticas se basan en el company_id del servicio/acabado
  - Solo usuarios autenticados de la misma empresa pueden ver/modificar

  ## Índices
  - Índices en servicio_id y acabado_id para optimizar joins
  - Índices en categoria_id para búsquedas por categoría
*/

-- =====================================================
-- 1. CREAR TABLA servicios_categorias
-- =====================================================

CREATE TABLE IF NOT EXISTS servicios_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(servicio_id, categoria_id)
);

ALTER TABLE servicios_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company servicios_categorias"
  ON servicios_categorias FOR SELECT
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company servicios_categorias"
  ON servicios_categorias FOR INSERT
  TO authenticated
  WITH CHECK (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company servicios_categorias"
  ON servicios_categorias FOR DELETE
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_servicios_categorias_servicio_id ON servicios_categorias(servicio_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categorias_categoria_id ON servicios_categorias(categoria_id);

-- =====================================================
-- 2. CREAR TABLA acabados_categorias
-- =====================================================

CREATE TABLE IF NOT EXISTS acabados_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(acabado_id, categoria_id)
);

ALTER TABLE acabados_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company acabados_categorias"
  ON acabados_categorias FOR SELECT
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company acabados_categorias"
  ON acabados_categorias FOR INSERT
  TO authenticated
  WITH CHECK (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company acabados_categorias"
  ON acabados_categorias FOR DELETE
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_acabados_categorias_acabado_id ON acabados_categorias(acabado_id);
CREATE INDEX IF NOT EXISTS idx_acabados_categorias_categoria_id ON acabados_categorias(categoria_id);

-- =====================================================
-- 3. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Migrar servicios existentes que tienen categoria_id
INSERT INTO servicios_categorias (servicio_id, categoria_id)
SELECT id, categoria_id
FROM servicios
WHERE categoria_id IS NOT NULL
ON CONFLICT (servicio_id, categoria_id) DO NOTHING;

-- Migrar acabados existentes que tienen categoria_id
INSERT INTO acabados_categorias (acabado_id, categoria_id)
SELECT id, categoria_id
FROM acabados
WHERE categoria_id IS NOT NULL
ON CONFLICT (acabado_id, categoria_id) DO NOTHING;

-- =====================================================
-- 4. ELIMINAR COLUMNAS Y CONSTRAINTS ANTIGUAS
-- =====================================================

-- Eliminar foreign key constraints primero
ALTER TABLE servicios DROP CONSTRAINT IF EXISTS servicios_categoria_id_fkey;
ALTER TABLE acabados DROP CONSTRAINT IF EXISTS acabados_categoria_id_fkey;

-- Eliminar índices en las columnas antiguas
DROP INDEX IF EXISTS idx_servicios_categoria_id;
DROP INDEX IF EXISTS idx_acabados_categoria_id;

-- Eliminar columnas categoria_id
ALTER TABLE servicios DROP COLUMN IF EXISTS categoria_id;
ALTER TABLE acabados DROP COLUMN IF EXISTS categoria_id;

-- =====================================================
-- 5. COMENTARIOS DESCRIPTIVOS
-- =====================================================

COMMENT ON TABLE servicios_categorias IS 
  'Tabla relacional muchos-a-muchos entre servicios y categorías. Un servicio puede tener múltiples categorías.';

COMMENT ON TABLE acabados_categorias IS 
  'Tabla relacional muchos-a-muchos entre acabados y categorías. Un acabado puede tener múltiples categorías.';

COMMENT ON COLUMN servicios_categorias.servicio_id IS 
  'ID del servicio. Elimina en cascada cuando se elimina el servicio.';

COMMENT ON COLUMN servicios_categorias.categoria_id IS 
  'ID de la categoría. Restricción para prevenir eliminación de categorías en uso.';

COMMENT ON COLUMN acabados_categorias.acabado_id IS 
  'ID del acabado. Elimina en cascada cuando se elimina el acabado.';

COMMENT ON COLUMN acabados_categorias.categoria_id IS 
  'ID de la categoría. Restricción para prevenir eliminación de categorías en uso.';
