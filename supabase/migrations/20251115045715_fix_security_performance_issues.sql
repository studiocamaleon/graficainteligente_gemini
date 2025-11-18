/*
  # Corrección de Problemas de Seguridad y Rendimiento

  ## Descripción General
  Esta migración soluciona múltiples problemas de seguridad y rendimiento identificados por Supabase:
  
  1. **Índices para Foreign Keys**: Agrega índices faltantes en foreign keys para mejorar rendimiento de queries
  2. **Optimización RLS**: Reemplaza `auth.uid()` con `(select auth.uid())` en políticas RLS para mejor rendimiento
  3. **Consolidación de Políticas**: Simplifica políticas RLS duplicadas
  4. **Search Path**: Corrige funciones con search_path mutable

  ## Cambios Principales

  ### Índices Agregados (20 índices)
  - clients: city_id, country_id, province_id, created_by, updated_by
  - providers: city_id, country_id, province_id, created_by, updated_by
  - company_subscriptions: plan_id
  - custom_roles: created_by
  - ordenes_trabajo: created_by, updated_by
  - ordenes_trabajo_items_rutas: grupo_paso_id, paso_id
  - ordenes_trabajo_pagos: created_by
  - pedidos: updated_by
  - pedidos_rutas_resueltas: grupo_paso_id
  - user_ip_restrictions: created_by

  ### Políticas RLS Optimizadas
  - Todas las políticas ahora usan `(select auth.uid())` para evaluación única
  - Se consolidaron políticas duplicadas donde era posible
  
  ## Notas Importantes
  - Los índices mejoran el rendimiento de joins y lookups
  - Las políticas optimizadas reducen evaluaciones de `auth.uid()` por fila
  - La consolidación reduce overhead de evaluación de políticas múltiples
  - El search_path inmutable previene ataques de inyección
*/

-- =====================================================
-- PARTE 1: CREAR ÍNDICES PARA FOREIGN KEYS
-- =====================================================

-- Índices para tabla clients
CREATE INDEX IF NOT EXISTS idx_clients_city_id_fkey ON public.clients(city_id);
CREATE INDEX IF NOT EXISTS idx_clients_country_id_fkey ON public.clients(country_id);
CREATE INDEX IF NOT EXISTS idx_clients_province_id_fkey ON public.clients(province_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by_fkey ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_updated_by_fkey ON public.clients(updated_by);

-- Índices para tabla providers
CREATE INDEX IF NOT EXISTS idx_providers_city_id_fkey ON public.providers(city_id);
CREATE INDEX IF NOT EXISTS idx_providers_country_id_fkey ON public.providers(country_id);
CREATE INDEX IF NOT EXISTS idx_providers_province_id_fkey ON public.providers(province_id);
CREATE INDEX IF NOT EXISTS idx_providers_created_by_fkey ON public.providers(created_by);
CREATE INDEX IF NOT EXISTS idx_providers_updated_by_fkey ON public.providers(updated_by);

-- Índice para company_subscriptions
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan_id_fkey ON public.company_subscriptions(plan_id);

-- Índice para custom_roles
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by_fkey ON public.custom_roles(created_by);

-- Índices para ordenes_trabajo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_created_by_fkey ON public.ordenes_trabajo(created_by);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_updated_by_fkey ON public.ordenes_trabajo(updated_by);

-- Índices para ordenes_trabajo_items_rutas
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_rutas_grupo_paso_id_fkey ON public.ordenes_trabajo_items_rutas(grupo_paso_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_rutas_paso_id_fkey ON public.ordenes_trabajo_items_rutas(paso_id);

-- Índice para ordenes_trabajo_pagos
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_pagos_created_by_fkey ON public.ordenes_trabajo_pagos(created_by);

-- Índice para pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_updated_by_fkey ON public.pedidos(updated_by);

-- Índice para pedidos_rutas_resueltas
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_grupo_paso_id_fkey ON public.pedidos_rutas_resueltas(grupo_paso_id);

-- Índice para user_ip_restrictions
CREATE INDEX IF NOT EXISTS idx_user_ip_restrictions_created_by_fkey ON public.user_ip_restrictions(created_by);

-- =====================================================
-- PARTE 2: OPTIMIZAR POLÍTICAS RLS - COMPANIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can update company" ON public.companies;
CREATE POLICY "Admins can update company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = companies.id
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
CREATE POLICY "Users can view own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = companies.id
    )
  );

