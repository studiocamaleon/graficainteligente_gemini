/*
  # Agregar Soporte Multi-Tenant a Ubicaciones

  ## Descripción
  Esta migración extiende el sistema de ubicaciones para soportar multi-tenancy, permitiendo
  que cada compañía tenga sus propias ubicaciones personalizadas mientras mantiene las 
  ubicaciones pre-cargadas de Argentina disponibles globalmente para todos.

  ## Cambios en Tablas Existentes

  ### 1. `countries` - Agregar campos multi-tenant
  - `company_id` (uuid, nullable, FK) - Referencia a la compañía propietaria (null = global)
  - `is_global` (boolean) - Indica si es una ubicación global del sistema

  ### 2. `provinces` - Agregar campos multi-tenant
  - `company_id` (uuid, nullable, FK) - Referencia a la compañía propietaria (null = global)
  - `is_global` (boolean) - Indica si es una ubicación global del sistema

  ### 3. `cities` - Agregar campos multi-tenant
  - `company_id` (uuid, nullable, FK) - Referencia a la compañía propietaria (null = global)
  - `is_global` (boolean) - Indica si es una ubicación global del sistema

  ## Modificaciones de Seguridad (RLS)

  ### Políticas actualizadas para permitir:
  - Usuarios autenticados pueden ver ubicaciones globales y de su compañía
  - super_admin puede gestionar todas las ubicaciones
  - admin y manager pueden crear/editar ubicaciones de su compañía
  - No se pueden eliminar ubicaciones con dependencias activas

  ## Datos Iniciales
  - Marcar todas las ubicaciones existentes de Argentina como globales
*/

-- ============================================================================
-- 1. AGREGAR COLUMNAS A COUNTRIES
-- ============================================================================

-- Agregar company_id y is_global a countries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'countries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE countries ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'countries' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE countries ADD COLUMN is_global boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Crear índice para company_id en countries
CREATE INDEX IF NOT EXISTS idx_countries_company_id ON countries(company_id);

-- Marcar ubicaciones existentes como globales
UPDATE countries SET is_global = true, company_id = null WHERE company_id IS NULL;

-- ============================================================================
-- 2. AGREGAR COLUMNAS A PROVINCES
-- ============================================================================

-- Agregar company_id y is_global a provinces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'provinces' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE provinces ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'provinces' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE provinces ADD COLUMN is_global boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Crear índice para company_id en provinces
CREATE INDEX IF NOT EXISTS idx_provinces_company_id ON provinces(company_id);

-- Marcar ubicaciones existentes como globales
UPDATE provinces SET is_global = true, company_id = null WHERE company_id IS NULL;

-- ============================================================================
-- 3. AGREGAR COLUMNAS A CITIES
-- ============================================================================

-- Agregar company_id y is_global a cities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cities' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE cities ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cities' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE cities ADD COLUMN is_global boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Crear índice para company_id en cities
CREATE INDEX IF NOT EXISTS idx_cities_company_id ON cities(company_id);

-- Marcar ubicaciones existentes como globales
UPDATE cities SET is_global = true, company_id = null WHERE company_id IS NULL;

-- ============================================================================
-- 4. ACTUALIZAR POLÍTICAS RLS PARA COUNTRIES
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Anyone can view active countries" ON countries;
DROP POLICY IF EXISTS "Only super_admin can manage countries" ON countries;

-- Nueva política de lectura: ver ubicaciones globales y de su compañía
CREATE POLICY "Users can view global and own company countries"
  ON countries FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (
      is_global = true 
      OR company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- super_admin puede gestionar todas las ubicaciones
CREATE POLICY "super_admin can manage all countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- admin y manager pueden crear ubicaciones de su compañía
CREATE POLICY "admin and manager can create company countries"
  ON countries FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden actualizar ubicaciones de su compañía
CREATE POLICY "admin and manager can update company countries"
  ON countries FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden eliminar ubicaciones de su compañía
CREATE POLICY "admin and manager can delete company countries"
  ON countries FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- ============================================================================
-- 5. ACTUALIZAR POLÍTICAS RLS PARA PROVINCES
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Anyone can view active provinces" ON provinces;
DROP POLICY IF EXISTS "Only super_admin can manage provinces" ON provinces;

-- Nueva política de lectura
CREATE POLICY "Users can view global and own company provinces"
  ON provinces FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (
      is_global = true 
      OR company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- super_admin puede gestionar todas las ubicaciones
CREATE POLICY "super_admin can manage all provinces"
  ON provinces FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- admin y manager pueden crear provincias de su compañía
CREATE POLICY "admin and manager can create company provinces"
  ON provinces FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden actualizar provincias de su compañía
CREATE POLICY "admin and manager can update company provinces"
  ON provinces FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden eliminar provincias de su compañía
CREATE POLICY "admin and manager can delete company provinces"
  ON provinces FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- ============================================================================
-- 6. ACTUALIZAR POLÍTICAS RLS PARA CITIES
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Anyone can view active cities" ON cities;
DROP POLICY IF EXISTS "Only super_admin can manage cities" ON cities;

-- Nueva política de lectura
CREATE POLICY "Users can view global and own company cities"
  ON cities FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (
      is_global = true 
      OR company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- super_admin puede gestionar todas las ubicaciones
CREATE POLICY "super_admin can manage all cities"
  ON cities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- admin y manager pueden crear ciudades de su compañía
CREATE POLICY "admin and manager can create company cities"
  ON cities FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden actualizar ciudades de su compañía
CREATE POLICY "admin and manager can update company cities"
  ON cities FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );

-- admin y manager pueden eliminar ciudades de su compañía
CREATE POLICY "admin and manager can delete company cities"
  ON cities FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    AND is_global = false
  );
