-- ============================================================================
-- Función: Obtener estadísticas globales de presupuestos con filtros (V2 - Robusta)
-- ============================================================================
DROP FUNCTION IF EXISTS fn_get_presupuestos_stats(uuid, uuid, uuid, text, text, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS fn_get_presupuestos_stats(uuid, text, text, text, text, text, text, text, boolean, boolean);

CREATE OR REPLACE FUNCTION fn_get_presupuestos_stats(
  p_company_id uuid,
  p_vendedor_id text DEFAULT NULL,
  p_cliente_id text DEFAULT NULL,
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL,
  p_canal_venta text DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_solo_vencidos boolean DEFAULT false,
  p_solo_pendientes_respuesta boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_fecha_desde timestamptz;
  v_fecha_hasta timestamptz;
  v_vendedor_id uuid;
  v_cliente_id uuid;
BEGIN
  -- Castings seguros
  IF p_fecha_desde IS NOT NULL AND p_fecha_desde <> '' THEN v_fecha_desde := p_fecha_desde::timestamptz; END IF;
  IF p_fecha_hasta IS NOT NULL AND p_fecha_hasta <> '' THEN v_fecha_hasta := p_fecha_hasta::timestamptz; END IF;
  IF p_vendedor_id IS NOT NULL AND p_vendedor_id <> '' THEN v_vendedor_id := p_vendedor_id::uuid; END IF;
  IF p_cliente_id IS NOT NULL AND p_cliente_id <> '' THEN v_cliente_id := p_cliente_id::uuid; END IF;

  WITH filtered_presupuestos AS (
    SELECT 
      p.*
    FROM presupuestos p
    LEFT JOIN clients c ON c.id = p.cliente_id
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
        p.numero_presupuesto ILIKE '%' || p_search_term || '%' OR
        c.razon_social ILIKE '%' || p_search_term || '%' OR
        c.nombre_fantasia ILIKE '%' || p_search_term || '%' OR
        c.email ILIKE '%' || p_search_term || '%'
      )
  ),
  stats AS (
    SELECT
      COUNT(*)::integer as total_count,
      COUNT(*) FILTER (WHERE estado = 'borrador')::integer as borrador_count,
      COUNT(*) FILTER (WHERE estado = 'enviado')::integer as enviado_count,
      COUNT(*) FILTER (WHERE estado = 'aprobado')::integer as aprobado_count,
      COUNT(*) FILTER (WHERE estado = 'rechazado')::integer as rechazado_count,
      COUNT(*) FILTER (WHERE estado = 'convertido')::integer as convertido_count,
      COUNT(*) FILTER (WHERE estado = 'vencido')::integer as vencido_count,
      COUNT(*) FILTER (
        WHERE estado = 'enviado' 
        AND fecha_validez IS NOT NULL 
        AND fecha_validez >= now() 
        AND fecha_validez <= (now() + interval '7 days')
      )::integer as por_vencer_count,
      COALESCE(SUM(total), 0)::numeric as valor_total,
      COALESCE(SUM(total) FILTER (WHERE estado IN ('enviado', 'pendiente')), 0)::numeric as valor_en_negociacion,
      COUNT(*) FILTER (
        WHERE estado = 'borrador'
        AND EXISTS (
          SELECT 1
          FROM presupuestos_items pi
          WHERE pi.presupuesto_id = filtered_presupuestos.id
            AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
        )
      )::integer as pendientes_cotizar_count
    FROM filtered_presupuestos
  )
  SELECT row_to_json(stats) INTO v_result FROM stats;

  RETURN v_result;
END;
$$;
