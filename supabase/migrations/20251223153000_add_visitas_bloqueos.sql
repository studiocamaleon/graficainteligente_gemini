ALTER TABLE public.visitas_config 
ADD COLUMN bloqueos JSONB DEFAULT '[]'::jsonb;
