/*
  # Password Verification Hook con Validación de IP

  ## Descripción

  Esta migración implementa un Auth Hook de Supabase que valida las restricciones
  de IP ANTES de crear la sesión del usuario durante el proceso de login.

  ## Funcionalidad

  ### Hook Principal: `hook_password_verification_with_ip`

  Este hook se ejecuta automáticamente durante el proceso de autenticación con password:

  1. **Extracción de datos:**
     - user_id: ID del usuario que intenta iniciar sesión
     - password_valid: Si la contraseña es correcta
     - user_ip: IP extraída del header 'x-forwarded-for'

  2. **Lógica de validación:**
     - Si la password es inválida → Continuar (Supabase maneja el error)
     - Si el usuario NO tiene restricciones → PERMITIR acceso
     - Si el usuario TIENE restricciones:
       - Si la IP está en la lista de IPs permitidas → PERMITIR acceso
       - Si la IP NO está permitida → RECHAZAR acceso

  3. **Registro de auditoría:**
     - Cuando se bloquea un acceso, se registra automáticamente en `audit_log`
     - Incluye: IP bloqueada, motivo, timestamp

  4. **Respuestas:**
     - `{"decision": "continue"}` → Permite el login
     - `{"decision": "reject", "message": "..."}` → Bloquea el login con mensaje

  ## Seguridad

  - El hook tiene permisos SECURITY DEFINER (se ejecuta con privilegios elevados)
  - Solo el rol `supabase_auth_admin` puede ejecutarlo
  - Los roles `authenticated`, `anon` y `public` NO tienen acceso
  - Implementa fail-open: Si hay error, permite acceso (no bloquea usuarios por bugs)

  ## Testing

  Se incluye función `test_password_verification_hook()` para probar el hook manualmente.

  ## Configuración Post-Migración

  Después de aplicar esta migración, debes configurar el hook en Supabase Dashboard:

  1. Ir a: Authentication > Hooks
  2. Seleccionar: "Password Verification Hook"
  3. Configurar:
     - Type: PostgreSQL Function
     - Function Name: public.hook_password_verification_with_ip
  4. Guardar y activar

  ## Notas Importantes

  - ⚡ El hook se ejecuta ANTES de crear la sesión (sin ventana de vulnerabilidad)
  - 📊 La IP se obtiene de headers del request (no requiere servicio externo)
  - 🔒 Solo afecta login con password (no OAuth, magic links, etc.)
  - ⏱️ El hook debe completarse en máximo 2 segundos
*/

-- =====================================================
-- FUNCIÓN PRINCIPAL: Password Verification Hook
-- =====================================================

