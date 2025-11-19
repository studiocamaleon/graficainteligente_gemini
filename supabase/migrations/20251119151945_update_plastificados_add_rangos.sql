/*
  # Actualización de Plastificados con Rangos

  ## Descripción
  Modifica la tabla de plastificados para incluir rangos de cantidad
  similar al sistema de anillados, permitiendo precios escalonados.

  ## Cambios

  1. **Eliminar constraint único anterior**
     - Se elimina la restricción de tipo único por compañía

  2. **Agregar campos de rango**
     - `unidades_desde`: Cantidad mínima de unidades (integer)
     - `unidades_hasta`: Cantidad máxima de unidades (integer, nullable para infinito)

  3. **Actualizar constraint**
     - Nueva restricción única por (company_id, tipo, unidades_desde)
     - Validación de que unidades_hasta >= unidades_desde

  ## Notas
  - Los datos existentes se mantienen con un rango por defecto
  - Se permite null en unidades_hasta para rangos infinitos
*/

-- Eliminar el constraint único anterior
ALTER TABLE centro_copiado_plastificados
  DROP CONSTRAINT IF EXISTS centro_copiado_plastificados_tipo_company_unique;

-- Agregar columnas de rango si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_copiado_plastificados'
    AND column_name = 'unidades_desde'
  ) THEN
    ALTER TABLE centro_copiado_plastificados
      ADD COLUMN unidades_desde integer NOT NULL DEFAULT 1 CHECK (unidades_desde > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_copiado_plastificados'
    AND column_name = 'unidades_hasta'
  ) THEN
    ALTER TABLE centro_copiado_plastificados
      ADD COLUMN unidades_hasta integer CHECK (unidades_hasta IS NULL OR unidades_hasta >= unidades_desde);
  END IF;
END $$;

-- Actualizar registros existentes para tener un rango por defecto (1 unidad en adelante)
UPDATE centro_copiado_plastificados
SET unidades_desde = 1, unidades_hasta = NULL
WHERE unidades_desde IS NULL OR unidades_desde = 0;

-- Crear nuevo constraint único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'centro_copiado_plastificados_unique_rango'
  ) THEN
    ALTER TABLE centro_copiado_plastificados
      ADD CONSTRAINT centro_copiado_plastificados_unique_rango
      UNIQUE(company_id, tipo, unidades_desde);
  END IF;
END $$;

-- Actualizar índice para incluir rangos
DROP INDEX IF EXISTS idx_centro_copiado_plastificados_company;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_plastificados_company_tipo
  ON centro_copiado_plastificados(company_id, tipo) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_plastificados_rangos
  ON centro_copiado_plastificados(company_id, tipo, unidades_desde) WHERE is_active = true;
