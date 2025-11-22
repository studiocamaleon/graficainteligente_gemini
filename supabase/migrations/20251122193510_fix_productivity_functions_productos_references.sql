/*
  # Fix productivity functions - remove productos table references

  ## Problem
  Functions fn_metricas_por_categoria and fn_ordenes_completadas_detalle
  were trying to JOIN with a table "productos" that doesn't exist.
  
  The system has separate tables per category:
  - productos_impresion_laser
  - productos_gran_formato
  - productos_materiales_rigidos
  - productos_plotter_corte
  - productos_sellos
  - productos_portabanners
  - productos_talonarios

  ## Solution
  The table ordenes_trabajo_items already has denormalized fields:
  - producto_nombre (text) - product name
  - producto_categoria (text) - product category
  
  We can use these fields directly instead of joining with non-existent table.

  ## Changes
  1. fn_metricas_por_categoria - removed JOIN productos, use oti.producto_categoria
  2. fn_ordenes_completadas_detalle - removed JOIN productos, use oti.producto_categoria
*/

-- =====================================================
-- 1. FIX: fn_metricas_por_categoria
-- =====================================================

CREATE OR REPLACE FUNCTION fn_metricas_por_categoria(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  categoria_id uuid,
  categoria_nombre text,
  total_ordenes bigint,
  total_items bigint,
  minutos_promedio_por_item numeric,
  minutos_minimo numeric,
  minutos_maximo numeric,
  desviacion_estandar numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH item_duraciones AS (
    SELECT
      oti.id as item_id,
      oti.producto_categoria,
      c.id as cat_id,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as minutos_totales
    FROM ordenes_trabajo_items oti
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    JOIN ordenes_trabajo_items_rutas r ON r.orden_item_id = oti.id
    LEFT JOIN categorias c ON c.nombre = oti.producto_categoria
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
      AND oti.producto_categoria IS NOT NULL
    GROUP BY oti.id, oti.producto_categoria, c.id
  )
  SELECT
    id.cat_id as categoria_id,
    COALESCE(c.nombre, id.producto_categoria) as categoria_nombre,
    COUNT(DISTINCT oti.orden_id)::bigint as total_ordenes,
    COUNT(DISTINCT id.item_id)::bigint as total_items,
    ROUND(AVG(id.minutos_totales)::numeric, 2) as minutos_promedio_por_item,
    ROUND(MIN(id.minutos_totales)::numeric, 2) as minutos_minimo,
    ROUND(MAX(id.minutos_totales)::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(id.minutos_totales)::numeric, 2) as desviacion_estandar
  FROM item_duraciones id
  LEFT JOIN categorias c ON c.id = id.cat_id
  JOIN ordenes_trabajo_items oti ON oti.id = id.item_id
  GROUP BY id.cat_id, c.nombre, id.producto_categoria
  ORDER BY minutos_promedio_por_item DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_metricas_por_categoria IS 'Retorna métricas agregadas por categoría de producto (fixed: no JOIN productos)';

-- =====================================================
-- 2. FIX: fn_ordenes_completadas_detalle
-- =====================================================

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
    ot.numero as orden_numero,
    cl.nombre as cliente_nombre,
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

COMMENT ON FUNCTION fn_ordenes_completadas_detalle IS 'Retorna detalle de órdenes completadas con sus métricas (fixed: no JOIN productos)';
