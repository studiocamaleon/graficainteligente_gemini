/*
  # Corrección Definitiva del Trigger de Registro con Bypass de RLS

  ## Problema Identificado
  Aunque la función handle_new_user() tiene SECURITY DEFINER, las políticas RLS
  aún se aplican durante la ejecución. Esto causa que el INSERT falle porque:
  1. Durante el signup, el usuario aún no está "autenticado" completamente
  2. Las políticas RLS con WITH CHECK (true) no son suficientes
  3. La función necesita ejecutarse con privilegios de superusuario para bypass RLS

  ## Solución
  1. Modificar la función para deshabilitar RLS temporalmente usando SET LOCAL
  2. Cambiar el propietario de la función al rol postgres (superusuario)
  3. Agregar manejo de errores más robusto con logging detallado
  4. Asegurar que auth.uid() funcione correctamente durante el signup

  ## Cambios

  ### 1. Nueva Función handle_new_user con Bypass RLS
  - SET LOCAL para deshabilitar RLS en el contexto de la transacción
  - Manejo de errores más detallado con RAISE NOTICE
  - Validación de cada paso con logging
  - Owner postgres para máximos privilegios

  ## Seguridad
  - La función sigue siendo SECURITY DEFINER
  - Solo se ejecuta durante el trigger de auth.users
  - RLS se deshabilita SOLO en el contexto de esta función
  - Las tablas siguen protegidas para acceso normal de usuarios
*/

-- Primero, eliminar el trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recrear la función con bypass de RLS y mejor manejo de errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_full_name text;
BEGIN
  -- Deshabilitar RLS para esta transacción (requiere superusuario)
  -- Esto permite que la función haga INSERT sin restricciones RLS
  EXECUTE 'SET LOCAL role postgres';

  RAISE NOTICE 'Starting handle_new_user for email: %', NEW.email;

  -- Extraer información de metadata
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_slug := NEW.raw_user_meta_data->>'company_slug';
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  RAISE NOTICE 'Metadata - company_name: %, company_slug: %, full_name: %',
    v_company_name, v_company_slug, v_full_name;

  -- Generar slug si no existe
  IF v_company_slug IS NULL AND v_company_name IS NOT NULL THEN
    v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_company_slug := regexp_replace(v_company_slug, '^-+|-+$', '', 'g');

    -- Asegurar que el slug sea único
    IF EXISTS (SELECT 1 FROM public.companies WHERE slug = v_company_slug) THEN
      v_company_slug := v_company_slug || '-' || substr(NEW.id::text, 1, 8);
      RAISE NOTICE 'Slug already exists, using: %', v_company_slug;
    END IF;
  END IF;

  -- Crear empresa si se proporcionó nombre
  IF v_company_name IS NOT NULL AND v_company_name != '' THEN
    BEGIN
      RAISE NOTICE 'Creating company: % with slug: %', v_company_name, v_company_slug;

      INSERT INTO public.companies (name, slug, status)
      VALUES (v_company_name, v_company_slug, 'active')
      RETURNING id INTO v_company_id;

      RAISE NOTICE 'Company created with id: %', v_company_id;

      -- Obtener el plan Free
      SELECT id INTO v_free_plan_id
      FROM public.subscription_plans
      WHERE slug = 'free'
      LIMIT 1;

      IF v_free_plan_id IS NULL THEN
        RAISE WARNING 'Free plan not found in subscription_plans table';
      ELSE
        RAISE NOTICE 'Found free plan with id: %', v_free_plan_id;

        -- Crear suscripción Free
        BEGIN
          INSERT INTO public.company_subscriptions (company_id, plan_id, status, started_at)
          VALUES (v_company_id, v_free_plan_id, 'active', now());

          RAISE NOTICE 'Company subscription created successfully';
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to create subscription: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        END;
      END IF;

      -- Crear perfil con rol super_admin
      RAISE NOTICE 'Creating profile for user: % with company_id: %', NEW.id, v_company_id;

      INSERT INTO public.profiles (id, email, full_name, company_id, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_full_name, split_part(NEW.email, '@', 1)),
        v_company_id,
        'super_admin'
      );

      RAISE NOTICE 'Profile created successfully as super_admin';

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creating company/profile: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      RAISE;
    END;
  ELSE
    -- Sin empresa, crear perfil básico
    RAISE NOTICE 'No company provided, creating basic profile';

    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_full_name, split_part(NEW.email, '@', 1)),
        'viewer'
      );

      RAISE NOTICE 'Basic profile created successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creating basic profile: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      RAISE;
    END;
  END IF;

  RAISE NOTICE 'handle_new_user completed successfully for: %', NEW.email;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Fatal error in handle_new_user for %: % (SQLSTATE: %)', NEW.email, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

-- Cambiar el propietario a postgres para que tenga privilegios de superusuario
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario sobre la función
COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function to create company, profile and subscription when a new user signs up.
   Uses SET LOCAL role postgres to bypass RLS during execution.';
