-- Dashboard v2: KPIs, series and operational payload (OT + Centro de Copiado)
-- Scope:
--   p_scope = 'ot' | 'copiado'
-- Period:
--   p_period = '7d' | '30d' | '90d' | 'mes_actual'

CREATE OR REPLACE FUNCTION public.fn_dashboard_kpis_v2(
  p_company_id uuid,
  p_scope text,
  p_period text,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  pendientes_count integer,
  pendientes_prev integer,
  en_proceso_count integer,
  en_proceso_prev integer,
  vencidas_count integer,
  vencidas_prev integer,
  finalizadas_periodo_count integer,
  finalizadas_periodo_prev integer,
  cumplimiento_pct numeric,
  cumplimiento_prev numeric,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scope text := lower(coalesce(p_scope, 'ot'));
  v_period text := lower(coalesce(p_period, '7d'));

  v_now_local timestamp;
  v_today_local date;

  v_curr_from_local timestamp;
  v_curr_to_local timestamp;
  v_prev_from_local timestamp;
  v_prev_to_local timestamp;

  v_curr_from timestamptz;
  v_curr_to timestamptz;
  v_prev_from timestamptz;
  v_prev_to timestamptz;

  v_eval_curr integer := 0;
  v_ontime_curr integer := 0;
  v_eval_prev integer := 0;
  v_ontime_prev integer := 0;
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
  v_today_local := v_now_local::date;

  IF v_period = 'mes_actual' THEN
    v_curr_from_local := date_trunc('month', v_now_local);
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
    v_prev_from_local := date_trunc('month', v_now_local) - interval '1 month';
    v_prev_to_local := date_trunc('month', v_now_local);
  ELSIF v_period = '30d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '29 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
    v_prev_from_local := v_curr_from_local - interval '30 days';
    v_prev_to_local := v_curr_from_local;
  ELSIF v_period = '90d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '89 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
    v_prev_from_local := v_curr_from_local - interval '90 days';
    v_prev_to_local := v_curr_from_local;
  ELSE
    v_curr_from_local := date_trunc('day', v_now_local) - interval '6 days';
    v_curr_to_local := date_trunc('day', v_now_local) + interval '1 day';
    v_prev_from_local := v_curr_from_local - interval '7 days';
    v_prev_to_local := v_curr_from_local;
  END IF;

  v_curr_from := v_curr_from_local AT TIME ZONE p_tz;
  v_curr_to := v_curr_to_local AT TIME ZONE p_tz;
  v_prev_from := v_prev_from_local AT TIME ZONE p_tz;
  v_prev_to := v_prev_to_local AT TIME ZONE p_tz;

  IF v_scope = 'ot' THEN
    SELECT count(*)::integer
    INTO pendientes_count
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado = 'pendiente';

    SELECT count(*)::integer
    INTO pendientes_prev
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado = 'pendiente'
      AND o.created_at >= v_prev_from
      AND o.created_at < v_prev_to;

    SELECT count(*)::integer
    INTO en_proceso_count
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado = 'en_proceso';

    SELECT count(*)::integer
    INTO en_proceso_prev
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado = 'en_proceso'
      AND o.created_at >= v_prev_from
      AND o.created_at < v_prev_to;

    SELECT count(*)::integer
    INTO vencidas_count
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('pendiente', 'en_proceso')
      AND o.fecha_estimada_entrega IS NOT NULL
      AND timezone(p_tz, o.fecha_estimada_entrega)::date < v_today_local;

    SELECT count(*)::integer
    INTO vencidas_prev
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('pendiente', 'en_proceso')
      AND o.fecha_estimada_entrega IS NOT NULL
      AND timezone(p_tz, o.fecha_estimada_entrega)::date >= v_prev_from_local::date
      AND timezone(p_tz, o.fecha_estimada_entrega)::date < v_prev_to_local::date;

    SELECT count(*)::integer
    INTO finalizadas_periodo_count
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_completado >= v_curr_from
      AND o.fecha_completado < v_curr_to;

    SELECT count(*)::integer
    INTO finalizadas_periodo_prev
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_completado >= v_prev_from
      AND o.fecha_completado < v_prev_to;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE o.fecha_completado <= o.fecha_estimada_entrega)::integer
    INTO v_eval_curr, v_ontime_curr
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_estimada_entrega IS NOT NULL
      AND o.fecha_completado >= v_curr_from
      AND o.fecha_completado < v_curr_to;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE o.fecha_completado <= o.fecha_estimada_entrega)::integer
    INTO v_eval_prev, v_ontime_prev
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_estimada_entrega IS NOT NULL
      AND o.fecha_completado >= v_prev_from
      AND o.fecha_completado < v_prev_to;
  ELSE
    SELECT count(*)::integer
    INTO pendientes_count
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado = 'pendiente';

    SELECT count(*)::integer
    INTO pendientes_prev
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado = 'pendiente'
      AND o.fecha_solicitud >= v_prev_from
      AND o.fecha_solicitud < v_prev_to;

    SELECT count(*)::integer
    INTO en_proceso_count
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado = 'en_proceso';

    SELECT count(*)::integer
    INTO en_proceso_prev
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado = 'en_proceso'
      AND o.fecha_solicitud >= v_prev_from
      AND o.fecha_solicitud < v_prev_to;

    SELECT count(*)::integer
    INTO vencidas_count
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('pendiente', 'en_proceso')
      AND o.fecha_entrega_estimada IS NOT NULL
      AND timezone(p_tz, o.fecha_entrega_estimada)::date < v_today_local;

    SELECT count(*)::integer
    INTO vencidas_prev
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('pendiente', 'en_proceso')
      AND o.fecha_entrega_estimada IS NOT NULL
      AND timezone(p_tz, o.fecha_entrega_estimada)::date >= v_prev_from_local::date
      AND timezone(p_tz, o.fecha_entrega_estimada)::date < v_prev_to_local::date;

    SELECT count(*)::integer
    INTO finalizadas_periodo_count
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_completado >= v_curr_from
      AND o.fecha_completado < v_curr_to;

    SELECT count(*)::integer
    INTO finalizadas_periodo_prev
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_completado >= v_prev_from
      AND o.fecha_completado < v_prev_to;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE o.fecha_completado <= o.fecha_entrega_estimada)::integer
    INTO v_eval_curr, v_ontime_curr
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_entrega_estimada IS NOT NULL
      AND o.fecha_completado >= v_curr_from
      AND o.fecha_completado < v_curr_to;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE o.fecha_completado <= o.fecha_entrega_estimada)::integer
    INTO v_eval_prev, v_ontime_prev
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_entrega_estimada IS NOT NULL
      AND o.fecha_completado >= v_prev_from
      AND o.fecha_completado < v_prev_to;
  END IF;

  cumplimiento_pct := CASE
    WHEN v_eval_curr = 0 THEN 0
    ELSE round((v_ontime_curr::numeric * 100.0) / v_eval_curr::numeric, 2)
  END;

  cumplimiento_prev := CASE
    WHEN v_eval_prev = 0 THEN 0
    ELSE round((v_ontime_prev::numeric * 100.0) / v_eval_prev::numeric, 2)
  END;

  updated_at := now();
  RETURN NEXT;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_dashboard_series_v2(
  p_company_id uuid,
  p_scope text,
  p_period text,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  series_creadas jsonb,
  series_finalizadas jsonb,
  series_cumplimiento jsonb,
  backlog_aging jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scope text := lower(coalesce(p_scope, 'ot'));
  v_period text := lower(coalesce(p_period, '7d'));

  v_now_local timestamp;
  v_today_local date;
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
  v_today_local := v_now_local::date;

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
    WITH days AS (
      SELECT generate_series(v_curr_from_local::date, (v_curr_to_local::date - 1), interval '1 day')::date AS day
    ),
    created_by_day AS (
      SELECT timezone(p_tz, o.created_at)::date AS day, count(*)::int AS total
      FROM public.ordenes_trabajo o
      WHERE o.company_id = p_company_id
        AND o.created_at >= v_curr_from
        AND o.created_at < v_curr_to
      GROUP BY 1
    ),
    final_by_day AS (
      SELECT timezone(p_tz, o.fecha_completado)::date AS day, count(*)::int AS total
      FROM public.ordenes_trabajo o
      WHERE o.company_id = p_company_id
        AND o.estado IN ('finalizada', 'entregada')
        AND o.fecha_completado IS NOT NULL
        AND o.fecha_completado >= v_curr_from
        AND o.fecha_completado < v_curr_to
      GROUP BY 1
    ),
    cumplimiento_by_day AS (
      SELECT
        timezone(p_tz, o.fecha_completado)::date AS day,
        count(*)::int AS evaluadas,
        count(*) FILTER (WHERE o.fecha_completado <= o.fecha_estimada_entrega)::int AS a_tiempo
      FROM public.ordenes_trabajo o
      WHERE o.company_id = p_company_id
        AND o.estado IN ('finalizada', 'entregada')
        AND o.fecha_completado IS NOT NULL
        AND o.fecha_estimada_entrega IS NOT NULL
        AND o.fecha_completado >= v_curr_from
        AND o.fecha_completado < v_curr_to
      GROUP BY 1
    )
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', COALESCE(c.total, 0)
        ) ORDER BY d.day
      ), '[]'::jsonb),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', COALESCE(f.total, 0)
        ) ORDER BY d.day
      ), '[]'::jsonb),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', CASE WHEN COALESCE(k.evaluadas, 0) = 0 THEN 0
                        ELSE round((k.a_tiempo::numeric * 100.0) / k.evaluadas::numeric, 2)
                   END
        ) ORDER BY d.day
      ), '[]'::jsonb),
      (
        WITH aging AS (
          SELECT
            CASE
              WHEN age_days <= 2 THEN '0-2d'
              WHEN age_days <= 7 THEN '3-7d'
              WHEN age_days <= 14 THEN '8-14d'
              ELSE '+14d'
            END AS bucket,
            count(*)::int AS total
          FROM (
            SELECT (v_today_local - timezone(p_tz, o.created_at)::date) AS age_days
            FROM public.ordenes_trabajo o
            WHERE o.company_id = p_company_id
              AND o.estado IN ('pendiente', 'en_proceso')
          ) s
          GROUP BY 1
        )
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('bucket', b.bucket, 'value', COALESCE(a.total, 0))
          ORDER BY b.ord
        ), '[]'::jsonb)
        FROM (VALUES ('0-2d', 1), ('3-7d', 2), ('8-14d', 3), ('+14d', 4)) b(bucket, ord)
        LEFT JOIN aging a ON a.bucket = b.bucket
      )
    INTO series_creadas, series_finalizadas, series_cumplimiento, backlog_aging
    FROM days d
    LEFT JOIN created_by_day c ON c.day = d.day
    LEFT JOIN final_by_day f ON f.day = d.day
    LEFT JOIN cumplimiento_by_day k ON k.day = d.day;
  ELSE
    WITH days AS (
      SELECT generate_series(v_curr_from_local::date, (v_curr_to_local::date - 1), interval '1 day')::date AS day
    ),
    created_by_day AS (
      SELECT timezone(p_tz, o.fecha_solicitud)::date AS day, count(*)::int AS total
      FROM public.centro_copiado_ordenes o
      WHERE o.company_id = p_company_id
        AND o.fecha_solicitud >= v_curr_from
        AND o.fecha_solicitud < v_curr_to
      GROUP BY 1
    ),
    final_by_day AS (
      SELECT timezone(p_tz, o.fecha_completado)::date AS day, count(*)::int AS total
      FROM public.centro_copiado_ordenes o
      WHERE o.company_id = p_company_id
        AND o.estado IN ('finalizada', 'entregada')
        AND o.fecha_completado IS NOT NULL
        AND o.fecha_completado >= v_curr_from
        AND o.fecha_completado < v_curr_to
      GROUP BY 1
    ),
    cumplimiento_by_day AS (
      SELECT
        timezone(p_tz, o.fecha_completado)::date AS day,
        count(*)::int AS evaluadas,
        count(*) FILTER (WHERE o.fecha_completado <= o.fecha_entrega_estimada)::int AS a_tiempo
      FROM public.centro_copiado_ordenes o
      WHERE o.company_id = p_company_id
        AND o.estado IN ('finalizada', 'entregada')
        AND o.fecha_completado IS NOT NULL
        AND o.fecha_entrega_estimada IS NOT NULL
        AND o.fecha_completado >= v_curr_from
        AND o.fecha_completado < v_curr_to
      GROUP BY 1
    )
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', COALESCE(c.total, 0)
        ) ORDER BY d.day
      ), '[]'::jsonb),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', COALESCE(f.total, 0)
        ) ORDER BY d.day
      ), '[]'::jsonb),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'label', to_char(d.day, 'DD/MM'),
          'value', CASE WHEN COALESCE(k.evaluadas, 0) = 0 THEN 0
                        ELSE round((k.a_tiempo::numeric * 100.0) / k.evaluadas::numeric, 2)
                   END
        ) ORDER BY d.day
      ), '[]'::jsonb),
      (
        WITH aging AS (
          SELECT
            CASE
              WHEN age_days <= 2 THEN '0-2d'
              WHEN age_days <= 7 THEN '3-7d'
              WHEN age_days <= 14 THEN '8-14d'
              ELSE '+14d'
            END AS bucket,
            count(*)::int AS total
          FROM (
            SELECT (v_today_local - timezone(p_tz, o.fecha_solicitud)::date) AS age_days
            FROM public.centro_copiado_ordenes o
            WHERE o.company_id = p_company_id
              AND o.estado IN ('pendiente', 'en_proceso')
          ) s
          GROUP BY 1
        )
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('bucket', b.bucket, 'value', COALESCE(a.total, 0))
          ORDER BY b.ord
        ), '[]'::jsonb)
        FROM (VALUES ('0-2d', 1), ('3-7d', 2), ('8-14d', 3), ('+14d', 4)) b(bucket, ord)
        LEFT JOIN aging a ON a.bucket = b.bucket
      )
    INTO series_creadas, series_finalizadas, series_cumplimiento, backlog_aging
    FROM days d
    LEFT JOIN created_by_day c ON c.day = d.day
    LEFT JOIN final_by_day f ON f.day = d.day
    LEFT JOIN cumplimiento_by_day k ON k.day = d.day;
  END IF;

  RETURN NEXT;
