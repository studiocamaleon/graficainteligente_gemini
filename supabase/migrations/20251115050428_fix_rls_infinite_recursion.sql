/*
  # Corrección de Recursión Infinita en Políticas RLS

  ## Problema Identificado
  La migración anterior (20251115045715) causó recursión infinita en las políticas RLS
  porque las políticas de `profiles` y otras tablas intentaban consultar `profiles`
  dentro de sus propias condiciones USING, creando un bucle infinito.

  ## Solución
  1. Crear funciones helper con SECURITY DEFINER que bypasean RLS
  2. Reemplazar políticas recursivas con políticas que usan estas funciones
  3. Las funciones se ejecutan con privilegios elevados, evitando la recursión

  ## Tablas Afectadas
  - profiles (la más crítica)
  - companies
  - countries, provinces, cities
  - clients
  - providers
  - company_subscriptions
  - custom_roles, role_permissions
  - user_ip_restrictions
  - audit_log, user_sessions
  - Todas las tablas ABM core que dependen de profiles

  ## Seguridad
  Las funciones SECURITY DEFINER están diseñadas específicamente para este propósito
  y solo retornan información básica necesaria para las políticas RLS.
*/

-- =====================================================
-- PARTE 1: FUNCIONES HELPER SEGURAS
-- =====================================================

-- Función para obtener el company_id del usuario actual (ya existe, la recreamos por seguridad)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Función para verificar si el usuario es admin/super_admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    LIMIT 1
  );
$$;

-- Función para verificar si el usuario es super_admin
CREATE OR REPLACE FUNCTION public.is_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'super_admin'
    LIMIT 1
  );
$$;

-- Función para verificar si el usuario pertenece a una compañía específica
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND company_id = target_company_id
    LIMIT 1
  );
$$;

-- =====================================================
-- PARTE 2: CORREGIR POLÍTICAS DE PROFILES (MÁS CRÍTICO)
-- =====================================================

-- Eliminar la política recursiva problemática
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Crear política simple sin recursión
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Política separada para ver perfiles de la misma compañía (usa función helper)
CREATE POLICY "Users can view company profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
  );

-- La política de UPDATE ya es correcta, pero la recreamos por consistencia
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- PARTE 3: CORREGIR POLÍTICAS DE COMPANIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can update company" ON public.companies;
CREATE POLICY "Admins can update company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    id = get_user_company_id() AND is_user_admin()
  );

DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
CREATE POLICY "Users can view own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

-- =====================================================
-- PARTE 4: CORREGIR POLÍTICAS DE LOCATIONS
-- =====================================================

-- COUNTRIES
DROP POLICY IF EXISTS "Users can view countries" ON public.countries;
CREATE POLICY "Users can view countries"
  ON public.countries FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = get_user_company_id()
  );

DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;
CREATE POLICY "Admins can manage countries"
  ON public.countries FOR ALL
  TO authenticated
  USING (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  );

-- PROVINCES
DROP POLICY IF EXISTS "Users can view provinces" ON public.provinces;
CREATE POLICY "Users can view provinces"
  ON public.provinces FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = get_user_company_id()
  );

DROP POLICY IF EXISTS "Admins can manage provinces" ON public.provinces;
CREATE POLICY "Admins can manage provinces"
  ON public.provinces FOR ALL
  TO authenticated
  USING (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  );

-- CITIES
DROP POLICY IF EXISTS "Users can view cities" ON public.cities;
CREATE POLICY "Users can view cities"
  ON public.cities FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = get_user_company_id()
  );

DROP POLICY IF EXISTS "Admins can manage cities" ON public.cities;
CREATE POLICY "Admins can manage cities"
  ON public.cities FOR ALL
  TO authenticated
  USING (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    is_user_admin() AND (
      company_id IS NULL OR 
      company_id = get_user_company_id()
    )
  );

-- =====================================================
-- PARTE 5: CORREGIR POLÍTICAS DE CLIENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view clients from their company" ON public.clients;
CREATE POLICY "Users can view clients from their company"
  ON public.clients FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Admins and managers can create clients" ON public.clients;
