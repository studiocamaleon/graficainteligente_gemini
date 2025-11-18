/*
  ============================================================================
  SCRIPT DE REPARACIÓN: Usuarios Huérfanos sin Perfil
  ============================================================================

  Este script identifica y repara usuarios en auth.users que no tienen
  un perfil correspondiente en la tabla profiles.

  PROBLEMA:
  - Usuarios se registraron pero el trigger handle_new_user() falló
  - Usuarios existen en auth.users pero NO en profiles
  - No tienen empresa ni suscripción asignada

  SOLUCIÓN:
  - Crear empresa para cada usuario huérfano
  - Crear perfil con rol super_admin
  - Asignar suscripción Free
  - Registrar en audit_log

  FECHA: 2025-11-05
  VERSIÓN: 1.0
*/

DO $$
DECLARE
  v_user record;
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_users_repaired int := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO REPARACIÓN DE USUARIOS HUÉRFANOS';
  RAISE NOTICE '========================================';

  -- Obtener el plan Free
  SELECT id INTO v_free_plan_id FROM subscription_plans WHERE slug = 'free' LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan Free no encontrado. Debe existir un plan con slug = ''free''';
  END IF;

  RAISE NOTICE 'Plan Free encontrado: %', v_free_plan_id;

  -- Buscar usuarios en auth.users sin perfil en profiles
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      u.raw_user_meta_data->>'full_name' as full_name,
      u.raw_user_meta_data->>'company_name' as company_name,
      u.created_at
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE p.id IS NULL
    AND u.email IS NOT NULL
  LOOP
    BEGIN
      RAISE NOTICE 'Reparando usuario: % (%)', v_user.email, v_user.id;

      -- Generar nombre de empresa
      v_company_name := COALESCE(
        v_user.company_name,
        v_user.full_name || '''s Company',
        split_part(v_user.email, '@', 1) || ' Company'
      );

      -- Generar slug único
      v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_company_slug := regexp_replace(v_company_slug, '^-+|-+$', '', 'g');

      -- Asegurar unicidad del slug
      IF EXISTS (SELECT 1 FROM companies WHERE slug = v_company_slug) THEN
        v_company_slug := v_company_slug || '-' || substr(v_user.id::text, 1, 8);
      END IF;

      -- Crear empresa
      INSERT INTO companies (name, slug, status)
      VALUES (v_company_name, v_company_slug, 'active')
      RETURNING id INTO v_company_id;

      RAISE NOTICE '  ✓ Empresa creada: % (ID: %)', v_company_name, v_company_id;

      -- Crear suscripción Free
      INSERT INTO company_subscriptions (company_id, plan_id, status, started_at)
      VALUES (v_company_id, v_free_plan_id, 'active', now());

      RAISE NOTICE '  ✓ Suscripción Free asignada';

      -- Crear perfil
      INSERT INTO profiles (
        id,
        email,
        full_name,
        company_id,
        role,
        is_active
      ) VALUES (
        v_user.id,
        v_user.email,
        COALESCE(v_user.full_name, split_part(v_user.email, '@', 1)),
        v_company_id,
        'super_admin',
        true
      );

      RAISE NOTICE '  ✓ Perfil creado con rol super_admin';

      -- Registrar en audit_log
      INSERT INTO audit_log (
        company_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details
      ) VALUES (
        v_company_id,
        v_user.id,
        'user_repaired',
        'user',
        v_user.id,
        jsonb_build_object(
          'reason', 'Orphaned user without profile',
          'repair_date', now(),
          'original_creation_date', v_user.created_at,
          'repaired_by', 'system_script'
        )
      );

      RAISE NOTICE '  ✓ Registro de auditoría creado';

      v_users_repaired := v_users_repaired + 1;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '  ✗ Error reparando usuario %: %', v_user.email, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPARACIÓN COMPLETADA';
  RAISE NOTICE 'Usuarios reparados: %', v_users_repaired;
  RAISE NOTICE '========================================';

  -- Mostrar resumen
  RAISE NOTICE '';
  RAISE NOTICE 'RESUMEN ACTUAL:';
  RAISE NOTICE 'Total usuarios en auth.users: %', (SELECT COUNT(*) FROM auth.users);
  RAISE NOTICE 'Total perfiles en profiles: %', (SELECT COUNT(*) FROM profiles);
  RAISE NOTICE 'Total empresas: %', (SELECT COUNT(*) FROM companies);
  RAISE NOTICE 'Total suscripciones activas: %', (SELECT COUNT(*) FROM company_subscriptions WHERE status = 'active');

END $$;

-- Verificar que no queden usuarios huérfanos
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ TODOS LOS USUARIOS TIENEN PERFIL'
    ELSE '✗ AÚN HAY ' || COUNT(*) || ' USUARIOS SIN PERFIL'
  END as verification_result
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
