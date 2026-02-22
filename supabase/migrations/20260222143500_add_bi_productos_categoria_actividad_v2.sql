-- BI v2 Productos: actividad histórica por categoría para explicar estados vacíos por período.

DROP FUNCTION IF EXISTS public.fn_bi_productos_categoria_actividad_v2(uuid, text);
CREATE OR REPLACE FUNCTION public.fn_bi_productos_categoria_actividad_v2(
  p_company_id uuid,
  p_categoria text
)
RETURNS TABLE(
  categoria_nombre text,
  total_items_historico bigint,
  primera_venta date,
  ultima_venta date
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT
    public.fn_bi_categoria_producto_normalizada(
      COALESCE(NULLIF(oti.producto_categoria, ''), NULLIF(COALESCE(oti.configuracion->>'categoria_nombre', ''), ''))
    ) AS categoria_nombre,
    (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha_ba
  FROM public.ordenes_trabajo ot
  JOIN public.ordenes_trabajo_items oti ON oti.orden_id = ot.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelada', 'cancelado', 'borrador')
),
filtered AS (
  SELECT *
  FROM base b
  WHERE b.categoria_nombre = public.fn_bi_categoria_producto_normalizada(p_categoria)
)
SELECT
  public.fn_bi_categoria_producto_normalizada(p_categoria) AS categoria_nombre,
  COUNT(*)::bigint AS total_items_historico,
  MIN(fecha_ba) AS primera_venta,
  MAX(fecha_ba) AS ultima_venta
FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bi_productos_categoria_actividad_v2(uuid, text) TO authenticated;
