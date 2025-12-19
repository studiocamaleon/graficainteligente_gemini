/*
  # Corrección de Ambigüedad en Métricas de Productividad
  
  Se renombran las columnas de retorno para evitar conflictos con los nombres de las columnas en las tablas.
*/

-- 1. Limpiar funciones para evitar errores de tipo de retorno
DROP FUNCTION IF EXISTS fn_metricas_por_paso(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_metricas_por_etapa(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_cuellos_botella(uuid, timestamptz, timestamptz);

-- 2. Corregir fn_metricas_por_paso
CREATE OR REPLACE FUNCTION fn_metricas_por_paso(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  paso_id uuid,
  paso_nombre text,
  etapa_tipo text, -- Renombrado de tipo_etapa a etapa_tipo
  total_ejecuciones bigint,
  minutos_promedio numeric,
  minutos_minimo numeric,
  minutos_maximo numeric,
  desviacion_estandar numeric,
  total_minutos numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.paso_id,
    r.paso_nombre,
    r.tipo_etapa as etapa_tipo,
    COUNT(*)::bigint as total_ejecuciones,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_promedio,
    ROUND(MIN(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_minimo,
    ROUND(MAX(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as desviacion_estandar,
    ROUND(SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as total_minutos
  FROM ordenes_trabajo_items_rutas r
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.paso_id, r.paso_nombre, r.tipo_etapa
  ORDER BY minutos_promedio DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Corregir fn_metricas_por_etapa
CREATE OR REPLACE FUNCTION fn_metricas_por_etapa(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  etapa_tipo text, -- Renombrado
  total_pasos bigint,
  minutos_promedio numeric,
  minutos_totales numeric,
  porcentaje_tiempo numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH etapa_stats AS (
    SELECT
      r.tipo_etapa as internal_etapa_tipo,
      COUNT(*)::bigint as etapa_total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total)) as etapa_minutos_totales
    FROM ordenes_trabajo_items_rutas r
    WHERE r.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
    GROUP BY r.tipo_etapa
  ),
  total_general AS (
    SELECT SUM(es.etapa_minutos_totales) as suma_total 
    FROM etapa_stats es
  )
  SELECT
    es.internal_etapa_tipo as etapa_tipo,
    es.etapa_total_pasos as total_pasos,
    ROUND((es.etapa_minutos_totales / NULLIF(es.etapa_total_pasos, 0))::numeric, 2) as minutos_promedio,
    ROUND(es.etapa_minutos_totales::numeric, 2) as minutos_totales,
    ROUND((es.etapa_minutos_totales / NULLIF(tg.suma_total, 0) * 100)::numeric, 2) as porcentaje_tiempo
  FROM etapa_stats es
  CROSS JOIN total_general tg
  ORDER BY es.etapa_minutos_totales DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Re-crear fn_kpis_generales para que use los nuevos nombres (no cambia firma)
CREATE OR REPLACE FUNCTION fn_kpis_generales(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_ordenes_completadas bigint,
  total_items_completados bigint,
  total_pasos_completados bigint,
  horas_promedio_por_orden numeric,
  minutos_promedio_por_item numeric,
  minutos_promedio_por_paso numeric,
  total_horas_produccion numeric,
  paso_mas_lento text,
  paso_mas_lento_minutos numeric,
  operario_mas_productivo text,
  operario_pasos_completados bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT oti.orden_id)::bigint as stats_total_ordenes,
      COUNT(DISTINCT r.orden_item_id)::bigint as stats_total_items,
      COUNT(*)::bigint as stats_total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total)) as stats_total_minutos
    FROM ordenes_trabajo_items_rutas r
    JOIN ordenes_trabajo_items oti ON oti.id = r.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  ),
  paso_lento AS (
    SELECT 
      pm.paso_nombre as pl_paso_nombre, 
      pm.minutos_promedio as pl_minutos_promedio
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta) pm
    ORDER BY pm.minutos_promedio DESC
    LIMIT 1
  ),
  operario_top AS (
    SELECT 
      op.operario_nombre as ot_operario_nombre, 
      op.total_pasos_completados as ot_total_pasos
    FROM fn_metricas_por_operario(p_company_id, p_fecha_desde, p_fecha_hasta) op
    ORDER BY op.total_pasos_completados DESC
    LIMIT 1
  )
  SELECT
    s.stats_total_ordenes as total_ordenes_completadas,
    s.stats_total_items as total_items_completados,
    s.stats_total_pasos as total_pasos_completados,
    ROUND((s.stats_total_minutos / 60.0 / NULLIF(s.stats_total_ordenes, 0))::numeric, 2) as horas_promedio_por_orden,
    ROUND((s.stats_total_minutos / NULLIF(s.stats_total_items, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((s.stats_total_minutos / NULLIF(s.stats_total_pasos, 0))::numeric, 2) as minutos_promedio_por_paso,
    ROUND((s.stats_total_minutos / 60.0)::numeric, 2) as total_horas_produccion,
    COALESCE(pl.pl_paso_nombre, 'N/A') as paso_mas_lento,
    COALESCE(pl.pl_minutos_promedio, 0) as paso_mas_lento_minutos,
    COALESCE(ot.ot_operario_nombre, 'N/A') as operario_mas_productivo,
    COALESCE(ot.ot_total_pasos, 0) as operario_pasos_completados
  FROM stats s
  LEFT JOIN paso_lento pl ON true
  LEFT JOIN operario_top ot ON true;
END;
$$ LANGUAGE plpgsql STABLE;
