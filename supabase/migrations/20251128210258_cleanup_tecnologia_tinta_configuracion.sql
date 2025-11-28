/*
  # Limpieza de configuracion_condicion para tipo tecnologia_tinta

  ## Objetivo
  Limpiar el campo `configuracion_condicion` de los pasos de rutas que usan
  `tipo_condicion = 'tecnologia_tinta'` para eliminar el campo `tecnologia_id`
  que ya no es necesario.

  ## Cambios
  1. Actualiza `configuracion_condicion` a objeto vacío `{}` para pasos con tipo `tecnologia_tinta`
  2. Esto es seguro porque la evaluación NO usa `configuracion_condicion.tecnologia_id`
  3. La evaluación usa la tecnología del PRODUCTO, no la almacenada en configuración

  ## Razón del Cambio
  - Mejorar UX: La UI ya no pide seleccionar una tecnología específica
  - Claridad: El campo `tecnologia_id` causaba confusión (parecía limitar evaluación)
  - Realidad: El sistema siempre evaluó TODAS las tecnologías, no solo una

  ## Impacto
  - Sin impacto en evaluación (no cambia lógica de negocio)
  - Limpieza de datos innecesarios
  - Mejor alineación entre UI y datos almacenados
*/

-- Actualizar configuracion_condicion para pasos con tipo tecnologia_tinta
-- Solo afecta pasos existentes, no cambia comportamiento
UPDATE rutas_produccion_pasos
SET configuracion_condicion = '{}'::jsonb
WHERE tipo_condicion = 'tecnologia_tinta'
  AND configuracion_condicion IS NOT NULL
  AND configuracion_condicion != '{}'::jsonb;

-- Log para verificación
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO affected_count
  FROM rutas_produccion_pasos
  WHERE tipo_condicion = 'tecnologia_tinta';

  RAISE NOTICE 'Total de pasos con tipo_condicion = tecnologia_tinta: %', affected_count;
END $$;
