-- BI v2 - Data correctness + métricas modernas
-- Timezone canónica: America/Argentina/Buenos_Aires
-- Política OC: para métricas comerciales se excluyen OC vinculadas a OT (orden_trabajo_id IS NULL)

-- Índices de soporte para consultas BI
CREATE INDEX IF NOT EXISTS idx_ot_company_estado_fecha_creacion_bi_v2
  ON public.ordenes_trabajo (company_id, estado, fecha_creacion);

CREATE INDEX IF NOT EXISTS idx_cc_company_estado_fecha_solicitud_vinculada_bi_v2
  ON public.centro_copiado_ordenes (company_id, estado, fecha_solicitud, orden_trabajo_id);

CREATE INDEX IF NOT EXISTS idx_otp_orden_fecha_pago_bi_v2
  ON public.ordenes_trabajo_pagos (orden_id, fecha_pago);

CREATE INDEX IF NOT EXISTS idx_ccp_orden_fecha_pago_bi_v2
  ON public.centro_copiado_ordenes_pagos (orden_copiado_id, fecha_pago);

CREATE INDEX IF NOT EXISTS idx_cm_caja_fecha_tipo_bi_v2
  ON public.cajas_movimientos (caja_id, fecha, tipo_movimiento);

-- =====================================================
-- fn_bi_kpis_executive_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_kpis_executive_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_kpis_executive_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  revenue_total numeric,
  revenue_growth_pct numeric,
  total_orders bigint,
  ticket_promedio numeric,
  cash_margin_pct numeric,
  brecha_cobranza numeric,
  canal_dominante text,
  canal_concentracion_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dias_periodo integer;
  v_fecha_inicio_anterior date;
  v_fecha_fin_anterior date;
BEGIN
  v_dias_periodo := (p_fecha_fin - p_fecha_inicio) + 1;
  v_fecha_fin_anterior := p_fecha_inicio - 1;
  v_fecha_inicio_anterior := v_fecha_fin_anterior - (v_dias_periodo - 1);

  RETURN QUERY
  WITH ventas_actual AS (
    SELECT
      SUM(v.total) AS total_ventas,
      COUNT(*) AS total_ordenes,
      AVG(v.total) AS ticket
    FROM (
      SELECT
        ot.total,
        COALESCE(ot.canal_venta, 'Mostrador') AS canal
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

      UNION ALL

      SELECT
        cc.total,
        COALESCE(cc.origen, 'Mostrador') AS canal
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ) v
  ),
  ventas_anterior AS (
    SELECT SUM(v.total) AS total_ventas_anterior
    FROM (
      SELECT ot.total
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior)

      UNION ALL

      SELECT cc.total
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior)
    ) v
  ),
  canal_top AS (
    SELECT
      q.canal,
      q.ventas,
      CASE WHEN t.total_ventas > 0 THEN (q.ventas / t.total_ventas) * 100 ELSE 0 END AS share
    FROM (
      SELECT canal, SUM(total) AS ventas
      FROM (
        SELECT COALESCE(ot.canal_venta, 'Mostrador') AS canal, ot.total
        FROM public.ordenes_trabajo ot
        WHERE ot.company_id = p_company_id
          AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
          AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

        UNION ALL

        SELECT COALESCE(cc.origen, 'Mostrador') AS canal, cc.total
        FROM public.centro_copiado_ordenes cc
        WHERE cc.company_id = p_company_id
          AND cc.estado <> 'cancelada'
          AND cc.orden_trabajo_id IS NULL
          AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
      ) x
      GROUP BY canal
      ORDER BY SUM(total) DESC
      LIMIT 1
    ) q
    CROSS JOIN (
      SELECT COALESCE(SUM(total), 0) AS total_ventas
      FROM (
        SELECT ot.total
        FROM public.ordenes_trabajo ot
        WHERE ot.company_id = p_company_id
          AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
          AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

        UNION ALL

        SELECT cc.total
        FROM public.centro_copiado_ordenes cc
        WHERE cc.company_id = p_company_id
          AND cc.estado <> 'cancelada'
          AND cc.orden_trabajo_id IS NULL
          AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
      ) z
    ) t
  ),
  caja AS (
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END), 0) AS egresos
    FROM public.cajas_movimientos m
    JOIN public.cajas c ON c.id = m.caja_id
    WHERE c.company_id = p_company_id
      AND m.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
  ),
  cobros_periodo AS (
    SELECT
      COALESCE((
        SELECT SUM(otp.monto)
        FROM public.ordenes_trabajo_pagos otp
        JOIN public.ordenes_trabajo ot ON ot.id = otp.orden_id
        WHERE ot.company_id = p_company_id
          AND otp.fecha_pago BETWEEN p_fecha_inicio AND p_fecha_fin
      ), 0)
      +
      COALESCE((
        SELECT SUM(ccp.monto)
        FROM public.centro_copiado_ordenes_pagos ccp
        JOIN public.centro_copiado_ordenes cc ON cc.id = ccp.orden_copiado_id
        WHERE cc.company_id = p_company_id
          AND cc.orden_trabajo_id IS NULL
          AND ccp.fecha_pago BETWEEN p_fecha_inicio AND p_fecha_fin
      ), 0) AS cobrado
  )
  SELECT
    COALESCE(va.total_ventas, 0) AS revenue_total,
    CASE
      WHEN COALESCE(van.total_ventas_anterior, 0) > 0
      THEN ((COALESCE(va.total_ventas, 0) - van.total_ventas_anterior) / van.total_ventas_anterior) * 100
      ELSE 0
    END AS revenue_growth_pct,
    COALESCE(va.total_ordenes, 0) AS total_orders,
    COALESCE(va.ticket, 0) AS ticket_promedio,
    CASE
      WHEN caja.ingresos > 0 THEN ((caja.ingresos - caja.egresos) / caja.ingresos) * 100
      ELSE 0
    END AS cash_margin_pct,
    GREATEST(COALESCE(va.total_ventas, 0) - COALESCE(cp.cobrado, 0), 0) AS brecha_cobranza,
    COALESCE(ct.canal, 'Sin datos') AS canal_dominante,
    COALESCE(ct.share, 0) AS canal_concentracion_pct
  FROM ventas_actual va
  CROSS JOIN ventas_anterior van
  CROSS JOIN caja
  CROSS JOIN cobros_periodo cp
  LEFT JOIN canal_top ct ON true;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_kpis_executive_v2(uuid, date, date)
