-- Hotfix: corrige join de rutas por item en dashboard operativo v2
-- Error observado: 42703 column r.item_id does not exist

CREATE OR REPLACE FUNCTION public.fn_dashboard_operativo_v2(
  p_company_id uuid,
  p_scope text,
  p_period text,
  p_limit_entregas integer DEFAULT 10,
  p_limit_actividad integer DEFAULT 15,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  proximas_entregas jsonb,
  actividad_reciente jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scope text := lower(coalesce(p_scope, 'ot'));
  v_period text := lower(coalesce(p_period, '7d'));

  v_now_local timestamp;
  v_curr_from_local timestamp;
  v_curr_to_local timestamp;
  v_curr_from timestamptz;
  v_curr_to timestamptz;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'p_company_id is required';
  END IF;

  IF v_scope NOT IN ('ot', 'copiado') THEN
    RAISE EXCEPTION 'p_scope must be ot or copiado';
  END IF;

  IF v_period NOT IN ('7d', '30d', '90d', 'mes_actual') THEN
    RAISE EXCEPTION 'p_period must be one of: 7d, 30d, 90d, mes_actual';
  END IF;

  v_now_local := timezone(p_tz, now());

  IF v_period = 'mes_actual' THEN
    v_curr_from_local := date_trunc('month', v_now_local);
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
  ELSIF v_period = '30d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '29 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
  ELSIF v_period = '90d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '89 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
  ELSE
    v_curr_from_local := date_trunc('day', v_now_local) - interval '6 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
  END IF;

  v_curr_from := v_curr_from_local AT TIME ZONE p_tz;
  v_curr_to := v_curr_to_local AT TIME ZONE p_tz;

  IF v_scope = 'ot' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.fecha_estimada_entrega ASC), '[]'::jsonb)
    INTO proximas_entregas
    FROM (
      SELECT
        o.id::text AS id,
        'ot'::text AS tipo_orden,
        o.numero_orden,
        COALESCE(c.nombre_fantasia, c.razon_social, 'Sin cliente') AS cliente_nombre,
        o.fecha_estimada_entrega,
        GREATEST(0, (timezone(p_tz, o.fecha_estimada_entrega)::date - timezone(p_tz, now())::date))::int AS dias_restantes,
        o.estado,
        CASE
          WHEN coalesce(r.total_rutas, 0) = 0 THEN 0
          ELSE round((coalesce(r.completadas, 0)::numeric * 100.0) / r.total_rutas::numeric, 0)::int
        END AS progreso_porcentaje,
        CASE
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 1 THEN 'critico'
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 3 THEN 'urgente'
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 7 THEN 'proximo'
          ELSE 'normal'
        END AS nivel_urgencia
      FROM public.ordenes_trabajo o
      LEFT JOIN public.clients c ON c.id = o.cliente_id
      LEFT JOIN LATERAL (
        SELECT
          count(r.id) AS total_rutas,
          count(r.id) FILTER (WHERE r.estado_paso = 'completado') AS completadas
        FROM public.ordenes_trabajo_items i
        LEFT JOIN public.ordenes_trabajo_items_rutas r ON r.orden_item_id = i.id
        WHERE i.orden_id = o.id
      ) r ON true
      WHERE o.company_id = p_company_id
        AND o.estado IN ('pendiente', 'en_proceso')
        AND o.fecha_estimada_entrega IS NOT NULL
      ORDER BY o.fecha_estimada_entrega ASC
      LIMIT greatest(coalesce(p_limit_entregas, 10), 1)
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO actividad_reciente
    FROM (
      SELECT
        h.id::text AS id,
        'orden'::text AS tipo,
        'ot'::text AS tipo_orden,
        h.tipo_evento::text AS tipo_evento,
        h.descripcion,
        o.numero_orden AS orden_numero,
        o.id::text AS orden_id,
        p.full_name AS usuario_nombre,
        h.created_at,
        null::text AS detalle_extra
      FROM public.ordenes_trabajo_historial h
      JOIN public.ordenes_trabajo o ON o.id = h.orden_id
      LEFT JOIN public.profiles p ON p.id = h.usuario_id
      WHERE o.company_id = p_company_id
        AND h.created_at >= v_curr_from
        AND h.created_at < v_curr_to
      ORDER BY h.created_at DESC
      LIMIT greatest(coalesce(p_limit_actividad, 15), 1)
    ) t;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.fecha_estimada_entrega ASC), '[]'::jsonb)
    INTO proximas_entregas
    FROM (
      SELECT
        o.id::text AS id,
        'copiado'::text AS tipo_orden,
        o.numero_orden,
        COALESCE(c.nombre_fantasia, c.razon_social, 'Sin cliente') AS cliente_nombre,
        o.fecha_entrega_estimada AS fecha_estimada_entrega,
        GREATEST(0, (timezone(p_tz, o.fecha_entrega_estimada)::date - timezone(p_tz, now())::date))::int AS dias_restantes,
        o.estado,
        CASE
          WHEN o.estado = 'en_proceso' THEN 50
          WHEN o.estado IN ('finalizada', 'entregada') THEN 100
          ELSE 0
        END AS progreso_porcentaje,
        CASE
          WHEN timezone(p_tz, o.fecha_entrega_estimada)::date <= timezone(p_tz, now())::date + 1 THEN 'critico'
          WHEN timezone(p_tz, o.fecha_entrega_estimada)::date <= timezone(p_tz, now())::date + 3 THEN 'urgente'
          WHEN timezone(p_tz, o.fecha_entrega_estimada)::date <= timezone(p_tz, now())::date + 7 THEN 'proximo'
          ELSE 'normal'
        END AS nivel_urgencia
      FROM public.centro_copiado_ordenes o
      LEFT JOIN public.clients c ON c.id = o.cliente_id
      WHERE o.company_id = p_company_id
        AND o.estado IN ('pendiente', 'en_proceso')
        AND o.fecha_entrega_estimada IS NOT NULL
      ORDER BY o.fecha_entrega_estimada ASC
      LIMIT greatest(coalesce(p_limit_entregas, 10), 1)
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO actividad_reciente
    FROM (
      SELECT
        o.id::text || '-' || extract(epoch FROM o.updated_at)::text AS id,
        'orden'::text AS tipo,
        'copiado'::text AS tipo_orden,
        'cambio_estado'::text AS tipo_evento,
        'Orden de copiado actualizada'::text AS descripcion,
        o.numero_orden AS orden_numero,
        o.id::text AS orden_id,
        p.full_name AS usuario_nombre,
        o.updated_at AS created_at,
        ('Estado: ' || o.estado)::text AS detalle_extra
      FROM public.centro_copiado_ordenes o
      LEFT JOIN public.profiles p ON p.id = o.updated_by
      WHERE o.company_id = p_company_id
        AND o.updated_at >= v_curr_from
        AND o.updated_at < v_curr_to
      ORDER BY o.updated_at DESC
      LIMIT greatest(coalesce(p_limit_actividad, 15), 1)
    ) t;
  END IF;

  RETURN NEXT;
END;
$function$;
