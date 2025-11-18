/*
  ============================================================================
  MIGRACIÓN MAESTRA CONSOLIDADA
  ============================================================================

  Este script consolida todas las migraciones del proyecto en un único archivo
  ejecutable de forma idempotente. Puede ejecutarse múltiples veces sin errores.

  ORDEN DE EJECUCIÓN:
  1. Extensiones y Configuración Base
  2. Tablas Base (companies, subscription_plans, profiles)
  3. Funciones Helper y Triggers
  4. Políticas RLS Base
  5. Extensión de Perfil de Empresa
  6. Sistema de Seguridad y Equipo
  7. Funciones de Gestión de Equipo
  8. Módulos de Negocio (locations, clients, banks, providers)
  9. Configuraciones Finales

  FECHA: 2025-11-05
  VERSIÓN: 1.0 - Script Consolidado Maestro
*/

-- ============================================================================
-- FASE 1: EXTENSIONES Y CONFIGURACIÓN BASE
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- FASE 2: TABLAS BASE
-- ============================================================================

-- Tabla de empresas
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  billing_period text DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'lifetime')),
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de suscripciones de empresas
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  role text DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'manager', 'operator', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tablas de geografía
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(country_id, name)
);

CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  postal_code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(province_id, name)
);

-- Insertar planes de suscripción si no existen
INSERT INTO subscription_plans (name, slug, description, price, billing_period, features)
VALUES
  ('Free', 'free', 'Plan gratuito con funcionalidades básicas', 0, 'lifetime',
   '["Gestión básica de inventario", "Hasta 3 usuarios", "Reportes básicos"]'::jsonb),
  ('Pro', 'pro', 'Plan profesional con todas las funcionalidades', 29.99, 'monthly',
   '["Gestión completa de inventario", "Usuarios ilimitados", "Reportes avanzados", "Integraciones", "Soporte prioritario"]'::jsonb),
  ('Enterprise', 'enterprise', 'Plan empresarial personalizado', 99.99, 'monthly',
   '["Todo lo de Pro", "Personalización avanzada", "API dedicada", "Soporte 24/7", "Consultoría incluida"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features;

-- ============================================================================
-- FASE 3: FUNCIONES HELPER Y TRIGGERS
-- ============================================================================

-- Función helper para obtener company_id sin recursión RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

ALTER FUNCTION public.get_user_company_id(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO anon;

-- Función para actualizar timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función trigger FINAL para crear perfil automáticamente
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_profile_exists boolean;
  v_user_role text;
  v_custom_role_id uuid;
  v_created_by_admin boolean;
BEGIN
  -- Verificar si el perfil ya existe
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO v_profile_exists;

  -- Si el perfil ya existe, no hacer nada y retornar
  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %. Skipping creation.', NEW.id;
    RETURN NEW;
  END IF;

  -- Detectar si fue creado por un administrador
  v_created_by_admin := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);

  -- Si fue creado por admin, usar los datos del metadata
  IF v_created_by_admin THEN
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
    v_user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'viewer');
    v_custom_role_id := (NEW.raw_user_meta_data->>'custom_role_id')::uuid;

    -- Crear perfil con los datos proporcionados por el administrador
    INSERT INTO profiles (id, email, full_name, company_id, role, custom_role_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_company_id,
      v_user_role,
      v_custom_role_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Profile created by admin for user % with company_id % and role %', NEW.id, v_company_id, v_user_role;
    RETURN NEW;
  END IF;

  -- Flujo de auto-registro (usuario se registra por su cuenta)
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_slug := NEW.raw_user_meta_data->>'company_slug';

  -- Si no hay company_slug, generarlo del company_name
  IF v_company_slug IS NULL AND v_company_name IS NOT NULL THEN
    v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_company_slug := regexp_replace(v_company_slug, '^-+|-+$', '', 'g');

    -- Asegurar que el slug sea único agregando un sufijo si es necesario
    IF EXISTS (SELECT 1 FROM companies WHERE slug = v_company_slug) THEN
      v_company_slug := v_company_slug || '-' || substr(NEW.id::text, 1, 8);
    END IF;
  END IF;

  -- Crear la empresa si se proporcionó el nombre
  IF v_company_name IS NOT NULL THEN
    INSERT INTO companies (name, slug, status)
    VALUES (v_company_name, v_company_slug, 'active')
    RETURNING id INTO v_company_id;

    -- Obtener el plan Free
    SELECT id INTO v_free_plan_id FROM subscription_plans WHERE slug = 'free' LIMIT 1;

    -- Crear suscripción Free para la nueva empresa
    IF v_free_plan_id IS NOT NULL THEN
      INSERT INTO company_subscriptions (company_id, plan_id, status, started_at)
      VALUES (v_company_id, v_free_plan_id, 'active', now());
    END IF;

    -- Crear perfil con rol de super_admin
    INSERT INTO profiles (id, email, full_name, company_id, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_company_id,
      'super_admin'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'New company and super_admin profile created for user %', NEW.id;
  ELSE
    -- Si no hay empresa, crear perfil sin company_id
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'viewer'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Basic profile created for user % without company', NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Crear o reemplazar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_subscriptions_updated_at ON company_subscriptions;
CREATE TRIGGER update_company_subscriptions_updated_at
  BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FASE 4: POLÍTICAS RLS BASE
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Políticas para PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;
CREATE POLICY "Users can view company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = public.get_user_company_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow trigger inserts on profiles" ON profiles;
CREATE POLICY "Allow trigger inserts on profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para COMPANIES
DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can update company" ON companies;
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

DROP POLICY IF EXISTS "Allow trigger inserts on companies" ON companies;
CREATE POLICY "Allow trigger inserts on companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para SUBSCRIPTION_PLANS
DROP POLICY IF EXISTS "Anyone can view active plans" ON subscription_plans;
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Políticas para COMPANY_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view company subscription" ON company_subscriptions;
CREATE POLICY "Users can view company subscription"
  ON company_subscriptions FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Allow trigger inserts on company_subscriptions" ON company_subscriptions;
CREATE POLICY "Allow trigger inserts on company_subscriptions"
  ON company_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para geografía (lectura pública)
DROP POLICY IF EXISTS "Anyone can view countries" ON countries;
CREATE POLICY "Anyone can view countries"
  ON countries FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Anyone can view provinces" ON provinces;
CREATE POLICY "Anyone can view provinces"
  ON provinces FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Anyone can view cities" ON cities;
CREATE POLICY "Anyone can view cities"
  ON cities FOR SELECT
  TO authenticated, anon
  USING (true);

-- ============================================================================
-- FASE 5: EXTENSIÓN DE PERFIL DE EMPRESA
-- ============================================================================

-- Agregar campos adicionales a companies si no existen
DO $$
BEGIN
  -- Información de contacto
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'contact_phone') THEN
    ALTER TABLE companies ADD COLUMN contact_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'contact_email') THEN
    ALTER TABLE companies ADD COLUMN contact_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'website') THEN
    ALTER TABLE companies ADD COLUMN website text;
  END IF;

  -- Información de ubicación
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'address') THEN
    ALTER TABLE companies ADD COLUMN address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'country_id') THEN
    ALTER TABLE companies ADD COLUMN country_id uuid REFERENCES countries(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'province_id') THEN
    ALTER TABLE companies ADD COLUMN province_id uuid REFERENCES provinces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'city_id') THEN
    ALTER TABLE companies ADD COLUMN city_id uuid REFERENCES cities(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'postal_code') THEN
    ALTER TABLE companies ADD COLUMN postal_code text;
  END IF;

  -- Información fiscal
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'legal_name') THEN
    ALTER TABLE companies ADD COLUMN legal_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'tax_id_type') THEN
    ALTER TABLE companies ADD COLUMN tax_id_type text CHECK (tax_id_type IN ('DNI', 'CUIT', 'CUIL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'tax_id_number') THEN
    ALTER TABLE companies ADD COLUMN tax_id_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'tax_condition') THEN
    ALTER TABLE companies ADD COLUMN tax_condition text;
  END IF;

  -- Configuración regional
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'timezone') THEN
    ALTER TABLE companies ADD COLUMN timezone text DEFAULT 'America/Argentina/Buenos_Aires';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'currency') THEN
    ALTER TABLE companies ADD COLUMN currency text DEFAULT 'ARS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'language') THEN
    ALTER TABLE companies ADD COLUMN language text DEFAULT 'es';
  END IF;

  -- Información adicional
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'description') THEN
    ALTER TABLE companies ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'industry') THEN
    ALTER TABLE companies ADD COLUMN industry text;
  END IF;
