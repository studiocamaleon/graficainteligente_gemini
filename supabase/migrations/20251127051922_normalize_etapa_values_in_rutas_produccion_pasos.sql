/*
  # Normalizar valores de etapa en rutas_produccion_pasos

  ## Descripción
  Esta migración normaliza los valores de la columna `etapa` en la tabla `rutas_produccion_pasos`
  para que coincidan con los valores estándar esperados por la aplicación.

  ## Cambios

  1. **Actualización de valores legacy**
     - Convierte valores antiguos a los valores correctos:
       - `pre_prensa` → `Pre-prensa`
       - `principal` → `Produccion`
       - `produccion` → `Produccion`
       - `post_prensa` → `Terminacion`
       - `terminacion` → `Terminacion`
       - `instalacion` → `Instalacion`
       - `entrega` → `Entrega`

  2. **Verificación del constraint**
     - El constraint `check_etapa` en la tabla garantiza que solo se usen valores válidos
     - Valores permitidos: 'Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion', 'Entrega'

  ## Impacto
  - Esta migración actualiza registros existentes que tienen valores legacy
  - No afecta la estructura de la tabla, solo los datos
  - Es segura para ejecutar múltiples veces (idempotente)

  ## Notas
  - Los valores ya normalizados no se modifican
  - Se usa CASE WHEN para mapear valores específicos
  - La actualización es case-insensitive para máxima compatibilidad
*/

-- =====================================================
-- NORMALIZACIÓN DE VALORES DE ETAPA
-- =====================================================

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Actualizar valores legacy a valores estándar
  UPDATE rutas_produccion_pasos
  SET etapa = CASE
    -- Pre-prensa
    WHEN LOWER(etapa) = 'pre_prensa' THEN 'Pre-prensa'
    WHEN LOWER(etapa) = 'pre-prensa' THEN 'Pre-prensa'

    -- Produccion (también llamada "principal" en algunos casos legacy)
    WHEN LOWER(etapa) = 'principal' THEN 'Produccion'
    WHEN LOWER(etapa) = 'produccion' THEN 'Produccion'

    -- Terminacion (también llamada "post_prensa" en algunos casos legacy)
    WHEN LOWER(etapa) = 'post_prensa' THEN 'Terminacion'
    WHEN LOWER(etapa) = 'post-prensa' THEN 'Terminacion'
    WHEN LOWER(etapa) = 'terminacion' THEN 'Terminacion'

    -- Instalacion
    WHEN LOWER(etapa) = 'instalacion' THEN 'Instalacion'

    -- Entrega
    WHEN LOWER(etapa) = 'entrega' THEN 'Entrega'

    -- Si ya está correctamente formateado, mantenerlo
    ELSE etapa
  END
  WHERE LOWER(etapa) IN (
    'pre_prensa', 'pre-prensa',
    'principal', 'produccion',
    'post_prensa', 'post-prensa', 'terminacion',
    'instalacion',
    'entrega'
  );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Normalización de etapas completada. Registros actualizados: %', v_updated_count;
END $$;

-- =====================================================
-- VERIFICACIÓN DEL CONSTRAINT
-- =====================================================

-- El constraint check_etapa ya existe en la tabla y garantiza que solo
-- se puedan usar los valores correctos a partir de ahora.
--
-- Si por alguna razón el constraint no existe o fue modificado,
-- podemos recrearlo aquí:

DO $$
BEGIN
  -- Verificar si existe el constraint
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'rutas_produccion_pasos'
    AND constraint_name = 'check_etapa'
  ) THEN
    -- Si no existe, crearlo
    ALTER TABLE rutas_produccion_pasos
    ADD CONSTRAINT check_etapa CHECK (etapa IN (
      'Pre-prensa',
      'Produccion',
      'Terminacion',
      'Instalacion',
      'Entrega'
    ));

    RAISE NOTICE 'Constraint check_etapa creado';
  ELSE
    RAISE NOTICE 'Constraint check_etapa ya existe';
  END IF;
END $$;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

COMMENT ON COLUMN rutas_produccion_pasos.etapa IS
  'Etapa de producción. Valores válidos: Pre-prensa, Produccion, Terminacion, Instalacion, Entrega. Estos valores están normalizados y son case-sensitive.';