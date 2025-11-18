/*
  # Solución Definitiva: Usar Función Helper para Evitar Recursión RLS

  ## Problema
  Las políticas RLS que hacen subconsultas a la misma tabla causan recursión infinita.
  Las políticas de profiles no pueden hacer SELECT a profiles dentro de USING.

  ## Solución
  Crear una función SECURITY DEFINER que bypasea RLS para obtener el company_id
  del usuario actual. Esta función rompe el ciclo de recursión.

  ## Cambios
  1. Crear función get_user_company_id() con SECURITY DEFINER
  2. Usar esta función en las políticas en lugar de subconsultas directas
  3. Simplificar todas las políticas para usar la función helper
*/

-- Función helper que bypasea RLS para obtener el company_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

-- Asegurar owner correcto
ALTER FUNCTION public.get_user_company_id(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_company_id(uuid) IS
  'Helper function to get user company_id bypassing RLS to prevent infinite recursion';

-- PROFILES: Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- PROFILES: Nueva política simple para ver propio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- PROFILES: Nueva política usando función helper (sin recursión)
CREATE POLICY "Users can view company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- PROFILES: Política de actualización
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- COMPANIES: Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own company" ON companies;
DROP POLICY IF EXISTS "Admins can update company" ON companies;

-- COMPANIES: Nueva política usando función helper
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id(auth.uid()));

-- COMPANIES: Política de actualización para admins
CREATE POLICY "Admins can update company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- COMPANY_SUBSCRIPTIONS: Actualizar usando función helper
DROP POLICY IF EXISTS "Users can view company subscription" ON company_subscriptions;

CREATE POLICY "Users can view company subscription"
  ON company_subscriptions FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Grant execute a los roles necesarios
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO anon;
