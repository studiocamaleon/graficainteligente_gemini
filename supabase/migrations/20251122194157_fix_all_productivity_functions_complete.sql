/*
  # Corrección Completa de Funciones de Productividad
  
  ## Problemas Identificados
  1. fn_ordenes_completadas_detalle: usa ot.numero pero la columna es numero_orden
  2. fn_metricas_por_etapa: ambigüedad en minutos_totales
  3. fn_cuellos_botella: ambigüedad en minutos_promedio
  4. fn_kpis_generales: verificar que no tenga ambigüedades
  
  ## Esquema Verificado
  - ordenes_trabajo: tiene numero_orden (NO numero)
  - ordenes_trabajo_items_rutas: tiene estado_paso, fecha_inicio, fecha_fin, responsable_id
  - ordenes_trabajo_items: tiene producto_nombre, producto_categoria
  
  ## Solución
  - Usar nombres de columnas exactos del esquema
  - Eliminar todas las ambigüedades usando aliases explícitos y únicos
  - Renombrar columnas en CTEs para evitar conflictos
*/

-- =====================================================
-- 1. FIX: fn_ordenes_completadas_detalle
--    Cambiar ot.numero -> ot.numero_orden
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
    ot.numero_orden as orden_numero,
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

COMMENT ON FUNCTION fn_ordenes_completadas_detalle IS 'Retorna detalle de órdenes completadas con sus métricas (fixed: numero_orden)';

-- =====================================================
-- 2. FIX: fn_metricas_por_etapa
--    Resolver ambigüedad de minutos_totales
-- =====================================================

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
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as etapa_minutos_totales
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

COMMENT ON FUNCTION fn_metricas_por_etapa IS 'Retorna métricas agregadas por tipo de etapa (fixed: ambiguous columns)';

-- =====================================================
-- 3. FIX: fn_cuellos_botella
--    Resolver ambigüedad de minutos_promedio
-- =====================================================

CREATE OR REPLACE FUNCTION fn_cuellos_botella(
  p_company_id uuid,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  paso_nombre text,
  tipo_etapa text,
  total_ejecuciones bigint,
  minutos_promedio numeric,
  desviacion_estandar numeric,
  coeficiente_variacion numeric,
  es_cuello_botella boolean,
  razon text
) AS $$
BEGIN
  RETURN QUERY
  WITH paso_metricas AS (
    SELECT 
      pm.paso_id,
      pm.paso_nombre as pm_paso_nombre,
      pm.tipo_etapa as pm_tipo_etapa,
      pm.total_ejecuciones as pm_total_ejecuciones,
      pm.minutos_promedio as pm_minutos_promedio,
      pm.minutos_minimo as pm_minutos_minimo,
      pm.minutos_maximo as pm_minutos_maximo,
      pm.desviacion_estandar as pm_desviacion_estandar,
      pm.total_minutos as pm_total_minutos
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta) pm
  ),
  paso_promedio_general AS (
    SELECT AVG(pm.pm_minutos_promedio) as promedio_global
    FROM paso_metricas pm
  )
  SELECT
    pm.pm_paso_nombre as paso_nombre,
    pm.pm_tipo_etapa as tipo_etapa,
    pm.pm_total_ejecuciones as total_ejecuciones,
    pm.pm_minutos_promedio as minutos_promedio,
    pm.pm_desviacion_estandar as desviacion_estandar,
    ROUND((pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0))::numeric, 2) as coeficiente_variacion,
    (
      pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)
      OR (pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0)) > 0.5
    ) as es_cuello_botella,
    CASE
      WHEN pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)
        THEN 'Tiempo promedio muy alto'
      WHEN (pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0)) > 0.5
        THEN 'Alta variabilidad en tiempos'
      ELSE 'Rendimiento normal'
    END as razon
  FROM paso_metricas pm
  WHERE pm.pm_total_ejecuciones >= 5
  ORDER BY
    (pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)) DESC,
    pm.pm_minutos_promedio DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_cuellos_botella IS 'Identifica pasos problemáticos que representan cuellos de botella (fixed: ambiguous columns)';

-- =====================================================
-- 4. VERIFICAR: fn_kpis_generales
--    Ya fue corregida anteriormente, recrear para consistencia
-- =====================================================

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
DECLARE
  v_result record;
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT oti.orden_id)::bigint as stats_total_ordenes,
      COUNT(DISTINCT r.orden_item_id)::bigint as stats_total_items,
      COUNT(*)::bigint as stats_total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as stats_total_minutos
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

COMMENT ON FUNCTION fn_kpis_generales IS 'Retorna KPIs principales para el dashboard de productividad (fixed: all ambiguous columns)';
