-- Function to get config for public booking page
-- Returns only necessary fields
CREATE OR REPLACE FUNCTION public.get_visitas_config_public(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config json;
BEGIN
    SELECT json_build_object(
        'dias_habilitados', dias_habilitados,
        'horarios_disponibles', horarios_disponibles,
        'duracion_slot', duracion_slot,
        'deshabilitar_visitas_hoy', deshabilitar_visitas_hoy,
        'bloqueos', bloqueos,
        'hora_inicio', hora_inicio, -- Legacy support
        'hora_fin', hora_fin        -- Legacy support
    )
    INTO v_config
    FROM visitas_config
    WHERE company_id = p_company_id;

    RETURN v_config;
END;
$$;

-- Function to get busy slots (start/end) to calculate availability
-- Does NOT expose client names or details
CREATE OR REPLACE FUNCTION public.get_busy_slots_public(
    p_company_id uuid, 
    p_start timestamp with time zone, 
    p_end timestamp with time zone
)
RETURNS TABLE (
    fecha_inicio timestamp with time zone,
    fecha_fin timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT v.fecha_inicio, v.fecha_fin
    FROM visitas v
    WHERE v.company_id = p_company_id
    AND v.fecha_inicio >= p_start
    AND v.fecha_fin <= p_end
    AND v.estado != 'cancelada';
END;
$$;

-- Function to create a visit publicly
CREATE OR REPLACE FUNCTION public.create_public_visit(
    p_company_id uuid,
    p_cliente_nombre text,
    p_cliente_whatsapp text,
    p_domicilio text,
    p_fecha_inicio timestamp with time zone,
    p_fecha_fin timestamp with time zone,
    p_titulo text DEFAULT 'Visita Web',
    p_notas text DEFAULT null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_visita_id uuid;
    v_exists boolean;
BEGIN
    -- 1. Validate Overlaps (Primitive check, ideally consistent with logic but this is the safety net)
    SELECT EXISTS (
        SELECT 1 FROM visitas v
        WHERE v.company_id = p_company_id
        AND v.estado != 'cancelada'
        AND (
            (p_fecha_inicio < v.fecha_fin AND p_fecha_fin > v.fecha_inicio)
        )
    ) INTO v_exists;

    IF v_exists THEN
        RAISE EXCEPTION 'El horario seleccionado ya está ocupado.';
    END IF;

    -- 2. Insert Visit
    INSERT INTO visitas (
        company_id,
        titulo,
        cliente_nombre,
        cliente_whatsapp,
        domicilio,
        fecha_inicio,
        fecha_fin,
        estado,
        descripcion,
        creado_por, -- Null for public
        notif_cliente_creacion_env,
        notif_staff_creacion_env,
        notif_cliente_1h_env,
        notif_staff_30m_env
    ) VALUES (
        p_company_id,
        p_titulo,
        p_cliente_nombre,
        p_cliente_whatsapp,
        p_domicilio,
        p_fecha_inicio,
        p_fecha_fin,
        'confirmada', -- Auto-confirm for simple flow
        p_notas,
        null,
        false, -- Not sent yet
        false,
        false,
        false
    )
    RETURNING id INTO v_visita_id;

    RETURN json_build_object('id', v_visita_id, 'status', 'success');
END;
$$;

-- Grant access to anon for these functions
GRANT EXECUTE ON FUNCTION public.get_visitas_config_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_busy_slots_public(uuid, timestamp with time zone, timestamp with time zone) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_visit(uuid, text, text, text, timestamp with time zone, timestamp with time zone, text, text) TO anon, authenticated;
