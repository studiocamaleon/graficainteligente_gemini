-- BI v2 Gran Formato: segmentación por tecnología y unidad de venta (mt2/mt_lineal).

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_tecnologia_unidad_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_tecnologia_unidad_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tecnologia_label text,
  tipo_venta text,
  total_ventas numeric,
  total_lineas bigint,
  total_mt2 numeric,
  total_ml numeric,
  precio_promedio_mt2 numeric,
  precio_promedio_ml numeric
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
    AND public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) = 'Impresion Gran Formato'
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
    COALESCE(NULLIF(le.cfg->>'tecnologia_nombre', ''), 'Sin tecnología') AS tecnologia_label,
    CASE
      WHEN lower(COALESCE(NULLIF(le.cfg->>'tipo_venta_real', ''), NULLIF(le.cfg->>'tipo_venta', ''))) = 'mt_lineal' THEN 'Metro lineal'
      WHEN lower(COALESCE(NULLIF(le.cfg->>'tipo_venta_real', ''), NULLIF(le.cfg->>'tipo_venta', ''))) = 'mt2' THEN 'Metro cuadrado'
      WHEN COALESCE(NULLIF(le.linea->>'ancho_seleccionado', '')::numeric, NULLIF(le.linea->>'ancho', '')::numeric, NULLIF(le.cfg->>'medida_ancho', '')::numeric, 0) > 0
        AND COALESCE(NULLIF(le.linea->>'metros_lineales', '')::numeric, CASE WHEN NULLIF(le.linea->>'alto', '') IS NOT NULL THEN NULLIF(le.linea->>'alto', '')::numeric / 100 ELSE NULL END, CASE WHEN NULLIF(le.cfg->>'medida_alto', '') IS NOT NULL THEN NULLIF(le.cfg->>'medida_alto', '')::numeric / 100 ELSE NULL END, 0) > 0
        THEN 'Metro lineal'
      ELSE 'Metro cuadrado'
    END AS tipo_venta,
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
lineas_metricas AS (
  SELECT
    lc.tecnologia_label,
    lc.tipo_venta,
    lc.ventas_linea,
    GREATEST(lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1), 0)::numeric AS ml_real,
    GREATEST(((lc.ancho_cm / 100) * lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1)), 0)::numeric AS mt2_real
  FROM lineas_calc lc
),
agg AS (
  SELECT
    lm.tecnologia_label,
    lm.tipo_venta,
    SUM(lm.ventas_linea)::numeric AS total_ventas,
    COUNT(*)::bigint AS total_lineas,
    SUM(lm.mt2_real)::numeric AS total_mt2,
    SUM(lm.ml_real)::numeric AS total_ml
  FROM lineas_metricas lm
  GROUP BY lm.tecnologia_label, lm.tipo_venta
)
SELECT
  a.tecnologia_label,
  a.tipo_venta,
  a.total_ventas,
  a.total_lineas,
  a.total_mt2,
  a.total_ml,
  CASE WHEN a.total_mt2 > 0 THEN (a.total_ventas / a.total_mt2)::numeric ELSE 0::numeric END AS precio_promedio_mt2,
  CASE WHEN a.total_ml > 0 THEN (a.total_ventas / a.total_ml)::numeric ELSE 0::numeric END AS precio_promedio_ml
FROM agg a
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_tecnologia_unidad_v2(uuid, date, date) TO authenticated;
