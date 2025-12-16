CREATE OR REPLACE FUNCTION fn_search_presupuestos(
  p_search_term text,
  p_company_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  numero_presupuesto text,
  fecha_creacion timestamptz,
  fecha_validez timestamptz,
  cliente_id uuid,
  vendedor_id uuid,
  estado text,
  total numeric,
  company_id uuid,
  cliente_razon_social text,
  cliente_nombre_fantasia text,
  cliente_email text,
  vendedor_full_name text,
  orden_trabajo_id uuid,
  orden_trabajo_numero text,
  items_count bigint,
  full_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_presupuestos AS (
    SELECT
      p.id,
      p.numero_presupuesto,
      p.fecha_creacion,
      p.fecha_validez,
      p.cliente_id,
      p.vendedor_id,
      p.estado,
      p.total,
      p.company_id,
      c.razon_social as cliente_razon_social,
      c.nombre_fantasia as cliente_nombre_fantasia,
      c.email as cliente_email,
      prof.full_name as vendedor_full_name,
      ot.id as orden_trabajo_id,
      ot.numero_orden as orden_trabajo_numero,
      (SELECT count(*) FROM presupuestos_items pi WHERE pi.presupuesto_id = p.id) as items_count
    FROM presupuestos p
    LEFT JOIN clients c ON p.cliente_id = c.id
    LEFT JOIN profiles prof ON p.vendedor_id = prof.id
    LEFT JOIN ordenes_trabajo ot ON p.orden_trabajo_id = ot.id
    WHERE p.company_id = p_company_id
      AND (
        p.numero_presupuesto ILIKE '%' || p_search_term || '%'
        OR c.razon_social ILIKE '%' || p_search_term || '%'
        OR c.nombre_fantasia ILIKE '%' || p_search_term || '%'
        OR c.email ILIKE '%' || p_search_term || '%'
      )
  )
  SELECT
    fp.*,
    (SELECT COUNT(*) FROM filtered_presupuestos)::bigint as full_count
  FROM filtered_presupuestos fp
  ORDER BY fp.fecha_creacion DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
