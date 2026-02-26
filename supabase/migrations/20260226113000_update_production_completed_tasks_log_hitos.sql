-- Producción / Rendimiento: reemplaza duración por tiempo entre hitos en log de tareas finalizadas

DROP FUNCTION IF EXISTS public.fn_production_completed_tasks_log(uuid, timestamptz, timestamptz, uuid, uuid, integer);

CREATE FUNCTION public.fn_production_completed_tasks_log(
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
  tiempo_entre_hitos_minutos numeric
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
  WITH rutas_con_hitos AS (
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
      r.orden AS orden_ruta,
      o.fecha_creacion AS orden_fecha_creacion,
      LAG(r.fecha_fin) OVER (PARTITION BY r.orden_item_id ORDER BY r.orden) AS fecha_fin_paso_anterior
    FROM public.ordenes_trabajo_items_rutas r
    JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
    JOIN public.ordenes_trabajo o ON o.id = i.orden_id
    LEFT JOIN public.pasos p ON p.id = r.paso_id
    LEFT JOIN public.estaciones_trabajo est ON est.id = p.estacion_id
    LEFT JOIN public.profiles pr ON pr.id = r.responsable_id
    WHERE o.company_id = p_company_id
      AND o.estado <> 'cancelada'
  )
  SELECT
    rc.ruta_id,
    rc.orden_id,
    rc.numero_orden,
    rc.orden_item_id,
    rc.item_nombre,
    rc.responsable_id,
    rc.responsable_nombre,
    rc.paso_nombre,
    rc.estacion_id,
    rc.estacion_nombre,
    rc.estado_paso,
    rc.fecha_inicio,
    rc.fecha_fin,
    CASE
      WHEN rc.orden_ruta = 1 THEN ROUND((EXTRACT(EPOCH FROM (rc.fecha_fin - rc.orden_fecha_creacion)) / 60.0)::numeric, 2)
      WHEN rc.fecha_fin_paso_anterior IS NOT NULL THEN ROUND((EXTRACT(EPOCH FROM (rc.fecha_fin - rc.fecha_fin_paso_anterior)) / 60.0)::numeric, 2)
      ELSE NULL
    END AS tiempo_entre_hitos_minutos
  FROM rutas_con_hitos rc
  WHERE rc.estado_paso IN ('completado', 'omitido')
    AND rc.fecha_fin IS NOT NULL
    AND rc.fecha_fin >= p_from
    AND rc.fecha_fin < p_to
    AND (p_estacion_id IS NULL OR rc.estacion_id = p_estacion_id)
    AND (p_user_id IS NULL OR rc.responsable_id = p_user_id)
  ORDER BY rc.fecha_fin DESC
  LIMIT GREATEST(COALESCE(p_limit, 500), 1);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_production_completed_tasks_log(uuid, timestamptz, timestamptz, uuid, uuid, integer) TO authenticated;