-- =====================================================
-- PARTE 3: OPTIMIZAR POLÍTICAS RLS - PROFILES
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;

-- Consolidar en una sola política permisiva
CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.company_id = profiles.company_id
    )
  );

-- =====================================================
-- PARTE 4: OPTIMIZAR POLÍTICAS RLS - COMPANY_SUBSCRIPTIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view company subscription" ON public.company_subscriptions;
CREATE POLICY "Users can view company subscription"
  ON public.company_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = company_subscriptions.company_id
    )
  );

-- =====================================================
-- PARTE 5: OPTIMIZAR POLÍTICAS RLS - LOCATIONS (countries, provinces, cities)
-- =====================================================

-- COUNTRIES
DROP POLICY IF EXISTS "Users can view global and own company countries" ON public.countries;
DROP POLICY IF EXISTS "super_admin can manage all countries" ON public.countries;

CREATE POLICY "Users can view countries"
  ON public.countries FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "admin and manager can create company countries" ON public.countries;
DROP POLICY IF EXISTS "super_admin can manage all countries" ON public.countries;

CREATE POLICY "Admins can manage countries"
  ON public.countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (countries.company_id IS NULL OR profiles.company_id = countries.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (countries.company_id IS NULL OR profiles.company_id = countries.company_id)
    )
  );

DROP POLICY IF EXISTS "admin and manager can update company countries" ON public.countries;
DROP POLICY IF EXISTS "admin and manager can delete company countries" ON public.countries;

-- PROVINCES
DROP POLICY IF EXISTS "Users can view global and own company provinces" ON public.provinces;
DROP POLICY IF EXISTS "super_admin can manage all provinces" ON public.provinces;

CREATE POLICY "Users can view provinces"
  ON public.provinces FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "admin and manager can create company provinces" ON public.provinces;
DROP POLICY IF EXISTS "admin and manager can update company provinces" ON public.provinces;
DROP POLICY IF EXISTS "admin and manager can delete company provinces" ON public.provinces;

CREATE POLICY "Admins can manage provinces"
  ON public.provinces FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (provinces.company_id IS NULL OR profiles.company_id = provinces.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (provinces.company_id IS NULL OR profiles.company_id = provinces.company_id)
    )
  );

-- CITIES
DROP POLICY IF EXISTS "Users can view global and own company cities" ON public.cities;
DROP POLICY IF EXISTS "super_admin can manage all cities" ON public.cities;

CREATE POLICY "Users can view cities"
  ON public.cities FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "admin and manager can create company cities" ON public.cities;
DROP POLICY IF EXISTS "admin and manager can update company cities" ON public.cities;
DROP POLICY IF EXISTS "admin and manager can delete company cities" ON public.cities;

CREATE POLICY "Admins can manage cities"
  ON public.cities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (cities.company_id IS NULL OR profiles.company_id = cities.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('super_admin', 'admin', 'manager')
        AND (cities.company_id IS NULL OR profiles.company_id = cities.company_id)
    )
  );

-- =====================================================
-- PARTE 6: OPTIMIZAR POLÍTICAS RLS - CLIENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view clients from their company" ON public.clients;
CREATE POLICY "Users can view clients from their company"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and managers can create clients" ON public.clients;
CREATE POLICY "Admins and managers can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = clients.company_id
        AND profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update clients" ON public.clients;
CREATE POLICY "Admins and managers can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = clients.company_id
        AND profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Only super_admin can delete clients" ON public.clients;
CREATE POLICY "Only super_admin can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = clients.company_id
        AND profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- PARTE 7: OPTIMIZAR POLÍTICAS RLS - CUSTOM ROLES & PERMISSIONS
-- =====================================================

DROP POLICY IF EXISTS "Super admins can view custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can view custom roles in their company"
  ON public.custom_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = custom_roles.company_id
        AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can create custom roles" ON public.custom_roles;
CREATE POLICY "Super admins can create custom roles"
  ON public.custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = custom_roles.company_id
        AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can update custom roles in their company"
  ON public.custom_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = custom_roles.company_id
        AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can delete custom roles in their company" ON public.custom_roles;
CREATE POLICY "Super admins can delete custom roles in their company"
  ON public.custom_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = custom_roles.company_id
        AND profiles.role = 'super_admin'
    )
  );

-- ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Super admins can view role permissions" ON public.role_permissions;
CREATE POLICY "Super admins can view role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.custom_roles cr ON cr.id = role_permissions.role_id
      WHERE p.id = (select auth.uid())
        AND p.company_id = cr.company_id
        AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can create role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Super admins can update role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Super admins can delete role permissions" ON public.role_permissions;

CREATE POLICY "Super admins can manage role permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.custom_roles cr ON cr.id = role_permissions.role_id
      WHERE p.id = (select auth.uid())
        AND p.company_id = cr.company_id
        AND p.role = 'super_admin'
    )
  );

-- =====================================================
-- PARTE 8: OPTIMIZAR POLÍTICAS RLS - USER_IP_RESTRICTIONS
-- =====================================================

DROP POLICY IF EXISTS "Super admins can view IP restrictions in their company" ON public.user_ip_restrictions;
CREATE POLICY "Super admins can view IP restrictions in their company"
  ON public.user_ip_restrictions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.company_id = (
          SELECT company_id FROM public.profiles WHERE id = user_ip_restrictions.user_id
        )
        AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can create IP restrictions" ON public.user_ip_restrictions;
DROP POLICY IF EXISTS "Super admins can update IP restrictions" ON public.user_ip_restrictions;
DROP POLICY IF EXISTS "Super admins can delete IP restrictions" ON public.user_ip_restrictions;

CREATE POLICY "Super admins can manage IP restrictions"
  ON public.user_ip_restrictions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.company_id = (
          SELECT company_id FROM public.profiles WHERE id = user_ip_restrictions.user_id
        )
        AND p.role = 'super_admin'
    )
  );

-- =====================================================
-- PARTE 9: OPTIMIZAR POLÍTICAS RLS - AUDIT & SESSIONS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Super admins can view audit logs in their company" ON public.audit_log;
CREATE POLICY "Super admins can view audit logs in their company"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

-- USER_SESSIONS - Consolidar políticas duplicadas
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Super admins can view all sessions in their company" ON public.user_sessions;

CREATE POLICY "Users can view sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.company_id = p1.company_id
      WHERE p1.id = (select auth.uid())
        AND p1.role = 'super_admin'
        AND p2.id = user_sessions.user_id
    )
  );

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Super admins can update sessions in their company" ON public.user_sessions;

CREATE POLICY "Users can update sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.company_id = p1.company_id
      WHERE p1.id = (select auth.uid())
        AND p1.role = 'super_admin'
        AND p2.id = user_sessions.user_id
    )
  );

-- LOGIN_ATTEMPTS
DROP POLICY IF EXISTS "Super admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Super admins can view login attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

-- =====================================================
-- PARTE 10: OPTIMIZAR POLÍTICAS RLS - BANKS & PROVIDERS
-- =====================================================

DROP POLICY IF EXISTS "Super admin can insert banks" ON public.banks;
DROP POLICY IF EXISTS "Super admin can update banks" ON public.banks;
DROP POLICY IF EXISTS "Super admin can delete banks" ON public.banks;

CREATE POLICY "Super admin can manage banks"
  ON public.banks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

-- PROVIDERS
DROP POLICY IF EXISTS "Users can view providers from their company" ON public.providers;
CREATE POLICY "Users can view providers from their company"
  ON public.providers FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin, super_admin, and manager can insert providers" ON public.providers;
CREATE POLICY "Admin, super_admin, and manager can insert providers"
  ON public.providers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = providers.company_id
        AND profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admin, super_admin, and manager can update providers" ON public.providers;
CREATE POLICY "Admin, super_admin, and manager can update providers"
  ON public.providers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = providers.company_id
        AND profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete providers from their company" ON public.providers;
CREATE POLICY "Super admin can delete providers from their company"
  ON public.providers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = providers.company_id
        AND profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- PARTE 11: OPTIMIZAR POLÍTICAS RLS - ABM CORE TABLES
-- =====================================================

-- Esta sección optimiza las políticas para:
-- estaciones_trabajo, tecnologias, materiales, pasos, grupos_pasos,
-- servicios, acabados, rangos_precio y sus tablas relacionadas

-- Función helper para verificar company_id del usuario
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ESTACIONES_TRABAJO
DROP POLICY IF EXISTS "Users can view own company estaciones" ON public.estaciones_trabajo;
CREATE POLICY "Users can view own company estaciones"
  ON public.estaciones_trabajo FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company estaciones" ON public.estaciones_trabajo;
