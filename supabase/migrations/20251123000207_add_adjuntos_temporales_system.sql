/*
  # Sistema de Adjuntos Temporales para Órdenes en Creación

  ## Cambios Principales
  
  1. **Campos temporales en tablas de adjuntos**
     - orden_temporal_id: UUID para adjuntos antes de crear la orden
     - temporal_creado_en: timestamp para limpieza automática
     - orden_id ahora es nullable
  
  2. **Constraints de validación**
     - Debe tener orden_id O orden_temporal_id, no ambos
  
  3. **Funciones de limpieza**
     - Limpiar adjuntos temporales antiguos (>24 horas)
     - Asociar adjuntos temporales con orden real
  
  4. **Índices para rendimiento**
     - Búsqueda por orden_temporal_id
     - Limpieza de adjuntos antiguos
*/

-- =====================================================
-- 1. MODIFICAR TABLA ordenes_trabajo_archivos
-- =====================================================

-- Agregar campos para adjuntos temporales
ALTER TABLE ordenes_trabajo_archivos
  ADD COLUMN IF NOT EXISTS orden_temporal_id uuid,
  ADD COLUMN IF NOT EXISTS temporal_creado_en timestamptz;

-- Permitir orden_id NULL para adjuntos temporales
ALTER TABLE ordenes_trabajo_archivos
  ALTER COLUMN orden_id DROP NOT NULL;

-- Constraint: debe tener orden_id O orden_temporal_id, no ambos
ALTER TABLE ordenes_trabajo_archivos
  DROP CONSTRAINT IF EXISTS check_orden_id_xor_temporal;

ALTER TABLE ordenes_trabajo_archivos
  ADD CONSTRAINT check_orden_id_xor_temporal
  CHECK (
    (orden_id IS NOT NULL AND orden_temporal_id IS NULL) OR
    (orden_id IS NULL AND orden_temporal_id IS NOT NULL)
  );

-- Índices para búsqueda y limpieza
CREATE INDEX IF NOT EXISTS idx_archivos_temporal 
  ON ordenes_trabajo_archivos(orden_temporal_id)
  WHERE orden_temporal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archivos_temporal_antiguos
  ON ordenes_trabajo_archivos(temporal_creado_en)
  WHERE temporal_creado_en IS NOT NULL;

-- =====================================================
-- 2. MODIFICAR TABLA ordenes_trabajo_archivos_produccion
-- =====================================================

ALTER TABLE ordenes_trabajo_archivos_produccion
  ADD COLUMN IF NOT EXISTS orden_temporal_id uuid,
  ADD COLUMN IF NOT EXISTS temporal_creado_en timestamptz;

ALTER TABLE ordenes_trabajo_archivos_produccion
  ALTER COLUMN orden_id DROP NOT NULL;

ALTER TABLE ordenes_trabajo_archivos_produccion
  DROP CONSTRAINT IF EXISTS check_orden_id_xor_temporal_prod;

