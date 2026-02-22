-- Alinear mt2 de mix tipo_venta con resumen GF (priorizando cfg.mt2_total).

DROP FUNCTION IF EXISTS public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(uuid, date, date, text);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_tecnologia text DEFAULT NULL
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
    COALESCE(oti.precio_total, 0)::numeric AS total_item,
    COALESCE(oti.cantidad, 0)::numeric AS unidades_item,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg,
    pgf.tipo_venta AS tipo_venta_producto,
    COALESCE(NULLIF(oti.configuracion->>'tecnologia_nombre', ''), 'Sin tecnología') AS tecnologia_item
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  LEFT JOIN public.productos_gran_formato pgf
    ON pgf.id = oti.producto_id
    AND pgf.company_id = ot.company_id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    AND public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) = 'Impresion Gran Formato'
    AND (p_tecnologia IS NULL OR lower(COALESCE(NULLIF(oti.configuracion->>'tecnologia_nombre', ''), 'Sin tecnología')) = lower(p_tecnologia))
),
lineas_expand AS (
  SELECT
    b.item_id,
    b.total_item,
    b.unidades_item,
    b.cfg,
    b.tipo_venta_producto,
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
    CASE
      WHEN COALESCE(lc.tipo_venta_producto, lower(COALESCE(NULLIF(lc.cfg->>'tipo_venta_real', ''), NULLIF(lc.cfg->>'tipo_venta', '')))) = 'mt_lineal' THEN 'Metro lineal'
      WHEN COALESCE(lc.tipo_venta_producto, lower(COALESCE(NULLIF(lc.cfg->>'tipo_venta_real', ''), NULLIF(lc.cfg->>'tipo_venta', '')))) = 'mt2' THEN 'Metro cuadrado'
      WHEN COALESCE(NULLIF(lc.linea->>'ancho_seleccionado', '')::numeric, NULLIF(lc.linea->>'ancho', '')::numeric, NULLIF(lc.cfg->>'medida_ancho', '')::numeric, 0) > 0
        AND COALESCE(NULLIF(lc.linea->>'metros_lineales', '')::numeric, CASE WHEN NULLIF(lc.linea->>'alto', '') IS NOT NULL THEN NULLIF(lc.linea->>'alto', '')::numeric / 100 ELSE NULL END, CASE WHEN NULLIF(lc.cfg->>'medida_alto', '') IS NOT NULL THEN NULLIF(lc.cfg->>'medida_alto', '')::numeric / 100 ELSE NULL END, 0) > 0
        THEN 'Metro lineal'
      ELSE 'Metro cuadrado'
    END AS tipo_venta,
    (lc.total_item / GREATEST(lc.lineas_por_item, 1))::numeric AS ventas_linea,
    GREATEST(lc.lineas_por_item, 1) AS lineas_por_item,
    lc.cfg,
    COALESCE(NULLIF(lc.linea->>'cantidad', '')::numeric, NULLIF(lc.cfg->>'cantidad', '')::numeric, lc.unidades_item, 1)::numeric AS linea_cantidad,
    COALESCE(
      NULLIF(lc.linea->>'ancho_seleccionado', '')::numeric,
      NULLIF(lc.linea->>'ancho', '')::numeric,
      NULLIF(lc.cfg->>'medida_ancho', '')::numeric,
      0
    )::numeric AS ancho_cm,
    COALESCE(
      NULLIF(lc.linea->>'metros_lineales', '')::numeric,
      CASE WHEN NULLIF(lc.linea->>'alto', '') IS NOT NULL THEN NULLIF(lc.linea->>'alto', '')::numeric / 100 ELSE NULL END,
      CASE WHEN NULLIF(lc.cfg->>'medida_alto', '') IS NOT NULL THEN NULLIF(lc.cfg->>'medida_alto', '')::numeric / 100 ELSE NULL END,
      0
    )::numeric AS metros_lineales_base
  FROM lineas_expand lc
),
lineas_metricas AS (
  SELECT
    lc.tipo_venta,
    lc.ventas_linea,
    GREATEST(lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1), 0)::numeric AS ml_real,
    GREATEST(
      COALESCE(
        NULLIF(lc.cfg->>'mt2_total', '')::numeric / lc.lineas_por_item,
        ((lc.ancho_cm / 100) * lc.metros_lineales_base * GREATEST(lc.linea_cantidad, 1))
      ),
      0
    )::numeric AS mt2_real
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
tot AS (SELECT COALESCE(SUM(a.total_ventas), 0)::numeric AS total_ventas_all FROM agg a)
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

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_gran_formato_mix_tipo_venta_v2(uuid, date, date, text) TO authenticated;