END $$;

-- Crear índices para companies
CREATE INDEX IF NOT EXISTS idx_companies_country_id ON companies(country_id);
CREATE INDEX IF NOT EXISTS idx_companies_province_id ON companies(province_id);
CREATE INDEX IF NOT EXISTS idx_companies_city_id ON companies(city_id);
CREATE INDEX IF NOT EXISTS idx_companies_tax_id_number ON companies(tax_id_number);

-- ============================================================================
-- FASE 6: SISTEMA DE SEGURIDAD Y EQUIPO
-- ============================================================================

-- Tabla de roles personalizados
CREATE TABLE IF NOT EXISTS custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Tabla de permisos de roles
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, module_id)
);

-- Tabla de restricciones de IP
CREATE TABLE IF NOT EXISTS user_ip_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  module_id text,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabla de intentos de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean DEFAULT false,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

-- Agregar campos de seguridad a profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'custom_role_id') THEN
    ALTER TABLE profiles ADD COLUMN custom_role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login') THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_ip') THEN
    ALTER TABLE profiles ADD COLUMN last_ip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'failed_login_attempts') THEN
    ALTER TABLE profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'locked_until') THEN
    ALTER TABLE profiles ADD COLUMN locked_until timestamptz;
  END IF;
END $$;

