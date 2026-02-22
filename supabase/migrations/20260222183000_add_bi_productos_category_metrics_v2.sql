-- BI v2 Productos: métricas específicas por Talonarios, Plotter, Materiales Rígidos, Sellos y Portabanners

DROP FUNCTION IF EXISTS public.fn_bi_productos_base_items_v2(uuid, date, date, text);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_base_items_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_categoria text DEFAULT NULL
)
RETURNS TABLE(
  orden_id uuid,
  item_id uuid,
  categoria_nombre text,
  producto_nombre text,
  cantidad numeric,
  total numeric,
  tipo_copia text,
  tinta_label text,
  material_label text,
  medida_label text,
  ancho_cm numeric,
  alto_cm numeric,
  ml_total numeric,
  mt2_total numeric,
  color_label text,
  marca_label text,
  tecnologia_label text,
  tipo_producto text,
  tipo_sello text,
  variante_espesor_label text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH raw AS (
  SELECT
    ot.id AS orden_id,
    oti.id AS item_id,
    oti.producto_id,
    public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) AS categoria_nombre,
    COALESCE(NULLIF(oti.producto_nombre, ''), 'Producto personalizado') AS producto_nombre,
    COALESCE(oti.cantidad, 0)::numeric AS cantidad,
    COALESCE(oti.precio_total, 0)::numeric AS total,
    COALESCE(oti.configuracion, '{}'::jsonb) AS cfg
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
    AND ((ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_fecha_inicio AND p_fecha_fin)
),
filtered AS (
  SELECT *
  FROM raw r
  WHERE r.categoria_nombre IS NOT NULL
    AND (
      p_categoria IS NULL
      OR lower(r.categoria_nombre) = lower(public.fn_bi_categoria_producto_normalizada(p_categoria))
    )
),
joined AS (
  SELECT
    f.*,
    pt.id AS pt_id,
    ppc.id AS ppc_id,
    pmr.id AS pmr_id,
    ps.id AS ps_id,
    pb.id AS pb_id,
    ppc.color AS ppc_color,
    ppc.marca AS ppc_marca,
    ps.tipo_producto AS ps_tipo_producto,
    ps.tipo_sello AS ps_tipo_sello,
    ps.marca AS ps_marca,
    ps.medida_ancho AS ps_ancho,
    ps.medida_alto AS ps_alto,
    pb.ancho_cm AS pb_ancho,
    pb.alto_cm AS pb_alto,
    talonario_rel.tinta_fallback,
    talonario_rel.tecnologia_fallback,
    talonario_rel.material_fallback,
    plotter_rel.material_fallback AS plotter_material_fallback,
    rigidos_rel.material_fallback AS rigidos_material_fallback,
    rigidos_rel.variante_fallback AS rigidos_variante_fallback,
    rigidos_rel.espesor_fallback AS rigidos_espesor_fallback,
    portabanner_rel.tecnologia_fallback AS portabanner_tecnologia_fallback
  FROM filtered f
  LEFT JOIN public.productos_talonarios pt ON pt.id = f.producto_id
  LEFT JOIN public.productos_plotter_corte ppc ON ppc.id = f.producto_id
  LEFT JOIN public.productos_materiales_rigidos pmr ON pmr.id = f.producto_id
  LEFT JOIN public.productos_sellos ps ON ps.id = f.producto_id
  LEFT JOIN public.productos_portabanners pb ON pb.id = f.producto_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(NULLIF(tt.tintas[1], ''), 'Sin tinta') AS tinta_fallback,
      COALESCE(t.nombre, 'Sin tecnología') AS tecnologia_fallback,
      COALESCE(NULLIF(CONCAT_WS(' - ', m.nombre, tm.variante_nombre), ''), 'Sin material') AS material_fallback
    FROM public.productos_talonarios_tecnologias tt
    LEFT JOIN public.tecnologias t ON t.id = tt.tecnologia_id
    LEFT JOIN public.productos_talonarios_materiales tm ON tm.producto_talonario_id = tt.producto_talonario_id
    LEFT JOIN public.materiales m ON m.id = tm.material_id
    WHERE tt.producto_talonario_id = pt.id
    ORDER BY tt.created_at ASC
    LIMIT 1
  ) talonario_rel ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(CONCAT_WS(' - ', m.nombre, ppc.variante_nombre), ''), 'Sin material') AS material_fallback
    FROM public.materiales m
    WHERE m.id = ppc.material_id
    LIMIT 1
  ) plotter_rel ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(NULLIF(CONCAT_WS(' - ', m.nombre, pmrm.variante_nombre), ''), 'Sin material') AS material_fallback,
      pmrm.variante_nombre AS variante_fallback,
      pmrm.espesor::text AS espesor_fallback
    FROM public.productos_materiales_rigidos_materiales pmrm
    LEFT JOIN public.materiales m ON m.id = pmrm.material_id
    WHERE pmrm.producto_materiales_rigidos_id = pmr.id
    ORDER BY pmrm.created_at ASC
    LIMIT 1
  ) rigidos_rel ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(t.nombre, 'Sin tecnología') AS tecnologia_fallback
    FROM public.tecnologias t
    WHERE t.id = pb.tecnologia_id
    LIMIT 1
  ) portabanner_rel ON true
)
SELECT
  j.orden_id,
  j.item_id,
  j.categoria_nombre,
  j.producto_nombre,
  j.cantidad,
  j.total,
  COALESCE(
    NULLIF(j.cfg->>'tipo_copia', ''),
    CASE WHEN j.pt_id IS NOT NULL THEN 'Sin tipo copia' ELSE 'Sin tipo copia' END
  ) AS tipo_copia,
  COALESCE(
    NULLIF(j.cfg->>'tinta_nombre', ''),
    NULLIF(j.cfg->>'tinta', ''),
    NULLIF(j.cfg->>'tipo_tinta', ''),
    j.tinta_fallback,
    'Sin tinta'
  ) AS tinta_label,
  COALESCE(
    NULLIF(CONCAT_WS(' - ', NULLIF(j.cfg->>'material_nombre', ''), NULLIF(j.cfg->>'variante_nombre', '')), ''),
    CASE
      WHEN j.categoria_nombre = 'Talonarios' THEN j.material_fallback
      WHEN j.categoria_nombre = 'Plotter de Corte' THEN j.plotter_material_fallback
      WHEN j.categoria_nombre = 'Materiales Rigidos' THEN j.rigidos_material_fallback
      ELSE 'Sin material'
    END,
    'Sin material'
  ) AS material_label,
  COALESCE(
    NULLIF(CONCAT_WS('x', NULLIF(j.cfg->>'medida_ancho', ''), NULLIF(j.cfg->>'medida_alto', '')), ''),
    NULLIF(CONCAT_WS('x', NULLIF(j.cfg->'medida_seleccionada'->>'ancho', ''), NULLIF(j.cfg->'medida_seleccionada'->>'alto', '')), ''),
    CASE WHEN j.ps_id IS NOT NULL THEN CONCAT_WS('x', j.ps_ancho::text, j.ps_alto::text) ELSE NULL END,
    CASE WHEN j.pb_id IS NOT NULL THEN CONCAT_WS('x', j.pb_ancho::text, j.pb_alto::text) ELSE NULL END,
    'Sin medida'
  ) AS medida_label,
  COALESCE(
    NULLIF(j.cfg->>'medida_ancho', '')::numeric,
    NULLIF(j.cfg->'medida_seleccionada'->>'ancho', '')::numeric,
    j.ps_ancho,
    j.pb_ancho,
    0::numeric
  ) AS ancho_cm,
  COALESCE(
    NULLIF(j.cfg->>'medida_alto', '')::numeric,
    NULLIF(j.cfg->'medida_seleccionada'->>'alto', '')::numeric,
    j.ps_alto,
    j.pb_alto,
    0::numeric
  ) AS alto_cm,
  COALESCE(
    NULLIF(j.cfg->>'mt_lineal_total', '')::numeric,
    CASE WHEN NULLIF(j.cfg->>'medida_alto', '') IS NOT NULL THEN (NULLIF(j.cfg->>'medida_alto', '')::numeric / 100) * GREATEST(j.cantidad, 1) ELSE NULL END,
    0::numeric
  ) AS ml_total,
  COALESCE(
    NULLIF(j.cfg->>'mt2_total', '')::numeric,
    CASE
      WHEN NULLIF(j.cfg->>'medida_ancho', '') IS NOT NULL AND NULLIF(j.cfg->>'medida_alto', '') IS NOT NULL
      THEN ((NULLIF(j.cfg->>'medida_ancho', '')::numeric / 100) * (NULLIF(j.cfg->>'medida_alto', '')::numeric / 100)) * GREATEST(j.cantidad, 1)
      WHEN j.pb_id IS NOT NULL THEN ((j.pb_ancho / 100) * (j.pb_alto / 100)) * GREATEST(j.cantidad, 1)
      WHEN j.ps_id IS NOT NULL AND j.ps_ancho IS NOT NULL AND j.ps_alto IS NOT NULL THEN ((j.ps_ancho / 100) * (j.ps_alto / 100)) * GREATEST(j.cantidad, 1)
      ELSE NULL
    END,
    0::numeric
  ) AS mt2_total,
  COALESCE(NULLIF(j.cfg->>'color', ''), NULLIF(j.ppc_color, ''), 'Sin color') AS color_label,
  COALESCE(NULLIF(j.cfg->>'marca', ''), NULLIF(j.ppc_marca, ''), NULLIF(j.ps_marca, ''), 'Sin marca') AS marca_label,
  COALESCE(NULLIF(j.cfg->>'tecnologia_nombre', ''), j.tecnologia_fallback, j.portabanner_tecnologia_fallback, 'Sin tecnología') AS tecnologia_label,
  COALESCE(NULLIF(j.cfg->>'tipo_producto', ''), NULLIF(j.ps_tipo_producto, ''), 'Sin tipo') AS tipo_producto,
  COALESCE(NULLIF(j.cfg->>'tipo_sello', ''), NULLIF(j.ps_tipo_sello, ''), 'Sin tipo sello') AS tipo_sello,
  COALESCE(
    NULLIF(CONCAT_WS(' / ', NULLIF(j.cfg->>'variante_nombre', ''), NULLIF(j.cfg->>'espesor', '')), ''),
    NULLIF(CONCAT_WS(' / ', NULLIF(j.rigidos_variante_fallback, ''), NULLIF(j.rigidos_espesor_fallback, '')), ''),
    'Sin variante/espesor'
  ) AS variante_espesor_label
