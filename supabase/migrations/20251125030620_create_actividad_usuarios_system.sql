/*
  # Sistema de Actividad de Usuarios y Métricas de Rendimiento

  1. Vista de Actividad
    - `v_actividad_usuarios`: Vista para historial completo de actividad de operadores

  2. Funciones de Métricas
    - `fn_metricas_rendimiento_operadores`: Calcula KPIs por operador
    - `fn_resumen_actividad_equipo`: Calcula KPIs generales del equipo

  3. Seguridad
    - RLS habilitado, acceso solo para usuarios autenticados
*/

-- =====================================================
-- VISTA: Actividad de Usuarios
-- =====================================================

CREATE OR REPLACE VIEW v_actividad_usuarios AS
SELECT
  oir.id as ruta_id,
  oir.orden_item_id,
  oir.estado_paso as estado_paso,
  oir.fecha_inicio,
  oir.fecha_fin,
  oir.responsable_id,
  oir.notas,
  COALESCE(oir.paso_nombre, p.nombre) as paso_nombre,
  COALESCE(oir.tipo_etapa, p.etapa) as tipo_etapa,
  oir.orden as orden_paso,
  EXTRACT(EPOCH FROM (oir.fecha_fin - oir.fecha_inicio)) / 60.0 as duracion_minutos,
  prof.full_name as responsable_nombre,
  prof.email as responsable_email,
  prof.role as responsable_role,
  prof.avatar_url as responsable_avatar,
  oi.producto_nombre,
  oi.producto_categoria,
  oi.cantidad as producto_cantidad,
  oi.estado as item_estado,
  ot.id as orden_id,
  ot.numero_orden,
  ot.fecha_creacion as orden_fecha_creacion,
  ot.company_id,
  c.nombre_fantasia as cliente_nombre,
  p.estacion_id,
  e.nombre as estacion_nombre
FROM ordenes_trabajo_items_rutas oir
INNER JOIN ordenes_trabajo_items oi ON oir.orden_item_id = oi.id
INNER JOIN ordenes_trabajo ot ON oi.orden_id = ot.id
LEFT JOIN pasos p ON oir.paso_id = p.id
LEFT JOIN profiles prof ON oir.responsable_id = prof.id
LEFT JOIN clients c ON ot.cliente_id = c.id
LEFT JOIN estaciones_trabajo e ON p.estacion_id = e.id
WHERE
  oir.estado_paso IN ('completado', 'omitido')
  AND oir.fecha_fin IS NOT NULL
  AND oir.responsable_id IS NOT NULL;

ALTER VIEW v_actividad_usuarios SET (security_invoker = true);

COMMENT ON VIEW v_actividad_usuarios IS 'Vista del historial de actividad de operadores';

-- =====================================================
-- FUNCIÓN: Métricas de Rendimiento por Operador
-- =====================================================

CREATE OR REPLACE FUNCTION fn_metricas_rendimiento_operadores(
  p_company_id UUID,
  p_fecha_desde TIMESTAMPTZ DEFAULT NULL,
  p_fecha_hasta TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  responsable_id UUID,
  responsable_nombre TEXT,
  responsable_email TEXT,
  responsable_avatar TEXT,
  total_pasos_completados BIGINT,
  total_pasos_omitidos BIGINT,
  total_pasos BIGINT,
  tasa_completitud NUMERIC,
  tiempo_total_minutos NUMERIC,
  tiempo_total_horas NUMERIC,
  tiempo_promedio_minutos NUMERIC,
  pasos_prensa BIGINT,
  pasos_post_prensa BIGINT,
  pasos_terminacion BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.responsable_id,
    v.responsable_nombre,
    v.responsable_email,
    v.responsable_avatar,
    COUNT(*) FILTER (WHERE v.estado_paso = 'completado') as total_pasos_completados,
    COUNT(*) FILTER (WHERE v.estado_paso = 'omitido') as total_pasos_omitidos,
    COUNT(*) as total_pasos,
    ROUND(
      (COUNT(*) FILTER (WHERE v.estado_paso = 'completado')::NUMERIC /
       NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
      2
    ) as tasa_completitud,
    ROUND(SUM(v.duracion_minutos), 2) as tiempo_total_minutos,
    ROUND(SUM(v.duracion_minutos) / 60.0, 2) as tiempo_total_horas,
    ROUND(AVG(v.duracion_minutos), 2) as tiempo_promedio_minutos,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'prensa') as pasos_prensa,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'post-prensa') as pasos_post_prensa,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'terminacion') as pasos_terminacion
  FROM v_actividad_usuarios v
  WHERE
    v.company_id = p_company_id
    AND (p_fecha_desde IS NULL OR v.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_fin <= p_fecha_hasta)
  GROUP BY
    v.responsable_id,
    v.responsable_nombre,
    v.responsable_email,
    v.responsable_avatar
  ORDER BY total_pasos_completados DESC, tiempo_total_horas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_metricas_rendimiento_operadores IS 'Calcula métricas de rendimiento detalladas por operador';

-- =====================================================
-- FUNCIÓN: Resumen de Actividad del Equipo
-- =====================================================

CREATE OR REPLACE FUNCTION fn_resumen_actividad_equipo(
  p_company_id UUID,
  p_fecha_desde TIMESTAMPTZ DEFAULT NULL,
  p_fecha_hasta TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_pasos_ejecutados BIGINT,
  total_operadores_activos BIGINT,
  promedio_pasos_por_operador NUMERIC,
  tiempo_promedio_por_paso NUMERIC,
  tasa_completitud_equipo NUMERIC,
  total_horas_trabajadas NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_pasos,
      COUNT(DISTINCT v.responsable_id) as operadores_activos,
      COUNT(*) FILTER (WHERE v.estado_paso = 'completado') as pasos_completados,
      ROUND(AVG(v.duracion_minutos), 2) as tiempo_promedio,
      ROUND(SUM(v.duracion_minutos) / 60.0, 2) as total_horas
    FROM v_actividad_usuarios v
    WHERE
      v.company_id = p_company_id
      AND (p_fecha_desde IS NULL OR v.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR v.fecha_fin <= p_fecha_hasta)
  )
  SELECT
    s.total_pasos,
    s.operadores_activos,
    ROUND(s.total_pasos::NUMERIC / NULLIF(s.operadores_activos::NUMERIC, 0), 1) as promedio_pasos,
    s.tiempo_promedio,
    ROUND((s.pasos_completados::NUMERIC / NULLIF(s.total_pasos::NUMERIC, 0)) * 100, 2) as tasa_completitud,
    s.total_horas
  FROM stats s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_resumen_actividad_equipo IS 'Calcula KPIs generales del equipo de producción';

-- =====================================================
-- PERMISOS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_metricas_rendimiento_operadores TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resumen_actividad_equipo TO authenticated;
GRANT SELECT ON v_actividad_usuarios TO authenticated;