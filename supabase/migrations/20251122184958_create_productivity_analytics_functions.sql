/*
  # Funciones de Análisis de Productividad

  ## Descripción
  Esta migración crea funciones SQL optimizadas para el análisis de productividad
  del sistema de producción. Incluye cálculos de tiempos promedio, métricas por
  categoría, paso, etapa, operario, y detección de cuellos de botella.

  ## Funciones Creadas
  1. fn_calcular_duracion_paso() - Calcula la duración de un paso en minutos
  2. fn_metricas_por_paso() - Métricas agregadas por paso
  3. fn_metricas_por_categoria() - Métricas agregadas por categoría de producto
  4. fn_metricas_por_etapa() - Métricas agregadas por tipo de etapa
  5. fn_metricas_por_operario() - Métricas de eficiencia por operario
  6. fn_ordenes_completadas_detalle() - Detalle de órdenes completadas
  7. fn_cuellos_botella() - Identificación de pasos problemáticos
  8. fn_tendencias_temporales() - Evolución de métricas en el tiempo
  9. fn_kpis_generales() - KPIs principales del dashboard

  ## Índices
  - Índices optimizados para consultas de análisis temporal
*/

-- =====================================================
-- 1. FUNCIÓN: Calcular duración de paso en minutos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_duracion_paso(
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz
)
RETURNS numeric AS $$
BEGIN
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN EXTRACT(EPOCH FROM (p_fecha_fin - p_fecha_inicio)) / 60.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 2. FUNCIÓN: Métricas por paso
-- =====================================================

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
    r.tipo_etapa,
    COUNT(*)::bigint as total_ejecuciones,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_promedio,
    ROUND(MIN(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_minimo,
    ROUND(MAX(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as desviacion_estandar,
    ROUND(SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as total_minutos
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

-- =====================================================
-- 3. FUNCIÓN: Métricas por categoría
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
      p.categoria_id,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as minutos_totales
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
    GROUP BY oti.id, p.categoria_id
  )
  SELECT
    c.id as categoria_id,
    c.nombre as categoria_nombre,
    COUNT(DISTINCT oti.orden_id)::bigint as total_ordenes,
    COUNT(DISTINCT id.item_id)::bigint as total_items,
    ROUND(AVG(id.minutos_totales)::numeric, 2) as minutos_promedio_por_item,
    ROUND(MIN(id.minutos_totales)::numeric, 2) as minutos_minimo,
    ROUND(MAX(id.minutos_totales)::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(id.minutos_totales)::numeric, 2) as desviacion_estandar
  FROM item_duraciones id
  JOIN categorias c ON c.id = id.categoria_id
  JOIN ordenes_trabajo_items oti ON oti.id = id.item_id
  GROUP BY c.id, c.nombre
  ORDER BY minutos_promedio_por_item DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 4. FUNCIÓN: Métricas por etapa
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
      r.tipo_etapa,
      COUNT(*)::bigint as total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as minutos_totales
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
    SELECT SUM(minutos_totales) as total FROM etapa_stats
  )
  SELECT
    es.tipo_etapa,
    es.total_pasos,
    ROUND((es.minutos_totales / NULLIF(es.total_pasos, 0))::numeric, 2) as minutos_promedio,
    ROUND(es.minutos_totales::numeric, 2) as minutos_totales,
    ROUND((es.minutos_totales / NULLIF(tg.total, 0) * 100)::numeric, 2) as porcentaje_tiempo
  FROM etapa_stats es
  CROSS JOIN total_general tg
  ORDER BY es.minutos_totales DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. FUNCIÓN: Métricas por operario
-- =====================================================

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
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_promedio_por_paso,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as desviacion_estandar,
    ROUND((SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) / 60.0)::numeric, 2) as total_horas
  FROM ordenes_trabajo_items_rutas r
  LEFT JOIN profiles pr ON pr.id = r.responsable_id
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.responsable_id, pr.full_name, pr.email
  HAVING COUNT(*) >= 3
  ORDER BY total_pasos_completados DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 6. FUNCIÓN: Órdenes completadas con detalle
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
    c.nombre as categoria_nombre,
    os.fecha_inicio,
    os.fecha_fin,
    ROUND((EXTRACT(EPOCH FROM (os.fecha_fin - os.fecha_inicio)) / 3600.0)::numeric, 2) as duracion_horas,
    os.total_items,
    os.total_pasos_completados,
    ot.estado
  FROM orden_stats os
  JOIN ordenes_trabajo ot ON ot.id = os.orden_id
  LEFT JOIN clients cl ON cl.id = ot.cliente_id
  LEFT JOIN ordenes_trabajo_items oti ON oti.orden_id = ot.id
  LEFT JOIN productos p ON p.id = oti.producto_id
  LEFT JOIN categorias c ON c.id = p.categoria_id
  WHERE (p_fecha_desde IS NULL OR os.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR os.fecha_fin <= p_fecha_hasta)
  GROUP BY ot.id, ot.numero, cl.nombre, c.nombre, os.fecha_inicio, os.fecha_fin,
           os.total_items, os.total_pasos_completados, ot.estado
  ORDER BY os.fecha_fin DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 7. FUNCIÓN: Detección de cuellos de botella
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
    SELECT * FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta)
  )
  SELECT
    pm.paso_nombre,
    pm.tipo_etapa,
    pm.total_ejecuciones,
    pm.minutos_promedio,
    pm.desviacion_estandar,
    ROUND((pm.desviacion_estandar / NULLIF(pm.minutos_promedio, 0))::numeric, 2) as coeficiente_variacion,
    (
      pm.minutos_promedio > (SELECT AVG(minutos_promedio) * 2 FROM paso_metricas)
      OR (pm.desviacion_estandar / NULLIF(pm.minutos_promedio, 0)) > 0.5
    ) as es_cuello_botella,
    CASE
      WHEN pm.minutos_promedio > (SELECT AVG(minutos_promedio) * 2 FROM paso_metricas)
        THEN 'Tiempo promedio muy alto'
      WHEN (pm.desviacion_estandar / NULLIF(pm.minutos_promedio, 0)) > 0.5
        THEN 'Alta variabilidad en tiempos'
      ELSE 'Rendimiento normal'
    END as razon
  FROM paso_metricas pm
  WHERE pm.total_ejecuciones >= 5
  ORDER BY
    (pm.minutos_promedio > (SELECT AVG(minutos_promedio) * 2 FROM paso_metricas)) DESC,
    pm.minutos_promedio DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 8. FUNCIÓN: Tendencias temporales