FROM joined j;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_base_items_v2(uuid, date, date, text) TO authenticated;

-- Talonarios
DROP FUNCTION IF EXISTS public.fn_bi_productos_talonarios_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_talonarios_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_unidades numeric,
  ticket_promedio_orden numeric,
  precio_promedio_unidad numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Talonarios')
)
SELECT
  COALESCE(SUM(b.total), 0)::numeric,
  COALESCE(COUNT(DISTINCT b.orden_id), 0)::bigint,
  COALESCE(SUM(b.cantidad), 0)::numeric,
  CASE WHEN COUNT(DISTINCT b.orden_id) > 0 THEN (SUM(b.total) / COUNT(DISTINCT b.orden_id))::numeric ELSE 0::numeric END,
  CASE WHEN SUM(b.cantidad) > 0 THEN (SUM(b.total) / SUM(b.cantidad))::numeric ELSE 0::numeric END
FROM b;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_talonarios_resumen_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_talonarios_mix_tipo_copia_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_talonarios_mix_tipo_copia_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tipo_copia text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Talonarios')
),
agg AS (
  SELECT COALESCE(NULLIF(b.tipo_copia, ''), 'Sin tipo copia') AS tipo_copia, SUM(b.total)::numeric AS total_ventas,
    SUM(b.cantidad)::numeric AS total_unidades, COUNT(DISTINCT b.orden_id)::bigint AS total_ordenes
  FROM b GROUP BY 1
),
tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.tipo_copia, a.total_ventas, a.total_unidades, a.total_ordenes,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END AS porcentaje_ventas
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_talonarios_mix_tipo_copia_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_talonarios_mix_tintas_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_talonarios_mix_tintas_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tinta_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Talonarios')
),
agg AS (
  SELECT COALESCE(NULLIF(b.tinta_label, ''), 'Sin tinta') AS tinta_label, SUM(b.total)::numeric AS total_ventas,
    SUM(b.cantidad)::numeric AS total_unidades, COUNT(DISTINCT b.orden_id)::bigint AS total_ordenes
  FROM b GROUP BY 1
),
tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.tinta_label, a.total_ventas, a.total_unidades, a.total_ordenes,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END AS porcentaje_ventas
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_talonarios_mix_tintas_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_talonarios_top_medidas_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_talonarios_top_medidas_v2(
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
SELECT b.medida_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, COUNT(DISTINCT b.orden_id)::bigint
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Talonarios') b
GROUP BY b.medida_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_talonarios_top_medidas_v2(uuid, date, date, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_talonarios_top_materiales_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_talonarios_top_materiales_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  material_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT b.material_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, COUNT(DISTINCT b.orden_id)::bigint
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Talonarios') b
GROUP BY b.material_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_talonarios_top_materiales_v2(uuid, date, date, integer) TO authenticated;

-- Plotter de Corte
DROP FUNCTION IF EXISTS public.fn_bi_productos_plotter_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_plotter_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_unidades numeric,
  total_ml numeric,
  ticket_promedio_orden numeric,
  precio_promedio_ml numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Plotter de Corte')
)
SELECT
  COALESCE(SUM(b.total), 0)::numeric,
  COALESCE(COUNT(DISTINCT b.orden_id), 0)::bigint,
  COALESCE(SUM(b.cantidad), 0)::numeric,
  COALESCE(SUM(b.ml_total), 0)::numeric,
  CASE WHEN COUNT(DISTINCT b.orden_id) > 0 THEN (SUM(b.total) / COUNT(DISTINCT b.orden_id))::numeric ELSE 0::numeric END,
  CASE WHEN SUM(b.ml_total) > 0 THEN (SUM(b.total) / SUM(b.ml_total))::numeric ELSE 0::numeric END
FROM b;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_plotter_resumen_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_plotter_mix_anchos_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_plotter_mix_anchos_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  ancho_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ml numeric,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(ancho_cm::text, ''), '0') || ' cm' AS ancho_label, total, cantidad, ml_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Plotter de Corte')
), agg AS (
  SELECT ancho_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, SUM(ml_total)::numeric AS total_ml
  FROM b GROUP BY ancho_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.ancho_label, a.total_ventas, a.total_unidades, a.total_ml,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_plotter_mix_anchos_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_plotter_mix_color_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_plotter_mix_color_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  color_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ml numeric,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(color_label, ''), 'Sin color') AS color_label, total, cantidad, ml_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Plotter de Corte')
), agg AS (
  SELECT color_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, SUM(ml_total)::numeric AS total_ml
  FROM b GROUP BY color_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.color_label, a.total_ventas, a.total_unidades, a.total_ml,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_plotter_mix_color_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_plotter_mix_marca_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_plotter_mix_marca_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  marca_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ml numeric,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(marca_label, ''), 'Sin marca') AS marca_label, total, cantidad, ml_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Plotter de Corte')
), agg AS (
  SELECT marca_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, SUM(ml_total)::numeric AS total_ml
  FROM b GROUP BY marca_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.marca_label, a.total_ventas, a.total_unidades, a.total_ml,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_plotter_mix_marca_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_plotter_top_materiales_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_plotter_top_materiales_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  material_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ml numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT b.material_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, SUM(b.ml_total)::numeric
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Plotter de Corte') b
GROUP BY b.material_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_plotter_top_materiales_v2(uuid, date, date, integer) TO authenticated;

-- Materiales Rígidos
DROP FUNCTION IF EXISTS public.fn_bi_productos_rigidos_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_rigidos_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_unidades numeric,
  total_mt2 numeric,
  ticket_promedio_orden numeric,
  precio_promedio_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Materiales Rigidos')
)
SELECT
  COALESCE(SUM(b.total), 0)::numeric,
  COALESCE(COUNT(DISTINCT b.orden_id), 0)::bigint,
  COALESCE(SUM(b.cantidad), 0)::numeric,
  COALESCE(SUM(b.mt2_total), 0)::numeric,
  CASE WHEN COUNT(DISTINCT b.orden_id) > 0 THEN (SUM(b.total) / COUNT(DISTINCT b.orden_id))::numeric ELSE 0::numeric END,
  CASE WHEN SUM(b.mt2_total) > 0 THEN (SUM(b.total) / SUM(b.mt2_total))::numeric ELSE 0::numeric END
