-- Add app_pin column to clients table for simple guest authentication
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS app_pin text CHECK (app_pin ~ '^\d{4}$');

-- Create RPC for Guest Login
-- Returns JSON with success status and client data if valid

CREATE OR REPLACE FUNCTION fn_api_login_guest(
  p_company_id uuid,
  p_documento text,
  p_clave text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client record;
BEGIN
  -- 1. Buscar Cliente
  SELECT * INTO v_client
  FROM clients
  WHERE company_id = p_company_id
  AND numero_documento = p_documento;

  -- 2. Validar Existencia
  IF v_client IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Documento no encontrado'
    );
  END IF;

  -- 3. Validar PIN
  -- Nota: Si el cliente no tiene PIN configurado, no puede entrar (o se podría definir politica distinta)
  IF v_client.app_pin IS NULL OR v_client.app_pin != p_clave THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Clave incorrecta'
    );
  END IF;

  -- 4. Éxito
  RETURN jsonb_build_object(
    'success', true,
    'client', jsonb_build_object(
      'id', v_client.id,
      'nombre', v_client.nombre_fantasia,
      'email', v_client.email,
      'whatsapp', v_client.whatsapp,
      'documento', v_client.numero_documento
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

-- Grant access to anonymous users (for the App Login screen)
GRANT EXECUTE ON FUNCTION fn_api_login_guest(uuid, text, text) TO anon, authenticated, service_role;
