-- BI v2 Productos: usar fallback de categoría desde configuracion cuando producto_categoria viene null/vacío.

DROP FUNCTION IF EXISTS public.fn_bi_productos_categorias_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_categorias_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    ot.id AS orden_id,
    public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) AS categoria_nombre,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
filtered AS (
  SELECT * FROM base b WHERE b.categoria_nombre IS NOT NULL
),
agg AS (
  SELECT
    b.categoria_nombre,
    SUM(b.total)::numeric AS total_ventas,
    SUM(b.unidades)::numeric AS total_unidades,
    COUNT(DISTINCT b.orden_id)::bigint AS total_ordenes
  FROM filtered b
  GROUP BY b.categoria_nombre
)
SELECT
  a.categoria_nombre,
  a.total_ventas,
  a.total_unidades,
  a.total_ordenes
FROM agg a
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_categorias_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_resumen_v2(uuid, date, date, text);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_categoria text DEFAULT NULL
)
RETURNS TABLE(
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  ticket_promedio_orden numeric,
  precio_promedio_unidad numeric,
  productos_unicos bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    ot.id AS orden_id,
    public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) AS categoria_nombre,
    COALESCE(NULLIF(oti.producto_nombre, ''), 'Producto personalizado') AS producto_nombre,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
filtered AS (
  SELECT *
  FROM base b
  WHERE b.categoria_nombre IS NOT NULL
    AND (
      p_categoria IS NULL
      OR lower(b.categoria_nombre) = lower(public.fn_bi_categoria_producto_normalizada(p_categoria))
    )
)
SELECT
  COALESCE(SUM(f.total), 0)::numeric AS total_ventas,
  COALESCE(SUM(f.unidades), 0)::numeric AS total_unidades,
  COALESCE(COUNT(DISTINCT f.orden_id), 0)::bigint AS total_ordenes,
  CASE WHEN COUNT(DISTINCT f.orden_id) > 0 THEN (SUM(f.total) / COUNT(DISTINCT f.orden_id))::numeric ELSE 0::numeric END AS ticket_promedio_orden,
  CASE WHEN SUM(f.unidades) > 0 THEN (SUM(f.total) / SUM(f.unidades))::numeric ELSE 0::numeric END AS precio_promedio_unidad,
  COALESCE(COUNT(DISTINCT f.producto_nombre), 0)::bigint AS productos_unicos
FROM filtered f;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_resumen_v2(uuid, date, date, text) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_top_v2(uuid, date, date, text, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_top_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_categoria text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  producto_nombre text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  ticket_promedio_orden numeric,
  precio_promedio_unidad numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    ot.id AS orden_id,
    public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) AS categoria_nombre,
    COALESCE(NULLIF(oti.producto_nombre, ''), 'Producto personalizado') AS producto_nombre,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
filtered AS (
  SELECT *
  FROM base b
  WHERE b.categoria_nombre IS NOT NULL
    AND (
      p_categoria IS NULL
      OR lower(b.categoria_nombre) = lower(public.fn_bi_categoria_producto_normalizada(p_categoria))
    )
),
agg AS (
  SELECT
    f.producto_nombre,
    SUM(f.total)::numeric AS total_ventas,
    SUM(f.unidades)::numeric AS total_unidades,
    COUNT(DISTINCT f.orden_id)::bigint AS total_ordenes
  FROM filtered f
  GROUP BY f.producto_nombre
)
SELECT
  a.producto_nombre,
  a.total_ventas,
  a.total_unidades,
  a.total_ordenes,
  CASE WHEN a.total_ordenes > 0 THEN (a.total_ventas / a.total_ordenes)::numeric ELSE 0::numeric END AS ticket_promedio_orden,
  CASE WHEN a.total_unidades > 0 THEN (a.total_ventas / a.total_unidades)::numeric ELSE 0::numeric END AS precio_promedio_unidad