FROM b;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_rigidos_resumen_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_rigidos_mix_variante_espesor_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_rigidos_mix_variante_espesor_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  variante_espesor_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_mt2 numeric,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(variante_espesor_label, ''), 'Sin variante/espesor') AS variante_espesor_label, total, cantidad, mt2_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Materiales Rigidos')
), agg AS (
  SELECT variante_espesor_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, SUM(mt2_total)::numeric AS total_mt2
  FROM b GROUP BY variante_espesor_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.variante_espesor_label, a.total_ventas, a.total_unidades, a.total_mt2,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_rigidos_mix_variante_espesor_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_rigidos_top_materiales_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_rigidos_top_materiales_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  material_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT b.material_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, SUM(b.mt2_total)::numeric
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Materiales Rigidos') b
GROUP BY b.material_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_rigidos_top_materiales_v2(uuid, date, date, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_rigidos_top_medidas_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_rigidos_top_medidas_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  medida_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT b.medida_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, SUM(b.mt2_total)::numeric
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Materiales Rigidos') b
GROUP BY b.medida_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_rigidos_top_medidas_v2(uuid, date, date, integer) TO authenticated;

-- Sellos
DROP FUNCTION IF EXISTS public.fn_bi_productos_sellos_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_sellos_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_unidades numeric,
  ticket_promedio_orden numeric,
  precio_promedio_unidad numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Sellos')
)
SELECT
  COALESCE(SUM(b.total), 0)::numeric,
  COALESCE(COUNT(DISTINCT b.orden_id), 0)::bigint,
  COALESCE(SUM(b.cantidad), 0)::numeric,
  CASE WHEN COUNT(DISTINCT b.orden_id) > 0 THEN (SUM(b.total) / COUNT(DISTINCT b.orden_id))::numeric ELSE 0::numeric END,
  CASE WHEN SUM(b.cantidad) > 0 THEN (SUM(b.total) / SUM(b.cantidad))::numeric ELSE 0::numeric END
FROM b;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_sellos_resumen_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_sellos_mix_tipo_producto_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_sellos_mix_tipo_producto_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tipo_producto text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(tipo_producto, ''), 'Sin tipo') AS tipo_producto, total, cantidad, orden_id
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Sellos')
), agg AS (
  SELECT tipo_producto, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, COUNT(DISTINCT orden_id)::bigint AS total_ordenes
  FROM b GROUP BY tipo_producto
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.tipo_producto, a.total_ventas, a.total_unidades, a.total_ordenes,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_sellos_mix_tipo_producto_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_sellos_mix_tipo_sello_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_sellos_mix_tipo_sello_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tipo_sello text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(tipo_sello, ''), 'Sin tipo sello') AS tipo_sello, total, cantidad, orden_id
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Sellos')
), agg AS (
  SELECT tipo_sello, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, COUNT(DISTINCT orden_id)::bigint AS total_ordenes
  FROM b GROUP BY tipo_sello
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.tipo_sello, a.total_ventas, a.total_unidades, a.total_ordenes,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_sellos_mix_tipo_sello_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_sellos_mix_marca_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_sellos_mix_marca_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  marca_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_ordenes bigint,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(marca_label, ''), 'Sin marca') AS marca_label, total, cantidad, orden_id
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Sellos')
), agg AS (
  SELECT marca_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, COUNT(DISTINCT orden_id)::bigint AS total_ordenes
  FROM b GROUP BY marca_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.marca_label, a.total_ventas, a.total_unidades, a.total_ordenes,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_sellos_mix_marca_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_sellos_top_medidas_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_sellos_top_medidas_v2(
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
SELECT b.medida_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, COUNT(DISTINCT b.orden_id)::bigint
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Sellos') b
GROUP BY b.medida_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_sellos_top_medidas_v2(uuid, date, date, integer) TO authenticated;

-- Portabanners
DROP FUNCTION IF EXISTS public.fn_bi_productos_portabanners_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_portabanners_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_ordenes bigint,
  total_unidades numeric,
  total_area_mt2 numeric,
  ticket_promedio_orden numeric,
  precio_promedio_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT * FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Portabanners')
)
SELECT
  COALESCE(SUM(b.total), 0)::numeric,
  COALESCE(COUNT(DISTINCT b.orden_id), 0)::bigint,
  COALESCE(SUM(b.cantidad), 0)::numeric,
  COALESCE(SUM(b.mt2_total), 0)::numeric,
  CASE WHEN COUNT(DISTINCT b.orden_id) > 0 THEN (SUM(b.total) / COUNT(DISTINCT b.orden_id))::numeric ELSE 0::numeric END,
  CASE WHEN SUM(b.mt2_total) > 0 THEN (SUM(b.total) / SUM(b.mt2_total))::numeric ELSE 0::numeric END
FROM b;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_portabanners_resumen_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_portabanners_mix_tecnologia_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_portabanners_mix_tecnologia_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  tecnologia_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_area_mt2 numeric,
  porcentaje_ventas numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT COALESCE(NULLIF(tecnologia_label, ''), 'Sin tecnología') AS tecnologia_label, total, cantidad, mt2_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Portabanners')
), agg AS (
  SELECT tecnologia_label, SUM(total)::numeric AS total_ventas, SUM(cantidad)::numeric AS total_unidades, SUM(mt2_total)::numeric AS total_area_mt2
  FROM b GROUP BY tecnologia_label
), tot AS (SELECT COALESCE(SUM(total_ventas),0)::numeric AS all_ventas FROM agg)
SELECT a.tecnologia_label, a.total_ventas, a.total_unidades, a.total_area_mt2,
  CASE WHEN t.all_ventas > 0 THEN ((a.total_ventas / t.all_ventas) * 100)::numeric ELSE 0::numeric END