-- Índices para seguridad
CREATE INDEX IF NOT EXISTS idx_custom_roles_company_id ON custom_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_restrictions_user_id ON user_ip_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_profiles_custom_role_id ON profiles(custom_role_id);

-- Habilitar RLS
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para custom_roles
DROP POLICY IF EXISTS "Super admins can view custom roles in their company" ON custom_roles;
CREATE POLICY "Super admins can view custom roles in their company"
  ON custom_roles FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage custom roles" ON custom_roles;
CREATE POLICY "Super admins can manage custom roles"
  ON custom_roles FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Políticas RLS para role_permissions
DROP POLICY IF EXISTS "Users can view role permissions" ON role_permissions;
CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT id FROM custom_roles
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can manage role permissions" ON role_permissions;
CREATE POLICY "Super admins can manage role permissions"
  ON role_permissions FOR ALL TO authenticated
  USING (
    role_id IN (
      SELECT id FROM custom_roles
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Políticas RLS para user_ip_restrictions
DROP POLICY IF EXISTS "Super admins can manage IP restrictions" ON user_ip_restrictions;
CREATE POLICY "Super admins can manage IP restrictions"
  ON user_ip_restrictions FOR ALL TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Políticas RLS para audit_log
DROP POLICY IF EXISTS "Super admins can view audit logs" ON audit_log;
CREATE POLICY "Super admins can view audit logs"
  ON audit_log FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Políticas RLS para user_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
CREATE POLICY "Users can manage own sessions"
  ON user_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Políticas RLS para login_attempts
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON login_attempts;
CREATE POLICY "Anyone can insert login attempts"
  ON login_attempts FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funciones de seguridad
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_login_attempt(
  p_email text,
  p_ip_address text,
  p_success boolean,
  p_failure_reason text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO login_attempts (email, ip_address, success, failure_reason)
  VALUES (p_email, p_ip_address, p_success, p_failure_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_ip_restriction(
  p_user_id uuid,
  p_ip_address text
)
RETURNS boolean AS $$
DECLARE
  v_has_restrictions boolean;
  v_ip_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_ip_restrictions
    WHERE user_id = p_user_id AND is_active = true
  ) INTO v_has_restrictions;

  IF NOT v_has_restrictions THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_ip_restrictions
    WHERE user_id = p_user_id
    AND ip_address = p_ip_address
    AND is_active = true
  ) INTO v_ip_allowed;

  RETURN v_ip_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Continúa en la siguiente parte...
