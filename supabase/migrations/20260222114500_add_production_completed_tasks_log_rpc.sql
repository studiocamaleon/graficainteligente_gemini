-- Producción / Rendimiento: log detallado de tareas finalizadas por usuario

CREATE INDEX IF NOT EXISTS idx_perf_rutas_company_fecha_fin_desc
  ON public.ordenes_trabajo_items_rutas(company_id, fecha_fin DESC)
  WHERE fecha_fin IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_production_completed_tasks_log(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_estacion_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  ruta_id uuid,
  orden_id uuid,
  numero_orden text,
  orden_item_id uuid,
  item_nombre text,
  responsable_id uuid,
  responsable_nombre text,
  paso_nombre text,
  estacion_id uuid,
  estacion_nombre text,
  estado_paso text,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  duracion_minutos numeric
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
    r.id AS ruta_id,
    o.id AS orden_id,
    o.numero_orden,
    i.id AS orden_item_id,
    COALESCE(i.producto_nombre, 'Item sin nombre')::text AS item_nombre,
    r.responsable_id,
    COALESCE(pr.full_name, 'Sin asignar')::text AS responsable_nombre,
    COALESCE(r.paso_nombre, 'Paso')::text AS paso_nombre,
    p.estacion_id,
    COALESCE(est.nombre, 'Sin estación')::text AS estacion_nombre,
    r.estado_paso::text AS estado_paso,
    r.fecha_inicio,
    r.fecha_fin,
    ROUND((EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 60.0)::numeric, 2) AS duracion_minutos
  FROM public.ordenes_trabajo_items_rutas r
  JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
  JOIN public.ordenes_trabajo o ON o.id = i.orden_id
  LEFT JOIN public.pasos p ON p.id = r.paso_id
  LEFT JOIN public.estaciones_trabajo est ON est.id = p.estacion_id
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
  ORDER BY r.fecha_fin DESC
  LIMIT GREATEST(COALESCE(p_limit, 500), 1);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_production_completed_tasks_log(uuid, timestamptz, timestamptz, uuid, uuid, integer) TO authenticated;