FROM agg a
ORDER BY a.total_ventas DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_top_v2(uuid, date, date, text, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_items bigint,
  total_lineas bigint,
  total_mt2 numeric,
  total_ml numeric,
  ticket_promedio_orden numeric,
  precio_promedio_mt2 numeric,
  precio_promedio_ml numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base_items AS (
  SELECT
    oti.id AS item_id,
    ot.id AS orden_id,
    COALESCE(oti.precio_total, 0)::numeric AS total_item,
    COALESCE(oti.cantidad, 0)::numeric AS unidades_item,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    AND public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) = 'Impresion Gran Formato'
),
lineas_expand AS (
  SELECT
    b.item_id,
    b.orden_id,
    b.total_item,
    b.unidades_item,
    b.cfg,
    l.linea,
    COUNT(*) OVER (PARTITION BY b.item_id) AS lineas_por_item
  FROM base_items b
  CROSS JOIN LATERAL (
    SELECT value AS linea
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(b.cfg->'lineas_medidas') = 'array' THEN b.cfg->'lineas_medidas' ELSE '[]'::jsonb END
    )
    UNION ALL
    SELECT '{}'::jsonb
    WHERE COALESCE(jsonb_array_length(
      CASE WHEN jsonb_typeof(b.cfg->'lineas_medidas') = 'array' THEN b.cfg->'lineas_medidas' ELSE '[]'::jsonb END
    ), 0) = 0
  ) l
),
lineas_calc AS (
  SELECT
    le.item_id,
    le.orden_id,
    le.total_item,
    le.cfg,
    GREATEST(le.lineas_por_item, 1) AS lineas_por_item,
    COALESCE(NULLIF(le.linea->>'cantidad', '')::numeric, NULLIF(le.cfg->>'cantidad', '')::numeric, le.unidades_item, 1)::numeric AS linea_cantidad,
    COALESCE(
      NULLIF(le.linea->>'ancho_seleccionado', '')::numeric,
      NULLIF(le.linea->>'ancho', '')::numeric,
      NULLIF(le.cfg->>'medida_ancho', '')::numeric,
      0
    )::numeric AS ancho_cm,
    COALESCE(
      NULLIF(le.linea->>'metros_lineales', '')::numeric,
      CASE WHEN NULLIF(le.linea->>'alto', '') IS NOT NULL THEN NULLIF(le.linea->>'alto', '')::numeric / 100 ELSE NULL END,
      CASE WHEN NULLIF(le.cfg->>'medida_alto', '') IS NOT NULL THEN NULLIF(le.cfg->>'medida_alto', '')::numeric / 100 ELSE NULL END,
      0
    )::numeric AS metros_lineales_base
  FROM lineas_expand le
),
lineas_metricas AS (
  SELECT
    lc.item_id,
    lc.orden_id,
    lc.lineas_por_item,
    (lc.total_item / lc.lineas_por_item)::numeric AS ventas_linea,
    GREATEST(lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1), 0)::numeric AS ml_real,
    GREATEST(
      COALESCE(
        NULLIF(lc.cfg->>'mt2_total', '')::numeric / lc.lineas_por_item,
        ((lc.ancho_cm / 100) * lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1))
      ),
      0
    )::numeric AS mt2_real
  FROM lineas_calc lc
)
SELECT
  COALESCE(SUM(lm.ventas_linea), 0)::numeric AS total_ventas,
  COALESCE(COUNT(DISTINCT lm.orden_id), 0)::bigint AS total_ordenes,
  COALESCE(COUNT(DISTINCT lm.item_id), 0)::bigint AS total_items,
  COALESCE(COUNT(*), 0)::bigint AS total_lineas,
  COALESCE(SUM(lm.mt2_real), 0)::numeric AS total_mt2,
  COALESCE(SUM(lm.ml_real), 0)::numeric AS total_ml,
  CASE WHEN COUNT(DISTINCT lm.orden_id) > 0 THEN (SUM(lm.ventas_linea) / COUNT(DISTINCT lm.orden_id))::numeric ELSE 0::numeric END AS ticket_promedio_orden,
  CASE WHEN SUM(lm.mt2_real) > 0 THEN (SUM(lm.ventas_linea) / SUM(lm.mt2_real))::numeric ELSE 0::numeric END AS precio_promedio_mt2,
  CASE WHEN SUM(lm.ml_real) > 0 THEN (SUM(lm.ventas_linea) / SUM(lm.ml_real))::numeric ELSE 0::numeric END AS precio_promedio_ml
FROM lineas_metricas lm;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_resumen_v2(uuid, date, date) TO authenticated;
