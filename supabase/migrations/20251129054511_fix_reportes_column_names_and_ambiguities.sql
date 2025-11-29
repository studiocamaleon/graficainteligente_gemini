/*
  # Fix: Corregir nombres de columnas y ambigüedades en funciones de reportes

  ## Descripción
  Corrige múltiples errores en las funciones de reportes:
  1. fn_reporte_ventas_por_canal: origen → canal_venta
  2. fn_reporte_ventas_por_categoria: resolver ambigüedad de total_ventas
  3. fn_reporte_ventas_por_hora: resolver ambigüedad de hora

  ## Funciones Corregidas
  - fn_reporte_ventas_por_canal()
  - fn_reporte_ventas_por_categoria()
  - fn_reporte_ventas_por_hora()
  - fn_reporte_ventas_timeline() (también usa origen)
*/

-- =====================================================
-- CORREGIR: fn_reporte_ventas_por_canal
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_canal(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  canal text,
  total_ventas numeric,
  total_ordenes bigint,
  ordenes_trabajo bigint,
  ordenes_copiado bigint,
  porcentaje_ventas numeric,
  porcentaje_ordenes numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_canal AS (
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      'Centro de Copiado' AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_canales AS (
    SELECT
      canal,
      SUM(monto) AS ventas,
      COUNT(*) AS ordenes,
      COUNT(CASE WHEN tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
      COUNT(CASE WHEN tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
    FROM ordenes_por_canal
    GROUP BY canal
  ),
  totales AS (
    SELECT
      SUM(ventas) AS total_ventas,
      SUM(ordenes) AS total_ordenes
    FROM resumen_canales
  )
  SELECT
    rc.canal,
    rc.ventas,
    rc.ordenes,
    rc.ordenes_trabajo,
    rc.ordenes_copiado,
    CASE
      WHEN t.total_ventas > 0 THEN (rc.ventas / t.total_ventas * 100)
      ELSE 0
    END AS porcentaje_ventas,
    CASE
      WHEN t.total_ordenes > 0 THEN (rc.ordenes::numeric / t.total_ordenes * 100)
      ELSE 0
    END AS porcentaje_ordenes,
    CASE
      WHEN rc.ordenes > 0 THEN rc.ventas / rc.ordenes
      ELSE 0
    END AS ticket_promedio
  FROM resumen_canales rc
  CROSS JOIN totales t
  ORDER BY rc.ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal de venta';

-- =====================================================
-- CORREGIR: fn_reporte_ventas_por_categoria
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_categoria(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_ventas numeric,
  total_ordenes bigint,
  porcentaje numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_trabajo_items_categorias AS (
    SELECT
      COALESCE(oti.producto_categoria, 'Sin Categoría') AS categoria,
      oti.precio_total AS total_item
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  centro_copiado_categoria AS (
    SELECT
      'Centro de Copiado' AS categoria,
      cc.total AS total_item
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  todas_categorias AS (
    SELECT categoria, total_item FROM ordenes_trabajo_items_categorias
    UNION ALL
    SELECT categoria, total_item FROM centro_copiado_categoria
  ),
  resumen_categorias AS (
    SELECT
      tc.categoria,
      SUM(tc.total_item) AS ventas_categoria,
      COUNT(*) AS ordenes_categoria
    FROM todas_categorias tc
    GROUP BY tc.categoria
  ),
  total_general AS (
    SELECT SUM(ventas_categoria) AS total_ventas_general FROM resumen_categorias
  )
  SELECT
    rc.categoria AS categoria_nombre,
    rc.ventas_categoria AS total_ventas,
    rc.ordenes_categoria AS total_ordenes,
    CASE
      WHEN tg.total_ventas_general > 0 THEN (rc.ventas_categoria / tg.total_ventas_general * 100)
      ELSE 0
    END AS porcentaje,
    CASE
      WHEN rc.ordenes_categoria > 0 THEN rc.ventas_categoria / rc.ordenes_categoria
      ELSE 0
    END AS ticket_promedio
  FROM resumen_categorias rc
  CROSS JOIN total_general tg
  ORDER BY rc.ventas_categoria DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_categoria IS 
  'Retorna facturación agrupada por categorías de productos incluyendo centro de copiado';

-- =====================================================
-- CORREGIR: fn_reporte_ventas_por_hora
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_hora(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  hora integer,
  rango_horario text,
  total_ordenes bigint,
  porcentaje numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_hora AS (
    SELECT
      EXTRACT(HOUR FROM (ot.fecha_creacion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(HOUR FROM (cc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_horas AS (
    SELECT
      oph.hora_orden,
      COUNT(*) AS ordenes_por_hora
    FROM ordenes_por_hora oph
    GROUP BY oph.hora_orden
  ),
  total_ordenes_sum AS (
    SELECT SUM(ordenes_por_hora) AS total_ordenes_general FROM resumen_horas
  )
  SELECT
    rh.hora_orden AS hora,
    LPAD(rh.hora_orden::text, 2, '0') || ':00 - ' || LPAD((rh.hora_orden + 1)::text, 2, '0') || ':00' AS rango_horario,
    rh.ordenes_por_hora AS total_ordenes,
    CASE
      WHEN tos.total_ordenes_general > 0 THEN (rh.ordenes_por_hora::numeric / tos.total_ordenes_general * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_horas rh
  CROSS JOIN total_ordenes_sum tos
  ORDER BY rh.hora_orden;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_hora IS 
  'Retorna análisis de órdenes por hora del día en zona horaria Argentina (UTC-3) para identificar horarios pico';

-- =====================================================
-- CORREGIR: fn_reporte_ventas_timeline
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_timeline(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_granularidad text DEFAULT 'dia'
)
RETURNS TABLE(
  fecha text,
  total_ventas numeric,
  total_ordenes bigint,
  ordenes_trabajo bigint,
  ordenes_copiado bigint,
  ticket_promedio numeric
) AS $$
DECLARE
  v_formato_fecha text;
  v_trunc_periodo text;
BEGIN
  CASE p_granularidad
    WHEN 'hora' THEN
      v_formato_fecha := 'YYYY-MM-DD HH24:00';
      v_trunc_periodo := 'hour';
    WHEN 'dia' THEN
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
    WHEN 'semana' THEN
      v_formato_fecha := 'YYYY-WW';
      v_trunc_periodo := 'week';
    WHEN 'mes' THEN
      v_formato_fecha := 'YYYY-MM';
      v_trunc_periodo := 'month';
    ELSE
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
  END CASE;

  RETURN QUERY
  EXECUTE format($query$
    WITH ordenes_timeline AS (
      SELECT
        date_trunc(%L, ot.fecha_creacion)::date AS periodo,
        ot.total AS monto,
        'trabajo' AS tipo_orden
      FROM ordenes_trabajo ot
      WHERE ot.company_id = %L
        AND ot.fecha_creacion::date BETWEEN %L AND %L
        AND ot.estado NOT IN ('cancelado', 'borrador')
      UNION ALL
      SELECT
        date_trunc(%L, cc.fecha_solicitud)::date AS periodo,
        cc.total AS monto,
        'copiado' AS tipo_orden
      FROM centro_copiado_ordenes cc
      WHERE cc.company_id = %L
        AND cc.fecha_solicitud::date BETWEEN %L AND %L
        AND cc.estado != 'cancelada'
    ),
    resumen_timeline AS (
      SELECT
        to_char(periodo, %L) AS fecha,
        SUM(monto) AS ventas,
        COUNT(*) AS ordenes,
        COUNT(CASE WHEN tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
        COUNT(CASE WHEN tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
      FROM ordenes_timeline
      GROUP BY periodo
    )
    SELECT
      fecha,
      ventas,
      ordenes,
      ordenes_trabajo,
      ordenes_copiado,
      CASE
        WHEN ordenes > 0 THEN ventas / ordenes
        ELSE 0
      END AS ticket_promedio
    FROM resumen_timeline
    ORDER BY fecha
  $query$,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_formato_fecha
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_timeline IS 
  'Retorna evolución temporal de ventas con granularidad configurable';
