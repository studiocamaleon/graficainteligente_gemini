/*
  # Corrección de Funciones de Encriptación con pgcrypto

  ## Descripción
  Esta migración corrige las funciones de gestión de usuarios del equipo para usar
  correctamente las funciones de encriptación de pgcrypto que ya están instaladas
  en el schema extensions.

  ## Problema Resuelto
  - Error: "function gen_salt(unknown) does not exist"
  - Las funciones intentaban usar gen_salt() sin especificar el schema correcto
  - Se necesita usar extensions.gen_salt() o agregar el schema al search_path

  ## Cambios Realizados
  1. Se agrega "extensions" al search_path de las funciones
  2. Se corrigen las funciones create_team_member y reset_team_member_password
  3. Se mantiene la compatibilidad con el formato de encriptación de Supabase Auth

  ## Seguridad
  - Todas las funciones mantienen SECURITY DEFINER
  - Se mantienen las verificaciones de permisos existentes
  - No se cambia la lógica de negocio, solo la referencia a las funciones de encriptación
*/

-- Eliminar las funciones existentes para recrearlas con el search_path correcto
DROP FUNCTION IF EXISTS create_team_member(text, text, text, text, uuid);
DROP FUNCTION IF EXISTS reset_team_member_password(uuid, text);

-- Recrear función para crear un nuevo miembro del equipo con search_path corregido
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No autenticado'
    );
  END IF;

  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes permisos para crear usuarios'
    );
  END IF;

  IF v_caller_profile.company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes una empresa asignada'
    );
  END IF;

  v_company_id := v_caller_profile.company_id;

  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email inválido'
    );
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Este email ya está registrado'
    );
  END IF;

  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operator', 'viewer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Rol inválido'
    );
  END IF;

  v_new_user_id := gen_random_uuid();

  v_encrypted_password := crypt(p_password, gen_salt('bf'));

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
  );

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
$$;

-- Recrear función para resetear contraseña con search_path corregido
CREATE OR REPLACE FUNCTION reset_team_member_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
  SET
    encrypted_password = v_encrypted_password,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'password_reset',
    'user',
    p_user_id,
    jsonb_build_object('target_user', v_target_profile.email)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Restaurar permisos de ejecución
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION reset_team_member_password TO authenticated;
