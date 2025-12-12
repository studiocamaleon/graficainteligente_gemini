/*
  # Client Lookup RPC
  
  Creates fn_api_get_client_by_document to allow apps to check if a client exists
  and retrieve their details for autocomplete forms.
  
  SECURITY:
  - SECURITY DEFINER: Allows guest users (App) to look up clients without full RLS access.
  - Returns only safe/contact info.
*/

CREATE OR REPLACE FUNCTION fn_api_get_client_by_document(
  p_company_id uuid,
  p_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client record;
BEGIN
  -- Buscar cliente por documento en la empresa
  SELECT 
    id,
    nombre_fantasia,
    razon_social,
    tipo_documento,
    numero_documento,
    whatsapp,
    email,
    domicilio,
    city_id,
    province_id,
    country_id
  INTO v_client
  FROM clients
  WHERE company_id = p_company_id
  AND numero_documento = p_documento
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'found', true,
      'client', jsonb_build_object(
        'id', v_client.id,
        'nombre', v_client.nombre_fantasia,
        'razon_social', v_client.razon_social,
        'tipo_documento', v_client.tipo_documento,
        'documento', v_client.numero_documento,
        'telefono', v_client.whatsapp,
        'email', v_client.email,
        'domicilio', v_client.domicilio,
        'city_id', v_client.city_id,
        'province_id', v_client.province_id
      )
    );
  ELSE
    RETURN jsonb_build_object(
      'found', false
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'found', false,
    'error', SQLERRM
  );
END;
$$;
