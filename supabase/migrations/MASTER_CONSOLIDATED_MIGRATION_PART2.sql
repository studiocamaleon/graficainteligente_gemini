/*
  ============================================================================
  MIGRACIÓN MAESTRA CONSOLIDADA - PARTE 2
  ============================================================================

  Continuación del script maestro:
  - Funciones de Gestión de Equipo
  - Módulos de Negocio
  - Configuraciones Finales
*/

-- ============================================================================
-- FASE 7: FUNCIONES DE GESTIÓN DE EQUIPO
-- ============================================================================

-- Función para crear miembros del equipo
CREATE OR REPLACE FUNCTION create_team_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'viewer',
  p_custom_role_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_profile profiles;
  v_new_user_id uuid;
  v_company_id uuid;
  v_encrypted_password text;
  v_profile_created boolean;
  v_max_attempts int := 5;
  v_attempt int := 0;
BEGIN
  -- Validar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfil del llamador
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();

  -- Validar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos para crear usuarios');
  END IF;

  -- Validar empresa
  IF v_caller_profile.company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes una empresa asignada');
  END IF;

  v_company_id := v_caller_profile.company_id;

  -- Validar email
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email inválido');
  END IF;

  -- Validar contraseña
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  -- Verificar si el email ya existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este email ya está registrado');
  END IF;

  -- Validar rol
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operator', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Rol inválido');
  END IF;

  -- Generar ID y encriptar contraseña
  v_new_user_id := gen_random_uuid();
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  BEGIN
    -- Insertar usuario en auth.users con metadata enriquecido
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      v_encrypted_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', p_full_name,
        'company_id', v_company_id::text,
        'role', p_role,
        'custom_role_id', p_custom_role_id::text,
        'created_by_admin', true
      ),
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    -- Esperar a que el trigger cree el perfil
    LOOP
      v_attempt := v_attempt + 1;
      SELECT EXISTS(
        SELECT 1 FROM profiles
        WHERE id = v_new_user_id AND company_id = v_company_id
      ) INTO v_profile_created;
      EXIT WHEN v_profile_created OR v_attempt >= v_max_attempts;
      PERFORM pg_sleep(0.1);
    END LOOP;

    -- Si el perfil no fue creado por el trigger, crearlo manualmente
    IF NOT v_profile_created THEN
      INSERT INTO profiles (id, email, full_name, company_id, role, custom_role_id, is_active)
      VALUES (v_new_user_id, p_email, p_full_name, v_company_id, p_role, p_custom_role_id, true)
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role = EXCLUDED.role,
        custom_role_id = EXCLUDED.custom_role_id,
        full_name = EXCLUDED.full_name;
    END IF;

    -- Registrar en audit log
    INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
    VALUES (
      v_company_id, auth.uid(), 'user_created', 'user', v_new_user_id,
      jsonb_build_object(
        'created_user_email', p_email,
        'created_user_role', p_role,
        'created_by', v_caller_profile.email
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Usuario creado exitosamente',
      'user_id', v_new_user_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'message', 'Error al crear usuario: ' || SQLERRM);
  END;
END;
$$;

-- Función para actualizar rol de miembro
CREATE OR REPLACE FUNCTION update_team_member_role(
  p_user_id uuid,
  p_new_role text,
  p_custom_role_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();

  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  UPDATE profiles
  SET role = p_new_role, custom_role_id = p_custom_role_id, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id, auth.uid(), 'user_role_updated', 'user', p_user_id,
    jsonb_build_object(
      'target_user', v_target_profile.email,
      'old_role', v_target_profile.role,
      'new_role', p_new_role
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Rol actualizado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Función para resetear contraseña
CREATE OR REPLACE FUNCTION reset_team_member_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
  v_encrypted_password text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  v_encrypted_password := crypt(p_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_encrypted_password, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id, auth.uid(), 'password_reset', 'user', p_user_id,
    jsonb_build_object('target_user', v_target_profile.email)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Función para activar/desactivar usuario
CREATE OR REPLACE FUNCTION deactivate_team_member(
  p_user_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  UPDATE profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_user_id;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id, auth.uid(),
    CASE WHEN p_is_active THEN 'user_activated' ELSE 'user_deactivated' END,
    'user', p_user_id,
    jsonb_build_object('target_user', v_target_profile.email, 'is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Estado actualizado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Función para eliminar usuario
CREATE OR REPLACE FUNCTION delete_team_member(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_caller_profile.role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Solo super admins pueden eliminar usuarios');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes eliminar usuarios de otra empresa');
  END IF;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id, auth.uid(), 'user_deleted', 'user', p_user_id,
    jsonb_build_object('deleted_user', v_target_profile.email)
  );

  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION update_team_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION reset_team_member_password TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION delete_team_member TO authenticated;

-- ============================================================================
-- FASE 8: MÓDULOS DE NEGOCIO
-- ============================================================================

-- LOCATIONS (Sedes/Sucursales)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  country_id uuid REFERENCES countries(id),
  province_id uuid REFERENCES provinces(id),
  city_id uuid REFERENCES cities(id),
  postal_code text,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_company_id ON locations(company_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company locations" ON locations;
CREATE POLICY "Users can view company locations"
  ON locations FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can manage company locations" ON locations;
CREATE POLICY "Users can manage company locations"
  ON locations FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- CLIENTS (Clientes)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text DEFAULT 'individual' CHECK (type IN ('individual', 'business')),
  full_name text,
  business_name text,
  tax_id_type text,
  tax_id_number text,
  email text,
  phone text,
  address text,
  country_id uuid REFERENCES countries(id),
  province_id uuid REFERENCES provinces(id),
  city_id uuid REFERENCES cities(id),
  postal_code text,
  notes text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company clients" ON clients;
CREATE POLICY "Users can view company clients"
  ON clients FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can manage company clients" ON clients;
CREATE POLICY "Users can manage company clients"
  ON clients FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Función para audit en clients
CREATE OR REPLACE FUNCTION set_client_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF (TG_OP = 'UPDATE') THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_client_audit_fields_trigger ON clients;
CREATE TRIGGER set_client_audit_fields_trigger
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_client_audit_fields();

-- BANKS (Bancos)
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banks_company_id ON banks(company_id);

ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company banks" ON banks;
CREATE POLICY "Users can view company banks"
  ON banks FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can manage company banks" ON banks;
CREATE POLICY "Users can manage company banks"
  ON banks FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- PROVIDERS (Proveedores)
CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text DEFAULT 'individual' CHECK (type IN ('individual', 'business')),
  full_name text,
  business_name text,
  tax_id_type text,
  tax_id_number text,
  email text,
  phone text,
  address text,
  country_id uuid REFERENCES countries(id),
  province_id uuid REFERENCES provinces(id),
  city_id uuid REFERENCES cities(id),
  postal_code text,
  bank_id uuid REFERENCES banks(id),
  account_number text,
  account_type text,
  notes text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_company_id ON providers(company_id);
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company providers" ON providers;
CREATE POLICY "Users can view company providers"
  ON providers FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can manage company providers" ON providers;
CREATE POLICY "Users can manage company providers"
  ON providers FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Función para audit en providers
CREATE OR REPLACE FUNCTION set_provider_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF (TG_OP = 'UPDATE') THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_provider_audit_fields_trigger ON providers;
CREATE TRIGGER set_provider_audit_fields_trigger
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION set_provider_audit_fields();

-- ============================================================================
-- FASE 9: CONFIGURACIONES FINALES
-- ============================================================================

-- Habilitar Realtime para profiles
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Índices adicionales de rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Comentarios en funciones
COMMENT ON FUNCTION handle_new_user() IS 'Trigger que crea automáticamente perfil, empresa y suscripción para nuevos usuarios';
COMMENT ON FUNCTION create_team_member IS 'Crea un nuevo miembro del equipo sin exponer SERVICE_ROLE_KEY';
COMMENT ON FUNCTION get_user_company_id IS 'Helper para obtener company_id sin recursión RLS';

-- ============================================================================
-- SCRIPT COMPLETADO
-- ============================================================================

-- Verificar que todo está configurado correctamente
DO $$
DECLARE
  v_tables_count int;
  v_functions_count int;
  v_triggers_count int;
BEGIN
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'companies', 'subscription_plans', 'company_subscriptions', 'profiles',
    'countries', 'provinces', 'cities', 'custom_roles', 'role_permissions',
    'user_ip_restrictions', 'audit_log', 'user_sessions', 'login_attempts',
    'locations', 'clients', 'banks', 'providers'
  );

  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc
  WHERE proname IN (
    'handle_new_user', 'create_team_member', 'update_team_member_role',
    'reset_team_member_password', 'deactivate_team_member', 'delete_team_member',
    'get_user_company_id', 'update_updated_at_column'
  );

  SELECT COUNT(*) INTO v_triggers_count
  FROM pg_trigger
  WHERE tgname IN ('on_auth_user_created', 'update_profiles_updated_at');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACIÓN COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas creadas: %', v_tables_count;
  RAISE NOTICE 'Funciones creadas: %', v_functions_count;
  RAISE NOTICE 'Triggers activos: %', v_triggers_count;
  RAISE NOTICE '========================================';
END $$;
