-- BI v2: calendario de feriados nacionales AR + días hábiles con feriados

CREATE TABLE IF NOT EXISTS public.calendario_feriados_nacionales (
  id bigserial PRIMARY KEY,
  fecha date NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('inamovible', 'trasladable')),
  fuente text NOT NULL DEFAULT 'Ley 27.399',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha, nombre)
);

CREATE INDEX IF NOT EXISTS idx_calendario_feriados_nacionales_fecha
  ON public.calendario_feriados_nacionales (fecha);

ALTER TABLE public.calendario_feriados_nacionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendario_feriados_nacionales_select_authenticated
  ON public.calendario_feriados_nacionales;
CREATE POLICY calendario_feriados_nacionales_select_authenticated
  ON public.calendario_feriados_nacionales
  FOR SELECT
  TO authenticated
  USING (true);

DROP FUNCTION IF EXISTS public.fn_feriado_trasladable_a_lunes(date);
CREATE OR REPLACE FUNCTION public.fn_feriado_trasladable_a_lunes(p_fecha date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_isodow int;
BEGIN
  v_isodow := EXTRACT(ISODOW FROM p_fecha)::int;

  IF v_isodow IN (2, 3) THEN
    RETURN (p_fecha - (v_isodow - 1));
  ELSIF v_isodow IN (4, 5) THEN
    RETURN (p_fecha + (8 - v_isodow));
  END IF;

  RETURN p_fecha;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_pascua_domingo(int);
CREATE OR REPLACE FUNCTION public.fn_pascua_domingo(p_anio int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a int;
  b int;
  c int;
  d int;
  e int;
  f int;
  g int;
  h int;
  i int;
  k int;
  l int;
  m int;
  mes int;
  dia int;
BEGIN
  -- Algoritmo de Meeus/Jones/Butcher (calendario gregoriano)
  a := p_anio % 19;
  b := p_anio / 100;
  c := p_anio % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;

  RETURN make_date(p_anio, mes, dia);
END;
$$;

DROP FUNCTION IF EXISTS public.fn_sync_feriados_nacionales_ar(int);
CREATE OR REPLACE FUNCTION public.fn_sync_feriados_nacionales_ar(p_anio int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pascua date;
BEGIN
  DELETE FROM public.calendario_feriados_nacionales
  WHERE EXTRACT(YEAR FROM fecha)::int = p_anio;

  v_pascua := public.fn_pascua_domingo(p_anio);

  -- Feriados inamovibles + religiosos nacionales
  INSERT INTO public.calendario_feriados_nacionales (fecha, nombre, tipo, fuente)
  VALUES
    (make_date(p_anio, 1, 1), 'Año Nuevo', 'inamovible', 'Ley 27.399'),
    (v_pascua - 48, 'Carnaval (Lunes)', 'inamovible', 'Ley 27.399'),
    (v_pascua - 47, 'Carnaval (Martes)', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 3, 24), 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 4, 2), 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', 'Ley 27.399'),
    (v_pascua - 2, 'Viernes Santo', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 5, 1), 'Día del Trabajador', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 5, 25), 'Día de la Revolución de Mayo', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 6, 20), 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 7, 9), 'Día de la Independencia', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 12, 8), 'Inmaculada Concepción de María', 'inamovible', 'Ley 27.399'),
    (make_date(p_anio, 12, 25), 'Navidad', 'inamovible', 'Ley 27.399');

  -- Feriados trasladables
  INSERT INTO public.calendario_feriados_nacionales (fecha, nombre, tipo, fuente)
  VALUES
    (public.fn_feriado_trasladable_a_lunes(make_date(p_anio, 6, 17)), 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', 'Ley 27.399'),
    (public.fn_feriado_trasladable_a_lunes(make_date(p_anio, 8, 17)), 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', 'Ley 27.399'),
    (public.fn_feriado_trasladable_a_lunes(make_date(p_anio, 10, 12)), 'Día del Respeto a la Diversidad Cultural', 'trasladable', 'Ley 27.399'),
    (public.fn_feriado_trasladable_a_lunes(make_date(p_anio, 11, 20)), 'Día de la Soberanía Nacional', 'trasladable', 'Ley 27.399');
END;
$$;

DROP FUNCTION IF EXISTS public.fn_bi_dias_habiles_ar(date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_dias_habiles_ar(
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin <= p_fecha_inicio THEN 0::numeric
      ELSE COALESCE((
        SELECT COUNT(*)::numeric
        FROM generate_series(p_fecha_inicio, p_fecha_fin - 1, interval '1 day') AS d(dia)
        LEFT JOIN public.calendario_feriados_nacionales f
          ON f.fecha = d.dia::date
        WHERE EXTRACT(ISODOW FROM d.dia) BETWEEN 1 AND 5
          AND f.id IS NULL
      ), 0::numeric)
    END;
$$;

-- Reemplazo de funciones de operación para usar feriados nacionales
DROP FUNCTION IF EXISTS public.fn_bi_operacion_kpis_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_operacion_kpis_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  lead_time_dias_habiles_prom numeric,
  on_time_pct numeric,
  backlog_activo bigint,
  entregadas_periodo bigint,
  ciclo_mediano_dias_habiles numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH operaciones_ot AS (
    SELECT
      ot.id,
      ot.estado,
      ot.fecha_creacion AS fecha_inicio,
      COALESCE(ot.fecha_entrega_real, ot.fecha_completado) AS fecha_fin,
      ot.fecha_estimada_entrega AS fecha_estimada
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
  ),
  operaciones_oc AS (
    SELECT
      cc.id,
      cc.estado,
      cc.fecha_solicitud AS fecha_inicio,
      cc.fecha_entrega_real AS fecha_fin,
      cc.fecha_entrega_estimada AS fecha_estimada
    FROM public.centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.estado <> 'cancelada'
      AND cc.orden_trabajo_id IS NULL
  ),
  operaciones AS (
    SELECT * FROM operaciones_ot
    UNION ALL
    SELECT * FROM operaciones_oc
  ),
  finalizadas AS (
    SELECT
      o.*,
      public.fn_bi_dias_habiles_ar(
        (o.fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
        (o.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      ) AS dias_habiles_ciclo
    FROM operaciones o
    WHERE o.fecha_fin IS NOT NULL
  )
  SELECT
    COALESCE((
      SELECT AVG(f.dias_habiles_ciclo)::numeric
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS lead_time_dias_habiles_prom,

    COALESCE((
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN f.fecha_estimada IS NOT NULL AND f.fecha_fin <= f.fecha_estimada THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100
          ELSE 0
        END
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS on_time_pct,

    COALESCE((
      SELECT COUNT(*)::bigint
      FROM operaciones o
      WHERE o.estado IN ('pendiente', 'en_proceso')
    ), 0) AS backlog_activo,

    COALESCE((
      SELECT COUNT(*)::bigint
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS entregadas_periodo,

    COALESCE((
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY f.dias_habiles_ciclo)::numeric
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS ciclo_mediano_dias_habiles;
END;
$$;

DROP FUNCTION IF EXISTS public.fn_bi_operacion_tiempos_categoria_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_operacion_tiempos_categoria_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_entregadas bigint,
  lead_time_dias_habiles_prom numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH ot_base AS (
  SELECT
    ot.id AS orden_id,
    ot.fecha_creacion AS fecha_inicio,
    COALESCE(ot.fecha_entrega_real, ot.fecha_completado) AS fecha_fin
  FROM public.ordenes_trabajo ot
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND COALESCE(ot.fecha_entrega_real, ot.fecha_completado) IS NOT NULL
    AND ((COALESCE(ot.fecha_entrega_real, ot.fecha_completado) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
ot_categoria_rank AS (
  SELECT
    oti.orden_id,
    CASE
      WHEN oti.producto_categoria IS NULL OR btrim(oti.producto_categoria) = '' THEN 'Personalizado'
      WHEN lower(oti.producto_categoria) IN ('sin categoria', 'sin categorías', 'sin categorias') THEN 'Personalizado'
      ELSE oti.producto_categoria
    END AS categoria_nombre,
    SUM(oti.precio_total) AS monto_categoria,
    ROW_NUMBER() OVER (
      PARTITION BY oti.orden_id
      ORDER BY SUM(oti.precio_total) DESC, MIN(oti.producto_categoria)
    ) AS rn
  FROM public.ordenes_trabajo_items oti
  GROUP BY oti.orden_id, 2
),
ot_final AS (
  SELECT
    COALESCE(r.categoria_nombre, 'Personalizado') AS categoria_nombre,
    public.fn_bi_dias_habiles_ar(
      (b.fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      (b.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    ) AS dias_habiles
  FROM ot_base b
  LEFT JOIN ot_categoria_rank r
    ON r.orden_id = b.orden_id
   AND r.rn = 1
),
oc_final AS (
  SELECT
    'Centro de Copiado'::text AS categoria_nombre,
    public.fn_bi_dias_habiles_ar(
      (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      (cc.fecha_entrega_real AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    ) AS dias_habiles
  FROM public.centro_copiado_ordenes cc
  WHERE cc.company_id = p_company_id
    AND cc.estado <> 'cancelada'
    AND cc.orden_trabajo_id IS NULL
    AND cc.fecha_entrega_real IS NOT NULL
    AND ((cc.fecha_entrega_real AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
base AS (
  SELECT * FROM ot_final
  UNION ALL
  SELECT * FROM oc_final
)
SELECT
  b.categoria_nombre,
  COUNT(*)::bigint AS total_entregadas,
  AVG(b.dias_habiles)::numeric AS lead_time_dias_habiles_prom
FROM base b
GROUP BY b.categoria_nombre
ORDER BY lead_time_dias_habiles_prom DESC, total_entregadas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_feriado_trasladable_a_lunes(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pascua_domingo(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sync_feriados_nacionales_ar(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_dias_habiles_ar(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_operacion_kpis_v2(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_operacion_tiempos_categoria_v2(uuid, date, date) TO authenticated;

DO $$
DECLARE
  y int;
  y_start int := EXTRACT(YEAR FROM current_date)::int - 2;
  y_end int := EXTRACT(YEAR FROM current_date)::int + 5;
BEGIN
  FOR y IN y_start..y_end LOOP
    PERFORM public.fn_sync_feriados_nacionales_ar(y);
  END LOOP;
END;
$$;