FROM agg a CROSS JOIN tot t
ORDER BY a.total_ventas DESC;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_portabanners_mix_tecnologia_v2(uuid, date, date) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_portabanners_top_medidas_v2(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_portabanners_top_medidas_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  medida_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_area_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT b.medida_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, SUM(b.mt2_total)::numeric
FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Portabanners') b
GROUP BY b.medida_label
ORDER BY SUM(b.total) DESC
LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_portabanners_top_medidas_v2(uuid, date, date, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_bi_productos_portabanners_area_resumen_v2(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_portabanners_area_resumen_v2(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  rango_label text,
  total_ventas numeric,
  total_unidades numeric,
  total_area_mt2 numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH b AS (
  SELECT
    CASE
      WHEN mt2_total < 1 THEN '< 1 m²'
      WHEN mt2_total < 3 THEN '1 - 3 m²'
      WHEN mt2_total < 6 THEN '3 - 6 m²'
      ELSE '6+ m²'
    END AS rango_label,
    total,
    cantidad,
    mt2_total
  FROM public.fn_bi_productos_base_items_v2(p_company_id, p_fecha_inicio, p_fecha_fin, 'Portabanners')
)
SELECT b.rango_label, SUM(b.total)::numeric, SUM(b.cantidad)::numeric, SUM(b.mt2_total)::numeric
FROM b
GROUP BY b.rango_label
ORDER BY
  CASE b.rango_label
    WHEN '< 1 m²' THEN 1
    WHEN '1 - 3 m²' THEN 2
    WHEN '3 - 6 m²' THEN 3
    ELSE 4
  END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_bi_productos_portabanners_area_resumen_v2(uuid, date, date) TO authenticated;
