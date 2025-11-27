/*
  # Corregir Trigger de fecha_completado

  ## Descripción
  Actualiza la función trigger fn_set_fecha_completado() para usar el estado correcto
  'finalizada' en lugar de 'completado' (que no existe en el sistema).

  ## Cambios Realizados
  - Detecta cuando el estado cambia a 'finalizada' → establece fecha_completado
  - Al cambiar de 'finalizada' a 'entregada' → mantiene fecha_completado
  - Al revertir desde 'finalizada' o 'entregada' → limpia fecha_completado

  ## Flujo de Estados y fecha_completado

  ### Establecer fecha_completado:
  - pendiente → finalizada ✅ fecha_completado = NOW()
  - en_proceso → finalizada ✅ fecha_completado = NOW()

  ### Mantener fecha_completado:
  - finalizada → entregada ✅ fecha_completado sin cambios (ya establecida)
  - entregada → finalizada ✅ fecha_completado sin cambios

  ### Limpiar fecha_completado:
  - finalizada → en_proceso ⚠️ fecha_completado = NULL (reversión)
  - finalizada → pendiente ⚠️ fecha_completado = NULL (reversión)
  - entregada → cancelada ⚠️ fecha_completado = NULL (reversión)
  - entregada → en_proceso ⚠️ fecha_completado = NULL (reversión)

  ## Lógica del Trigger
  1. Si el estado NUEVO es 'finalizada' y el ANTERIOR no era 'finalizada':
     → Establecer fecha_completado = NOW()

  2. Si el estado ANTERIOR era 'finalizada' o 'entregada'
     Y el estado NUEVO no es ninguno de estos dos:
     → Limpiar fecha_completado = NULL

  3. Si cambia de 'finalizada' a 'entregada' o viceversa:
     → No hacer nada (mantener fecha_completado)
*/

-- =====================================================
-- RECREAR FUNCIÓN fn_set_fecha_completado
-- =====================================================

CREATE OR REPLACE FUNCTION fn_set_fecha_completado()
RETURNS TRIGGER AS $$
BEGIN
  -- CASO 1: Estado cambia a 'finalizada' desde otro estado
  -- Establecer fecha_completado si no está ya establecida
  IF NEW.estado = 'finalizada' 
     AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN
    
    -- Solo establecer si no tiene fecha_completado ya
    -- (respeta valores establecidos manualmente)
    IF NEW.fecha_completado IS NULL THEN
      NEW.fecha_completado := NOW();
    END IF;
  END IF;
  
  -- CASO 2: Estado deja de ser 'finalizada' o 'entregada'
  -- PERO: Si cambia de 'finalizada' a 'entregada' o viceversa, NO limpiar
  IF OLD.estado IN ('finalizada', 'entregada') 
     AND NEW.estado NOT IN ('finalizada', 'entregada') THEN
    
    -- Limpiar fecha porque se está revirtiendo el trabajo
    NEW.fecha_completado := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agregar comentario actualizado a la función
COMMENT ON FUNCTION fn_set_fecha_completado() IS 
'Establece fecha_completado cuando una orden cambia a estado finalizada. Mantiene la fecha cuando pasa a entregada. Limpia la fecha si se revierte a estados anteriores.';

-- =====================================================
-- RECREAR TRIGGER
-- =====================================================

-- Eliminar trigger existente
DROP TRIGGER IF EXISTS trigger_set_fecha_completado ON ordenes_trabajo;

-- Crear trigger actualizado
CREATE TRIGGER trigger_set_fecha_completado
  BEFORE UPDATE OF estado ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_fecha_completado();

-- Comentario del trigger
COMMENT ON TRIGGER trigger_set_fecha_completado ON ordenes_trabajo IS 
'Actualiza automáticamente fecha_completado cuando el estado cambia a/desde finalizada o entregada';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Query para verificar el trigger (ejecutar manualmente si necesario)
-- SELECT
--   trigger_name,
--   event_manipulation,
--   action_timing,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_set_fecha_completado';
