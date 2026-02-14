-- List clients with LTV metrics and server-side sorting/pagination.
-- LTV = ventas OT no canceladas + ventas Centro Copiado no canceladas.

DROP FUNCTION IF EXISTS fn_list_clients_with_ltv(uuid, text, boolean, boolean, text, text, int, int);

CREATE OR REPLACE FUNCTION fn_list_clients_with_ltv(
  p_company_id uuid,
  p_search_term text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_has_cuenta_corriente boolean DEFAULT NULL,
  p_status_aprobacion text DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at_desc',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  nombre_fantasia text,
  razon_social text,
  tipo_documento text,
  numero_documento text,
  whatsapp text,
  email text,
  domicilio text,
  country_id uuid,
  province_id uuid,
  city_id uuid,
  codigo_postal text,
  tiene_cuenta_corriente boolean,
  acuerdo_pago text,
  dia_cierre_semanal int,
  dia_cierre_mensual int,
  usa_ultimo_dia_mes boolean,
  dias_vencimiento int,
  is_active boolean,
  created_by uuid,
  updated_by uuid,
  app_pin text,
  created_at timestamptz,
  updated_at timestamptz,
  status_aprobacion text,
  ltv_total numeric,
  full_count bigint,
  avg_ltv numeric,
  avg_ltv_global numeric,
  total_ltv numeric
) AS $$
DECLARE
  v_search_term text := trim(COALESCE(p_search_term, ''));
BEGIN
  RETURN QUERY
  WITH ventas_ot AS (
    SELECT
      ot.cliente_id,
      SUM(COALESCE(ot.total, 0)) AS total_ot
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado <> 'cancelada'
      AND ot.cliente_id IS NOT NULL
    GROUP BY ot.cliente_id
  ),
  ventas_cc AS (
    SELECT
      cc.cliente_id,
      SUM(COALESCE(cc.total, 0)) AS total_cc
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.estado <> 'cancelada'
      AND cc.cliente_id IS NOT NULL
    GROUP BY cc.cliente_id
  ),
  ltv_por_cliente AS (
    SELECT
      c.id AS cliente_id,
      (COALESCE(vo.total_ot, 0) + COALESCE(vc.total_cc, 0))::numeric AS ltv_total
    FROM clients c
    LEFT JOIN ventas_ot vo ON vo.cliente_id = c.id
    LEFT JOIN ventas_cc vc ON vc.cliente_id = c.id
    WHERE c.company_id = p_company_id
  ),
  filtered AS (
    SELECT
      c.*,
      COALESCE(lpc.ltv_total, 0)::numeric AS ltv_total
    FROM clients c
    LEFT JOIN ltv_por_cliente lpc ON lpc.cliente_id = c.id
    WHERE c.company_id = p_company_id
      AND (p_is_active IS NULL OR c.is_active = p_is_active)
      AND (p_has_cuenta_corriente IS NULL OR c.tiene_cuenta_corriente = p_has_cuenta_corriente)
      AND (p_status_aprobacion IS NULL OR c.status_aprobacion = p_status_aprobacion)
      AND (
        v_search_term = ''
        OR c.nombre_fantasia ILIKE '%' || v_search_term || '%'
        OR c.razon_social ILIKE '%' || v_search_term || '%'
        OR c.numero_documento ILIKE '%' || v_search_term || '%'
      )
  )
  SELECT
    f.id,
    f.company_id,
    f.nombre_fantasia,
    f.razon_social,
    f.tipo_documento,
    f.numero_documento,
    f.whatsapp,
    f.email,
    f.domicilio,
    f.country_id,
    f.province_id,
    f.city_id,
    f.codigo_postal,
    f.tiene_cuenta_corriente,
    f.acuerdo_pago,
    f.dia_cierre_semanal,
    f.dia_cierre_mensual,
    f.usa_ultimo_dia_mes,
    f.dias_vencimiento,
    f.is_active,
    f.created_by,
    f.updated_by,
    f.app_pin,
    f.created_at,
    f.updated_at,
    f.status_aprobacion,
    f.ltv_total,
    COUNT(*) OVER() AS full_count,
    AVG(NULLIF(f.ltv_total, 0)) OVER() AS avg_ltv,
    AVG(f.ltv_total) OVER() AS avg_ltv_global,
    SUM(f.ltv_total) OVER() AS total_ltv
  FROM filtered f
  ORDER BY
    CASE WHEN p_sort_by = 'ltv_desc' THEN f.ltv_total END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'name_asc' THEN lower(f.nombre_fantasia) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at_desc' THEN f.created_at END DESC NULLS LAST,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
