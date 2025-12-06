-- Add shipping fields to ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS requiere_despacho boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_despacho timestamptz,
ADD COLUMN IF NOT EXISTS transporte text,
ADD COLUMN IF NOT EXISTS numero_guia text,
ADD COLUMN IF NOT EXISTS estado_envio text DEFAULT 'pendiente' CHECK (estado_envio IN ('pendiente', 'enviado', 'entregado'));

-- Add comment
COMMENT ON COLUMN public.ordenes_trabajo.requiere_despacho IS 'Indica si la orden requiere envío/despacho a otra localidad';
