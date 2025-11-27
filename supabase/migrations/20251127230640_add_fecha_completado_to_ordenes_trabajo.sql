/*
  # Agregar Campo fecha_completado a Órdenes de Trabajo

  ## Descripción
  Esta migración agrega el campo fecha_completado a la tabla ordenes_trabajo,
  junto con los índices necesarios, una función trigger y el trigger mismo
  para mantener el campo actualizado automáticamente.

  ## Cambios Realizados

  ### 1. Nueva Columna
  - `fecha_completado` (timestamptz, nullable)
  - Se establece automáticamente cuando el estado cambia a 'completado'
  - Se limpia cuando el estado deja de ser 'completado'

  ### 2. Índices
  - Índice parcial para queries de liquidación (solo órdenes completadas)
  - Índice compuesto para queries por cliente y fecha

  ### 3. Función Trigger
  - `fn_set_fecha_completado()` - Establece/limpia la fecha automáticamente

  ### 4. Trigger
  - `trigger_set_fecha_completado` - Se ejecuta en UPDATE del campo estado

  ## Comportamiento
  - Cuando estado cambia a 'completado' → fecha_completado = NOW()
  - Cuando estado deja de ser 'completado' → fecha_completado = NULL
  - No sobrescribe si ya tiene fecha_completado establecida manualmente
*/

-- =====================================================
-- 1. AGREGAR COLUMNA fecha_completado
-- =====================================================

ALTER TABLE ordenes_trabajo 
ADD COLUMN IF NOT EXISTS fecha_completado timestamptz;

-- Agregar comentario descriptivo
COMMENT ON COLUMN ordenes_trabajo.fecha_completado IS 
'Fecha y hora en que la orden cambió a estado completado. Se establece automáticamente mediante trigger cuando el estado cambia a completado.';

-- =====================================================
-- 2. CREAR ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índice parcial para queries de liquidación (solo órdenes completadas con fecha)
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha_completado 
ON ordenes_trabajo(fecha_completado) 
WHERE estado = 'completado' AND fecha_completado IS NOT NULL;

-- Índice compuesto para queries comunes de liquidación por cliente
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_cliente_fecha_completado 
ON ordenes_trabajo(cliente_id, fecha_completado) 
WHERE estado = 'completado' AND fecha_completado IS NOT NULL;

-- Índice para queries por rango de fechas de completado
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha_completado_range
ON ordenes_trabajo(fecha_completado DESC)
WHERE fecha_completado IS NOT NULL;

-- =====================================================
-- 3. CREAR FUNCIÓN PARA ESTABLECER fecha_completado
-- =====================================================

CREATE OR REPLACE FUNCTION fn_set_fecha_completado()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado cambia a 'completado' desde otro estado
  IF NEW.estado = 'completado' AND (OLD.estado IS NULL OR OLD.estado != 'completado') THEN
    -- Solo establecer si no tiene fecha_completado ya
    IF NEW.fecha_completado IS NULL THEN
      NEW.fecha_completado := NOW();
    END IF;
  END IF;
  
  -- Si el estado deja de ser 'completado', limpiar la fecha
  -- (útil si se revierte el estado por algún motivo)
  IF OLD.estado = 'completado' AND NEW.estado != 'completado' THEN
    NEW.fecha_completado := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agregar comentario a la función
COMMENT ON FUNCTION fn_set_fecha_completado() IS 
'Establece automáticamente fecha_completado cuando una orden cambia a estado completado, y la limpia si el estado cambia a otro valor.';

-- =====================================================
-- 4. CREAR TRIGGER PARA ACTUALIZAR fecha_completado
-- =====================================================

-- Eliminar trigger si existe (para recrearlo)
DROP TRIGGER IF EXISTS trigger_set_fecha_completado ON ordenes_trabajo;

-- Crear trigger que se ejecuta ANTES del UPDATE
CREATE TRIGGER trigger_set_fecha_completado
  BEFORE UPDATE OF estado ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_fecha_completado();

-- Comentario del trigger
COMMENT ON TRIGGER trigger_set_fecha_completado ON ordenes_trabajo IS 
'Actualiza automáticamente fecha_completado cuando el estado de la orden cambia a o desde completado';
