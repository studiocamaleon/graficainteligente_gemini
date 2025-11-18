/*
  # Eliminar Dependencia de session_replication_role

  ## Problema
  La función create_team_member() intenta usar session_replication_role para desactivar
  triggers temporalmente, pero Supabase ha implementado restricciones de seguridad que
  impiden que funciones con SECURITY DEFINER modifiquen este parámetro del sistema.
  
  Error: "permission denied to set parameter 'session_replication_role'"

  ## Solución
  Refactorizar el sistema para que el trigger handle_new_user() y la función 
  create_team_member() trabajen en armonía usando metadata enriquecido:
  
  1. **handle_new_user()**: Lee metadata completo (company_id, role, etc.) y crea
     el perfil correctamente desde el inicio usando ON CONFLICT DO NOTHING
  
  2. **create_team_member()**: Inserta en auth.users con metadata completo,
     permite que el trigger cree el perfil, y luego verifica/actualiza si es necesario

  ## Cambios Realizados
  
  ### 1. Actualización de handle_new_user()
  - Leer company_id del metadata para usuarios creados por administradores
  - Detectar el contexto de creación (auto-registro vs creado por admin)
  - Crear perfil con los datos correctos desde el inicio
  - Mantener ON CONFLICT DO NOTHING para idempotencia
  
  ### 2. Refactorización de create_team_member()
  - ELIMINAR completamente el uso de session_replication_role
  - ELIMINAR bloques BEGIN/EXCEPTION que intentan restaurar triggers
  - Insertar en auth.users con metadata enriquecido (company_id, role, custom_role_id)
  - Permitir que el trigger cree el perfil
  - Verificar y actualizar el perfil si es necesario después de la creación
  
  ### 3. Flujo Mejorado
  - Admin llama a create_team_member()
  - Se inserta en auth.users con metadata completo
  - Trigger handle_new_user() se ejecuta y lee el metadata
  - Perfil se crea correctamente con company_id y role desde el inicio
  - No hay duplicación gracias a ON CONFLICT DO NOTHING
  - Audit log registra la operación

  ## Seguridad
  - Se mantienen todas las políticas RLS existentes
  - SECURITY DEFINER se mantiene en las funciones
  - No se requieren permisos especiales de sistema
  - Compatible con restricciones de seguridad de Supabase
*/

-- ============================================================================
-- PASO 1: Actualizar handle_new_user() para leer metadata enriquecido
-- ============================================================================

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

-- ============================================================================
-- PASO 2: Refactorizar create_team_member SIN session_replication_role
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
  v_profile_created boolean;
  v_max_attempts int := 5;
  v_attempt int := 0;
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

  BEGIN
    -- Insertar usuario en auth.users con metadata enriquecido
    -- El trigger handle_new_user() se ejecutará automáticamente y creará el perfil
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
      jsonb_build_object(
        'full_name', p_full_name,
        'company_id', v_company_id::text,
        'role', p_role,
        'custom_role_id', p_custom_role_id::text,
        'created_by_admin', true
      ),
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- Esperar a que el trigger cree el perfil (con reintentos)
    LOOP
      v_attempt := v_attempt + 1;
      
      SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = v_new_user_id 
        AND company_id = v_company_id
      ) INTO v_profile_created;
      
      EXIT WHEN v_profile_created OR v_attempt >= v_max_attempts;
      
      -- Pequeña pausa entre intentos
      PERFORM pg_sleep(0.1);
    END LOOP;

    -- Si el perfil no fue creado por el trigger, intentar crearlo manualmente
    IF NOT v_profile_created THEN
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
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role = EXCLUDED.role,
        custom_role_id = EXCLUDED.custom_role_id,
        full_name = EXCLUDED.full_name;
    END IF;

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
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Error al crear usuario: ' || SQLERRM
      );
  END;

END;
$$;

-- Restaurar permisos
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;

-- ============================================================================
-- PASO 3: Comentario explicativo
-- ============================================================================

COMMENT ON FUNCTION handle_new_user() IS 
'Trigger que se ejecuta al crear un nuevo usuario. Lee metadata enriquecido para crear perfiles correctamente tanto para auto-registro como para usuarios creados por administradores.';

COMMENT ON FUNCTION create_team_member(text, text, text, text, uuid) IS 
'Crea un nuevo miembro del equipo. Inserta en auth.users con metadata completo y permite que el trigger handle_new_user cree el perfil automáticamente. Compatible con restricciones de seguridad de Supabase.';
