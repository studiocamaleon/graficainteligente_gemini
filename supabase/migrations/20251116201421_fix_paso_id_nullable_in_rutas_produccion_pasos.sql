/*
  # Hacer nullable la columna paso_id en rutas_produccion_pasos

  1. Cambios en la tabla rutas_produccion_pasos
    - Modificar columna paso_id para permitir valores NULL
    - Agregar constraint CHECK para validar que pasos obligatorios y condiciones simples requieren paso_id
    - Agregar constraint CHECK para validar que condiciones de mapeo múltiple no deben tener paso_id

  2. Seguridad
    - No se modifican políticas RLS existentes
    - La lógica de validación se refuerza a nivel de base de datos

  ## Justificación
  
  Los pasos que usan mapeo múltiple (servicio_con_nivel, acabado_con_nivel, tecnologia_tinta)
  no necesitan un paso_id específico porque el paso se determina dinámicamente basado en la
  configuración del ABM Core. Por lo tanto, paso_id debe ser nullable para estos casos.
*/

-- Hacer nullable la columna paso_id
ALTER TABLE rutas_produccion_pasos 
  ALTER COLUMN paso_id DROP NOT NULL;

-- Agregar constraint para validar que pasos obligatorios requieren paso_id
ALTER TABLE rutas_produccion_pasos
  ADD CONSTRAINT check_paso_id_required_when_obligatorio
  CHECK (
    (es_obligatorio = true AND paso_id IS NOT NULL)
    OR (es_obligatorio = false)
  );

-- Agregar constraint para validar que condiciones simples requieren paso_id
ALTER TABLE rutas_produccion_pasos
  ADD CONSTRAINT check_paso_id_for_simple_conditions
  CHECK (
    (
      tipo_condicion IN ('sin_condicion', 'servicio_sin_nivel', 'acabado_sin_nivel')
      AND paso_id IS NOT NULL
    )
    OR (
      tipo_condicion IN ('servicio_con_nivel', 'acabado_con_nivel', 'tecnologia_tinta')
      AND paso_id IS NULL
    )
    OR (tipo_condicion IS NULL)
  );

-- Agregar comentario explicativo
COMMENT ON COLUMN rutas_produccion_pasos.paso_id IS 
  'UUID del paso específico a ejecutar. NULL para pasos con mapeo múltiple (servicio_con_nivel, acabado_con_nivel, tecnologia_tinta)';
