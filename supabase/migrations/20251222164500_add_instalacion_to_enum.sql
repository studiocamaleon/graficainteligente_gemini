-- =====================================================
-- FIX: Update 'rutas_produccion_pasos' stage constraint
-- =====================================================

DO $$
BEGIN
  -- 1. Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'rutas_produccion_pasos'
    AND constraint_name = 'check_etapa'
  ) THEN
    ALTER TABLE rutas_produccion_pasos DROP CONSTRAINT check_etapa;
  END IF;

  -- 2. Add the updated constraint allowing 'instalacion' (lowercase) and 'Instalacion' (Title Case)
  --    to be robust against frontend/backend mismatches.
  ALTER TABLE rutas_produccion_pasos
  ADD CONSTRAINT check_etapa CHECK (etapa IN (
    'Pre-prensa', 'pre_prensa',
    'Produccion', 'principal',
    'Terminacion', 'post_prensa',
    'Instalacion', 'instalacion',
    'Entrega', 'entrega'
  ));

  RAISE NOTICE 'Constraint check_etapa actualizado para soportar nuevos valores.';
END $$;
