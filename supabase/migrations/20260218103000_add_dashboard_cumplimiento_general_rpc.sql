-- Dashboard v2: cumplimiento general (histórico) por scope.
-- Se usa para que el KPI "Cumplimiento" no dependa del período seleccionado.

CREATE OR REPLACE FUNCTION public.fn_dashboard_cumplimiento_general_v2(
  p_company_id uuid,
  p_scope text,
  p_period text,
  p_tz text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS TABLE (
  cumplimiento_pct numeric,
  cumplimiento_prev numeric
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
  v_curr_from timestamptz;

  v_eval_total integer := 0;
  v_ontime_total integer := 0;
  v_eval_before integer := 0;
  v_ontime_before integer := 0;
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
  ELSIF v_period = '30d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '29 days';
  ELSIF v_period = '90d' THEN
    v_curr_from_local := date_trunc('day', v_now_local) - interval '89 days';
  ELSE
    v_curr_from_local := date_trunc('day', v_now_local) - interval '6 days';
  END IF;

  v_curr_from := v_curr_from_local AT TIME ZONE p_tz;

  IF v_scope = 'ot' THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE timezone(p_tz, o.fecha_completado)::date <= timezone(p_tz, o.fecha_estimada_entrega)::date
      )::integer
    INTO v_eval_total, v_ontime_total
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_estimada_entrega IS NOT NULL;

    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE timezone(p_tz, o.fecha_completado)::date <= timezone(p_tz, o.fecha_estimada_entrega)::date
      )::integer
    INTO v_eval_before, v_ontime_before
    FROM public.ordenes_trabajo o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_estimada_entrega IS NOT NULL
      AND o.fecha_completado < v_curr_from;
  ELSE
    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE timezone(p_tz, o.fecha_completado)::date <= timezone(p_tz, o.fecha_entrega_estimada)::date
      )::integer
    INTO v_eval_total, v_ontime_total
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_entrega_estimada IS NOT NULL;

    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE timezone(p_tz, o.fecha_completado)::date <= timezone(p_tz, o.fecha_entrega_estimada)::date
      )::integer
    INTO v_eval_before, v_ontime_before
    FROM public.centro_copiado_ordenes o
    WHERE o.company_id = p_company_id
      AND o.estado IN ('finalizada', 'entregada')
      AND o.fecha_completado IS NOT NULL
      AND o.fecha_entrega_estimada IS NOT NULL
      AND o.fecha_completado < v_curr_from;
  END IF;

  cumplimiento_pct := CASE
    WHEN v_eval_total = 0 THEN 0
    ELSE round((v_ontime_total::numeric * 100.0) / v_eval_total::numeric, 2)
  END;

  cumplimiento_prev := CASE
    WHEN v_eval_before = 0 THEN 0
    ELSE round((v_ontime_before::numeric * 100.0) / v_eval_before::numeric, 2)
  END;

  RETURN NEXT;
END;
$function$;