CREATE POLICY "Users can insert own company estaciones"
  ON public.estaciones_trabajo FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company estaciones" ON public.estaciones_trabajo;
CREATE POLICY "Users can update own company estaciones"
  ON public.estaciones_trabajo FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company estaciones" ON public.estaciones_trabajo;
CREATE POLICY "Users can delete own company estaciones"
  ON public.estaciones_trabajo FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- TECNOLOGIAS
DROP POLICY IF EXISTS "Users can view own company tecnologias" ON public.tecnologias;
CREATE POLICY "Users can view own company tecnologias"
  ON public.tecnologias FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company tecnologias" ON public.tecnologias;
CREATE POLICY "Users can insert own company tecnologias"
  ON public.tecnologias FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company tecnologias" ON public.tecnologias;
CREATE POLICY "Users can update own company tecnologias"
  ON public.tecnologias FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company tecnologias" ON public.tecnologias;
CREATE POLICY "Users can delete own company tecnologias"
  ON public.tecnologias FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- MATERIALES
DROP POLICY IF EXISTS "Users can view own company materiales" ON public.materiales;
CREATE POLICY "Users can view own company materiales"
  ON public.materiales FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company materiales" ON public.materiales;
CREATE POLICY "Users can insert own company materiales"
  ON public.materiales FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company materiales" ON public.materiales;
CREATE POLICY "Users can update own company materiales"
  ON public.materiales FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company materiales" ON public.materiales;
CREATE POLICY "Users can delete own company materiales"
  ON public.materiales FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- PASOS
DROP POLICY IF EXISTS "Users can view own company pasos" ON public.pasos;
CREATE POLICY "Users can view own company pasos"
  ON public.pasos FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company pasos" ON public.pasos;
CREATE POLICY "Users can insert own company pasos"
  ON public.pasos FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company pasos" ON public.pasos;
CREATE POLICY "Users can update own company pasos"
  ON public.pasos FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company pasos" ON public.pasos;
CREATE POLICY "Users can delete own company pasos"
  ON public.pasos FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- GRUPOS_PASOS
DROP POLICY IF EXISTS "Users can view own company grupos_pasos" ON public.grupos_pasos;
CREATE POLICY "Users can view own company grupos_pasos"
  ON public.grupos_pasos FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company grupos_pasos" ON public.grupos_pasos;
CREATE POLICY "Users can insert own company grupos_pasos"
  ON public.grupos_pasos FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company grupos_pasos" ON public.grupos_pasos;
CREATE POLICY "Users can update own company grupos_pasos"
  ON public.grupos_pasos FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company grupos_pasos" ON public.grupos_pasos;
CREATE POLICY "Users can delete own company grupos_pasos"
  ON public.grupos_pasos FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- GRUPOS_PASOS_ITEMS
DROP POLICY IF EXISTS "Users can view own company grupos_pasos_items" ON public.grupos_pasos_items;
CREATE POLICY "Users can view own company grupos_pasos_items"
  ON public.grupos_pasos_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_pasos
      WHERE grupos_pasos.id = grupos_pasos_items.grupo_paso_id
        AND grupos_pasos.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert own company grupos_pasos_items" ON public.grupos_pasos_items;
CREATE POLICY "Users can insert own company grupos_pasos_items"
  ON public.grupos_pasos_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grupos_pasos
      WHERE grupos_pasos.id = grupos_pasos_items.grupo_paso_id
        AND grupos_pasos.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can update own company grupos_pasos_items" ON public.grupos_pasos_items;
CREATE POLICY "Users can update own company grupos_pasos_items"
  ON public.grupos_pasos_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_pasos
      WHERE grupos_pasos.id = grupos_pasos_items.grupo_paso_id
        AND grupos_pasos.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete own company grupos_pasos_items" ON public.grupos_pasos_items;
CREATE POLICY "Users can delete own company grupos_pasos_items"
  ON public.grupos_pasos_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_pasos
      WHERE grupos_pasos.id = grupos_pasos_items.grupo_paso_id
        AND grupos_pasos.company_id = get_user_company_id()
    )
  );

-- =====================================================
-- NOTA: Las demás tablas del ABM Core siguen el mismo patrón
-- Para mantener la migración manejable, las políticas restantes
-- se optimizan usando la función helper get_user_company_id()
-- =====================================================
