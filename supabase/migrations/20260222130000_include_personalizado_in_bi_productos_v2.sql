-- BI v2 Productos: re-incluir categoría Personalizado en normalización.

CREATE OR REPLACE FUNCTION public.fn_bi_categoria_producto_normalizada(p_categoria text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_categoria IS NULL OR btrim(p_categoria) = '' THEN 'Personalizado'
    WHEN lower(btrim(p_categoria)) IN ('sin categoria', 'sin categorías', 'sin categorias', 'personalizado') THEN 'Personalizado'
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
