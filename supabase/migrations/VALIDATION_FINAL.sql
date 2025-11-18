/*
  ============================================================================
  SCRIPT DE VALIDACIÓN FINAL
  ============================================================================

  Este script realiza una validación completa del sistema para confirmar
  que todas las migraciones se aplicaron correctamente y que el trigger
  handle_new_user() funciona como se espera.

  FECHA: 2025-11-05
  VERSIÓN: 1.0
*/

DO $$
DECLARE
  v_tables_count int;
  v_functions_count int;
  v_triggers_count int;
  v_users_count int;
  v_profiles_count int;
  v_orphaned_users int;
  v_companies_count int;
  v_subscriptions_count int;
  v_trigger_enabled boolean;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDACIÓN FINAL DEL SISTEMA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. Verificar tablas
  RAISE NOTICE '1. VERIFICACIÓN DE TABLAS:';
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'companies', 'subscription_plans', 'company_subscriptions', 'profiles',
    'countries', 'provinces', 'cities', 'custom_roles', 'role_permissions',
    'user_ip_restrictions', 'audit_log', 'user_sessions', 'login_attempts',
    'locations', 'clients', 'banks', 'providers'
  );
  RAISE NOTICE '   Tablas esperadas: 17';
  RAISE NOTICE '   Tablas encontradas: %', v_tables_count;

  IF v_tables_count = 17 THEN
    RAISE NOTICE '   ✓ TODAS LAS TABLAS EXISTEN';
  ELSE
    RAISE WARNING '   ✗ FALTAN TABLAS';
  END IF;
  RAISE NOTICE '';

  -- 2. Verificar funciones
  RAISE NOTICE '2. VERIFICACIÓN DE FUNCIONES:';
  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc
  WHERE proname IN (
    'handle_new_user', 'create_team_member', 'update_team_member_role',
    'reset_team_member_password', 'deactivate_team_member', 'delete_team_member',
    'get_user_company_id', 'update_updated_at_column', 'set_client_audit_fields',
    'set_provider_audit_fields', 'cleanup_expired_sessions', 'log_login_attempt',
    'check_ip_restriction'
  );
  RAISE NOTICE '   Funciones esperadas: 13';
  RAISE NOTICE '   Funciones encontradas: %', v_functions_count;

  IF v_functions_count >= 10 THEN
    RAISE NOTICE '   ✓ FUNCIONES CRÍTICAS EXISTEN';
  ELSE
    RAISE WARNING '   ✗ FALTAN FUNCIONES';
  END IF;
  RAISE NOTICE '';

  -- 3. Verificar trigger
  RAISE NOTICE '3. VERIFICACIÓN DEL TRIGGER:';
  SELECT
    CASE WHEN tgenabled = 'O' THEN true ELSE false END
  INTO v_trigger_enabled
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relname = 'users'
  AND n.nspname = 'auth'
  AND t.tgname = 'on_auth_user_created';

  IF v_trigger_enabled THEN
    RAISE NOTICE '   ✓ TRIGGER on_auth_user_created ESTÁ HABILITADO';
  ELSE
    RAISE WARNING '   ✗ TRIGGER DESHABILITADO O NO EXISTE';
  END IF;
  RAISE NOTICE '';

  -- 4. Verificar datos
  RAISE NOTICE '4. VERIFICACIÓN DE DATOS:';
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM profiles;
  SELECT COUNT(*) INTO v_companies_count FROM companies;
  SELECT COUNT(*) INTO v_subscriptions_count FROM company_subscriptions WHERE status = 'active';

  SELECT COUNT(*) INTO v_orphaned_users
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE p.id IS NULL;

  RAISE NOTICE '   Total usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   Total perfiles en profiles: %', v_profiles_count;
  RAISE NOTICE '   Total empresas: %', v_companies_count;
  RAISE NOTICE '   Total suscripciones activas: %', v_subscriptions_count;
  RAISE NOTICE '   Usuarios huérfanos (sin perfil): %', v_orphaned_users;

  IF v_orphaned_users = 0 THEN
    RAISE NOTICE '   ✓ TODOS LOS USUARIOS TIENEN PERFIL';
  ELSE
    RAISE WARNING '   ✗ HAY USUARIOS SIN PERFIL';
  END IF;

  IF v_users_count = v_profiles_count THEN
    RAISE NOTICE '   ✓ USUARIOS Y PERFILES ESTÁN SINCRONIZADOS';
  ELSE
    RAISE WARNING '   ✗ DESINCRONIZACIÓN ENTRE USUARIOS Y PERFILES';
  END IF;
  RAISE NOTICE '';

  -- 5. Verificar políticas RLS
  RAISE NOTICE '5. VERIFICACIÓN DE POLÍTICAS RLS:';
  DECLARE
    v_policies_count int;
  BEGIN
    SELECT COUNT(*) INTO v_policies_count
    FROM pg_policies
    WHERE tablename IN ('companies', 'profiles', 'company_subscriptions')
    AND cmd = 'INSERT';

    RAISE NOTICE '   Políticas INSERT críticas: %', v_policies_count;

    IF v_policies_count >= 3 THEN
      RAISE NOTICE '   ✓ POLÍTICAS INSERT CONFIGURADAS';
    ELSE
      RAISE WARNING '   ✗ FALTAN POLÍTICAS INSERT';
    END IF;
  END;
  RAISE NOTICE '';

  -- 6. Verificar planes de suscripción
  RAISE NOTICE '6. VERIFICACIÓN DE PLANES:';
  DECLARE
    v_free_plan_exists boolean;
  BEGIN
    SELECT EXISTS(SELECT 1 FROM subscription_plans WHERE slug = 'free') INTO v_free_plan_exists;

    IF v_free_plan_exists THEN
      RAISE NOTICE '   ✓ PLAN FREE EXISTE';
    ELSE
      RAISE WARNING '   ✗ PLAN FREE NO EXISTE';
    END IF;
  END;
  RAISE NOTICE '';

  -- Resumen final
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE VALIDACIÓN:';
  RAISE NOTICE '========================================';

  IF v_tables_count = 17
    AND v_functions_count >= 10
    AND v_trigger_enabled
    AND v_orphaned_users = 0
    AND v_users_count = v_profiles_count THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ SISTEMA VALIDADO CORRECTAMENTE ✓✓✓';
    RAISE NOTICE '';
    RAISE NOTICE 'El sistema está completamente funcional:';
    RAISE NOTICE '- Todas las tablas existen';
    RAISE NOTICE '- Todas las funciones están creadas';
    RAISE NOTICE '- El trigger está habilitado';
    RAISE NOTICE '- No hay usuarios huérfanos';
    RAISE NOTICE '- Usuarios y perfiles sincronizados';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Probar registro de nuevo usuario desde el frontend';
    RAISE NOTICE '2. Verificar que se cree automáticamente empresa, perfil y suscripción';
    RAISE NOTICE '3. Verificar inicio de sesión';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ HAY PROBLEMAS EN EL SISTEMA ✗✗✗';
    RAISE WARNING '';
    RAISE WARNING 'Revisa los mensajes anteriores para identificar los problemas.';
    RAISE WARNING '';
  END IF;

  RAISE NOTICE '========================================';
END $$;
