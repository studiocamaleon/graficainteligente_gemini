-- ============================================================================
-- Función: Búsqueda avanzada de presupuestos con todos los filtros (V2 - Robusta)
-- ============================================================================
DROP FUNCTION IF EXISTS fn_search_presupuestos_v2(uuid, text, int, int, text, uuid, uuid, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS fn_search_presupuestos_v2(uuid, text, int, int, text, text, text, text, text, text, boolean, boolean);

CREATE OR REPLACE FUNCTION fn_search_presupuestos_v2(
  p_company_id uuid,
  p_search_term text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_estado text DEFAULT NULL,
  p_vendedor_id text DEFAULT NULL,
  p_cliente_id text DEFAULT NULL,
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL,
  p_canal_venta text DEFAULT NULL,
  p_solo_vencidos boolean DEFAULT false,
  p_solo_pendientes_respuesta boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  numero_presupuesto text,
  fecha_creacion timestamptz,
  fecha_validez timestamptz,
  cliente_id uuid,
  vendedor_id uuid,
  estado text,
  canal_venta text,
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
DECLARE
  v_fecha_desde timestamptz;
  v_fecha_hasta timestamptz;
  v_vendedor_id uuid;
  v_cliente_id uuid;
BEGIN
  -- Castings
  IF p_fecha_desde IS NOT NULL AND p_fecha_desde <> '' THEN v_fecha_desde := p_fecha_desde::timestamptz; END IF;
  IF p_fecha_hasta IS NOT NULL AND p_fecha_hasta <> '' THEN v_fecha_hasta := p_fecha_hasta::timestamptz; END IF;
  IF p_vendedor_id IS NOT NULL AND p_vendedor_id <> '' THEN v_vendedor_id := p_vendedor_id::uuid; END IF;
  IF p_cliente_id IS NOT NULL AND p_cliente_id <> '' THEN v_cliente_id := p_cliente_id::uuid; END IF;

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
      p.canal_venta,
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
      AND (v_vendedor_id IS NULL OR p.vendedor_id = v_vendedor_id)
      AND (v_cliente_id IS NULL OR p.cliente_id = v_cliente_id)
      AND (v_fecha_desde IS NULL OR p.fecha_creacion >= v_fecha_desde)
      AND (v_fecha_hasta IS NULL OR p.fecha_creacion <= v_fecha_hasta)
      AND (p_canal_venta IS NULL OR p_canal_venta = '' OR p.canal_venta = p_canal_venta)
      AND (p_estado IS NULL OR p_estado = '' OR p.estado = p_estado)
      AND (NOT p_solo_vencidos OR p.estado = 'vencido')
      AND (NOT p_solo_pendientes_respuesta OR p.estado = 'enviado')
      AND (
        p_search_term IS NULL OR 
        p_search_term = '' OR 
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
