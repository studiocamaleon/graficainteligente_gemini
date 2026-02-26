-- Update OT search RPC to support draft filters

DROP FUNCTION IF EXISTS public.fn_search_ordenes_trabajo(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.fn_search_ordenes_trabajo(
  p_search_term text,
  p_company_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_include_drafts boolean DEFAULT false,
  p_drafts_only boolean DEFAULT false
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
  v_term_lower text := lower(trim(COALESCE(p_search_term, '')));
  v_term_digits text := regexp_replace(COALESCE(p_search_term, ''), '[^0-9]', '', 'g');
  v_term_alnum text := regexp_replace(lower(COALESCE(p_search_term, '')), '[^a-z0-9]', '', 'g');
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
    (SELECT count(*) FROM public.ordenes_trabajo_items oti WHERE oti.orden_id = ot.id) as items_count,
    COALESCE((SELECT sum(otp.monto) FROM public.ordenes_trabajo_pagos otp WHERE otp.orden_id = ot.id), 0) as total_pagado,
    COUNT(*) OVER() as full_count
  FROM public.ordenes_trabajo ot
  LEFT JOIN public.clients c ON ot.cliente_id = c.id
  WHERE
    ot.company_id = p_company_id
    AND (
      (p_drafts_only = true AND ot.estado = 'borrador')
      OR (
        p_drafts_only = false
        AND (
          p_include_drafts = true
          OR ot.estado <> 'borrador'
        )
      )
    )
    AND (
      ot.numero_orden ILIKE '%' || v_term || '%'
      OR lower(COALESCE(c.nombre_fantasia, '')) LIKE '%' || v_term_lower || '%'
      OR lower(COALESCE(c.razon_social, '')) LIKE '%' || v_term_lower || '%'
      OR (
        v_term_digits <> ''
        AND (
          regexp_replace(COALESCE(c.numero_documento, ''), '[^0-9]', '', 'g') LIKE '%' || v_term_digits || '%'
          OR regexp_replace(COALESCE(c.whatsapp, ''), '[^0-9]', '', 'g') LIKE '%' || v_term_digits || '%'
        )
      )
      OR (
        v_term_alnum <> ''
        AND (
          regexp_replace(lower(COALESCE(c.nombre_fantasia, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_term_alnum || '%'
          OR regexp_replace(lower(COALESCE(c.razon_social, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_term_alnum || '%'
        )
      )
    )
  ORDER BY ot.fecha_creacion DESC, ot.id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
