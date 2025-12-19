/*
  # Actualización de Métricas de Productividad con Exclusión de Pausas
  
  ## Cambios
  1. Actualizar `fn_calcular_duracion_paso` para restar el tiempo pausado.
  2. Actualizar todas las funciones de métricas para usar el tiempo de pausa.
  3. Agregar `minutos_promedio_por_orden` a `fn_metricas_por_categoria`.
*/

-- 1. Limpiar funciones existentes para evitar errores de tipo de retorno
DROP FUNCTION IF EXISTS fn_metricas_por_paso(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_metricas_por_categoria(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_metricas_por_etapa(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_metricas_por_operario(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_kpis_generales(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_tendencias_temporales(uuid, timestamptz, timestamptz, text);

-- 2. Actualizar función de cálculo de duración para restar pausas
CREATE OR REPLACE FUNCTION fn_calcular_duracion_paso(
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz,
  p_tiempo_pausado interval DEFAULT INTERVAL '0'
)
RETURNS numeric AS $$
BEGIN
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RETURN NULL;
  END IF;

  -- (Duración total - Tiempo pausado) convertido a minutos
  RETURN (EXTRACT(EPOCH FROM (p_fecha_fin - p_fecha_inicio)) - EXTRACT(EPOCH FROM COALESCE(p_tiempo_pausado, INTERVAL '0'))) / 60.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Actualizar fn_metricas_por_paso
CREATE OR REPLACE FUNCTION fn_metricas_por_paso(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  paso_id uuid,
  paso_nombre text,
  tipo_etapa text,
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
    r.tipo_etStage as tipo_etapa, -- Usando alias para evitar ambigüedades
    COUNT(*)::bigint as total_ejecuciones,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_promedio,
    ROUND(MIN(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_minimo,
    ROUND(MAX(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as desviacion_estandar,
    ROUND(SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as total_minutos
  FROM (
    SELECT *, tipo_etapa as tipo_etStage 
    FROM ordenes_trabajo_items_rutas
  ) r
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.paso_id, r.paso_nombre, r.tipo_etStage
  ORDER BY minutos_promedio DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Actualizar fn_metricas_por_categoria
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
  minutos_promedio_por_orden numeric,
  minutos_minimo numeric,
  minutos_maximo numeric,
  desviacion_estandar numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH item_duraciones AS (
    SELECT
      oti.id as item_id,
      oti.orden_id,
      p.categoria_id,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total)) as minutos_totales
    FROM ordenes_trabajo_items oti
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    JOIN productos p ON p.id = oti.producto_id
    JOIN ordenes_trabajo_items_rutas r ON r.orden_item_id = oti.id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
    GROUP BY oti.id, oti.orden_id, p.categoria_id
  ),
  categoria_stats AS (
    SELECT
      id.categoria_id,
      COUNT(DISTINCT id.orden_id)::bigint as cat_total_ordenes,
      COUNT(DISTINCT id.item_id)::bigint as cat_total_items,
      ROUND(AVG(id.minutos_totales)::numeric, 2) as cat_minutos_promedio_por_item,
      -- Nueva métrica: Tiempo total de la categoría / Cantidad de órdenes únicas con esa categoría
      ROUND((SUM(id.minutos_totales) / NULLIF(COUNT(DISTINCT id.orden_id), 0))::numeric, 2) as cat_minutos_promedio_por_orden,
      ROUND(MIN(id.minutos_totales)::numeric, 2) as cat_minutos_minimo,
      ROUND(MAX(id.minutos_totales)::numeric, 2) as cat_minutos_maximo,
      ROUND(STDDEV(id.minutos_totales)::numeric, 2) as cat_desviacion_estandar
    FROM item_duraciones id
    GROUP BY id.categoria_id
  )
  SELECT
    c.id as categoria_id,
    c.nombre as categoria_nombre,
    cs.cat_total_ordenes as total_ordenes,
    cs.cat_total_items as total_items,
    cs.cat_minutos_promedio_por_item as minutos_promedio_por_item,
    cs.cat_minutos_promedio_por_orden as minutos_promedio_por_orden,
    cs.cat_minutos_minimo as minutos_minimo,
    cs.cat_minutos_maximo as minutos_maximo,
    cs.cat_desviacion_estandar as desviacion_estandar
  FROM categoria_stats cs
  JOIN categorias c ON c.id = cs.categoria_id
  ORDER BY minutos_promedio_por_item DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Actualizar fn_metricas_por_etapa
CREATE OR REPLACE FUNCTION fn_metricas_por_etapa(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  tipo_etapa text,
  total_pasos bigint,
  minutos_promedio numeric,
  minutos_totales numeric,
  porcentaje_tiempo numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH etapa_stats AS (
    SELECT
      r.tipo_etapa as etapa_tipo,
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
    es.etapa_tipo as tipo_etapa,
    es.etapa_total_pasos as total_pasos,
    ROUND((es.etapa_minutos_totales / NULLIF(es.etapa_total_pasos, 0))::numeric, 2) as minutos_promedio,
    ROUND(es.etapa_minutos_totales::numeric, 2) as minutos_totales,
    ROUND((es.etapa_minutos_totales / NULLIF(tg.suma_total, 0) * 100)::numeric, 2) as porcentaje_tiempo
  FROM etapa_stats es
  CROSS JOIN total_general tg
  ORDER BY es.etapa_minutos_totales DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Actualizar fn_metricas_por_operario
CREATE OR REPLACE FUNCTION fn_metricas_por_operario(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  operario_id uuid,
  operario_nombre text,
  operario_email text,
  total_pasos_completados bigint,
  minutos_promedio_por_paso numeric,
  desviacion_estandar numeric,
  total_horas numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.responsable_id as operario_id,
    COALESCE(pr.full_name, 'Sin asignar') as operario_nombre,
    pr.email as operario_email,
    COUNT(*)::bigint as total_pasos_completados,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as minutos_promedio_por_paso,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total))::numeric, 2) as desviacion_estandar,
    ROUND((SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total)) / 60.0)::numeric, 2) as total_horas
  FROM ordenes_trabajo_items_rutas r
  LEFT JOIN profiles pr ON pr.id = r.responsable_id
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.responsable_id, pr.full_name, pr.email
  HAVING COUNT(*) >= 1 -- Bajamos el umbral para ver más resultados en desarrollo
  ORDER BY total_pasos_completados DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Actualizar fn_kpis_generales
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

-- 7. Actualizar fn_tendencias_temporales
CREATE OR REPLACE FUNCTION fn_tendencias_temporales(
  p_company_id uuid,
  p_fecha_desde timestamptz,
  p_fecha_hasta timestamptz,
  p_intervalo text DEFAULT 'day'
)
RETURNS TABLE (
  periodo date,
  ordenes_completadas bigint,
  items_completados bigint,
  pasos_completados bigint,
  minutos_promedio_por_item numeric,
  total_horas numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH periodos AS (
    SELECT
      DATE_TRUNC(p_intervalo, r.fecha_fin)::date as periodo_fecha,
      COUNT(DISTINCT oti.orden_id)::bigint as ord_completadas,
      COUNT(DISTINCT r.orden_item_id)::bigint as itm_completados,
      COUNT(*)::bigint as pss_completados,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin, r.tiempo_pausado_total)) as tot_minutos
    FROM ordenes_trabajo_items_rutas r
    JOIN ordenes_trabajo_items oti ON oti.id = r.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND r.fecha_fin >= p_fecha_desde
      AND r.fecha_fin <= p_fecha_hasta
    GROUP BY DATE_TRUNC(p_intervalo, r.fecha_fin)
  )
  SELECT
    p.periodo_fecha as periodo,
    p.ord_completadas as ordenes_completadas,
    p.itm_completados as items_completados,
    p.pss_completados as pasos_completados,
    ROUND((p.tot_minutos / NULLIF(p.itm_completados, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((p.tot_minutos / 60.0)::numeric, 2) as total_horas
  FROM periodos p
  ORDER BY p.periodo_fecha ASC;
END;
$$ LANGUAGE plpgsql STABLE;
