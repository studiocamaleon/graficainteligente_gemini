-- Normaliza categorías legacy para BI v2 y evita mostrar "Sin Categoría"
-- Regla de negocio: categoría faltante => "Personalizado"

-- 1) Backfill de datos históricos (snapshot en items)
UPDATE public.ordenes_trabajo_items
SET producto_categoria = 'Personalizado'
WHERE producto_categoria IS NULL
   OR btrim(producto_categoria) = ''
   OR lower(producto_categoria) IN ('sin categoria', 'sin categorías', 'sin categorias');

-- 2) Reemplazo de función BI v2: ventas por categoría
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
    CASE
      WHEN oti.producto_categoria IS NULL OR btrim(oti.producto_categoria) = '' THEN 'Personalizado'
      WHEN lower(oti.producto_categoria) IN ('sin categoria', 'sin categorías', 'sin categorias') THEN 'Personalizado'
      ELSE oti.producto_categoria
    END AS categoria,
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

-- 3) Reemplazo de función BI v2: top productos
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
    CASE
      WHEN oti.producto_categoria IS NULL OR btrim(oti.producto_categoria) = '' THEN 'Personalizado'
      WHEN lower(oti.producto_categoria) IN ('sin categoria', 'sin categorías', 'sin categorias') THEN 'Personalizado'
      ELSE oti.producto_categoria
    END AS categoria_nombre,
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
LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_top_productos_v2(uuid, date, date, integer) TO authenticated;
