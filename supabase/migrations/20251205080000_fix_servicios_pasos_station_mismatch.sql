
-- MIGRACIÓN DE CORRECCIÓN DE DATOS: Sincronización Servicio-Paso-Estación
-- Esta migración intenta corregir inconsistencias donde un servicio está asignado a una estación,
-- pero su 'paso' vinculado internamente pertenece a OTRA estación diferente.

DO $$
DECLARE
    v_count_fixed INTEGER := 0;
    r RECORD;
    v_correct_paso_id UUID;
BEGIN
    RAISE NOTICE 'Iniciando diagnóstico y reparación de inconsistencias Servicio-Paso...';

    -- 1. Iterar sobre servicios que tienen paso vinculado (simple) y la estación no coincide
    FOR r IN 
        SELECT 
            s.id as servicio_id,
            s.nombre as servicio_nombre,
            s.estacion_id as estacion_esperada_id,
            es.nombre as estacion_esperada_nombre,
            sp.id as relacion_id,
            sp.paso_id as paso_actual_id,
            p.nombre as paso_actual_nombre,
            ep.nombre as estacion_actual_nombre
        FROM servicios s
        JOIN servicios_pasos sp ON sp.servicio_id = s.id
        JOIN pasos p ON p.id = sp.paso_id
        JOIN estaciones_trabajo es ON es.id = s.estacion_id
        JOIN estaciones_trabajo ep ON ep.id = p.estacion_id
        WHERE s.estacion_id != p.estacion_id
    LOOP
        RAISE NOTICE 'Desajuste encontrado: Servicio "%" (%) espera estación "%" pero tiene paso "%" en estación "%"',
            r.servicio_nombre, r.servicio_id, r.estacion_esperada_nombre, r.paso_actual_nombre, r.estacion_actual_nombre;

        -- Buscar si existe un paso "correcto" en la estación esperada con el mismo nombre del servicio o del paso actual
        SELECT id INTO v_correct_paso_id
        FROM pasos
        WHERE estacion_id = r.estacion_esperada_id
          AND (nombre = r.servicio_nombre OR nombre = r.paso_actual_nombre)
        LIMIT 1;

        IF v_correct_paso_id IS NOT NULL THEN
            RAISE NOTICE '  --> REPARANDO: Encontrado paso candidato id % en estación correcta. Actualizando...', v_correct_paso_id;
            
            UPDATE servicios_pasos
            SET paso_id = v_correct_paso_id
            WHERE id = r.relacion_id;
            
            v_count_fixed := v_count_fixed + 1;
        ELSE
            RAISE NOTICE '  --> NO SE PUEDE REPARAR AUTOMATICAMENTE: No existe un paso compatible en la estación %', r.estacion_esperada_nombre;
        END IF;

    END LOOP;

    RAISE NOTICE 'Reparación de servicios simples finalizada. Total corregidos: %', v_count_fixed;

    -- 2. (Opcional) Hacer lo mismo para niveles de precio
    -- ... (Lógica similar omitida por brevedad, nos enfocamos en el caso principal reportado)

END $$;
