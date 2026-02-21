-- Vista consolidada de tesoreria para dashboard enterprise (v1)

CREATE OR REPLACE FUNCTION public.fn_tesoreria_overview_v1(
  p_company_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (
  ingresos_total numeric,
  egresos_total numeric,
  saldo_neto numeric,
  por_cobrar_total numeric,
  por_pagar_total numeric,
  cheques_emitidos_pendientes numeric,
  cheques_recibidos_pendientes numeric,
  cajas_activas_count integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_company_id uuid;
  v_por_cobrar numeric := 0;
  v_por_pagar numeric := 0;
BEGIN
  SELECT company_id
  INTO v_profile_company_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile_company_id IS NULL OR v_profile_company_id <> p_company_id THEN
    RAISE EXCEPTION 'No autorizado para consultar tesorería de otra empresa.';
  END IF;

  SELECT COALESCE(s.total_pendiente, 0)
  INTO v_por_cobrar
  FROM public.fn_calcular_saldos_pendientes_cobro(p_company_id) s
  LIMIT 1;

  SELECT COALESCE(SUM(v.monto_pendiente), 0)
  INTO v_por_pagar
  FROM public.fn_get_vencimientos_pendientes(p_company_id) v;

  RETURN QUERY
  WITH ingresos AS (
    SELECT COALESCE(SUM(i.monto), 0)::numeric AS total
    FROM public.ingresos i
    WHERE i.company_id = p_company_id
      AND i.fecha BETWEEN p_from AND p_to
  ),
  egresos AS (
    SELECT COALESCE(SUM(e.monto), 0)::numeric AS total
    FROM public.egresos e
    WHERE e.company_id = p_company_id
      AND e.fecha BETWEEN p_from AND p_to
  ),
  cheques AS (
    SELECT
      COALESCE(SUM(CASE WHEN c.direction = 'emitido' AND c.estado = 'pendiente' THEN c.monto ELSE 0 END), 0)::numeric AS emitidos,
      COALESCE(SUM(CASE WHEN c.direction = 'recibido' AND c.estado = 'pendiente' THEN c.monto ELSE 0 END), 0)::numeric AS recibidos
    FROM public.cheques_cartera c
    WHERE c.company_id = p_company_id
  ),
  cajas AS (
    SELECT COUNT(*)::integer AS total
    FROM public.cajas c
    WHERE c.company_id = p_company_id
      AND c.is_active = true
  )
  SELECT
    i.total AS ingresos_total,
    e.total AS egresos_total,
    (i.total - e.total) AS saldo_neto,
    v_por_cobrar AS por_cobrar_total,
    v_por_pagar AS por_pagar_total,
    ch.emitidos AS cheques_emitidos_pendientes,
    ch.recibidos AS cheques_recibidos_pendientes,
    ca.total AS cajas_activas_count,
    now() AS updated_at
  FROM ingresos i
  CROSS JOIN egresos e
  CROSS JOIN cheques ch
  CROSS JOIN cajas ca;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_tesoreria_overview_v1(uuid, date, date) TO authenticated;
