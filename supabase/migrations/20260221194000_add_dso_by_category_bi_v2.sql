-- DSO por categoría (BI v2)
-- Mide días hasta cobro total, desagregado por categoría principal del trabajo.

DROP FUNCTION IF EXISTS public.fn_bi_dso_por_categoria_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_dso_por_categoria_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_ordenes_cobradas bigint,
  dso_promedio_dias numeric,
  dso_mediana_dias numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH ot_base AS (
  SELECT
    ot.id AS orden_id,
    (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha_orden,
    ot.total AS total_orden,
    COALESCE((
      SELECT SUM(otp.monto)
      FROM public.ordenes_trabajo_pagos otp
      WHERE otp.orden_id = ot.id
        AND otp.fecha_pago <= p_fecha_fin
    ), 0) AS total_pagado,
    (
      SELECT MAX(otp.fecha_pago)
      FROM public.ordenes_trabajo_pagos otp
      WHERE otp.orden_id = ot.id
    ) AS ultimo_pago
  FROM public.ordenes_trabajo ot
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
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
ot_principal AS (
  SELECT
    b.orden_id,
    COALESCE(c.categoria_nombre, 'Personalizado') AS categoria_nombre,
    (b.ultimo_pago - b.fecha_orden) AS dias_cobro
  FROM ot_base b
  LEFT JOIN ot_categoria_rank c ON c.orden_id = b.orden_id AND c.rn = 1
  WHERE b.fecha_orden BETWEEN p_fecha_inicio AND p_fecha_fin
    AND b.ultimo_pago IS NOT NULL
    AND b.total_pagado >= b.total_orden
),
oc_principal AS (
  SELECT
    cc.id AS orden_id,
    'Centro de Copiado'::text AS categoria_nombre,
    (
      (
        SELECT MAX(ccp.fecha_pago)
        FROM public.centro_copiado_ordenes_pagos ccp
        WHERE ccp.orden_copiado_id = cc.id
      ) - (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    ) AS dias_cobro
  FROM public.centro_copiado_ordenes cc
  WHERE cc.company_id = p_company_id
    AND cc.estado <> 'cancelada'
    AND cc.orden_trabajo_id IS NULL
    AND (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (
      SELECT COALESCE(SUM(ccp.monto), 0)
      FROM public.centro_copiado_ordenes_pagos ccp
      WHERE ccp.orden_copiado_id = cc.id
        AND ccp.fecha_pago <= p_fecha_fin
    ) >= cc.total
    AND (
      SELECT MAX(ccp.fecha_pago)
      FROM public.centro_copiado_ordenes_pagos ccp
      WHERE ccp.orden_copiado_id = cc.id
    ) IS NOT NULL
),
base AS (
  SELECT categoria_nombre, dias_cobro FROM ot_principal
  UNION ALL
  SELECT categoria_nombre, dias_cobro FROM oc_principal
)
SELECT
  b.categoria_nombre,
  COUNT(*)::bigint AS total_ordenes_cobradas,
  AVG(b.dias_cobro)::numeric AS dso_promedio_dias,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY b.dias_cobro)::numeric AS dso_mediana_dias
FROM base b
GROUP BY b.categoria_nombre
ORDER BY dso_promedio_dias DESC, total_ordenes_cobradas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_dso_por_categoria_v2(uuid, date, date) TO authenticated;
