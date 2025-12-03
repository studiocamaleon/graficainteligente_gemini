/*
  # Trigger para validar estado de presupuesto completo
  
  1. Trigger
    - Valida que no se pueda cambiar de estado 'borrador' si hay items sin precio
    - Previene envío de presupuestos incompletos
    - Previene conversión a orden con items pendientes
  
  2. Comportamiento
    - Solo valida cuando se intenta cambiar a estado diferente de 'borrador'
    - Lanza excepción si hay items pendientes de cotización
    - Mensaje claro para el usuario
  
  3. Seguridad
    - Se ejecuta BEFORE UPDATE para prevenir cambios inválidos
    - Usa función fn_presupuesto_tiene_items_sin_precio para validación
*/

-- ============================================================================
-- Función trigger: Validar estado presupuesto completo
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_validar_estado_presupuesto_completo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tiene_items_sin_precio boolean;
  v_cantidad_sin_precio integer;
BEGIN
  -- Solo validar si se intenta cambiar a estado diferente de 'borrador'
  IF NEW.estado != 'borrador' AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    -- Verificar si hay items sin precio
    v_tiene_items_sin_precio := fn_presupuesto_tiene_items_sin_precio(NEW.id);
    
    IF v_tiene_items_sin_precio THEN
      v_cantidad_sin_precio := fn_contar_items_sin_precio(NEW.id);
      
      RAISE EXCEPTION 'No se puede cambiar el estado del presupuesto. Hay % item(s) pendiente(s) de cotización. Completa todos los precios primero.', 
        v_cantidad_sin_precio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Crear trigger
-- ============================================================================
DROP TRIGGER IF EXISTS trg_validar_estado_presupuesto_completo ON presupuestos;

CREATE TRIGGER trg_validar_estado_presupuesto_completo
  BEFORE UPDATE OF estado ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_estado_presupuesto_completo();

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON FUNCTION fn_validar_estado_presupuesto_completo IS 
  'Trigger function que valida que un presupuesto tenga todos los precios asignados antes de cambiar de estado borrador';

COMMENT ON TRIGGER trg_validar_estado_presupuesto_completo ON presupuestos IS 
  'Previene cambio de estado si hay items pendientes de cotización';
