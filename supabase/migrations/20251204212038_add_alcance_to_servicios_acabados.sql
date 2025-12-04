/*
  # Agregar campo alcance a servicios y acabados

  ## Descripción
  Agrega el campo `alcance` a las tablas `servicios` y `acabados` para permitir
  definir si un servicio/acabado se aplica por item individual o al grupo completo.

  ## Cambios
  1. Agregar columna `alcance` a `servicios`
  2. Agregar columna `alcance` a `acabados`
  3. Actualizar registros existentes con valor default 'por_item'
  4. Agregar constraints de validación

  ## Valores de alcance
  - 'por_item': Se aplica a cada item individual (default)
  - 'grupo': Se aplica una vez para todos los items del grupo

  ## Retrocompatibilidad
  - Todos los servicios/acabados existentes se marcan como 'por_item'
  - No afecta funcionalidad actual
*/

-- =====================================================
-- 1. AGREGAR CAMPO ALCANCE A SERVICIOS
-- =====================================================

-- Agregar columna alcance
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS alcance text NOT NULL DEFAULT 'por_item';

-- Agregar constraint para validar valores
ALTER TABLE servicios
  DROP CONSTRAINT IF EXISTS check_servicios_alcance_valido;

ALTER TABLE servicios
  ADD CONSTRAINT check_servicios_alcance_valido
    CHECK (alcance IN ('por_item', 'grupo'));

-- Actualizar todos los registros existentes
UPDATE servicios
SET alcance = 'por_item'
WHERE alcance IS NULL OR alcance = '';

-- Crear índice para mejorar queries
CREATE INDEX IF NOT EXISTS idx_servicios_alcance
  ON servicios(alcance);

-- Comentario para documentación
COMMENT ON COLUMN servicios.alcance IS
'Alcance del servicio: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';

-- =====================================================
-- 2. AGREGAR CAMPO ALCANCE A ACABADOS
-- =====================================================

-- Agregar columna alcance
ALTER TABLE acabados
  ADD COLUMN IF NOT EXISTS alcance text NOT NULL DEFAULT 'por_item';

-- Agregar constraint para validar valores
ALTER TABLE acabados
  DROP CONSTRAINT IF EXISTS check_acabados_alcance_valido;

ALTER TABLE acabados
  ADD CONSTRAINT check_acabados_alcance_valido
    CHECK (alcance IN ('por_item', 'grupo'));

-- Actualizar todos los registros existentes
UPDATE acabados
SET alcance = 'por_item'
WHERE alcance IS NULL OR alcance = '';

-- Crear índice para mejorar queries
CREATE INDEX IF NOT EXISTS idx_acabados_alcance
  ON acabados(alcance);

-- Comentario para documentación
COMMENT ON COLUMN acabados.alcance IS
'Alcance del acabado: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';