CREATE OR REPLACE FUNCTION public.hook_password_verification_with_ip(
  event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_password_valid boolean;
  v_user_ip text;
  v_has_restrictions boolean;
  v_ip_allowed boolean;
BEGIN
  -- Extraer datos del evento
  v_user_id := (event->'user_id')::uuid;
  v_password_valid := (event->'valid')::boolean;

  -- Extraer IP del request header (primera IP de x-forwarded-for)
  BEGIN
    v_user_ip := split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',',
      1
    );

    -- Limpiar espacios en blanco
    v_user_ip := trim(v_user_ip);
  EXCEPTION
    WHEN OTHERS THEN
      -- Si no se puede obtener la IP, permitir acceso (fail-open)
      v_user_ip := NULL;
  END;

  -- Si la password no es válida, dejar que Supabase maneje el error normalmente
  IF NOT v_password_valid THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Si no se pudo obtener la IP, permitir acceso (fail-open para evitar bloqueos)
  IF v_user_ip IS NULL OR v_user_ip = '' THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Verificar si el usuario tiene restricciones de IP activas
  SELECT EXISTS (
    SELECT 1
    FROM public.user_ip_restrictions
    WHERE user_id = v_user_id
    AND is_active = true
  ) INTO v_has_restrictions;

  -- Si NO tiene restricciones, permitir acceso
  IF NOT v_has_restrictions THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Si TIENE restricciones, validar que la IP esté en la lista permitida
  SELECT EXISTS (
    SELECT 1
    FROM public.user_ip_restrictions
    WHERE user_id = v_user_id
    AND ip_address = v_user_ip
    AND is_active = true
  ) INTO v_ip_allowed;

  -- Si la IP NO está permitida, BLOQUEAR el acceso
  IF NOT v_ip_allowed THEN
    -- Registrar intento bloqueado en audit_log
    BEGIN
      INSERT INTO public.audit_log (
        company_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        created_at
      )
      SELECT
        p.company_id,
        v_user_id,
        'login_blocked_ip',
        'auth',
        v_user_id,
        jsonb_build_object(
          'blocked_ip', v_user_ip,
          'reason', 'IP no autorizada',
          'timestamp', now(),
          'hook_version', 'v1'
        ),
        v_user_ip,
        now()
      FROM public.profiles p
      WHERE p.id = v_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla el registro, continuar bloqueando (no es crítico)
        NULL;
    END;

    -- RECHAZAR LOGIN con mensaje personalizado
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Acceso denegado. Tu ubicación no está autorizada para acceder a esta cuenta. Contacta al administrador.',
      'should_logout_user', false
    );
  END IF;

  -- IP permitida, continuar con el login normalmente
  RETURN jsonb_build_object(
    'decision', 'continue'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de cualquier error inesperado, permitir acceso (fail-open)
    -- Esto evita bloquear usuarios legítimos si hay un bug en la función
    RAISE WARNING 'Error en hook de validación IP para usuario %: %', v_user_id, SQLERRM;

    RETURN jsonb_build_object(
      'decision', 'continue'
    );
END;
$$;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION public.hook_password_verification_with_ip(jsonb) IS
'Auth Hook que valida restricciones de IP antes de permitir el login.
Se ejecuta automáticamente durante password sign-in.
Responde con {"decision": "continue"} para permitir o {"decision": "reject"} para bloquear.';

-- =====================================================
-- PERMISOS DE SEGURIDAD
-- =====================================================

-- Otorgar permiso SOLO al rol de autenticación de Supabase
GRANT EXECUTE ON FUNCTION public.hook_password_verification_with_ip(jsonb)
TO supabase_auth_admin;

-- Revocar explícitamente de todos los demás roles
REVOKE EXECUTE ON FUNCTION public.hook_password_verification_with_ip(jsonb)
FROM authenticated, anon, public;

-- =====================================================
-- FUNCIÓN DE TESTING (Desarrollo y QA)
-- =====================================================

CREATE OR REPLACE FUNCTION public.test_password_verification_hook(
  p_user_id uuid,
  p_password_valid boolean DEFAULT true,
  p_test_ip text DEFAULT '192.168.1.1'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event jsonb;
  v_result jsonb;
  v_original_headers text;
BEGIN
  -- Guardar headers originales (si existen)
  BEGIN
    v_original_headers := current_setting('request.headers', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_original_headers := NULL;
  END;

  -- Simular evento del hook
  v_event := jsonb_build_object(
    'user_id', p_user_id,
    'valid', p_password_valid,
    'metadata', jsonb_build_object(
      'timestamp', now(),
      'test_mode', true
    )
  );

  -- Configurar IP de prueba en el request header
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-forwarded-for', p_test_ip)::text,
    true
  );

  -- Ejecutar el hook
  v_result := public.hook_password_verification_with_ip(v_event);

  -- Restaurar headers originales (si existían)
  IF v_original_headers IS NOT NULL THEN
    PERFORM set_config('request.headers', v_original_headers, true);
  END IF;

  -- Agregar metadata de testing
  v_result := v_result || jsonb_build_object(
    'test_metadata', jsonb_build_object(
      'user_id', p_user_id,
      'test_ip', p_test_ip,
      'password_valid', p_password_valid,
      'executed_at', now()
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.test_password_verification_hook(uuid, boolean, text) IS
'Función de testing para probar el password verification hook manualmente.
Simula el evento del hook con parámetros controlados.

Ejemplos de uso:

-- Probar usuario sin restricciones
SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''1.2.3.4'');

-- Probar usuario con IP permitida
SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''190.123.45.67'');

-- Probar usuario con IP NO permitida (debería rechazar)
SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''8.8.8.8'');

-- Probar con password inválida
SELECT test_password_verification_hook(''user-id-aqui''::uuid, false, ''1.2.3.4'');
';

-- Permitir que usuarios autenticados ejecuten la función de testing
-- (útil para desarrollo y debugging)
GRANT EXECUTE ON FUNCTION public.test_password_verification_hook(uuid, boolean, text)
TO authenticated;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Asegurarse de que existe índice para búsquedas rápidas de restricciones
-- (probablemente ya existe, pero verificamos)
CREATE INDEX IF NOT EXISTS idx_user_ip_restrictions_lookup
ON public.user_ip_restrictions(user_id, is_active, ip_address)
WHERE is_active = true;

COMMENT ON INDEX idx_user_ip_restrictions_lookup IS
'Índice para optimizar búsquedas de restricciones de IP activas en el password verification hook';
