/*
  # Modificación de ordenes_trabajo_pagos para Medios de Cobro

  ## Descripción
  Extiende la tabla de pagos para soportar el nuevo sistema de medios de cobro,
  manteniendo retrocompatibilidad con el campo anterior metodo_pago.

  ## Cambios en ordenes_trabajo_pagos

  1. Agregar columna `medio_cobro_id` (uuid, FK to medios_cobro)
  2. Agregar columna `comision_aplicada` (numeric) - Comisión en $ calculada
  3. Agregar columna `fecha_liberacion_estimada` (date) - Fecha estimada de disponibilidad
  4. Modificar constraint de metodo_pago para hacerlo opcional
  5. Agregar constraint para validar que exista medio_cobro_id O metodo_pago

  ## Notas
  - Se mantiene `metodo_pago` para retrocompatibilidad con pagos antiguos
  - Los nuevos pagos deben usar `medio_cobro_id`
  - La comisión y fecha de liberación se calculan automáticamente
*/

-- =====================================================
-- 1. ELIMINAR CONSTRAINT ANTIGUO
-- =====================================================

ALTER TABLE ordenes_trabajo_pagos 
  DROP CONSTRAINT IF EXISTS check_metodo_pago;

-- =====================================================
-- 2. MODIFICAR COLUMNA metodo_pago (hacerla nullable)
-- =====================================================

ALTER TABLE ordenes_trabajo_pagos 
  ALTER COLUMN metodo_pago DROP NOT NULL;

-- =====================================================
-- 3. AGREGAR NUEVAS COLUMNAS
-- =====================================================

-- Referencia al medio de cobro configurado
ALTER TABLE ordenes_trabajo_pagos 
  ADD COLUMN IF NOT EXISTS medio_cobro_id uuid REFERENCES medios_cobro(id) ON DELETE RESTRICT;

-- Comisión aplicada en valor absoluto ($)
ALTER TABLE ordenes_trabajo_pagos 
  ADD COLUMN IF NOT EXISTS comision_aplicada numeric DEFAULT 0 NOT NULL;

-- Fecha estimada de liberación del dinero
ALTER TABLE ordenes_trabajo_pagos 
  ADD COLUMN IF NOT EXISTS fecha_liberacion_estimada date;

-- =====================================================
-- 4. AGREGAR CONSTRAINTS
-- =====================================================

-- Validar que exista medio_cobro_id O metodo_pago (al menos uno)
ALTER TABLE ordenes_trabajo_pagos 
  ADD CONSTRAINT check_metodo_pago_o_medio_cobro 
  CHECK (
    medio_cobro_id IS NOT NULL OR metodo_pago IS NOT NULL
  );

-- Validar que comision_aplicada sea >= 0
ALTER TABLE ordenes_trabajo_pagos 
  ADD CONSTRAINT check_comision_aplicada_positiva 
  CHECK (comision_aplicada >= 0);

-- =====================================================
-- 5. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_pagos_medio_cobro_id 
  ON ordenes_trabajo_pagos(medio_cobro_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_pagos_fecha_liberacion 
  ON ordenes_trabajo_pagos(fecha_liberacion_estimada);

-- =====================================================
-- 6. FUNCIÓN PARA CALCULAR COMISIÓN Y FECHA LIBERACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_datos_pago_from_medio_cobro()
RETURNS TRIGGER AS $$
DECLARE
  v_medio_cobro medios_cobro%ROWTYPE;
BEGIN
  -- Si tiene medio_cobro_id, calcular comisión y fecha de liberación
  IF NEW.medio_cobro_id IS NOT NULL THEN
    -- Obtener datos del medio de cobro
    SELECT * INTO v_medio_cobro
    FROM medios_cobro
    WHERE id = NEW.medio_cobro_id;

    -- Calcular comisión aplicada (% del monto)
    IF v_medio_cobro.comision_porcentaje IS NOT NULL AND v_medio_cobro.comision_porcentaje > 0 THEN
      NEW.comision_aplicada := (NEW.monto * v_medio_cobro.comision_porcentaje / 100);
    ELSE
      NEW.comision_aplicada := 0;
    END IF;

    -- Calcular fecha de liberación estimada
    IF v_medio_cobro.dias_liberacion IS NOT NULL AND v_medio_cobro.dias_liberacion > 0 THEN
      NEW.fecha_liberacion_estimada := NEW.fecha_pago + (v_medio_cobro.dias_liberacion || ' days')::interval;
    ELSE
      NEW.fecha_liberacion_estimada := NEW.fecha_pago;
    END IF;
  ELSE
    -- Si no tiene medio_cobro_id, usar metodo_pago legacy (sin comisión ni liberación)
    NEW.comision_aplicada := 0;
    NEW.fecha_liberacion_estimada := NEW.fecha_pago;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CREAR TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_calcular_datos_pago_from_medio_cobro ON ordenes_trabajo_pagos;

CREATE TRIGGER trigger_calcular_datos_pago_from_medio_cobro
  BEFORE INSERT OR UPDATE OF medio_cobro_id, monto, fecha_pago
  ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION calcular_datos_pago_from_medio_cobro();