IS 'KPIs ejecutivos BI v2 con criterio comercial en fecha de creación OT/OC y caja por fecha de movimiento/pago.';

GRANT EXECUTE ON FUNCTION public.fn_bi_kpis_executive_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_ventas_timeline_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_ventas_timeline_v2(uuid, date, date, text);
CREATE OR REPLACE FUNCTION public.fn_bi_ventas_timeline_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_granularidad text DEFAULT 'dia'
)
RETURNS TABLE(
  periodo date,
  periodo_label text,
  total_ventas numeric,
  total_ordenes bigint,
  ordenes_ot bigint,
  ordenes_oc bigint,
  ticket_promedio numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_granularidad NOT IN ('dia', 'semana', 'mes') THEN
    p_granularidad := 'dia';
  END IF;

  IF p_granularidad = 'dia' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(p_fecha_inicio, p_fecha_fin, interval '1 day')::date AS p
    ),
    ventas AS (
      SELECT
        ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS periodo,
        ot.total AS monto,
        'ot'::text AS tipo
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

      UNION ALL

      SELECT
        ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS periodo,
        cc.total AS monto,
        'oc'::text AS tipo
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ),
    agg AS (
      SELECT
        v.periodo,
        SUM(v.monto) AS total_ventas,
        COUNT(*)::bigint AS total_ordenes,
        COUNT(*) FILTER (WHERE v.tipo = 'ot')::bigint AS ordenes_ot,
        COUNT(*) FILTER (WHERE v.tipo = 'oc')::bigint AS ordenes_oc
      FROM ventas v
      GROUP BY v.periodo
    )
    SELECT
      p.p AS periodo,
      to_char(p.p, 'DD/MM') AS periodo_label,
      COALESCE(a.total_ventas, 0),
      COALESCE(a.total_ordenes, 0),
      COALESCE(a.ordenes_ot, 0),
      COALESCE(a.ordenes_oc, 0),
      CASE WHEN COALESCE(a.total_ordenes, 0) > 0 THEN COALESCE(a.total_ventas, 0) / a.total_ordenes ELSE 0 END
    FROM periodos p
    LEFT JOIN agg a ON a.periodo = p.p
    ORDER BY p.p;

  ELSIF p_granularidad = 'semana' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('week', p_fecha_inicio::timestamp),
        date_trunc('week', p_fecha_fin::timestamp),
        interval '1 week'
      )::date AS p
    ),
    ventas AS (
      SELECT
        date_trunc('week', (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS periodo,
        ot.total AS monto,
        'ot'::text AS tipo
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

      UNION ALL

      SELECT
        date_trunc('week', (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS periodo,
        cc.total AS monto,
        'oc'::text AS tipo
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ),
    agg AS (
      SELECT
        v.periodo,
        SUM(v.monto) AS total_ventas,
        COUNT(*)::bigint AS total_ordenes,
        COUNT(*) FILTER (WHERE v.tipo = 'ot')::bigint AS ordenes_ot,
        COUNT(*) FILTER (WHERE v.tipo = 'oc')::bigint AS ordenes_oc
      FROM ventas v
      GROUP BY v.periodo
    )
    SELECT
      p.p AS periodo,
      'Sem ' || to_char(p.p, 'IW YYYY') AS periodo_label,
      COALESCE(a.total_ventas, 0),
      COALESCE(a.total_ordenes, 0),
      COALESCE(a.ordenes_ot, 0),
      COALESCE(a.ordenes_oc, 0),
      CASE WHEN COALESCE(a.total_ordenes, 0) > 0 THEN COALESCE(a.total_ventas, 0) / a.total_ordenes ELSE 0 END
    FROM periodos p
    LEFT JOIN agg a ON a.periodo = p.p
    ORDER BY p.p;

  ELSE
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('month', p_fecha_inicio::timestamp),
        date_trunc('month', p_fecha_fin::timestamp),
        interval '1 month'
      )::date AS p
    ),
    ventas AS (
      SELECT
        date_trunc('month', (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS periodo,
        ot.total AS monto,
        'ot'::text AS tipo
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

      UNION ALL

      SELECT
        date_trunc('month', (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS periodo,
        cc.total AS monto,
        'oc'::text AS tipo
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ),
    agg AS (
      SELECT
        v.periodo,
        SUM(v.monto) AS total_ventas,
        COUNT(*)::bigint AS total_ordenes,
        COUNT(*) FILTER (WHERE v.tipo = 'ot')::bigint AS ordenes_ot,
        COUNT(*) FILTER (WHERE v.tipo = 'oc')::bigint AS ordenes_oc
      FROM ventas v
      GROUP BY v.periodo
    )
    SELECT
      p.p AS periodo,
      to_char(p.p, 'Mon YYYY') AS periodo_label,
      COALESCE(a.total_ventas, 0),
      COALESCE(a.total_ordenes, 0),
      COALESCE(a.ordenes_ot, 0),
      COALESCE(a.ordenes_oc, 0),
      CASE WHEN COALESCE(a.total_ordenes, 0) > 0 THEN COALESCE(a.total_ventas, 0) / a.total_ordenes ELSE 0 END
    FROM periodos p
    LEFT JOIN agg a ON a.periodo = p.p
    ORDER BY p.p;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_ventas_timeline_v2(uuid, date, date, text)
IS 'Timeline BI v2 con orden cronológico real y granularidad día/semana/mes.';

GRANT EXECUTE ON FUNCTION public.fn_bi_ventas_timeline_v2(uuid, date, date, text) TO authenticated;

-- =====================================================
-- fn_bi_ventas_canal_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_ventas_canal_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_ventas_canal_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  canal text,
  total_ventas numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric,
  ticket_promedio numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH ventas AS (
  SELECT COALESCE(ot.canal_venta, 'Mostrador') AS canal, ot.total AS monto
  FROM public.ordenes_trabajo ot
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

  UNION ALL

  SELECT COALESCE(cc.origen, 'Mostrador') AS canal, cc.total AS monto
  FROM public.centro_copiado_ordenes cc
  WHERE cc.company_id = p_company_id
    AND cc.estado <> 'cancelada'
    AND cc.orden_trabajo_id IS NULL
    AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
agg AS (
  SELECT canal, SUM(monto) AS total_ventas, COUNT(*)::bigint AS total_ordenes
  FROM ventas
  GROUP BY canal
),
t AS (
  SELECT COALESCE(SUM(total_ventas), 0) AS total FROM agg
)
SELECT
  a.canal,
  a.total_ventas,
  a.total_ordenes,
  CASE WHEN t.total > 0 THEN (a.total_ventas / t.total) * 100 ELSE 0 END AS porcentaje_ventas,
  CASE WHEN a.total_ordenes > 0 THEN a.total_ventas / a.total_ordenes ELSE 0 END AS ticket_promedio
FROM agg a
CROSS JOIN t
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_ventas_canal_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_ventas_categoria_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_ventas_categoria_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_ventas_categoria_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_ventas numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric,
  ticket_promedio numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH categorias_ot AS (
  SELECT
    COALESCE(NULLIF(oti.producto_categoria, ''), 'Sin Categoría') AS categoria,
    oti.precio_total AS monto,
    ot.id AS orden_id
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
categorias_oc AS (
  SELECT
    'Centro de Copiado'::text AS categoria,
    cc.total AS monto,
    cc.id AS orden_id
  FROM public.centro_copiado_ordenes cc
  WHERE cc.company_id = p_company_id
    AND cc.estado <> 'cancelada'
    AND cc.orden_trabajo_id IS NULL
    AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
all_cat AS (
  SELECT * FROM categorias_ot
  UNION ALL
  SELECT * FROM categorias_oc
),
agg AS (
  SELECT
    categoria,
    SUM(monto) AS total_ventas,
    COUNT(DISTINCT orden_id)::bigint AS total_ordenes
  FROM all_cat
  GROUP BY categoria
),
t AS (
  SELECT COALESCE(SUM(total_ventas), 0) AS total FROM agg
)
SELECT
  a.categoria AS categoria_nombre,
  a.total_ventas,
  a.total_ordenes,
  CASE WHEN t.total > 0 THEN (a.total_ventas / t.total) * 100 ELSE 0 END AS porcentaje_ventas,
  CASE WHEN a.total_ordenes > 0 THEN a.total_ventas / a.total_ordenes ELSE 0 END AS ticket_promedio
FROM agg a
CROSS JOIN t
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_ventas_categoria_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_top_productos_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_top_productos_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_top_productos_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  producto_nombre text,
  categoria_nombre text,
  total_vendido numeric,
  unidades_vendidas numeric,
  porcentaje_ventas numeric,
  ticket_promedio numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    COALESCE(NULLIF(oti.producto_nombre, ''), 'Producto personalizado') AS producto_nombre,
    COALESCE(NULLIF(oti.producto_categoria, ''), 'Sin Categoría') AS categoria_nombre,
    oti.precio_total AS total,
    oti.cantidad AS unidades
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
agg AS (
  SELECT
    b.producto_nombre,
    b.categoria_nombre,
    SUM(b.total) AS total_vendido,
    SUM(b.unidades) AS unidades_vendidas
  FROM base b
  GROUP BY b.producto_nombre, b.categoria_nombre
),
t AS (
  SELECT COALESCE(SUM(total_vendido), 0) AS total FROM agg
)
SELECT
  a.producto_nombre,
  a.categoria_nombre,
  a.total_vendido,
  a.unidades_vendidas,
  CASE WHEN t.total > 0 THEN (a.total_vendido / t.total) * 100 ELSE 0 END AS porcentaje_ventas,
  CASE WHEN a.unidades_vendidas > 0 THEN a.total_vendido / a.unidades_vendidas ELSE 0 END AS ticket_promedio
FROM agg a
CROSS JOIN t
ORDER BY a.total_vendido DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_top_productos_v2(uuid, date, date, integer) TO authenticated;

-- =====================================================
-- fn_bi_heatmap_horario_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_heatmap_horario_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_heatmap_horario_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  dia_semana integer,
  hora integer,
  total_ordenes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    EXTRACT(DOW FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS dow,
    EXTRACT(HOUR FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS hh
  FROM public.ordenes_trabajo ot
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

  UNION ALL

  SELECT
    EXTRACT(DOW FROM (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS dow,
    EXTRACT(HOUR FROM (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS hh
  FROM public.centro_copiado_ordenes cc
  WHERE cc.company_id = p_company_id
    AND cc.estado <> 'cancelada'
    AND cc.orden_trabajo_id IS NULL
    AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
)
SELECT
  b.dow AS dia_semana,
  b.hh AS hora,
  COUNT(*)::bigint AS total_ordenes
FROM base b
GROUP BY b.dow, b.hh
ORDER BY b.dow, b.hh;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_heatmap_horario_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_caja_resumen_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_caja_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_caja_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  ingresos_movimientos numeric,
  egresos_movimientos numeric,
  balance_movimientos numeric,
  cobrado_periodo numeric,
  pendiente_0_30 numeric,
  pendiente_31_60 numeric,
  pendiente_61_mas numeric,
  dso_estimado numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH movimientos AS (
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END), 0) AS egresos
    FROM public.cajas_movimientos m
    JOIN public.cajas c ON c.id = m.caja_id
    WHERE c.company_id = p_company_id
      AND m.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
  ),
  cobros AS (
    SELECT
      COALESCE((
        SELECT SUM(otp.monto)
        FROM public.ordenes_trabajo_pagos otp
        JOIN public.ordenes_trabajo ot ON ot.id = otp.orden_id
        WHERE ot.company_id = p_company_id
          AND otp.fecha_pago BETWEEN p_fecha_inicio AND p_fecha_fin
      ), 0)
      +
      COALESCE((
        SELECT SUM(ccp.monto)
        FROM public.centro_copiado_ordenes_pagos ccp
        JOIN public.centro_copiado_ordenes cc ON cc.id = ccp.orden_copiado_id
        WHERE cc.company_id = p_company_id
          AND cc.orden_trabajo_id IS NULL
          AND ccp.fecha_pago BETWEEN p_fecha_inicio AND p_fecha_fin
      ), 0) AS cobrado
  ),
  deuda_ot AS (
    SELECT
      ot.id AS orden_id,
      ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden,
      ot.total AS total,
      COALESCE((
        SELECT SUM(otp.monto)
        FROM public.ordenes_trabajo_pagos otp
        WHERE otp.orden_id = ot.id
          AND otp.fecha_pago <= p_fecha_fin
      ), 0) AS pagado,
      (
        SELECT MAX(otp.fecha_pago)
        FROM public.ordenes_trabajo_pagos otp
        WHERE otp.orden_id = ot.id
      ) AS ultimo_pago
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
      AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= p_fecha_fin)
  ),
  deuda_oc AS (
    SELECT
      cc.id AS orden_id,
      ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden,
      cc.total AS total,
      COALESCE((
        SELECT SUM(ccp.monto)
        FROM public.centro_copiado_ordenes_pagos ccp
        WHERE ccp.orden_copiado_id = cc.id
          AND ccp.fecha_pago <= p_fecha_fin
      ), 0) AS pagado,
      (
        SELECT MAX(ccp.fecha_pago)
        FROM public.centro_copiado_ordenes_pagos ccp
        WHERE ccp.orden_copiado_id = cc.id
      ) AS ultimo_pago
    FROM public.centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.estado <> 'cancelada'
      AND cc.orden_trabajo_id IS NULL
      AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= p_fecha_fin)
  ),
  deuda_total AS (
    SELECT * FROM deuda_ot
    UNION ALL
    SELECT * FROM deuda_oc
  ),
  aging AS (
    SELECT
      COALESCE(SUM(CASE WHEN (p_fecha_fin - d.fecha_orden) BETWEEN 0 AND 30 THEN GREATEST(d.total - d.pagado, 0) ELSE 0 END), 0) AS p0_30,
      COALESCE(SUM(CASE WHEN (p_fecha_fin - d.fecha_orden) BETWEEN 31 AND 60 THEN GREATEST(d.total - d.pagado, 0) ELSE 0 END), 0) AS p31_60,
      COALESCE(SUM(CASE WHEN (p_fecha_fin - d.fecha_orden) > 60 THEN GREATEST(d.total - d.pagado, 0) ELSE 0 END), 0) AS p61_mas
    FROM deuda_total d
  ),
  dso AS (
    SELECT
      COALESCE(AVG(
        CASE
          WHEN d.ultimo_pago IS NOT NULL AND d.pagado >= d.total
          THEN (d.ultimo_pago - d.fecha_orden)
          ELSE NULL
        END
      ), 0) AS avg_days
    FROM deuda_total d
    WHERE d.fecha_orden BETWEEN p_fecha_inicio AND p_fecha_fin
  )
  SELECT
    m.ingresos,
    m.egresos,
    m.ingresos - m.egresos,
    c.cobrado,
    a.p0_30,
    a.p31_60,
    a.p61_mas,
    d.avg_days::numeric
  FROM movimientos m
  CROSS JOIN cobros c
  CROSS JOIN aging a
  CROSS JOIN dso d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_caja_resumen_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_clientes_kpis_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_clientes_kpis_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_clientes_kpis_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  clientes_nuevos bigint,
  clientes_activos bigint,
  clientes_recurrentes bigint,
  frecuencia_compra numeric,
  recencia_media_dias numeric,
  concentracion_top10_pct numeric,
  ticket_promedio_cliente numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ventas_cliente_periodo AS (
    SELECT
      ot.cliente_id,
      ot.total AS monto,
      ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden
    FROM public.ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
      AND ot.cliente_id IS NOT NULL
      AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)

    UNION ALL

    SELECT
      cc.cliente_id,
      cc.total AS monto,
      ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden
    FROM public.centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.estado <> 'cancelada'
      AND cc.orden_trabajo_id IS NULL
      AND cc.cliente_id IS NOT NULL
      AND ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
  ),
  resumen_cliente AS (
    SELECT
      v.cliente_id,
      COUNT(*)::bigint AS ordenes,
      SUM(v.monto) AS total_ventas,
      MAX(v.fecha_orden) AS ultima_orden_periodo
    FROM ventas_cliente_periodo v
    GROUP BY v.cliente_id
  ),
  top10 AS (
    SELECT COALESCE(SUM(x.total_ventas), 0) AS top10_sales
    FROM (
      SELECT r.total_ventas
      FROM resumen_cliente r
      ORDER BY r.total_ventas DESC
      LIMIT 10
    ) x
  ),
  total_sales AS (
    SELECT COALESCE(SUM(r.total_ventas), 0) AS total_sales
    FROM resumen_cliente r
  ),
  ultimas_ordenes_global AS (
    SELECT
      z.cliente_id,
      MAX(z.fecha_orden) AS ultima_orden
    FROM (
      SELECT
        ot.cliente_id,
        ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden
      FROM public.ordenes_trabajo ot
      WHERE ot.company_id = p_company_id
        AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
        AND ot.cliente_id IS NOT NULL

      UNION ALL

      SELECT
        cc.cliente_id,
        ((cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS fecha_orden
      FROM public.centro_copiado_ordenes cc
      WHERE cc.company_id = p_company_id
        AND cc.estado <> 'cancelada'
        AND cc.orden_trabajo_id IS NULL
        AND cc.cliente_id IS NOT NULL
    ) z
    GROUP BY z.cliente_id
  )
  SELECT
    COALESCE((
      SELECT COUNT(*)::bigint
      FROM public.clients c
      WHERE c.company_id = p_company_id
        AND ((c.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS clientes_nuevos,
    COALESCE((SELECT COUNT(*)::bigint FROM resumen_cliente), 0) AS clientes_activos,
    COALESCE((SELECT COUNT(*)::bigint FROM resumen_cliente WHERE ordenes >= 2), 0) AS clientes_recurrentes,
    CASE
      WHEN (SELECT COUNT(*) FROM resumen_cliente) > 0
      THEN (SELECT SUM(ordenes)::numeric / COUNT(*) FROM resumen_cliente)
      ELSE 0
    END AS frecuencia_compra,
    COALESCE((
      SELECT AVG((p_fecha_fin - u.ultima_orden))::numeric
      FROM ultimas_ordenes_global u
      JOIN resumen_cliente rc ON rc.cliente_id = u.cliente_id
    ), 0) AS recencia_media_dias,
    CASE
      WHEN ts.total_sales > 0 THEN (t10.top10_sales / ts.total_sales) * 100
      ELSE 0
    END AS concentracion_top10_pct,
    CASE
      WHEN (SELECT COUNT(*) FROM resumen_cliente) > 0
      THEN (SELECT SUM(total_ventas) / COUNT(*) FROM resumen_cliente)
      ELSE 0
    END AS ticket_promedio_cliente
  FROM top10 t10
  CROSS JOIN total_sales ts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_clientes_kpis_v2(uuid, date, date) TO authenticated;

-- =====================================================
-- fn_bi_operacion_kpis_v2
-- =====================================================
DROP FUNCTION IF EXISTS public.fn_bi_operacion_kpis_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_operacion_kpis_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  lead_time_horas_prom numeric,
  on_time_pct numeric,
  backlog_activo bigint,
  entregadas_periodo bigint,
  ciclo_mediano_horas numeric
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
      EXTRACT(EPOCH FROM (o.fecha_fin - o.fecha_inicio)) / 3600.0 AS horas_ciclo
    FROM operaciones o
    WHERE o.fecha_fin IS NOT NULL
  )
  SELECT
    COALESCE((
      SELECT AVG(f.horas_ciclo)::numeric
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS lead_time_horas_prom,

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
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY f.horas_ciclo)::numeric
      FROM finalizadas f
      WHERE ((f.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ), 0) AS ciclo_mediano_horas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_operacion_kpis_v2(uuid, date, date) TO authenticated;
