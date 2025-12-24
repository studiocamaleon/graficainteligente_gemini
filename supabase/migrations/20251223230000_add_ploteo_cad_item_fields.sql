/*
  # Agregar campos para Ploteo CAD en items de Centro de Copiado

  1. Nuevas Columnas (public.centro_copiado_ordenes_items):
    - `es_ploteo_cad` (boolean) default false
    - `ploteo_cad_tipo_papel` (text) nullable
    - `ploteo_cad_ancho_rollo` (integer) nullable (60, 90)
    - `ploteo_cad_metros_lineales` (decimal) nullable
*/

ALTER TABLE public.centro_copiado_ordenes_items
ADD COLUMN IF NOT EXISTS es_ploteo_cad boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ploteo_cad_tipo_papel text,
ADD COLUMN IF NOT EXISTS ploteo_cad_ancho_rollo integer,
ADD COLUMN IF NOT EXISTS ploteo_cad_metros_lineales decimal(10,2);