-- =====================================================

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
      DATE_TRUNC(p_intervalo, r.fecha_fin)::date as periodo,
      COUNT(DISTINCT oti.orden_id)::bigint as ordenes_completadas,
      COUNT(DISTINCT r.orden_item_id)::bigint as items_completados,
      COUNT(*)::bigint as pasos_completados,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as total_minutos
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
    p.periodo,
    p.ordenes_completadas,
    p.items_completados,
    p.pasos_completados,
    ROUND((p.total_minutos / NULLIF(p.items_completados, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((p.total_minutos / 60.0)::numeric, 2) as total_horas
  FROM periodos p
  ORDER BY p.periodo ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 9. FUNCIÓN: KPIs Generales
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
      COUNT(DISTINCT oti.orden_id)::bigint as total_ordenes,
      COUNT(DISTINCT r.orden_item_id)::bigint as total_items,
      COUNT(*)::bigint as total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as total_minutos
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
    SELECT paso_nombre, minutos_promedio
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta)
    ORDER BY minutos_promedio DESC
    LIMIT 1
  ),
  operario_top AS (
    SELECT operario_nombre, total_pasos_completados
    FROM fn_metricas_por_operario(p_company_id, p_fecha_desde, p_fecha_hasta)
    ORDER BY total_pasos_completados DESC
    LIMIT 1
  )
  SELECT
    s.total_ordenes,
    s.total_items,
    s.total_pasos,
    ROUND((s.total_minutos / 60.0 / NULLIF(s.total_ordenes, 0))::numeric, 2) as horas_promedio_por_orden,
    ROUND((s.total_minutos / NULLIF(s.total_items, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((s.total_minutos / NULLIF(s.total_pasos, 0))::numeric, 2) as minutos_promedio_por_paso,
    ROUND((s.total_minutos / 60.0)::numeric, 2) as total_horas_produccion,
    COALESCE(pl.paso_nombre, 'N/A') as paso_mas_lento,
    COALESCE(pl.minutos_promedio, 0) as paso_mas_lento_minutos,
    COALESCE(ot.operario_nombre, 'N/A') as operario_mas_productivo,
    COALESCE(ot.total_pasos_completados, 0) as operario_pasos_completados
  FROM stats s
  LEFT JOIN paso_lento pl ON true
  LEFT JOIN operario_top ot ON true;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 10. ÍNDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_items_rutas_fecha_fin_completado
ON ordenes_trabajo_items_rutas(company_id, fecha_fin)
WHERE estado_paso = 'completado' AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_rutas_paso_nombre
ON ordenes_trabajo_items_rutas(company_id, paso_nombre, estado_paso);

CREATE INDEX IF NOT EXISTS idx_items_rutas_tipo_etapa_estado
ON ordenes_trabajo_items_rutas(company_id, tipo_etapa, estado_paso);

-- =====================================================
-- 11. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_calcular_duracion_paso IS 'Calcula la duración de un paso en minutos';
COMMENT ON FUNCTION fn_metricas_por_paso IS 'Retorna métricas agregadas por paso de producción';
COMMENT ON FUNCTION fn_metricas_por_categoria IS 'Retorna métricas agregadas por categoría de producto';
COMMENT ON FUNCTION fn_metricas_por_etapa IS 'Retorna métricas agregadas por tipo de etapa (pre_prensa, principal, post_prensa)';
COMMENT ON FUNCTION fn_metricas_por_operario IS 'Retorna métricas de eficiencia por operario/responsable';
COMMENT ON FUNCTION fn_ordenes_completadas_detalle IS 'Retorna detalle de órdenes completadas con sus métricas';
COMMENT ON FUNCTION fn_cuellos_botella IS 'Identifica pasos problemáticos que representan cuellos de botella';
COMMENT ON FUNCTION fn_tendencias_temporales IS 'Retorna evolución de métricas en el tiempo (día, semana, mes)';
COMMENT ON FUNCTION fn_kpis_generales IS 'Retorna KPIs principales para el dashboard de productividad';