ALTER TABLE ordenes_trabajo_archivos_produccion
  ADD CONSTRAINT check_orden_id_xor_temporal_prod
  CHECK (
    (orden_id IS NOT NULL AND orden_temporal_id IS NULL) OR
    (orden_id IS NULL AND orden_temporal_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_archivos_prod_temporal 
  ON ordenes_trabajo_archivos_produccion(orden_temporal_id)
  WHERE orden_temporal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archivos_prod_temporal_antiguos
  ON ordenes_trabajo_archivos_produccion(temporal_creado_en)
  WHERE temporal_creado_en IS NOT NULL;

-- =====================================================
-- 3. MODIFICAR TABLA ordenes_trabajo_links
-- =====================================================

ALTER TABLE ordenes_trabajo_links
  ADD COLUMN IF NOT EXISTS orden_temporal_id uuid,
  ADD COLUMN IF NOT EXISTS temporal_creado_en timestamptz;

ALTER TABLE ordenes_trabajo_links
  ALTER COLUMN orden_id DROP NOT NULL;

ALTER TABLE ordenes_trabajo_links
  DROP CONSTRAINT IF EXISTS check_orden_id_xor_temporal_links;

ALTER TABLE ordenes_trabajo_links
  ADD CONSTRAINT check_orden_id_xor_temporal_links
  CHECK (
    (orden_id IS NOT NULL AND orden_temporal_id IS NULL) OR
    (orden_id IS NULL AND orden_temporal_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_links_temporal 
  ON ordenes_trabajo_links(orden_temporal_id)
  WHERE orden_temporal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_links_temporal_antiguos
  ON ordenes_trabajo_links(temporal_creado_en)
  WHERE temporal_creado_en IS NOT NULL;

-- =====================================================
-- 4. FUNCIÓN: Asociar adjuntos temporales con orden real
-- =====================================================

CREATE OR REPLACE FUNCTION fn_asociar_adjuntos_temporales(
  p_orden_temporal_id uuid,
  p_orden_id uuid,
  p_company_id uuid
)
RETURNS TABLE (
  archivos_asociados integer,
  archivos_produccion_asociados integer,
  links_asociados integer
) AS $$
DECLARE
  v_archivos_count integer;
  v_archivos_prod_count integer;
  v_links_count integer;
BEGIN
  -- Asociar archivos de cliente
  UPDATE ordenes_trabajo_archivos
  SET 
    orden_id = p_orden_id,
    orden_temporal_id = NULL,
    temporal_creado_en = NULL,
    -- Actualizar path de storage (mover de temporal/ a final/)
    storage_path = REPLACE(storage_path, '/temporal/' || p_orden_temporal_id::text, '/' || p_orden_id::text)
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_count = ROW_COUNT;

  -- Asociar archivos de producción
  UPDATE ordenes_trabajo_archivos_produccion
  SET 
    orden_id = p_orden_id,
    orden_temporal_id = NULL,
    temporal_creado_en = NULL,
    storage_path = REPLACE(storage_path, '/temporal/' || p_orden_temporal_id::text, '/' || p_orden_id::text)
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_prod_count = ROW_COUNT;

  -- Asociar links
  UPDATE ordenes_trabajo_links
  SET 
    orden_id = p_orden_id,
    orden_temporal_id = NULL,
    temporal_creado_en = NULL
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_links_count = ROW_COUNT;

  -- Retornar estadísticas
  RETURN QUERY SELECT v_archivos_count, v_archivos_prod_count, v_links_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNCIÓN: Limpiar adjuntos temporales específicos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_limpiar_adjuntos_temporales(
  p_orden_temporal_id uuid,
  p_company_id uuid
)
RETURNS TABLE (
  archivos_eliminados integer,
  archivos_produccion_eliminados integer,
  links_eliminados integer,
  storage_paths text[]
) AS $$
DECLARE
  v_archivos_count integer;
  v_archivos_prod_count integer;
  v_links_count integer;
  v_storage_paths text[];
BEGIN
  -- Recopilar paths de storage para eliminación
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths
  FROM (
    SELECT storage_path FROM ordenes_trabajo_archivos
    WHERE orden_temporal_id = p_orden_temporal_id
      AND company_id = p_company_id
    UNION ALL
    SELECT storage_path FROM ordenes_trabajo_archivos_produccion
    WHERE orden_temporal_id = p_orden_temporal_id
      AND company_id = p_company_id
  ) paths;

  -- Eliminar archivos de cliente
  DELETE FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_count = ROW_COUNT;

  -- Eliminar archivos de producción
  DELETE FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_prod_count = ROW_COUNT;

  -- Eliminar links
  DELETE FROM ordenes_trabajo_links
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_links_count = ROW_COUNT;

  -- Retornar estadísticas
  RETURN QUERY SELECT v_archivos_count, v_archivos_prod_count, v_links_count, v_storage_paths;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNCIÓN: Limpiar adjuntos temporales antiguos (>24h)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_limpiar_adjuntos_temporales_antiguos()
RETURNS TABLE (
  archivos_eliminados integer,
  archivos_produccion_eliminados integer,
  links_eliminados integer,
  storage_paths_cliente text[],
  storage_paths_produccion text[]
) AS $$
DECLARE
  v_archivos_count integer;
  v_archivos_prod_count integer;
  v_links_count integer;
  v_storage_paths_cliente text[];
  v_storage_paths_produccion text[];
  v_fecha_limite timestamptz;
BEGIN
  v_fecha_limite := NOW() - interval '24 hours';

  -- Recopilar paths de archivos de cliente
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths_cliente
  FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;

  -- Recopilar paths de archivos de producción
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths_produccion
  FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;

  -- Eliminar archivos de cliente antiguos
  DELETE FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_archivos_count = ROW_COUNT;

  -- Eliminar archivos de producción antiguos
  DELETE FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_archivos_prod_count = ROW_COUNT;

  -- Eliminar links antiguos
  DELETE FROM ordenes_trabajo_links
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_links_count = ROW_COUNT;

  -- Retornar estadísticas
  RETURN QUERY SELECT 
    v_archivos_count, 
    v_archivos_prod_count, 
    v_links_count,
    v_storage_paths_cliente,
    v_storage_paths_produccion;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. POLÍTICAS RLS PARA ADJUNTOS TEMPORALES
-- =====================================================

-- Los usuarios pueden ver sus propios adjuntos temporales
-- (mismo company_id)

-- Las políticas existentes ya cubren esto porque filtran por company_id
-- Solo necesitamos asegurar que funcionen con orden_temporal_id también

-- =====================================================
-- 8. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN ordenes_trabajo_archivos.orden_temporal_id IS 
'UUID temporal para adjuntos antes de crear la orden. Se convierte a orden_id al guardar.';

COMMENT ON COLUMN ordenes_trabajo_archivos.temporal_creado_en IS 
'Timestamp de creación del adjunto temporal. Usado para limpieza automática después de 24h.';

COMMENT ON FUNCTION fn_asociar_adjuntos_temporales IS
'Asocia adjuntos temporales con una orden real después de crearla. Actualiza paths de storage y IDs.';

COMMENT ON FUNCTION fn_limpiar_adjuntos_temporales IS
'Elimina adjuntos temporales específicos de una sesión de creación cancelada.';

COMMENT ON FUNCTION fn_limpiar_adjuntos_temporales_antiguos IS
'Limpieza automática de adjuntos temporales con más de 24 horas. Se ejecuta periódicamente.';
