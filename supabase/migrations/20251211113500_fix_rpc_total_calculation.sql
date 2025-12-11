/*
  # Fix RPC Total Calculation
  
  Updates fn_api_create_orden_copiado to:
  1. Calculate the total order amount by summing item subtotals.
  2. Update the centro_copiado_ordenes record with the calculated total.
*/

CREATE OR REPLACE FUNCTION fn_api_create_orden_copiado(
  p_company_id uuid,
  p_user_id uuid,
  p_cliente_id uuid,
  p_cliente_info jsonb,
  p_items jsonb,
  p_archivos jsonb DEFAULT '[]'::jsonb,
  p_canal_venta text DEFAULT 'App Mobile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_final_id uuid;
  v_orden_copiado_id uuid;
  v_numero_orden text;
  v_item jsonb;
  v_archivo_id uuid;
  v_item_id uuid;
  v_date_str text;
  v_sequence text;
  v_count integer;
  v_total_orden numeric := 0;
  v_subtotal_item numeric;
BEGIN
  -- 1. Resolver Cliente
  IF p_cliente_id IS NOT NULL THEN
    v_cliente_final_id := p_cliente_id;
  ELSE
    -- Buscar por documento dentro de la empresa
    SELECT id INTO v_cliente_final_id
    FROM clients
    WHERE company_id = p_company_id
    AND numero_documento = (p_cliente_info->>'documento');

    -- Si no existe, crear
    IF v_cliente_final_id IS NULL THEN
      INSERT INTO clients (
        company_id,
        nombre_fantasia,
        razon_social,
        tipo_documento,
        numero_documento,
        email,
        whatsapp,
        created_by,
        is_active
      ) VALUES (
        p_company_id,
        (p_cliente_info->>'nombre'),
        (p_cliente_info->>'nombre'),
        COALESCE(p_cliente_info->>'tipo_documento', 'DNI'),
        (p_cliente_info->>'documento'),
        (p_cliente_info->>'email'),
        (p_cliente_info->>'telefono'),
        p_user_id,
        true
      ) RETURNING id INTO v_cliente_final_id;
    END IF;
  END IF;

  -- 2. Generar número de orden (Formato CC-YYYYMMDD-XXXX)
  v_date_str := to_char(now(), 'YYYYMMDD');
  
  -- Contar órdenes del día para la secuencia
  SELECT count(*) INTO v_count
  FROM centro_copiado_ordenes
  WHERE company_id = p_company_id
  AND to_char(created_at, 'YYYYMMDD') = v_date_str;

  v_sequence := LPAD((v_count + 1)::text, 4, '0');
  v_numero_orden := 'CC-' || v_date_str || '-' || v_sequence;

  -- 3. Insertar Orden de Copiado (INDEPENDIENTE)
  -- Se inserta con total 0 inicialmente
  INSERT INTO centro_copiado_ordenes (
    company_id,
    numero_orden,
    orden_trabajo_id, -- NULL, es independiente
    cliente_id,
    origen,
    estado,
    created_by,
    total
  ) VALUES (
    p_company_id,
    v_numero_orden,
    NULL, 
    v_cliente_final_id,
    p_canal_venta,
    'pendiente',
    p_user_id,
    0
  ) RETURNING id INTO v_orden_copiado_id;

  -- 4. Insertar Items y Calcular Total
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_subtotal_item := COALESCE((v_item->>'subtotal')::numeric, 0);
      
      INSERT INTO centro_copiado_ordenes_items (
        orden_copiado_id,
        tipo_item,
        tamanio_papel_id,
        papel_id,
        tipo_tinta,
        cara_impresa,
        cantidad_hojas,
        tipo_anillado,
        tipo_plastificado,
        cantidad_unidades,
        precio_unitario,
        subtotal,
        descripcion
      ) VALUES (
        v_orden_copiado_id,
        (v_item->>'tipo_item'),
        (v_item->>'tamanio_papel_id')::uuid,
        (v_item->>'papel_id')::uuid,
        (v_item->>'tipo_tinta'),
        (v_item->>'cara_impresa'),
        (v_item->>'cantidad_hojas')::integer,
        (v_item->>'tipo_anillado'),
        (v_item->>'tipo_plastificado'),
        (v_item->>'cantidad_unidades')::integer,
        COALESCE((v_item->>'precio_unitario')::numeric, 0),
        v_subtotal_item,
        (v_item->>'descripcion')
      ) RETURNING id INTO v_item_id;
      
      -- Acumular total
      v_total_orden := v_total_orden + v_subtotal_item;
    END LOOP;
    
    -- Actualizar el total de la orden
    UPDATE centro_copiado_ordenes
    SET total = v_total_orden
    WHERE id = v_orden_copiado_id;
  END IF;

  -- 5. Vincular Archivos
  IF p_archivos IS NOT NULL AND jsonb_array_length(p_archivos) > 0 THEN
    FOR v_archivo_id IN SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_archivos)
    LOOP
      UPDATE centro_copiado_ordenes_archivos
      SET 
        orden_copiado_id = v_orden_copiado_id,
        orden_temporal_id = NULL
      WHERE id = v_archivo_id AND company_id = p_company_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'copiado_id', v_orden_copiado_id,
    'numero_orden', v_numero_orden,
    'cliente_id', v_cliente_final_id,
    'total', v_total_orden
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
