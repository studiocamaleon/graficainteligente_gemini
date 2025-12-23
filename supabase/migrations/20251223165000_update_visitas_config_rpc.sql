-- Function to get config for public booking page
-- Updated to include company name and logo
CREATE OR REPLACE FUNCTION public.get_visitas_config_public(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config json;
    v_company_name text;
    v_company_logo text;
BEGIN
    -- Get Company Details
    SELECT name, logo_url INTO v_company_name, v_company_logo
    FROM companies
    WHERE id = p_company_id;

    -- Get Config (If config doesn't exist, we might return null, so we should handle that maybe?)
    -- Assuming config exists if they are using this feature. If not, returns null.
    
    SELECT json_build_object(
        'dias_habilitados', dias_habilitados,
        'horarios_disponibles', horarios_disponibles,
        'duracion_slot', duracion_slot,
        'deshabilitar_visitas_hoy', deshabilitar_visitas_hoy,
        'bloqueos', bloqueos,
        'hora_inicio', hora_inicio, -- Legacy support
        'hora_fin', hora_fin,        -- Legacy support
        'empresa_nombre', v_company_name,
        'empresa_logo', v_company_logo
    )
    INTO v_config
    FROM visitas_config
    WHERE company_id = p_company_id;
    
    -- If no config found but company exists, return just company details with defaults? 
    -- For now logic expects config to exist.
    
    IF v_config IS NULL AND v_company_name IS NOT NULL THEN
       -- Return defaults + company info
       v_config := json_build_object(
            'dias_habilitados', json_build_array(1,2,3,4,5),
            'horarios_disponibles', json_build_array(
                json_build_object('inicio', '09:00', 'fin', '18:00')
            ),
            'duracion_slot', 60,
            'empresa_nombre', v_company_name,
            'empresa_logo', v_company_logo
       );
    END IF;

    RETURN v_config;
END;
$$;
