-- Reparar usuarios huérfanos (sin perfil)
DO $$
DECLARE
    user_record RECORD;
    company_id_val uuid;
    free_plan_id uuid;
BEGIN
    -- Iterar sobre usuarios que están en auth.users pero NO en public.profiles
    FOR user_record IN 
        SELECT * FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.profiles)
    LOOP
        RAISE NOTICE 'Reparando usuario huérfano: %', user_record.email;

        -- 1. Intentar buscar si se creó una compañía recientemente (últimos 10 min) que no tenga usuarios?
        -- O simplemente usar la primera compañía disponible para salir del paso.
        SELECT id INTO company_id_val FROM public.companies ORDER BY created_at DESC LIMIT 1;

        -- Si no existe ninguna compañía, crear una genérica
        IF company_id_val IS NULL THEN
            INSERT INTO public.companies (name, slug, status)
            VALUES ('Empresa Default', 'default-company', 'active')
            RETURNING id INTO company_id_val;
            
            -- Asignarle plan Free
            SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1;
            
            IF free_plan_id IS NOT NULL THEN
                INSERT INTO public.company_subscriptions (company_id, plan_id, status)
                VALUES (company_id_val, free_plan_id, 'active');
            END IF;
        END IF;

        -- 2. Insertar el perfil faltante
        INSERT INTO public.profiles (
            id, 
            email, 
            full_name, 
            company_id, 
            role
        ) VALUES (
            user_record.id,
            user_record.email,
            COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
            company_id_val,
            'super_admin'  -- Forzar super_admin para que tenga acceso completo
        );
        
        RAISE NOTICE 'Perfil creado para % asignado a company_id %', user_record.email, company_id_val;
    END LOOP;
END $$;