END;
$function$;


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
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 1 THEN 'critico'
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 3 THEN 'urgente'
          WHEN timezone(p_tz, o.fecha_estimada_entrega)::date <= timezone(p_tz, now())::date + 7 THEN 'proximo'
          ELSE 'normal'
        END AS nivel_urgencia
      FROM public.ordenes_trabajo o
      LEFT JOIN public.clients c ON c.id = o.cliente_id
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


CREATE INDEX IF NOT EXISTS idx_ot_dashboard_company_estado_entrega
  ON public.ordenes_trabajo(company_id, estado, fecha_estimada_entrega);

CREATE INDEX IF NOT EXISTS idx_ot_dashboard_company_fecha_completado
  ON public.ordenes_trabajo(company_id, fecha_completado);

CREATE INDEX IF NOT EXISTS idx_ot_dashboard_company_created_at
  ON public.ordenes_trabajo(company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_cc_dashboard_company_estado_entrega
  ON public.centro_copiado_ordenes(company_id, estado, fecha_entrega_estimada);

CREATE INDEX IF NOT EXISTS idx_cc_dashboard_company_fecha_completado
  ON public.centro_copiado_ordenes(company_id, fecha_completado);

CREATE INDEX IF NOT EXISTS idx_cc_dashboard_company_fecha_solicitud
  ON public.centro_copiado_ordenes(company_id, fecha_solicitud);
