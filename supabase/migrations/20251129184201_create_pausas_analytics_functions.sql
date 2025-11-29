/*
  # Funciones de Analítica de Pausas

  ## Descripción
  Crea funciones SQL para obtener métricas y analíticas del sistema de pausas:
  - KPIs principales (total pausas, tiempo promedio, etc)
  - Distribución por categoría
  - Evolución temporal
  - Pausas más prolongadas
  - Top pasos con más pausas

  ## Funciones Creadas
  1. fn_pausas_kpis_generales(periodo)
  2. fn_pausas_por_categoria(periodo)
  3. fn_pausas_evolucion_temporal(periodo)
  4. fn_pausas_mas_prolongadas(periodo, limit)
  5. fn_pasos_mas_pausados(periodo, limit)

  Fecha: 2025-11-30
*/

-- =============================================================================
-- 1. KPIs Generales de Pausas
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_pausas_kpis_generales(
  p_fecha_desde timestamptz DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_fecha_hasta timestamptz DEFAULT (CURRENT_DATE + INTERVAL '1 day')
)
RETURNS TABLE(
  total_pausas bigint,
  pausas_activas bigint,
  pausas_cerradas bigint,
  tiempo_total_pausado_horas numeric,
  tiempo_promedio_pausa_horas numeric,
  pausa_mas_larga_horas numeric,
  ordenes_afectadas bigint,
  pasos_pausados_unicos bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_pausas,
    COUNT(*) FILTER (WHERE p.fecha_fin_pausa IS NULL)::bigint as pausas_activas,
    COUNT(*) FILTER (WHERE p.fecha_fin_pausa IS NOT NULL)::bigint as pausas_cerradas,
    ROUND(
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_total_pausado_horas,
    ROUND(
      AVG(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_promedio_pausa_horas,
    ROUND(
      MAX(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as pausa_mas_larga_horas,
    COUNT(DISTINCT oir.orden_item_id)::bigint as ordenes_afectadas,
    COUNT(DISTINCT p.ruta_id)::bigint as pasos_pausados_unicos
  FROM ordenes_items_rutas_pausas p
  INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Distribución de Pausas por Categoría
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_pausas_por_categoria(
  p_fecha_desde timestamptz DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_fecha_hasta timestamptz DEFAULT (CURRENT_DATE + INTERVAL '1 day')
)
RETURNS TABLE(
  categoria text,
  cantidad bigint,
  porcentaje numeric,
  tiempo_total_horas numeric,
  tiempo_promedio_horas numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH pausas_stats AS (
    SELECT
      p.categoria_motivo,
      COUNT(*)::bigint as cant,
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60 as tiempo_total,
      COUNT(*) OVER() as total_pausas
    FROM ordenes_items_rutas_pausas p
    WHERE p.fecha_inicio_pausa >= p_fecha_desde
    AND p.fecha_inicio_pausa < p_fecha_hasta
    GROUP BY p.categoria_motivo
  )
  SELECT
    ps.categoria_motivo as categoria,
    ps.cant as cantidad,
    ROUND((ps.cant::numeric / ps.total_pausas::numeric) * 100, 1) as porcentaje,
    ROUND(ps.tiempo_total, 1) as tiempo_total_horas,
    ROUND(ps.tiempo_total / ps.cant, 1) as tiempo_promedio_horas
  FROM pausas_stats ps
  ORDER BY ps.cant DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Evolución Temporal de Pausas
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_pausas_evolucion_temporal(
  p_fecha_desde timestamptz DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_fecha_hasta timestamptz DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  p_agrupacion text DEFAULT 'dia' -- 'dia', 'semana', 'mes'
)
RETURNS TABLE(
  periodo text,
  fecha date,
  cantidad_pausas bigint,
  tiempo_total_horas numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN p_agrupacion = 'dia' THEN TO_CHAR(DATE(p.fecha_inicio_pausa), 'DD/MM/YYYY')
      WHEN p_agrupacion = 'semana' THEN TO_CHAR(DATE_TRUNC('week', p.fecha_inicio_pausa), 'DD/MM/YYYY')
      WHEN p_agrupacion = 'mes' THEN TO_CHAR(DATE_TRUNC('month', p.fecha_inicio_pausa), 'MM/YYYY')
      ELSE TO_CHAR(DATE(p.fecha_inicio_pausa), 'DD/MM/YYYY')
    END as periodo,
    CASE
      WHEN p_agrupacion = 'dia' THEN DATE(p.fecha_inicio_pausa)
      WHEN p_agrupacion = 'semana' THEN DATE(DATE_TRUNC('week', p.fecha_inicio_pausa))
      WHEN p_agrupacion = 'mes' THEN DATE(DATE_TRUNC('month', p.fecha_inicio_pausa))
      ELSE DATE(p.fecha_inicio_pausa)
    END as fecha,
    COUNT(*)::bigint as cantidad_pausas,
    ROUND(
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_total_horas
  FROM ordenes_items_rutas_pausas p
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta
  GROUP BY fecha, periodo
  ORDER BY fecha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. Pausas Más Prolongadas
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_pausas_mas_prolongadas(
  p_fecha_desde timestamptz DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_fecha_hasta timestamptz DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  pausa_id uuid,
  orden_numero text,
  paso_nombre text,
  categoria text,
  motivo_nombre text,
  descripcion text,
  duracion_horas numeric,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  esta_activa boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as pausa_id,
    ot.numero_orden as orden_numero,
    oir.paso_nombre as paso_nombre,
    p.categoria_motivo as categoria,
    m.nombre as motivo_nombre,
    p.descripcion,
    ROUND(
      COALESCE(
        p.duracion_minutos,
        EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
      ) / 60,
      1
    ) as duracion_horas,
    p.fecha_inicio_pausa as fecha_inicio,
    p.fecha_fin_pausa as fecha_fin,
    (p.fecha_fin_pausa IS NULL) as esta_activa
  FROM ordenes_items_rutas_pausas p
  INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
  INNER JOIN ordenes_trabajo_items oti ON oti.id = oir.orden_item_id
  INNER JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
  LEFT JOIN pasos_motivos_pausa m ON m.id = p.motivo_pausa_id
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta
  ORDER BY
    COALESCE(
      p.duracion_minutos,
      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
    ) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Pasos Más Pausados
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_pasos_mas_pausados(
  p_fecha_desde timestamptz DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_fecha_hasta timestamptz DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  paso_nombre text,
  tipo_etapa text,
  cantidad_pausas bigint,
  tiempo_total_horas numeric,
  tiempo_promedio_horas numeric,
  categoria_principal text
) AS $$
BEGIN
  RETURN QUERY
  WITH paso_stats AS (
    SELECT
      oir.paso_nombre,
      oir.tipo_etapa,
      COUNT(*)::bigint as cant_pausas,
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60 as tiempo_total,
      MODE() WITHIN GROUP (ORDER BY p.categoria_motivo) as categoria_mas_comun
    FROM ordenes_items_rutas_pausas p
    INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
    WHERE p.fecha_inicio_pausa >= p_fecha_desde
    AND p.fecha_inicio_pausa < p_fecha_hasta
    GROUP BY oir.paso_nombre, oir.tipo_etapa
  )
  SELECT
    ps.paso_nombre,
    ps.tipo_etapa,
    ps.cant_pausas as cantidad_pausas,
    ROUND(ps.tiempo_total, 1) as tiempo_total_horas,
    ROUND(ps.tiempo_total / ps.cant_pausas, 1) as tiempo_promedio_horas,
    ps.categoria_mas_comun as categoria_principal
  FROM paso_stats ps
  ORDER BY ps.cant_pausas DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comentarios y Documentación
-- =============================================================================
COMMENT ON FUNCTION fn_pausas_kpis_generales IS
'Retorna KPIs generales del sistema de pausas: total, activas, cerradas, tiempo promedio, etc.';

COMMENT ON FUNCTION fn_pausas_por_categoria IS
'Retorna distribución de pausas agrupadas por categoría con cantidades y tiempos.';

COMMENT ON FUNCTION fn_pausas_evolucion_temporal IS
'Retorna evolución temporal de pausas agrupadas por día, semana o mes.';

COMMENT ON FUNCTION fn_pausas_mas_prolongadas IS
'Retorna las pausas más prolongadas del período con información detallada.';

COMMENT ON FUNCTION fn_pasos_mas_pausados IS
'Retorna los pasos que más se pausan con estadísticas agregadas.';

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Funciones de analítica de pausas creadas:';
  RAISE NOTICE '   1. fn_pausas_kpis_generales()';
  RAISE NOTICE '   2. fn_pausas_por_categoria()';
  RAISE NOTICE '   3. fn_pausas_evolucion_temporal()';
  RAISE NOTICE '   4. fn_pausas_mas_prolongadas()';
  RAISE NOTICE '   5. fn_pasos_mas_pausados()';
  RAISE NOTICE '🎯 Sistema de reportes listo para usar';
END $$;
