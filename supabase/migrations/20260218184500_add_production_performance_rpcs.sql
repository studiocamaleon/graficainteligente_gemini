-- Rendimiento de Producción (Admin)
-- Métricas simplificadas para OT + mesa global por usuario.

CREATE INDEX IF NOT EXISTS idx_perf_rutas_company_fin_estado
  ON public.ordenes_trabajo_items_rutas(company_id, fecha_fin, estado_paso);

CREATE INDEX IF NOT EXISTS idx_perf_rutas_company_responsable_fin
  ON public.ordenes_trabajo_items_rutas(company_id, responsable_id, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_perf_items_orden_id
  ON public.ordenes_trabajo_items(orden_id);

CREATE INDEX IF NOT EXISTS idx_perf_mesa_company_assigned_user
  ON public.ordenes_items_mesa_trabajo(company_id, assigned_user_id, assigned_at DESC);

CREATE OR REPLACE FUNCTION public.fn_production_performance_kpis(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_estacion_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  tareas_terminadas bigint,
  ordenes_completas bigint,
  ciclo_promedio_horas numeric,
  ciclo_promedio_dias numeric,
  cumplimiento_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_company_id, p_from y p_to son requeridos';
  END IF;

  RETURN QUERY
  WITH completed_steps AS (
    SELECT r.id
    FROM public.ordenes_trabajo_items_rutas r
    JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
    JOIN public.ordenes_trabajo o ON o.id = i.orden_id
    LEFT JOIN public.pasos p ON p.id = r.paso_id
    WHERE o.company_id = p_company_id
      AND r.estado_paso IN ('completado', 'omitido')
      AND r.fecha_fin IS NOT NULL
      AND r.fecha_fin >= p_from
      AND r.fecha_fin < p_to
      AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
      AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  ),
  eligible_orders AS (
    SELECT DISTINCT o.id
    FROM public.ordenes_trabajo o
    JOIN public.ordenes_trabajo_items i ON i.orden_id = o.id
    JOIN public.ordenes_trabajo_items_rutas r ON r.orden_item_id = i.id
    LEFT JOIN public.pasos p ON p.id = r.paso_id
    WHERE o.company_id = p_company_id
      AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
      AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  ),
  orders_rollup AS (
    SELECT
      o.id,
      o.fecha_creacion,
      o.fecha_estimada_entrega,
      MAX(r.fecha_fin) AS fecha_orden_100,
      BOOL_AND(r.estado_paso IN ('completado', 'omitido') AND r.fecha_fin IS NOT NULL) AS is_complete
    FROM public.ordenes_trabajo o
    JOIN eligible_orders eo ON eo.id = o.id
    JOIN public.ordenes_trabajo_items i ON i.orden_id = o.id
    JOIN public.ordenes_trabajo_items_rutas r ON r.orden_item_id = i.id
    WHERE o.company_id = p_company_id
      AND o.estado <> 'cancelada'
    GROUP BY o.id, o.fecha_creacion, o.fecha_estimada_entrega
  ),
  completed_orders AS (
    SELECT *
    FROM orders_rollup
    WHERE is_complete
      AND fecha_orden_100 >= p_from
      AND fecha_orden_100 < p_to
  ),
  kpi AS (
    SELECT
      (SELECT COUNT(*)::bigint FROM completed_steps) AS tareas_terminadas,
      (SELECT COUNT(*)::bigint FROM completed_orders) AS ordenes_completas,
      (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (co.fecha_orden_100 - co.fecha_creacion)) / 3600.0)::numeric, 2)
        FROM completed_orders co
      ) AS ciclo_promedio_horas,
      (
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (co.fecha_orden_100 - co.fecha_creacion)) / 86400.0)::numeric, 2)
        FROM completed_orders co
      ) AS ciclo_promedio_dias,
      (
        SELECT ROUND(
          (
            COUNT(*) FILTER (WHERE co.fecha_estimada_entrega IS NOT NULL AND co.fecha_orden_100 <= co.fecha_estimada_entrega)::numeric
            / NULLIF(COUNT(*) FILTER (WHERE co.fecha_estimada_entrega IS NOT NULL), 0)::numeric
          ) * 100,
          2
        )
        FROM completed_orders co
      ) AS cumplimiento_pct
  )
  SELECT
    COALESCE(k.tareas_terminadas, 0),
    COALESCE(k.ordenes_completas, 0),
    COALESCE(k.ciclo_promedio_horas, 0),
    COALESCE(k.ciclo_promedio_dias, 0),
    COALESCE(k.cumplimiento_pct, 0)
  FROM kpi k;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_production_completed_by_user(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_estacion_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  responsable_id uuid,
  responsable_nombre text,
  tareas_terminadas bigint,
  horas_totales numeric,
  minutos_promedio numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_company_id, p_from y p_to son requeridos';
  END IF;

  RETURN QUERY
  SELECT
    r.responsable_id,
    COALESCE(pr.full_name, 'Sin asignar')::text AS responsable_nombre,
    COUNT(*)::bigint AS tareas_terminadas,
    ROUND((SUM(EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 3600.0))::numeric, 2) AS horas_totales,
    ROUND((AVG(EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 60.0))::numeric, 2) AS minutos_promedio
  FROM public.ordenes_trabajo_items_rutas r
  JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
  JOIN public.ordenes_trabajo o ON o.id = i.orden_id
  LEFT JOIN public.pasos p ON p.id = r.paso_id
  LEFT JOIN public.profiles pr ON pr.id = r.responsable_id
  WHERE o.company_id = p_company_id
    AND o.estado <> 'cancelada'
    AND r.estado_paso IN ('completado', 'omitido')
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND r.fecha_fin >= p_from
    AND r.fecha_fin < p_to
    AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
    AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  GROUP BY r.responsable_id, COALESCE(pr.full_name, 'Sin asignar')
  ORDER BY tareas_terminadas DESC, horas_totales DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_production_completed_by_station(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_estacion_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  estacion_id uuid,
  estacion_nombre text,
  tareas_terminadas bigint,
  minutos_promedio numeric,
  horas_totales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_company_id, p_from y p_to son requeridos';
  END IF;

  RETURN QUERY
  SELECT
    p.estacion_id,
    COALESCE(est.nombre, 'Sin estación')::text AS estacion_nombre,
    COUNT(*)::bigint AS tareas_terminadas,
    ROUND((AVG(EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 60.0))::numeric, 2) AS minutos_promedio,
    ROUND((SUM(EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 3600.0))::numeric, 2) AS horas_totales
  FROM public.ordenes_trabajo_items_rutas r
  JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
  JOIN public.ordenes_trabajo o ON o.id = i.orden_id
  LEFT JOIN public.pasos p ON p.id = r.paso_id
  LEFT JOIN public.estaciones_trabajo est ON est.id = p.estacion_id
  WHERE o.company_id = p_company_id
    AND o.estado <> 'cancelada'
    AND r.estado_paso IN ('completado', 'omitido')
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND r.fecha_fin >= p_from
    AND r.fecha_fin < p_to
    AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
    AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  GROUP BY p.estacion_id, COALESCE(est.nombre, 'Sin estación')
  ORDER BY tareas_terminadas DESC, horas_totales DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_production_cycle_trend(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_estacion_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  dia date,
  label text,
  ciclo_promedio_horas numeric,
  ordenes_completas bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_company_id, p_from y p_to son requeridos';
  END IF;

  RETURN QUERY
  WITH eligible_orders AS (
    SELECT DISTINCT o.id
    FROM public.ordenes_trabajo o
    JOIN public.ordenes_trabajo_items i ON i.orden_id = o.id
    JOIN public.ordenes_trabajo_items_rutas r ON r.orden_item_id = i.id
    LEFT JOIN public.pasos p ON p.id = r.paso_id
    WHERE o.company_id = p_company_id
      AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
      AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  ),
  completed_orders AS (
    SELECT
      o.id,
      o.fecha_creacion,
      MAX(r.fecha_fin) AS fecha_orden_100
    FROM public.ordenes_trabajo o
    JOIN eligible_orders eo ON eo.id = o.id
    JOIN public.ordenes_trabajo_items i ON i.orden_id = o.id
    JOIN public.ordenes_trabajo_items_rutas r ON r.orden_item_id = i.id
    WHERE o.company_id = p_company_id
      AND o.estado <> 'cancelada'
    GROUP BY o.id, o.fecha_creacion
    HAVING BOOL_AND(r.estado_paso IN ('completado', 'omitido') AND r.fecha_fin IS NOT NULL)
       AND MAX(r.fecha_fin) >= p_from
       AND MAX(r.fecha_fin) < p_to
  )
  SELECT
    timezone(p_tz, co.fecha_orden_100)::date AS dia,
    to_char(timezone(p_tz, co.fecha_orden_100)::date, 'DD/MM') AS label,
    ROUND(AVG(EXTRACT(EPOCH FROM (co.fecha_orden_100 - co.fecha_creacion)) / 3600.0)::numeric, 2) AS ciclo_promedio_horas,
    COUNT(*)::bigint AS ordenes_completas
  FROM completed_orders co
  GROUP BY timezone(p_tz, co.fecha_orden_100)::date
  ORDER BY timezone(p_tz, co.fecha_orden_100)::date;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_production_worktables_snapshot(
  p_company_id uuid,
  p_estacion_id uuid DEFAULT NULL,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  ruta_id uuid,
  numero_orden text,
  cliente_nombre text,
  paso_nombre text,
  estacion_nombre text,
  fecha_estimada_entrega timestamptz,
  urgencia text,
  assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := timezone(p_tz, now())::date;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'p_company_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    mt.assigned_user_id AS user_id,
    COALESCE(pr.full_name, 'Usuario desconocido')::text AS user_name,
    mt.ruta_id,
    o.numero_orden,
    COALESCE(cl.nombre_fantasia, cl.razon_social, 'Cliente')::text AS cliente_nombre,
    COALESCE(r.paso_nombre, 'Paso')::text AS paso_nombre,
    COALESCE(est.nombre, 'Sin estación')::text AS estacion_nombre,
    o.fecha_estimada_entrega,
    (
      CASE
        WHEN o.fecha_estimada_entrega IS NULL THEN 'sin_fecha'
        WHEN timezone(p_tz, o.fecha_estimada_entrega)::date < v_today THEN 'vencida'
        WHEN timezone(p_tz, o.fecha_estimada_entrega)::date = v_today THEN 'hoy'
        WHEN timezone(p_tz, o.fecha_estimada_entrega)::date = (v_today + 1) THEN 'manana'
        ELSE 'futura'
      END
    )::text AS urgencia,
    mt.assigned_at
  FROM public.ordenes_items_mesa_trabajo mt
  JOIN public.ordenes_trabajo_items_rutas r ON r.id = mt.ruta_id
  JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
  JOIN public.ordenes_trabajo o ON o.id = i.orden_id
  LEFT JOIN public.clients cl ON cl.id = o.cliente_id
  LEFT JOIN public.pasos p ON p.id = r.paso_id
  LEFT JOIN public.estaciones_trabajo est ON est.id = p.estacion_id
  LEFT JOIN public.profiles pr ON pr.id = mt.assigned_user_id
  WHERE mt.company_id = p_company_id
    AND o.company_id = p_company_id
    AND (p_estacion_id IS NULL OR COALESCE(mt.estacion_id, p.estacion_id) = p_estacion_id)
    AND o.estado <> 'cancelada'
  ORDER BY user_name ASC, o.fecha_estimada_entrega ASC NULLS LAST, mt.assigned_at DESC;
END;
$function$;
