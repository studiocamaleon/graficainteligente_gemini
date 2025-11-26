/*
  # Asociar Medios de Cobro con Cajas

  ## Descripción
  Agrega la relación entre medios de cobro y cajas. Cada medio de cobro
  ahora se asocia a una caja específica donde se acumula el dinero.

  ## Cambios
  - Agregar columna `caja_id` a tabla `medios_cobro`
  - Crear índice para optimizar consultas
  - Permitir nullable temporalmente para migración de datos existentes
*/

-- =====================================================
-- AGREGAR COLUMNA caja_id a medios_cobro
-- =====================================================

ALTER TABLE medios_cobro
  ADD COLUMN IF NOT EXISTS caja_id uuid REFERENCES cajas(id) ON DELETE RESTRICT;

-- Crear índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_medios_cobro_caja_id ON medios_cobro(caja_id);

-- Nota: caja_id es nullable temporalmente para permitir migración
-- de datos existentes. Se hará NOT NULL después de la migración.
