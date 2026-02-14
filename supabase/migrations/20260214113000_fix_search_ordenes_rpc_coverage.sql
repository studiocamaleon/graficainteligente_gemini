-- Ensure search covers all orders (including those without related client row)
-- and normalizes the search term.

DROP FUNCTION IF EXISTS fn_search_ordenes_trabajo(text, uuid, int, int);

CREATE OR REPLACE FUNCTION fn_search_ordenes_trabajo(
  p_search_term text,
  p_company_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  estado text,
  total numeric,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  items_count bigint,
  total_pagado numeric,
  full_count bigint
) AS $$
DECLARE
  v_term text := trim(COALESCE(p_search_term, ''));
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.fecha_creacion,
    ot.estado,
    ot.total,
    c.id as cliente_id,
    c.nombre_fantasia as cliente_nombre,
    c.numero_documento as cliente_documento,
    (SELECT count(*) FROM ordenes_trabajo_items oti WHERE oti.orden_id = ot.id) as items_count,
    COALESCE((SELECT sum(otp.monto) FROM ordenes_trabajo_pagos otp WHERE otp.orden_id = ot.id), 0) as total_pagado,
    COUNT(*) OVER() as full_count
  FROM ordenes_trabajo ot
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE
    ot.company_id = p_company_id
    AND (
      ot.numero_orden ILIKE '%' || v_term || '%'
      OR COALESCE(c.nombre_fantasia, '') ILIKE '%' || v_term || '%'
      OR COALESCE(c.numero_documento, '') ILIKE '%' || v_term || '%'
    )
  ORDER BY ot.fecha_creacion DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
