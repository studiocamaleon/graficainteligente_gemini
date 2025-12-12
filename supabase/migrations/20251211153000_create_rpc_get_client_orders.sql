-- Rpc to allow App to fetch order history for a verified client
-- Returns basic order details descending by date

CREATE OR REPLACE FUNCTION fn_api_get_client_orders(
  p_company_id uuid,
  p_client_id uuid
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  estado text,
  total numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.numero_orden,
    o.estado,
    o.total,
    o.created_at
  FROM centro_copiado_ordenes o
  WHERE o.company_id = p_company_id
  AND o.cliente_id = p_client_id
  ORDER BY o.created_at DESC;
END;
$$;

-- Grant access to anonymous/authenticated users (App uses anon key usually, but function is security definer)
GRANT EXECUTE ON FUNCTION fn_api_get_client_orders(uuid, uuid) TO anon, authenticated, service_role;
