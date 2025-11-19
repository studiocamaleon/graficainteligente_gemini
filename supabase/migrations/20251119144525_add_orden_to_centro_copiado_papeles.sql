/*
  # Agregar campo orden a centro_copiado_papeles

  ## Descripción
  Agrega campo 'orden' a la tabla centro_copiado_papeles para permitir
  ordenamiento personalizado de los papeles en las tablas de precios.

  ## Cambios
  1. Agregar columna 'orden' (integer) a centro_copiado_papeles
  2. Establecer valores por defecto basados en created_at
  3. Agregar índice para optimizar consultas de ordenamiento

  ## Notas Importantes
  - Los papeles existentes reciben valores de orden basados en su fecha de creación
  - Los nuevos papeles tendrán orden = 999 por defecto (al final)
  - El orden es específico por company_id
*/

-- Agregar columna orden a centro_copiado_papeles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_copiado_papeles' AND column_name = 'orden'
  ) THEN
    ALTER TABLE centro_copiado_papeles
    ADD COLUMN orden integer NOT NULL DEFAULT 999;
  END IF;
END $$;

-- Asignar valores de orden a papeles existentes basados en created_at
-- Esto mantiene el orden actual de forma explícita
DO $$
DECLARE
  papel_record RECORD;
  current_company uuid;
  orden_counter integer;
BEGIN
  -- Para cada empresa, ordenar los papeles por created_at
  FOR current_company IN
    SELECT DISTINCT company_id FROM centro_copiado_papeles
  LOOP
    orden_counter := 1;

    FOR papel_record IN
      SELECT id FROM centro_copiado_papeles
      WHERE company_id = current_company
      ORDER BY created_at ASC, id ASC
    LOOP
      UPDATE centro_copiado_papeles
      SET orden = orden_counter
      WHERE id = papel_record.id;

      orden_counter := orden_counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Crear índice para optimizar consultas de ordenamiento
CREATE INDEX IF NOT EXISTS idx_centro_copiado_papeles_orden
  ON centro_copiado_papeles(company_id, orden) WHERE is_active = true;

-- Agregar comentario a la columna
COMMENT ON COLUMN centro_copiado_papeles.orden IS 'Orden de visualización del papel en tablas de precios. Menor valor = primera posición.';