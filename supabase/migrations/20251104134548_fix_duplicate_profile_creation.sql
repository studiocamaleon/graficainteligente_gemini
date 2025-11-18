/*
  # Corrección de Creación Duplicada de Perfiles

  ## Problema
  Cuando un administrador crea un miembro del equipo usando create_team_member():
  1. La función inserta en auth.users
  2. El trigger handle_new_user() se dispara automáticamente
  3. Ambos intentan crear el perfil en profiles
  4. Resultado: error "duplicate key value violates unique constraint 'profiles_pkey'"

  ## Solución
  1. Hacer el trigger handle_new_user() idempotente usando INSERT ... ON CONFLICT DO NOTHING
  2. Modificar create_team_member() para desactivar temporalmente el trigger
  3. Esto permite que ambos mecanismos coexistan sin conflictos

  ## Cambios Realizados
  1. Actualizar handle_new_user() para verificar existencia antes de insertar
  2. Usar ON CONFLICT DO NOTHING en las inserciones de perfil
  3. Modificar create_team_member() para usar session_replication_role
  4. Agregar logging mejorado para debugging

  ## Seguridad
  - Se mantienen todas las políticas RLS existentes
  - SECURITY DEFINER se mantiene en las funciones
  - No se cambian los permisos de las tablas
*/

-- ============================================================================
-- PASO 1: Hacer el trigger handle_new_user() idempotente
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_profile_exists boolean;
BEGIN
  -- Verificar si el perfil ya existe
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO v_profile_exists;
  
  -- Si el perfil ya existe, no hacer nada y retornar
  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %. Skipping creation.', NEW.id;
    RETURN NEW;
  END IF;

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
    
    -- Crear perfil con rol de super_admin usando ON CONFLICT
    INSERT INTO profiles (id, email, full_name, company_id, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_company_id,
      'super_admin'
    )
    ON CONFLICT (id) DO NOTHING;
    
  ELSE
    -- Si no hay empresa, crear perfil sin company_id usando ON CONFLICT
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'viewer'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASO 2: Modificar create_team_member para desactivar el trigger
-- ============================================================================

DROP FUNCTION IF EXISTS create_team_member(text, text, text, text, uuid);

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
  v_profile_exists boolean;
BEGIN
  -- Validar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No autenticado'
    );
  END IF;

  -- Obtener perfil del llamador
  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = auth.uid();

  -- Validar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes permisos para crear usuarios'
    );
  END IF;

  -- Validar empresa
  IF v_caller_profile.company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes una empresa asignada'
    );
  END IF;

  v_company_id := v_caller_profile.company_id;

  -- Validar email
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email inválido'
    );
  END IF;

  -- Validar contraseña
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  -- Verificar si el email ya existe en auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Este email ya está registrado'
    );
  END IF;

  -- Validar rol
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operator', 'viewer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Rol inválido'
    );
  END IF;

  -- Generar ID para el nuevo usuario
  v_new_user_id := gen_random_uuid();

  -- Encriptar contraseña
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- CRÍTICO: Desactivar triggers temporalmente para esta sesión
  -- Esto evita que handle_new_user() se dispare automáticamente
  PERFORM set_config('session_replication_role', 'replica', true);

  BEGIN
    -- Insertar usuario en auth.users (sin disparar trigger)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      v_encrypted_password,
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name),
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- Restaurar triggers
    PERFORM set_config('session_replication_role', 'origin', true);

    -- Ahora crear el perfil manualmente (con ON CONFLICT por seguridad)
    INSERT INTO profiles (
      id,
      email,
      full_name,
      company_id,
      role,
      custom_role_id,
      is_active
    ) VALUES (
      v_new_user_id,
      p_email,
      p_full_name,
      v_company_id,
      p_role,
      p_custom_role_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;

    -- Registrar en audit log
    INSERT INTO audit_log (
      company_id,
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      v_company_id,
      auth.uid(),
      'user_created',
      'user',
      v_new_user_id,
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
      -- Asegurar que los triggers se restauren incluso si hay error
      PERFORM set_config('session_replication_role', 'origin', true);
      
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Error al crear usuario: ' || SQLERRM
      );
  END;

END;
$$;

-- Restaurar permisos
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;
