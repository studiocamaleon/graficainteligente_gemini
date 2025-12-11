/*
  # Soporte para Ordenes Temporales en Archivos

  ## Cambios
  1. Hacemos `orden_copiado_id` opcional (NULL), ya que al subir el archivo la orden no existe aún.
  2. Agregamos `orden_temporal_id` para agrupar archivos antes de crear la orden real.
  3. Agregamos constraint: Debe tener al menos uno de los dos IDs (orden real o temporal).
*/

-- 1. Hacer orden_copiado_id nullable
ALTER TABLE centro_copiado_ordenes_archivos 
ALTER COLUMN orden_copiado_id DROP NOT NULL;

-- 2. Agregar columna orden_temporal_id
ALTER TABLE centro_copiado_ordenes_archivos 
ADD COLUMN IF NOT EXISTS orden_temporal_id text;

-- 3. Index para búsquedas rápidas por ID temporal
CREATE INDEX IF NOT EXISTS idx_cc_archivos_orden_temporal 
ON centro_copiado_ordenes_archivos(orden_temporal_id);

-- 4. Constraint de validación (opcional pero recomendado)
-- Asegura que el archivo no quede "huerfano" indefinidamente sin ningún ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_archivo_tiene_orden_o_temporal'
  ) THEN
    ALTER TABLE centro_copiado_ordenes_archivos
    ADD CONSTRAINT check_archivo_tiene_orden_o_temporal
    CHECK (orden_copiado_id IS NOT NULL OR orden_temporal_id IS NOT NULL);
  END IF;
END $$;
