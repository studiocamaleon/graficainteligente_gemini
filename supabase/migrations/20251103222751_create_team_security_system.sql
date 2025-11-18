/*
  # Sistema de Equipo, Seguridad y Permisos

  ## Descripción
  Esta migración crea el sistema completo de gestión de equipo, roles personalizados,
  permisos granulares, restricciones de IP y auditoría de acciones.

  ## Nuevas Tablas

  ### 1. `custom_roles` (Roles Personalizados)
  - `id` (uuid, PK) - Identificador único del rol
  - `company_id` (uuid, FK) - Referencia a companies
  - `name` (text) - Nombre del rol personalizado
  - `description` (text) - Descripción del rol
  - `is_active` (boolean) - Si el rol está activo
  - `created_by` (uuid, FK) - Usuario que creó el rol
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ### 2. `role_permissions` (Permisos de Roles)
  - `id` (uuid, PK) - Identificador único
  - `role_id` (uuid, FK) - Referencia a custom_roles
  - `module_id` (text) - ID del módulo del sistema
  - `can_view` (boolean) - Permiso de lectura
  - `can_create` (boolean) - Permiso de creación
  - `can_edit` (boolean) - Permiso de edición
  - `can_delete` (boolean) - Permiso de eliminación
  - `created_at` (timestamptz) - Fecha de creación

  ### 3. `user_ip_restrictions` (Restricciones de IP por Usuario)
  - `id` (uuid, PK) - Identificador único
  - `user_id` (uuid, FK) - Referencia a profiles
  - `ip_address` (text) - Dirección IP permitida
  - `description` (text) - Descripción de la IP
  - `is_active` (boolean) - Si la restricción está activa
  - `created_by` (uuid, FK) - Usuario que creó la restricción
  - `created_at` (timestamptz) - Fecha de creación

  ### 4. `audit_log` (Registro de Auditoría)
  - `id` (uuid, PK) - Identificador único
  - `company_id` (uuid, FK) - Referencia a companies
  - `user_id` (uuid, FK) - Usuario que realizó la acción
  - `action` (text) - Tipo de acción realizada
  - `module_id` (text) - Módulo donde se realizó la acción
  - `resource_type` (text) - Tipo de recurso afectado
  - `resource_id` (uuid) - ID del recurso afectado
  - `details` (jsonb) - Detalles adicionales de la acción
  - `ip_address` (text) - IP desde donde se realizó la acción
  - `user_agent` (text) - Navegador y dispositivo utilizado
  - `created_at` (timestamptz) - Fecha de la acción

  ### 5. `user_sessions` (Sesiones de Usuario)
  - `id` (uuid, PK) - Identificador único de la sesión
  - `user_id` (uuid, FK) - Referencia a profiles
  - `session_token` (text) - Token único de sesión
  - `ip_address` (text) - IP de la sesión
  - `user_agent` (text) - Navegador y dispositivo
  - `last_activity` (timestamptz) - Última actividad registrada
  - `expires_at` (timestamptz) - Fecha de expiración
  - `is_active` (boolean) - Si la sesión está activa
  - `created_at` (timestamptz) - Fecha de inicio de sesión

  ### 6. `login_attempts` (Intentos de Login)
  - `id` (uuid, PK) - Identificador único
  - `email` (text) - Email del intento de login
  - `ip_address` (text) - IP del intento
  - `success` (boolean) - Si fue exitoso o fallido
  - `failure_reason` (text) - Razón del fallo
  - `created_at` (timestamptz) - Fecha del intento

  ## Modificaciones a Tablas Existentes

  ### profiles (Agregar campos de seguridad)
  - `custom_role_id` (uuid, nullable) - Referencia a custom_roles
  - `last_login` (timestamptz) - Última fecha de login
  - `last_ip` (text) - Última IP de acceso
  - `is_active` (boolean) - Si el usuario está activo
  - `failed_login_attempts` (integer) - Contador de intentos fallidos
  - `locked_until` (timestamptz) - Fecha hasta la cual está bloqueado

  ## Seguridad (Row Level Security)

  - Todas las tablas tienen RLS habilitado
  - Solo super_admin puede gestionar roles, permisos y restricciones de IP
  - Los logs de auditoría son visibles solo para super_admin
  - Las sesiones solo pueden ser vistas por el usuario propietario o super_admin
*/

-- Crear tabla de roles personalizados
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

-- Crear tabla de permisos de roles
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

-- Crear tabla de restricciones de IP
CREATE TABLE IF NOT EXISTS user_ip_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de auditoría
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

-- Crear tabla de sesiones de usuario
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

-- Crear tabla de intentos de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean DEFAULT false,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

-- Agregar campos de seguridad a la tabla profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'custom_role_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN custom_role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_ip'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_ip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE profiles ADD COLUMN locked_until timestamptz;
  END IF;
END $$;

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_custom_roles_company_id ON custom_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module_id ON role_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_restrictions_user_id ON user_ip_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_module_id ON audit_log(module_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_custom_role_id ON profiles(custom_role_id);

-- Habilitar Row Level Security
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para custom_roles (solo super_admin)
CREATE POLICY "Super admins can view custom roles in their company"
  ON custom_roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can create custom roles"
  ON custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update custom roles in their company"
  ON custom_roles FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete custom roles in their company"
  ON custom_roles FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas RLS para role_permissions (solo super_admin)
CREATE POLICY "Super admins can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM custom_roles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can create role permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    role_id IN (
      SELECT id FROM custom_roles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can update role permissions"
  ON role_permissions FOR UPDATE
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM custom_roles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM custom_roles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can delete role permissions"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM custom_roles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- Políticas RLS para user_ip_restrictions (solo super_admin)
CREATE POLICY "Super admins can view IP restrictions in their company"
  ON user_ip_restrictions FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can create IP restrictions"
  ON user_ip_restrictions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can update IP restrictions"
  ON user_ip_restrictions FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can delete IP restrictions"
  ON user_ip_restrictions FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- Políticas RLS para audit_log (solo super_admin puede ver)
CREATE POLICY "Super admins can view audit logs in their company"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para user_sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all sessions in their company"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can insert their own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can update sessions in their company"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- Políticas RLS para login_attempts (solo super_admin puede ver)
CREATE POLICY "Super admins can view login attempts"
  ON login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Anyone can insert login attempts"
  ON login_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Trigger para actualizar updated_at en custom_roles
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar intento de login
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

-- Función para validar restricción de IP
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