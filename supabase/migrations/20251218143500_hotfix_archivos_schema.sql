-- Hotfix para permitir adjuntos temporales en ordenes de trabajo
-- Asegura que orden_id sea opcional y que exista orden_temporal_id

DO $$
BEGIN
  -- 1. Asegurar que la columna existe si no se creó antes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ordenes_trabajo_archivos' 
    AND column_name = 'orden_temporal_id'
  ) THEN
    ALTER TABLE ordenes_trabajo_archivos ADD COLUMN orden_temporal_id uuid;
  END IF;

  -- 2. Asegurar que orden_id sea opcional (puede ser NULL si hay orden_temporal_id)
  -- Esto soluciona el error 23502 (not-null constraint)
  ALTER TABLE ordenes_trabajo_archivos ALTER COLUMN orden_id DROP NOT NULL;

  -- 3. Crear índice si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_gi_archivos_temporal'
    AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_gi_archivos_temporal ON ordenes_trabajo_archivos(orden_temporal_id);
  END IF;
END $$;
