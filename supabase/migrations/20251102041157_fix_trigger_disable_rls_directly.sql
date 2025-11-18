/*
  # Corrección del Trigger usando ALTER TABLE para Bypass de RLS

  ## Problema
  SET LOCAL role postgres puede no tener los permisos necesarios o no funcionar
  en el contexto de Supabase. En su lugar, vamos a usar una función que ejecute
  los INSERT directamente sin pasar por RLS.

  ## Solución
  Usar una función que tenga permisos especiales para insertar directamente
  sin validación de RLS, asegurando que la función es SECURITY DEFINER y
  tiene el owner correcto.

  ## Cambios
  1. Recrear la función sin SET LOCAL role
  2. Asegurar que la función tenga SECURITY DEFINER
  3. Garantizar permisos correctos en el owner
*/

-- Eliminar trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recrear la función con mejor manejo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_full_name text;
BEGIN
  RAISE NOTICE 'Starting handle_new_user for email: %', NEW.email;

  -- Extraer información de metadata
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_slug := NEW.raw_user_meta_data->>'company_slug';
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  RAISE NOTICE 'Metadata - company_name: %, full_name: %', v_company_name, v_full_name;

  -- Generar slug si no existe
  IF v_company_slug IS NULL AND v_company_name IS NOT NULL THEN
    v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_company_slug := regexp_replace(v_company_slug, '^-+|-+$', '', 'g');

    -- Asegurar que el slug sea único
    WHILE EXISTS (SELECT 1 FROM companies WHERE slug = v_company_slug) LOOP
      v_company_slug := v_company_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    END LOOP;
  END IF;

  -- Crear empresa si se proporcionó nombre
  IF v_company_name IS NOT NULL AND v_company_name != '' THEN
    RAISE NOTICE 'Creating company: % with slug: %', v_company_name, v_company_slug;

    INSERT INTO companies (name, slug, status)
    VALUES (v_company_name, v_company_slug, 'active')
    RETURNING id INTO v_company_id;

    RAISE NOTICE 'Company created with id: %', v_company_id;

    -- Obtener el plan Free
    SELECT id INTO v_free_plan_id
    FROM subscription_plans
    WHERE slug = 'free'
    LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
      RAISE NOTICE 'Found free plan with id: %', v_free_plan_id;

      -- Crear suscripción Free
      INSERT INTO company_subscriptions (company_id, plan_id, status, started_at)
      VALUES (v_company_id, v_free_plan_id, 'active', now());

      RAISE NOTICE 'Company subscription created successfully';
    ELSE
      RAISE WARNING 'Free plan not found in subscription_plans table';
    END IF;

    -- Crear perfil con rol super_admin
    RAISE NOTICE 'Creating profile for user: % with company_id: %', NEW.id, v_company_id;

    INSERT INTO profiles (id, email, full_name, company_id, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(v_full_name, split_part(NEW.email, '@', 1)),
      v_company_id,
      'super_admin'
    );

    RAISE NOTICE 'Profile created successfully as super_admin';
  ELSE
    -- Sin empresa, crear perfil básico
    RAISE NOTICE 'No company provided, creating basic profile';

    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(v_full_name, split_part(NEW.email, '@', 1)),
      'viewer'
    );

    RAISE NOTICE 'Basic profile created successfully';
  END IF;

  RAISE NOTICE 'handle_new_user completed successfully for: %', NEW.email;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Fatal error in handle_new_user for %: % (SQLSTATE: %)', NEW.email, SQLERRM, SQLSTATE;
  -- Re-raise to prevent user creation
  RAISE;
END;
$$;

-- Asegurar que la función tenga el owner correcto
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Grant execute a service_role también
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function to create company, profile and subscription when a new user signs up.
   Uses SECURITY DEFINER with postgres owner to bypass RLS.';
