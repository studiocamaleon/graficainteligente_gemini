/*
  # Sistema Seguro de Administración de Usuarios (sin correos)

  ## Descripción
  Esta migración crea funciones PostgreSQL seguras para que los super_admin puedan
  gestionar usuarios de su equipo sin necesidad de exponer la SERVICE_ROLE_KEY al frontend.

  Las operaciones se ejecutan en el servidor con SECURITY DEFINER, verificando permisos
  antes de cada acción.

  ## Nuevas Funciones RPC

  ### 1. `create_team_member`
  Crea un nuevo usuario en auth.users y su perfil asociado
  - Verifica que el llamador sea super_admin o admin
  - Crea usuario con email, contraseña y rol especificados
  - Asigna el usuario a la misma empresa del admin
  - Parámetros: email, password, full_name, role, custom_role_id (opcional)
  - Retorna: objeto con success y mensaje

  ### 2. `update_team_member_role`
  Actualiza el rol de un miembro del equipo
  - Verifica permisos del llamador
  - No permite modificar super_admins
  - Parámetros: user_id, new_role, custom_role_id (opcional)
  - Retorna: objeto con success y mensaje

  ### 3. `reset_team_member_password`
  Resetea la contraseña de un usuario
  - Verifica permisos del llamador
  - Actualiza la contraseña en auth.users
  - Parámetros: user_id, new_password
  - Retorna: objeto con success y mensaje

  ### 4. `deactivate_team_member`
  Activa o desactiva un usuario
  - Verifica permisos del llamador
  - No permite desactivar super_admins
  - Parámetros: user_id, is_active
  - Retorna: objeto con success y mensaje

  ### 5. `delete_team_member`
  Elimina completamente un usuario
  - Verifica permisos del llamador
  - No permite eliminar super_admins
  - Elimina el usuario de auth.users (cascade elimina profile)
  - Parámetros: user_id
  - Retorna: objeto con success y mensaje

  ## Seguridad

  - Todas las funciones usan SECURITY DEFINER (se ejecutan con privilegios elevados)
  - Verificación estricta de permisos en cada función
  - Solo super_admin y admin pueden ejecutar estas funciones
  - Los usuarios solo pueden afectar miembros de su propia empresa
  - Logs de auditoría para todas las operaciones
  - No se expone SERVICE_ROLE_KEY al frontend

  ## Notas Importantes

  - Las funciones requieren que el usuario esté autenticado (auth.uid())
  - Se utilizan para reemplazar las llamadas a supabase.auth.admin.* del frontend
  - El frontend las invoca mediante supabase.rpc('nombre_funcion', parametros)
*/

-- Extensión necesaria para manipular usuarios de auth
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función para crear un nuevo miembro del equipo
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
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles;
  v_new_user_id uuid;
  v_company_id uuid;
  v_encrypted_password text;
BEGIN
  -- Verificar que hay un usuario autenticado
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No autenticado'
    );
  END IF;

  -- Obtener el perfil del usuario que llama la función
  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = auth.uid();

  -- Verificar que el usuario tiene permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes permisos para crear usuarios'
    );
  END IF;

  -- Verificar que el usuario tiene una empresa asignada
  IF v_caller_profile.company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes una empresa asignada'
    );
  END IF;

  v_company_id := v_caller_profile.company_id;

  -- Validar el email
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email inválido'
    );
  END IF;

  -- Validar la contraseña
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  -- Verificar que el email no existe ya
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Este email ya está registrado'
    );
  END IF;

  -- Validar el rol
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operator', 'viewer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Rol inválido'
    );
  END IF;

  -- Generar ID para el nuevo usuario
  v_new_user_id := gen_random_uuid();

  -- Encriptar la contraseña usando crypt (compatible con Supabase Auth)
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Insertar el usuario en auth.users
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

  -- Crear el perfil del usuario
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
$$;

-- Función para actualizar el rol de un miembro
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
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfil del llamador
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();

  -- Verificar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  -- Obtener perfil del usuario objetivo
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar que pertenecen a la misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  -- No permitir modificar super_admins (a menos que seas super_admin)
  IF v_target_profile.role = 'super_admin' AND v_caller_profile.role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar un super admin');
  END IF;

  -- Actualizar el rol
  UPDATE profiles
  SET
    role = p_new_role,
    custom_role_id = p_custom_role_id,
    updated_at = now()
  WHERE id = p_user_id;

  -- Audit log
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'user_role_updated',
    'user',
    p_user_id,
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
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Validar contraseña
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  -- Obtener perfiles
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  -- Verificar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  -- Encriptar nueva contraseña
  v_encrypted_password := crypt(p_new_password, gen_salt('bf'));

  -- Actualizar contraseña en auth.users
  UPDATE auth.users
  SET
    encrypted_password = v_encrypted_password,
    updated_at = now()
  WHERE id = p_user_id;

  -- Audit log
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
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfiles
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  -- Verificar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  -- No permitir desactivar super_admins
  IF v_target_profile.role = 'super_admin' AND NOT p_is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes desactivar un super admin');
  END IF;

  -- Actualizar estado
  UPDATE profiles
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_user_id;

  -- Audit log
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    CASE WHEN p_is_active THEN 'user_activated' ELSE 'user_deactivated' END,
    'user',
    p_user_id,
    jsonb_build_object('target_user', v_target_profile.email, 'is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Estado actualizado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Función para eliminar usuario completamente
CREATE OR REPLACE FUNCTION delete_team_member(
  p_user_id uuid
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
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfiles
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  -- Verificar permisos (solo super_admin puede eliminar)
  IF v_caller_profile.role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Solo super admins pueden eliminar usuarios');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes eliminar usuarios de otra empresa');
  END IF;

  -- No permitir eliminar otros super_admins
  IF v_target_profile.role = 'super_admin' AND p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes eliminar otro super admin');
  END IF;

  -- Audit log ANTES de eliminar
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'user_deleted',
    'user',
    p_user_id,
    jsonb_build_object('deleted_user', v_target_profile.email)
  );

  -- Eliminar usuario de auth.users (el cascade eliminará el profile)
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION update_team_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION reset_team_member_password TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION delete_team_member TO authenticated;
