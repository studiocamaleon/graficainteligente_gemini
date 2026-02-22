-- BI v2 Productos: restrict to allowed system categories and normalize names.

DROP FUNCTION IF EXISTS public.fn_bi_categoria_producto_normalizada(text);
CREATE OR REPLACE FUNCTION public.fn_bi_categoria_producto_normalizada(p_categoria text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_categoria IS NULL OR btrim(p_categoria) = '' THEN NULL
    WHEN lower(btrim(p_categoria)) IN ('impresion laser', 'impresión laser') THEN 'Impresion Laser'
    WHEN lower(btrim(p_categoria)) IN ('impresion gran formato', 'impresión gran formato', 'gran formato') THEN 'Impresion Gran Formato'
    WHEN lower(btrim(p_categoria)) IN ('materiales rigidos', 'materiales rígidos') THEN 'Materiales Rigidos'
    WHEN lower(btrim(p_categoria)) = 'plotter de corte' THEN 'Plotter de Corte'
    WHEN lower(btrim(p_categoria)) = 'sellos' THEN 'Sellos'
    WHEN lower(btrim(p_categoria)) = 'portabanners' THEN 'Portabanners'
    WHEN lower(btrim(p_categoria)) = 'talonarios' THEN 'Talonarios'
    ELSE NULL
  END
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_categoria_producto_normalizada(text) TO authenticated;

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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
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
  CASE
    WHEN COUNT(DISTINCT f.orden_id) > 0 THEN (SUM(f.total) / COUNT(DISTINCT f.orden_id))::numeric
    ELSE 0::numeric
  END AS ticket_promedio_orden,
  CASE
    WHEN SUM(f.unidades) > 0 THEN (SUM(f.total) / SUM(f.unidades))::numeric
    ELSE 0::numeric
  END AS precio_promedio_unidad,
  COALESCE(COUNT(DISTINCT f.producto_nombre), 0)::bigint AS productos_unicos
FROM filtered f;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_resumen_v2(uuid, date, date, text) TO authenticated;

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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
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

CREATE OR REPLACE FUNCTION public.fn_bi_productos_laser_medidas_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  medida_label text,
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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
laser AS (
  SELECT
    b.orden_id,
    COALESCE(
      NULLIF(
        concat_ws('x',
          NULLIF(COALESCE(b.cfg->'medida_seleccionada'->>'ancho', b.cfg->>'medida_ancho', ''), ''),
          NULLIF(COALESCE(b.cfg->'medida_seleccionada'->>'alto', b.cfg->>'medida_alto', ''), '')
        ),
        ''
      ),
      'Sin medida'
    ) AS medida_label,
    b.total,
    b.unidades
  FROM base b
  WHERE b.categoria_nombre = 'Impresion Laser'
),
agg AS (
  SELECT
    l.medida_label,
    SUM(l.total)::numeric AS total_ventas,
    SUM(l.unidades)::numeric AS total_unidades,
    COUNT(DISTINCT l.orden_id)::bigint AS total_ordenes
  FROM laser l
  GROUP BY l.medida_label
)
SELECT
  a.medida_label,
  a.total_ventas,
  a.total_unidades,
  a.total_ordenes
FROM agg a
ORDER BY a.total_ventas DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_laser_medidas_v2(uuid, date, date, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_bi_productos_laser_tintas_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tinta_label text,
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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
laser AS (
  SELECT
    b.orden_id,
    COALESCE(NULLIF(COALESCE(b.cfg->>'tinta_nombre', b.cfg->>'tinta', b.cfg->>'tipo_tinta', ''), ''), 'Sin tinta') AS tinta_label,
    b.total,
    b.unidades
  FROM base b
  WHERE b.categoria_nombre = 'Impresion Laser'
),
agg AS (
  SELECT
    l.tinta_label,
    SUM(l.total)::numeric AS total_ventas,
    SUM(l.unidades)::numeric AS total_unidades,
    COUNT(DISTINCT l.orden_id)::bigint AS total_ordenes
  FROM laser l
  GROUP BY l.tinta_label
)
SELECT
  a.tinta_label,
  a.total_ventas,
  a.total_unidades,
  a.total_ordenes
FROM agg a
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_laser_tintas_v2(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_bi_productos_laser_caras_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  cara_label text,
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
    public.fn_bi_categoria_producto_normalizada(oti.producto_categoria) AS categoria_nombre,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg,
    COALESCE(oti.cantidad, 0)::numeric AS unidades,
    COALESCE(oti.precio_total, 0)::numeric AS total
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
laser AS (
  SELECT
    b.orden_id,
    CASE
      WHEN COALESCE(b.cfg->>'cara_impresa', b.cfg->>'cara_impresion', '') = 'solo_frente' THEN 'Solo frente'
      WHEN COALESCE(b.cfg->>'cara_impresa', b.cfg->>'cara_impresion', '') = 'frente_y_dorso' THEN 'Frente y dorso'
      ELSE 'Sin dato'
    END AS cara_label,
    b.total,
    b.unidades
  FROM base b
  WHERE b.categoria_nombre = 'Impresion Laser'
),
agg AS (
  SELECT
    l.cara_label,
    SUM(l.total)::numeric AS total_ventas,
    SUM(l.unidades)::numeric AS total_unidades,
    COUNT(DISTINCT l.orden_id)::bigint AS total_ordenes
  FROM laser l
  GROUP BY l.cara_label
)
SELECT
  a.cara_label,
  a.total_ventas,
  a.total_unidades,
  a.total_ordenes
FROM agg a
ORDER BY a.total_ventas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_laser_caras_v2(uuid, date, date) TO authenticated;
