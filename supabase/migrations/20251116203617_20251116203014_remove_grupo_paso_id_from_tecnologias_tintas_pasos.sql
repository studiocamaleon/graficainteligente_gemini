/*
  # Eliminación de grupo_paso_id de tecnologias_tintas_pasos

  ## Descripción
  Esta migración elimina completamente las referencias a grupos_pasos de la tabla
  tecnologias_tintas_pasos, ya que el sistema de grupos de pasos fue reemplazado
  por el sistema de rutas de producción.

  ## Cambios Realizados

  ### 1. Eliminación de Constraints
  - Eliminar constraint CHECK que validaba paso_id O grupo_paso_id

  ### 2. Eliminación de Columna
  - Eliminar columna `grupo_paso_id` de la tabla tecnologias_tintas_pasos

  ### 3. Nuevos Constraints
  - Agregar constraint CHECK para asegurar que paso_id sea NOT NULL

  ### 4. Índices
  - Eliminar índice en grupo_paso_id si existe

  ## Seguridad
  - No hay cambios en las políticas RLS
  - La tabla mantiene su estructura de seguridad existente

  ## IMPORTANTE
  Esta migración puede eliminar datos en la columna grupo_paso_id.
  Como el sistema de grupos de pasos ya no se usa, esto es seguro.
*/

-- =====================================================
-- PASO 1: Eliminar constraint CHECK existente
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_paso_o_grupo_tecnologia_tinta'
    AND table_name = 'tecnologias_tintas_pasos'
  ) THEN
    ALTER TABLE tecnologias_tintas_pasos DROP CONSTRAINT check_paso_o_grupo_tecnologia_tinta;
  END IF;
END $$;

-- =====================================================
-- PASO 2: Eliminar índice en grupo_paso_id
-- =====================================================

DROP INDEX IF EXISTS idx_tecnologias_tintas_pasos_grupo_paso_id;

-- =====================================================
-- PASO 3: Eliminar columna grupo_paso_id
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tecnologias_tintas_pasos'
    AND column_name = 'grupo_paso_id'
  ) THEN
    ALTER TABLE tecnologias_tintas_pasos DROP COLUMN grupo_paso_id;
  END IF;
END $$;

-- =====================================================
-- PASO 4: Agregar constraint para paso_id NOT NULL
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_paso_id_required'
    AND table_name = 'tecnologias_tintas_pasos'
  ) THEN
    ALTER TABLE tecnologias_tintas_pasos
    ADD CONSTRAINT check_paso_id_required CHECK (paso_id IS NOT NULL);
  END IF;
END $$;

-- =====================================================
-- COMENTARIOS ACTUALIZADOS
-- =====================================================

COMMENT ON TABLE tecnologias_tintas_pasos IS
  'Almacena la configuración de qué paso de producción se ejecuta para cada combinación de tecnología + tipo de tinta. Esta configuración es utilizada en las rutas de producción condicionales de productos. Cada configuración debe tener un paso_id obligatorio.';

COMMENT ON COLUMN tecnologias_tintas_pasos.paso_id IS
  'Paso individual de producción a ejecutar cuando se use esta combinación tecnología + tinta. Este campo es obligatorio.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================