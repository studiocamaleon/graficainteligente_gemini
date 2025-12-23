-- Add jsonb column for flexible time ranges
ALTER TABLE visitas_config 
ADD COLUMN horarios_disponibles jsonb DEFAULT '[{"inicio": "09:00", "fin": "18:00"}]'::jsonb;

-- Drop old columns eventually, but let's keep them for now to avoid breaking immediate runtime if not deployed simultaneously, 
-- or we can just ignore them in frontend.
