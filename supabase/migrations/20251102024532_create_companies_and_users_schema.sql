/*
  # Sistema Multi-Tenant: Empresas, Usuarios y Suscripciones

  ## Descripción
  Esta migración crea la estructura base para un sistema SaaS multi-tenant de gestión de imprentas digitales.
  Incluye empresas, usuarios, planes de suscripción y el sistema de roles y permisos.

  ## Nuevas Tablas

  ### 1. `companies` (Empresas/Tenants)
  - `id` (uuid, PK) - Identificador único de la empresa
  - `name` (text) - Nombre de la empresa
  - `slug` (text, unique) - Slug único para subdominios o URLs
  - `logo_url` (text, nullable) - URL del logo de la empresa
  - `status` (text) - Estado: active, suspended, cancelled
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ### 2. `subscription_plans` (Planes de Suscripción)
  - `id` (uuid, PK) - Identificador único del plan
  - `name` (text) - Nombre del plan: Free, Pro, Enterprise
  - `slug` (text, unique) - Identificador del plan
  - `price` (numeric) - Precio mensual
  - `features` (jsonb) - Características del plan en formato JSON
  - `limits` (jsonb) - Límites del plan (usuarios, órdenes, almacenamiento)
  - `is_active` (boolean) - Si el plan está disponible
  - `created_at` (timestamptz) - Fecha de creación

  ### 3. `company_subscriptions` (Suscripciones de Empresas)
  - `id` (uuid, PK) - Identificador único
  - `company_id` (uuid, FK) - Referencia a companies
  - `plan_id` (uuid, FK) - Referencia a subscription_plans
  - `status` (text) - Estado: active, cancelled, expired
  - `started_at` (timestamptz) - Fecha de inicio
  - `ends_at` (timestamptz, nullable) - Fecha de fin
  - `created_at` (timestamptz) - Fecha de creación

  ### 4. `profiles` (Perfiles de Usuario)
  - `id` (uuid, PK) - Igual al auth.users.id
  - `email` (text) - Email del usuario
  - `full_name` (text) - Nombre completo
  - `avatar_url` (text, nullable) - URL del avatar
  - `company_id` (uuid, FK) - Referencia a companies
  - `role` (text) - Rol: super_admin, admin, manager, operator, viewer
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad (Row Level Security)

  - Todas las tablas tienen RLS habilitado
  - Las políticas aseguran que los usuarios solo vean datos de su empresa (company_id)
  - Los perfiles solo pueden ser leídos y actualizados por el usuario propietario o admins de su empresa
  - Las empresas solo pueden ser vistas por sus miembros
  - Los planes de suscripción son públicos para lectura (necesarios para el registro)

  ## Funciones y Triggers

  ### `handle_new_user()`
  - Se ejecuta automáticamente cuando se registra un nuevo usuario en auth.users
  - Crea el perfil del usuario en la tabla profiles
  - Si es el primer usuario, crea la empresa automáticamente
  - Asigna rol de super_admin al primer usuario de cada empresa
  - Crea una suscripción Free por defecto para nuevas empresas

  ## Datos Iniciales

  - Se crean los 3 planes de suscripción: Free, Pro, Enterprise
  - Cada plan tiene características y límites predefinidos
*/

-- Crear tabla de empresas/tenants
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de suscripciones de empresas
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'manager', 'operator', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Habilitar Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para companies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Políticas RLS para subscription_plans (públicos para lectura)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Políticas RLS para company_subscriptions
CREATE POLICY "Users can view their company subscription"
  ON company_subscriptions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para profiles
CREATE POLICY "Users can view profiles in their company"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update profiles in their company"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Función para manejar nuevos usuarios registrados
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
BEGIN
  -- Extraer el nombre de la empresa del metadata
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
    );
  ELSE
    -- Si no hay empresa, crear perfil sin company_id (caso de invitación futura)
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'viewer'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función cuando se crea un nuevo usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
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

-- Insertar los planes de suscripción predeterminados
INSERT INTO subscription_plans (name, slug, price, features, limits, is_active)
VALUES
  (
    'Free',
    'free',
    0,
    '["Panel de control básico", "Hasta 3 usuarios", "100 órdenes/mes", "1GB almacenamiento", "Soporte por email"]'::jsonb,
    '{"max_users": 3, "max_orders_per_month": 100, "storage_gb": 1, "support": "email"}'::jsonb,
    true
  ),
  (
    'Pro',
    'pro',
    49.99,
    '["Panel avanzado con reportes", "Hasta 15 usuarios", "1000 órdenes/mes", "25GB almacenamiento", "Soporte prioritario", "Integraciones API", "Automatizaciones"]'::jsonb,
    '{"max_users": 15, "max_orders_per_month": 1000, "storage_gb": 25, "support": "priority", "api_access": true, "automations": true}'::jsonb,
    true
  ),
  (
    'Enterprise',
    'enterprise',
    199.99,
    '["Panel completo personalizable", "Usuarios ilimitados", "Órdenes ilimitadas", "200GB almacenamiento", "Soporte 24/7", "API completa", "Automatizaciones avanzadas", "Capacitación dedicada", "SLA garantizado"]'::jsonb,
    '{"max_users": -1, "max_orders_per_month": -1, "storage_gb": 200, "support": "24/7", "api_access": true, "automations": true, "training": true, "sla": true}'::jsonb,
    true
  )
ON CONFLICT (slug) DO NOTHING;