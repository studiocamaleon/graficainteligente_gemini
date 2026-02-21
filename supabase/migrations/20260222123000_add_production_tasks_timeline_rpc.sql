-- Producción / Rendimiento: evolución diaria de tareas finalizadas (con filtro opcional por usuario)

CREATE OR REPLACE FUNCTION public.fn_production_tasks_timeline(
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
  tareas_terminadas bigint
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
    timezone(p_tz, r.fecha_fin)::date AS dia,
    to_char(timezone(p_tz, r.fecha_fin)::date, 'DD/MM') AS label,
    COUNT(*)::bigint AS tareas_terminadas
  FROM public.ordenes_trabajo_items_rutas r
  JOIN public.ordenes_trabajo_items i ON i.id = r.orden_item_id
  JOIN public.ordenes_trabajo o ON o.id = i.orden_id
  LEFT JOIN public.pasos p ON p.id = r.paso_id
  WHERE o.company_id = p_company_id
    AND o.estado <> 'cancelada'
    AND r.estado_paso IN ('completado', 'omitido')
    AND r.fecha_fin IS NOT NULL
    AND r.fecha_fin >= p_from
    AND r.fecha_fin < p_to
    AND (p_estacion_id IS NULL OR p.estacion_id = p_estacion_id)
    AND (p_user_id IS NULL OR r.responsable_id = p_user_id)
  GROUP BY timezone(p_tz, r.fecha_fin)::date
  ORDER BY timezone(p_tz, r.fecha_fin)::date;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_production_tasks_timeline(uuid, timestamptz, timestamptz, uuid, uuid, text) TO authenticated;
