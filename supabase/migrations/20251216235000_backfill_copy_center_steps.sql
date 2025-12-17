-- Migration to backfill Copy Center steps for all companies
-- Updated to use "Centro de Copiado" station as preferred

DO $$
DECLARE
    company_rec RECORD;
    estacion_id uuid;
    step_name text;
    step_names text[] := ARRAY['Anillado', 'Plastificado', 'Guillotinado'];
BEGIN
    -- Iterate over all companies
    FOR company_rec IN SELECT id FROM companies
    LOOP
        -- 1. Ensure 'Centro de Copiado' station exists
        SELECT id INTO estacion_id
        FROM estaciones_trabajo
        WHERE company_id = company_rec.id AND nombre ILIKE 'Centro de Copiado%';

        IF estacion_id IS NULL THEN
            INSERT INTO estaciones_trabajo (company_id, nombre, descripcion)
            VALUES (company_rec.id, 'Centro de Copiado', 'Estación unificada para servicios de copiado y terminaciones rápidas')
            RETURNING id INTO estacion_id;
            
            RAISE NOTICE 'Created station Centro de Copiado for company %', company_rec.id;
        END IF;

        -- 2. Ensure Steps exist linked to THIS station
        FOREACH step_name IN ARRAY step_names
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pasos 
                WHERE company_id = company_rec.id 
                AND nombre ILIKE step_name || '%'
            ) THEN
                INSERT INTO pasos (company_id, nombre, etapa, estacion_id)
                VALUES (company_rec.id, step_name, 'Terminacion', estacion_id);
                
                RAISE NOTICE 'Created step % for company %', step_name, company_rec.id;
            END IF;
        END LOOP;

    END LOOP;
END $$;
