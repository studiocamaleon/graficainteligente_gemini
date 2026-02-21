-- Operación BI v2 en días hábiles (L-V) + desglose por categoría

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
      (
        SELECT COALESCE(COUNT(*), 0)::numeric
        FROM generate_series(
          (o.fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
          ((o.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1),
          interval '1 day'
        ) d
        WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
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

GRANT EXECUTE ON FUNCTION public.fn_bi_operacion_kpis_v2(uuid, date, date) TO authenticated;

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
    (
      SELECT COALESCE(COUNT(*), 0)::numeric
      FROM generate_series(
        (b.fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
        ((b.fecha_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1),
        interval '1 day'
      ) d
      WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
    ) AS dias_habiles
  FROM ot_base b
  LEFT JOIN ot_categoria_rank r
    ON r.orden_id = b.orden_id
   AND r.rn = 1
),
oc_final AS (
  SELECT
    'Centro de Copiado'::text AS categoria_nombre,
    (
      SELECT COALESCE(COUNT(*), 0)::numeric
      FROM generate_series(
        (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
        ((cc.fecha_entrega_real AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1),
        interval '1 day'
      ) d
      WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
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

GRANT EXECUTE ON FUNCTION public.fn_bi_operacion_tiempos_categoria_v2(uuid, date, date) TO authenticated;