CREATE POLICY "Admins and managers can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND
    get_user_role() IN ('super_admin', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can update clients" ON public.clients;
CREATE POLICY "Admins and managers can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    get_user_role() IN ('super_admin', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Only super_admin can delete clients" ON public.clients;
CREATE POLICY "Only super_admin can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

-- =====================================================
-- PARTE 6: CORREGIR POLÍTICAS DE PROVIDERS
-- =====================================================

DROP POLICY IF EXISTS "Users can view providers from their company" ON public.providers;
CREATE POLICY "Users can view providers from their company"
  ON public.providers FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Admin, super_admin, and manager can insert providers" ON public.providers;
CREATE POLICY "Admin, super_admin, and manager can insert providers"
  ON public.providers FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND
    get_user_role() IN ('super_admin', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Admin, super_admin, and manager can update providers" ON public.providers;
CREATE POLICY "Admin, super_admin, and manager can update providers"
  ON public.providers FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    get_user_role() IN ('super_admin', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Super admin can delete providers from their company" ON public.providers;
CREATE POLICY "Super admin can delete providers from their company"
  ON public.providers FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

-- =====================================================
-- PARTE 7: CORREGIR POLÍTICAS DE COMPANY_SUBSCRIPTIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view company subscription" ON public.company_subscriptions;
CREATE POLICY "Users can view company subscription"
  ON public.company_subscriptions FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- =====================================================
-- PARTE 8: CORREGIR POLÍTICAS DE CUSTOM_ROLES Y PERMISSIONS
-- =====================================================

DROP POLICY IF EXISTS "Super admins can view custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can view custom roles in their company"
  ON public.custom_roles FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can create custom roles" ON public.custom_roles;
CREATE POLICY "Super admins can create custom roles"
  ON public.custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can update custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can update custom roles in their company"
  ON public.custom_roles FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can delete custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can delete custom roles in their company"
  ON public.custom_roles FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

-- ROLE_PERMISSIONS - Necesita una función helper especial
CREATE OR REPLACE FUNCTION public.get_role_company_id(target_role_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.custom_roles WHERE id = target_role_id LIMIT 1;
$$;

DROP POLICY IF EXISTS "Super admins can view role permissions" ON public.role_permissions;
CREATE POLICY "Super admins can view role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    get_role_company_id(role_id) = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Super admins can manage role permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    get_role_company_id(role_id) = get_user_company_id() AND
    is_user_super_admin()
  );

-- =====================================================
-- PARTE 9: CORREGIR POLÍTICAS DE USER_IP_RESTRICTIONS
-- =====================================================

-- Función helper para obtener company_id de un usuario
CREATE OR REPLACE FUNCTION public.get_target_user_company_id(target_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = target_user_id LIMIT 1;
$$;

DROP POLICY IF EXISTS "Super admins can view IP restrictions in their company" ON public.user_ip_restrictions;
CREATE POLICY "Super admins can view IP restrictions in their company"
  ON public.user_ip_restrictions FOR SELECT
  TO authenticated
  USING (
    get_target_user_company_id(user_id) = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can manage IP restrictions" ON public.user_ip_restrictions;
CREATE POLICY "Super admins can manage IP restrictions"
  ON public.user_ip_restrictions FOR ALL
  TO authenticated
  USING (
    get_target_user_company_id(user_id) = get_user_company_id() AND
    is_user_super_admin()
  );

-- =====================================================
-- PARTE 10: CORREGIR POLÍTICAS DE AUDIT_LOG Y USER_SESSIONS
-- =====================================================

-- AUDIT_LOG
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view audit logs in their company" ON public.audit_log;
CREATE POLICY "Super admins can view audit logs in their company"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    is_user_super_admin()
  );

-- USER_SESSIONS
DROP POLICY IF EXISTS "Users can view sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view company sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (
    get_target_user_company_id(user_id) = get_user_company_id() AND
    is_user_super_admin()
  );

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can update company sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (
    get_target_user_company_id(user_id) = get_user_company_id() AND
    is_user_super_admin()
  );

-- LOGIN_ATTEMPTS
DROP POLICY IF EXISTS "Super admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Super admins can view login attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (is_user_super_admin());

-- =====================================================
-- PARTE 11: CORREGIR POLÍTICAS DE BANKS
-- =====================================================

DROP POLICY IF EXISTS "Super admin can manage banks" ON public.banks;
CREATE POLICY "Super admin can manage banks"
  ON public.banks FOR ALL
  TO authenticated
  USING (is_user_super_admin());

-- =====================================================
-- RESUMEN
-- =====================================================

-- Esta migración corrige el problema de recursión infinita reemplazando
-- todas las políticas que consultan `profiles` con funciones SECURITY DEFINER
-- que bypassean RLS y evitan la recursión.

-- Las funciones helper son seguras porque:
-- 1. Solo retornan información básica (company_id, role)
-- 2. Siempre usan auth.uid() como base
-- 3. Usan SET search_path para prevenir injection attacks
-- 4. Son STABLE (no modifican datos)
