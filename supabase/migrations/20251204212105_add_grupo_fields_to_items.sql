/*
  # Agregar campos para agrupación y servicios globales

  ## Descripción
  Agrega campos necesarios para:
  - Agrupar items relacionados del mismo wizard
  - Almacenar precios de servicios/acabados globales distribuidos
  - Almacenar información de servicios/acabados globales del grupo

  ## Cambios
  1. Agregar `item_grupo_id` para agrupar items relacionados
  2. Agregar `precio_servicios_globales` para porción distribuida
  3. Agregar `precio_acabados_globales` para porción distribuida
  4. Agregar `servicios_globales_grupo` (JSONB) para info completa
  5. Agregar `acabados_globales_grupo` (JSONB) para info completa
  6. Crear índices para optimizar queries

  ## Notas
  - Todos los campos son nullable para retrocompatibilidad
  - Items sin `item_grupo_id` son items individuales (no agrupados)
  - Solo el primer item de un grupo tiene `servicios_globales_grupo` y `acabados_globales_grupo`
*/

-- =====================================================
-- 1. AGREGAR CAMPOS DE AGRUPACIÓN
-- =====================================================

-- Campo para agrupar items relacionados
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS item_grupo_id uuid;

-- Índice para buscar items del mismo grupo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_item_grupo_id
  ON ordenes_trabajo_items(item_grupo_id)
  WHERE item_grupo_id IS NOT NULL;

COMMENT ON COLUMN ordenes_trabajo_items.item_grupo_id IS
'UUID que agrupa items relacionados creados desde el mismo wizard. NULL para items individuales.';

-- =====================================================
-- 2. AGREGAR CAMPOS DE PRECIOS GLOBALES
-- =====================================================

-- Precio de servicios globales distribuido
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS precio_servicios_globales numeric DEFAULT 0;

-- Precio de acabados globales distribuido
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS precio_acabados_globales numeric DEFAULT 0;

-- Constraints para validar valores positivos
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_precio_servicios_globales_positivo;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_precio_servicios_globales_positivo
    CHECK (precio_servicios_globales >= 0);

ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_precio_acabados_globales_positivo;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_precio_acabados_globales_positivo
    CHECK (precio_acabados_globales >= 0);

COMMENT ON COLUMN ordenes_trabajo_items.precio_servicios_globales IS
'Porción del precio de servicios globales asignada a este item (distribuida proporcionalmente)';

COMMENT ON COLUMN ordenes_trabajo_items.precio_acabados_globales IS
'Porción del precio de acabados globales asignada a este item (distribuida proporcionalmente)';

-- =====================================================
-- 3. AGREGAR CAMPOS JSONB PARA INFO COMPLETA
-- =====================================================

-- Información completa de servicios globales del grupo
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS servicios_globales_grupo jsonb DEFAULT NULL;

-- Información completa de acabados globales del grupo
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS acabados_globales_grupo jsonb DEFAULT NULL;

-- Índices GIN para búsquedas en JSONB
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_servicios_globales_grupo
  ON ordenes_trabajo_items USING gin(servicios_globales_grupo)
  WHERE servicios_globales_grupo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_acabados_globales_grupo
  ON ordenes_trabajo_items USING gin(acabados_globales_grupo)
  WHERE acabados_globales_grupo IS NOT NULL;

COMMENT ON COLUMN ordenes_trabajo_items.servicios_globales_grupo IS
'Array JSONB con información completa de servicios globales del grupo. Solo en el primer item del grupo.';

COMMENT ON COLUMN ordenes_trabajo_items.acabados_globales_grupo IS
'Array JSONB con información completa de acabados globales del grupo. Solo en el primer item del grupo.';

-- =====================================================
-- 4. ACTUALIZAR VALORES DEFAULT PARA ITEMS EXISTENTES
-- =====================================================

-- Los items existentes ya tienen precio_servicios y precio_acabados
-- Simplemente aseguramos que los nuevos campos sean 0
UPDATE ordenes_trabajo_items
SET
  precio_servicios_globales = 0,
  precio_acabados_globales = 0
WHERE
  precio_servicios_globales IS NULL OR
  precio_acabados_globales IS NULL;
