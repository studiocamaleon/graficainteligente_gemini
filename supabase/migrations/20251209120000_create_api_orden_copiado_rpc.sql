/*
  # API RPC v2: Create Orden Copiado con "Find or Create Client"

  ## Descripción
  Versión mejorada que maneja la lógica de cliente:
  - Si se recibe p_cliente_id, se usa ese.
  - Si se recibe p_cliente_info, se busca por documento en la empresa.
  - Si no existe, se crea el cliente automáticamente.
*/

CREATE OR REPLACE FUNCTION fn_api_create_orden_copiado(
  p_company_id uuid,
  p_user_id uuid,
  p_cliente_id uuid, -- Puede ser NULL
  p_cliente_info jsonb, -- { nombre, documento, email, telefono, tipo_documento }
  p_items jsonb,
  p_archivos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_final_id uuid;
  v_orden_trabajo_id uuid;
  v_orden_copiado_id uuid;
  v_numero_orden text;
  v_item jsonb;
  v_archivo_id uuid;
  v_item_id uuid;
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
        (p_cliente_info->>'nombre'), -- Usamos nombre como razon social default
        COALESCE(p_cliente_info->>'tipo_documento', 'DNI'),
        (p_cliente_info->>'documento'),
        (p_cliente_info->>'email'),
        (p_cliente_info->>'telefono'),
        p_user_id,
        true
      ) RETURNING id INTO v_cliente_final_id;
    END IF;
  END IF;

  -- 2. Generar número de orden
  v_numero_orden := generate_numero_orden(p_company_id);

  -- 3. Insertar Orden de Trabajo
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    vendedor_id,
    canal_venta,
    estado,
    numero_orden,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    v_cliente_final_id,
    p_user_id,
    'Web', 
    'borrador',
    v_numero_orden,
    p_user_id,
    p_user_id
  ) RETURNING id INTO v_orden_trabajo_id;

  -- 4. Insertar Orden de Copiado
  INSERT INTO centro_copiado_ordenes (
    company_id,
    numero_orden,
    orden_trabajo_id,
    cliente_id,
    estado,
    created_by
  ) VALUES (
    p_company_id,
    v_numero_orden,
    v_orden_trabajo_id,
    v_cliente_final_id,
    'pendiente',
    p_user_id
  ) RETURNING id INTO v_orden_copiado_id;

  -- 5. Insertar Items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
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
        (v_item->>'precio_unitario')::numeric,
        (v_item->>'subtotal')::numeric,
        (v_item->>'descripcion')
      ) RETURNING id INTO v_item_id;
    END LOOP;
  END IF;

  -- 6. Vincular Archivos
  IF p_archivos IS NOT NULL AND jsonb_array_length(p_archivos) > 0 THEN
    FOR v_archivo_id IN SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_archivos)
    LOOP
      UPDATE centro_copiado_ordenes_archivos
      SET orden_copiado_id = v_orden_copiado_id
      WHERE id = v_archivo_id AND company_id = p_company_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'orden_id', v_orden_trabajo_id,
    'copiado_id', v_orden_copiado_id,
    'numero_orden', v_numero_orden,
    'cliente_id', v_cliente_final_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
