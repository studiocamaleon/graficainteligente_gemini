-- BI v2 Productos: métricas específicas de Impresion Gran Formato

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
    AND public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) = 'Impresion Gran Formato'
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
    )::numeric AS metros_lineales_base,
    COALESCE(NULLIF(le.cfg->>'tipo_venta_real', ''), NULLIF(le.cfg->>'tipo_venta', '')) AS tipo_venta_cfg
  FROM lineas_expand le
),
lineas_metricas AS (
  SELECT
    lc.item_id,
    lc.orden_id,
    lc.lineas_por_item,
    (lc.total_item / lc.lineas_por_item)::numeric AS ventas_linea,
    lc.ancho_cm,
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

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tipo_venta text,
  total_ventas numeric,
  total_lineas bigint,
  total_mt2 numeric,
  total_ml numeric,
  porcentaje_ventas numeric
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
    AND public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) = 'Impresion Gran Formato'
),
lineas_expand AS (
  SELECT
    b.item_id,
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
    (le.total_item / GREATEST(le.lineas_por_item, 1))::numeric AS ventas_linea,
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
    )::numeric AS metros_lineales_base,
    lower(COALESCE(NULLIF(le.cfg->>'tipo_venta_real', ''), NULLIF(le.cfg->>'tipo_venta', ''))) AS tipo_venta_cfg
  FROM lineas_expand le
),
lineas_metricas AS (
  SELECT
    CASE
      WHEN lc.tipo_venta_cfg = 'mt_lineal' THEN 'Metro lineal'
      WHEN lc.tipo_venta_cfg = 'mt2' THEN 'Metro cuadrado'
      WHEN lc.ancho_cm > 0 AND lc.metros_lineales_base > 0 THEN 'Metro lineal'
      ELSE 'Metro cuadrado'
    END AS tipo_venta,
    lc.ventas_linea,
    GREATEST(lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1), 0)::numeric AS ml_real,
    GREATEST(((lc.ancho_cm / 100) * lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1)), 0)::numeric AS mt2_real
  FROM lineas_calc lc
),
agg AS (
  SELECT
    lm.tipo_venta,
    SUM(lm.ventas_linea)::numeric AS total_ventas,
    COUNT(*)::bigint AS total_lineas,
    SUM(lm.mt2_real)::numeric AS total_mt2,
    SUM(lm.ml_real)::numeric AS total_ml
  FROM lineas_metricas lm
  GROUP BY lm.tipo_venta
),
tot AS (
  SELECT COALESCE(SUM(a.total_ventas), 0)::numeric AS total_ventas_all FROM agg a
)
SELECT
  a.tipo_venta,
  a.total_ventas,
  a.total_lineas,
  a.total_mt2,
  a.total_ml,
  CASE WHEN t.total_ventas_all > 0 THEN ((a.total_ventas / t.total_ventas_all) * 100)::numeric ELSE 0::numeric END AS porcentaje_ventas
FROM agg a
CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_top_materiales_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_top_materiales_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  material_label text,
  total_ventas numeric,
  total_lineas bigint,
  total_mt2 numeric,
  total_ml numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base_items AS (
  SELECT
    oti.id AS item_id,
    COALESCE(oti.precio_total, 0)::numeric AS total_item,
    COALESCE(oti.cantidad, 0)::numeric AS unidades_item,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    AND public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) = 'Impresion Gran Formato'
),
lineas_expand AS (
  SELECT
    b.item_id,
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
lineas_metricas AS (
  SELECT
    COALESCE(
      NULLIF(CONCAT_WS(' - ', NULLIF(le.cfg->>'material_nombre', ''), NULLIF(le.cfg->>'variante_nombre', '')), ''),
      'Sin material'
    ) AS material_label,
    (le.total_item / GREATEST(le.lineas_por_item, 1))::numeric AS ventas_linea,
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
agg AS (
  SELECT
    lm.material_label,
    SUM(lm.ventas_linea)::numeric AS total_ventas,
    COUNT(*)::bigint AS total_lineas,
    SUM(GREATEST(((lm.ancho_cm / 100) * lm.metros_lineales_base * GREATEST(lm.linea_cantidad, 1)), 0))::numeric AS total_mt2,
    SUM(GREATEST(lm.metros_lineales_base * GREATEST(lm.linea_cantidad, 1), 0))::numeric AS total_ml
  FROM lineas_metricas lm
  GROUP BY lm.material_label
)
SELECT
  a.material_label,
  a.total_ventas,
  a.total_lineas,
  a.total_mt2,
  a.total_ml
FROM agg a
ORDER BY a.total_ventas DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_top_materiales_v2(uuid, date, date, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_anchos_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_anchos_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  ancho_label text,
  ancho_cm numeric,
  total_ventas numeric,
  total_lineas bigint,
  total_ml numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base_items AS (
  SELECT
    oti.id AS item_id,
    COALESCE(oti.precio_total, 0)::numeric AS total_item,
    COALESCE(oti.cantidad, 0)::numeric AS unidades_item,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    AND public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) = 'Impresion Gran Formato'
),
lineas_expand AS (
  SELECT
    b.item_id,
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
lineas_metricas AS (
  SELECT
    COALESCE(
      NULLIF(le.linea->>'ancho_seleccionado', '')::numeric,
      NULLIF(le.linea->>'ancho', '')::numeric,
      NULLIF(le.cfg->>'medida_ancho', '')::numeric,
      0
    )::numeric AS ancho_cm,
    (le.total_item / GREATEST(le.lineas_por_item, 1))::numeric AS ventas_linea,
    COALESCE(NULLIF(le.linea->>'cantidad', '')::numeric, NULLIF(le.cfg->>'cantidad', '')::numeric, le.unidades_item, 1)::numeric AS linea_cantidad,
    COALESCE(
      NULLIF(le.linea->>'metros_lineales', '')::numeric,
      CASE WHEN NULLIF(le.linea->>'alto', '') IS NOT NULL THEN NULLIF(le.linea->>'alto', '')::numeric / 100 ELSE NULL END,
      CASE WHEN NULLIF(le.cfg->>'medida_alto', '') IS NOT NULL THEN NULLIF(le.cfg->>'medida_alto', '')::numeric / 100 ELSE NULL END,
      0
    )::numeric AS metros_lineales_base
  FROM lineas_expand le
),
filtered AS (
  SELECT * FROM lineas_metricas WHERE ancho_cm > 0
),
agg AS (
  SELECT
    f.ancho_cm,
    SUM(f.ventas_linea)::numeric AS total_ventas,
    COUNT(*)::bigint AS total_lineas,
    SUM(GREATEST(f.metros_lineales_base * GREATEST(f.linea_cantidad, 1), 0))::numeric AS total_ml
  FROM filtered f
  GROUP BY f.ancho_cm
)
SELECT
  (a.ancho_cm::text || ' cm')::text AS ancho_label,
  a.ancho_cm,
  a.total_ventas,
  a.total_lineas,
  a.total_ml
FROM agg a
ORDER BY a.total_ventas DESC
LIMIT GREATEST(COALESCE(p_limit, 12), 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_anchos_v2(uuid, date, date, integer) TO authenticated;
