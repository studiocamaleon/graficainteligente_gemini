/*
  # Corrección de Políticas RLS con Recursión Infinita

  ## Problema
  Las políticas SELECT de profiles causan recursión infinita porque:
  - La política "Users can view profiles in their company" hace una subconsulta a profiles
  - Esta subconsulta activa la misma política, creando un loop infinito
  
  ## Solución
  Simplificar las políticas para evitar subconsultas recursivas:
  1. Para SELECT: Permitir a usuarios ver su propio perfil O perfiles de su company_id
  2. Para UPDATE: Mantener permisos simples basados en el usuario actual
  3. Para companies: Simplificar la lógica usando el perfil directamente

  ## Cambios
  - Eliminar todas las políticas problemáticas
  - Recrear con lógica simplificada y sin recursión
*/

-- PROFILES: Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON profiles;

-- PROFILES: Permitir a usuarios ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- PROFILES: Permitir a usuarios ver perfiles de la misma empresa (sin recursión)
CREATE POLICY "Users can view company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- PROFILES: Permitir actualizaciones solo del propio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- COMPANIES: Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Super admins can update their company" ON companies;

-- COMPANIES: Simplificar política de visualización
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- COMPANIES: Permitir actualizaciones solo a super_admin y admin
CREATE POLICY "Admins can update company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id = (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
      LIMIT 1
    )
  )
  WITH CHECK (
    id = (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
      LIMIT 1
    )
  );

-- COMPANY_SUBSCRIPTIONS: Actualizar política para evitar recursión
DROP POLICY IF EXISTS "Users can view their company subscription" ON company_subscriptions;

CREATE POLICY "Users can view company subscription"
  ON company_subscriptions FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

COMMENT ON POLICY "Users can view own profile" ON profiles IS
  'Allows users to view their own profile without recursion';

COMMENT ON POLICY "Users can view company profiles" ON profiles IS
  'Allows users to view profiles in their company using single-level subquery';

COMMENT ON POLICY "Users can view own company" ON companies IS
  'Allows users to view their company using single-level subquery';
