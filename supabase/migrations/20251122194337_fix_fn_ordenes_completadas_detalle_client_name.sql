/*
  # Corrección Final: fn_ordenes_completadas_detalle - nombre de cliente

  ## Problema
  La función usaba cl.nombre pero la tabla clients tiene nombre_fantasia (no nombre)

  ## Esquema Verificado
  clients table:
  - nombre_fantasia (text) - nombre del cliente para mostrar
  - razon_social (text) - razón social fiscal
  
  ## Solución
  Cambiar cl.nombre -> cl.nombre_fantasia
*/

CREATE OR REPLACE FUNCTION fn_ordenes_completadas_detalle(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  orden_id uuid,
  orden_numero text,
  cliente_nombre text,
  categoria_nombre text,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  duracion_horas numeric,
  total_items bigint,
  total_pasos_completados bigint,
  estado text
) AS $$
BEGIN
  RETURN QUERY
  WITH orden_stats AS (
    SELECT
      ot.id as orden_id,
      MIN(r.fecha_inicio) as fecha_inicio,
      MAX(r.fecha_fin) as fecha_fin,
      COUNT(DISTINCT oti.id)::bigint as total_items,
      COUNT(DISTINCT r.id)::bigint as total_pasos_completados
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON oti.orden_id = ot.id
    JOIN ordenes_trabajo_items_rutas r ON r.orden_item_id = oti.id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
    GROUP BY ot.id
  )
  SELECT
    ot.id as orden_id,
    ot.numero_orden as orden_numero,
    cl.nombre_fantasia as cliente_nombre,
    COALESCE(
      (SELECT oti.producto_categoria 
       FROM ordenes_trabajo_items oti 
       WHERE oti.orden_id = ot.id 
       LIMIT 1),
      'Sin categoría'
    ) as categoria_nombre,
    os.fecha_inicio,
    os.fecha_fin,
    ROUND((EXTRACT(EPOCH FROM (os.fecha_fin - os.fecha_inicio)) / 3600.0)::numeric, 2) as duracion_horas,
    os.total_items,
    os.total_pasos_completados,
    ot.estado
  FROM orden_stats os
  JOIN ordenes_trabajo ot ON ot.id = os.orden_id
  LEFT JOIN clients cl ON cl.id = ot.cliente_id
  WHERE (p_fecha_desde IS NULL OR os.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR os.fecha_fin <= p_fecha_hasta)
  ORDER BY os.fecha_fin DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_ordenes_completadas_detalle IS 'Retorna detalle de órdenes completadas (fixed: numero_orden, nombre_fantasia)';
