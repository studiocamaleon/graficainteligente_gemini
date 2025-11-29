/*
  # Corrección de columnas audit_log en create_team_member

  ## Problema
  La función create_team_member intenta insertar en columnas que no existen:
  - "module" (debe ser "module_id")
  - "record_id" (debe ser "resource_id")

  ## Solución
  Actualizar el INSERT INTO audit_log con las columnas correctas:
  - module_id (en lugar de module)
  - resource_type (nuevo, para identificar tipo de recurso)
  - resource_id (en lugar de record_id)

  ## Cambios
  Solo se modifica la sección de audit_log de la función, 
  manteniendo toda la lógica de validación de roles actualizada.
*/

-- Recrear función create_team_member con columnas correctas de audit_log
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

  -- Validar rol (CON NUEVOS ROLES: operador_diseno, operador_taller)
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operador_diseno', 'operador_taller', 'viewer') THEN
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

    -- Si el perfil no se creó después de los reintentos, intentar crearlo manualmente
    IF NOT v_profile_created THEN
      BEGIN
        INSERT INTO profiles (
          id,
          email,
          full_name,
          company_id,
          role,
          custom_role_id,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          v_new_user_id,
          p_email,
          p_full_name,
          v_company_id,
          p_role,
          p_custom_role_id,
          true,
          now(),
          now()
        )
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error al crear perfil manualmente: %', SQLERRM;
      END;
    END IF;

    -- Registrar en audit_log (CORREGIDO: columnas correctas)
    INSERT INTO audit_log (
      user_id,
      company_id,
      action,
      module_id,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      v_company_id,
      'create',
      'team',
      'user',
      v_new_user_id,
      jsonb_build_object(
        'email', p_email,
        'full_name', p_full_name,
        'role', p_role
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_new_user_id,
      'message', 'Usuario creado exitosamente'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al crear usuario: ' || SQLERRM
    );
  END;
END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION create_team_member IS
'Crea un nuevo miembro del equipo. Roles válidos: super_admin, admin, manager, operador_diseno, operador_taller, viewer.
Actualizado: 2025-11-29 - Corregidas columnas de audit_log (module_id, resource_type, resource_id).';