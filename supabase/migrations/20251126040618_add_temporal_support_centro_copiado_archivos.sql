/*
  # Agregar Soporte para Archivos Temporales en Centro de Copiado

  ## Descripción
  Permite subir archivos sin crear orden primero (sin estado borrador).
  Los archivos se almacenan temporalmente y se asocian a la orden real al guardar.

  ## Cambios

  1. Nuevos campos en centro_copiado_ordenes_archivos:
    - `orden_temporal_id` - ID temporal generado en frontend
    - `temporal_creado_en` - Timestamp de creación temporal

  2. Modificaciones a constraints:
    - `orden_copiado_id` ahora es NULLABLE
    - Solo uno de `orden_copiado_id` o `orden_temporal_id` debe estar presente

  3. Nueva función SQL:
    - `fn_asociar_archivos_copiado_temporales` - Asocia archivos temporales a orden real

  4. Actualización de índices:
    - Índice en `orden_temporal_id` para búsquedas rápidas

  ## Seguridad
  - RLS actualizado para permitir archivos temporales
  - Solo usuarios autenticados pueden crear archivos temporales
  - Archivos temporales solo visibles para el usuario que los creó
*/

-- =====================================================
-- 1. AGREGAR CAMPOS TEMPORALES
-- =====================================================

-- Hacer orden_copiado_id nullable (puede ser NULL en modo temporal)
ALTER TABLE centro_copiado_ordenes_archivos
  ALTER COLUMN orden_copiado_id DROP NOT NULL;

-- Agregar campos para soporte temporal
ALTER TABLE centro_copiado_ordenes_archivos
  ADD COLUMN IF NOT EXISTS orden_temporal_id text,
  ADD COLUMN IF NOT EXISTS temporal_creado_en timestamptz;

-- Constraint: Solo uno de orden_copiado_id o orden_temporal_id debe estar presente
ALTER TABLE centro_copiado_ordenes_archivos
  DROP CONSTRAINT IF EXISTS check_orden_o_temporal;

ALTER TABLE centro_copiado_ordenes_archivos
  ADD CONSTRAINT check_orden_o_temporal CHECK (
    (orden_copiado_id IS NOT NULL AND orden_temporal_id IS NULL) OR
    (orden_copiado_id IS NULL AND orden_temporal_id IS NOT NULL)
  );

-- Índice en orden_temporal_id para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cc_archivos_temporal
  ON centro_copiado_ordenes_archivos(orden_temporal_id, company_id)
  WHERE orden_temporal_id IS NOT NULL;

COMMENT ON COLUMN centro_copiado_ordenes_archivos.orden_temporal_id IS 'ID temporal generado en frontend para archivos pre-orden. Se usa antes de crear la orden real.';
COMMENT ON COLUMN centro_copiado_ordenes_archivos.temporal_creado_en IS 'Timestamp de cuándo se creó el archivo temporal. Se limpia al asociar con orden real.';

-- =====================================================
-- 2. ACTUALIZAR RLS PARA ARCHIVOS TEMPORALES
-- =====================================================

-- Política SELECT: permitir ver archivos temporales propios
DROP POLICY IF EXISTS "Users can view archivos from their company" ON centro_copiado_ordenes_archivos;

CREATE POLICY "Users can view archivos from their company"
  ON centro_copiado_ordenes_archivos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      -- Archivos de órdenes reales
      orden_copiado_id IS NOT NULL
      OR
      -- Archivos temporales solo del usuario que los creó
      (orden_temporal_id IS NOT NULL AND uploaded_by = auth.uid())
    )
  );

-- Política INSERT: permitir crear archivos temporales
DROP POLICY IF EXISTS "Users can insert archivos for their company" ON centro_copiado_ordenes_archivos;

CREATE POLICY "Users can insert archivos for their company"
  ON centro_copiado_ordenes_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
    AND (
      -- Orden real existe
      orden_copiado_id IS NOT NULL
      OR
      -- O es archivo temporal
      orden_temporal_id IS NOT NULL
    )
  );

-- =====================================================
-- 3. ACTUALIZAR FUNCIÓN DE VALIDACIÓN DE LÍMITE
-- =====================================================

-- Actualizar función para soportar archivos temporales
CREATE OR REPLACE FUNCTION fn_validar_limite_total_archivos_copiado()
RETURNS TRIGGER AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 209715200; -- 200 MB
BEGIN
  -- Calcular total según si es temporal o real
  IF NEW.orden_temporal_id IS NOT NULL THEN
    -- Para archivos temporales, validar contra el ID temporal
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_actual
    FROM centro_copiado_ordenes_archivos
    WHERE orden_temporal_id = NEW.orden_temporal_id
      AND company_id = NEW.company_id;
  ELSIF NEW.orden_copiado_id IS NOT NULL THEN
    -- Para archivos de orden real
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_actual
    FROM centro_copiado_ordenes_archivos
    WHERE orden_copiado_id = NEW.orden_copiado_id
      AND company_id = NEW.company_id;
  ELSE
    RAISE EXCEPTION 'Debe especificar orden_copiado_id o orden_temporal_id';
  END IF;

  -- Validar que no exceda el límite
  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'Ha alcanzado el límite de almacenamiento de 200 MB. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. ACTUALIZAR FUNCIÓN DE CÁLCULO DE ESPACIO
-- =====================================================

-- Crear versión que soporte ID temporal
CREATE OR REPLACE FUNCTION fn_calcular_espacio_usado_copiado_temporal(
  p_orden_id uuid DEFAULT NULL,
  p_orden_temporal_id text DEFAULT NULL
)
RETURNS TABLE(
  espacio_usado_bytes bigint,
  espacio_usado_mb numeric,
  espacio_disponible_bytes bigint,
  espacio_disponible_mb numeric,
  porcentaje_usado numeric,
  limite_total_bytes bigint
) AS $$
DECLARE
  v_limite_maximo bigint := 209715200; -- 200 MB
  v_total_usado bigint;
BEGIN
  -- Calcular total usado según parámetro
  IF p_orden_temporal_id IS NOT NULL THEN
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_usado
    FROM centro_copiado_ordenes_archivos
    WHERE orden_temporal_id = p_orden_temporal_id;
  ELSIF p_orden_id IS NOT NULL THEN
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_usado
    FROM centro_copiado_ordenes_archivos
    WHERE orden_copiado_id = p_orden_id;
  ELSE
    v_total_usado := 0;
  END IF;

  RETURN QUERY
  SELECT
    v_total_usado,
    ROUND(v_total_usado::numeric / 1048576, 2),
    v_limite_maximo - v_total_usado,
    ROUND((v_limite_maximo - v_total_usado)::numeric / 1048576, 2),
    ROUND((v_total_usado::numeric / v_limite_maximo * 100), 2),
    v_limite_maximo;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calcular_espacio_usado_copiado_temporal IS 'Calcula espacio usado para orden real o temporal. Límite: 200MB.';

-- =====================================================
-- 5. FUNCIÓN: Asociar archivos temporales con orden real
-- =====================================================

CREATE OR REPLACE FUNCTION fn_asociar_archivos_copiado_temporales(
  p_orden_temporal_id text,
  p_orden_copiado_id uuid,
  p_company_id uuid
)
RETURNS TABLE (archivos_asociados int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Actualizar archivos temporales a orden real
  UPDATE centro_copiado_ordenes_archivos
  SET
    orden_copiado_id = p_orden_copiado_id,
    orden_temporal_id = NULL,
    temporal_creado_en = NULL,
    updated_at = NOW()
  WHERE
    orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION fn_asociar_archivos_copiado_temporales IS 'Asocia archivos temporales con una orden real. Usado al guardar orden.';

-- =====================================================
-- 6. FUNCIÓN: Limpiar archivos temporales antiguos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_limpiar_archivos_temporales_copiado(
  p_horas_antiguedad int DEFAULT 24
)
RETURNS TABLE (archivos_eliminados int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Eliminar archivos temporales más antiguos que X horas
  DELETE FROM centro_copiado_ordenes_archivos
  WHERE
    orden_temporal_id IS NOT NULL
    AND temporal_creado_en < NOW() - (p_horas_antiguedad || ' hours')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION fn_limpiar_archivos_temporales_copiado IS 'Limpia archivos temporales no asociados después de X horas. Default: 24h.';

-- =====================================================
-- 7. ACTUALIZAR STORAGE RLS PARA ARCHIVOS TEMPORALES
-- =====================================================

-- Las políticas de storage deben permitir acceso a carpeta temporal
-- Estructura: {company_id}/temporal/{ordenTemporalId}/*

DROP POLICY IF EXISTS "Users can view centro copiado files from their company" ON storage.objects;

CREATE POLICY "Users can view centro copiado files from their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'centro-copiado-archivos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can upload centro copiado files for their company" ON storage.objects;

CREATE POLICY "Users can upload centro copiado files for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'centro-copiado-archivos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update centro copiado files from their company" ON storage.objects;

CREATE POLICY "Users can update centro copiado files from their company"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'centro-copiado-archivos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete centro copiado files from their company" ON storage.objects;

CREATE POLICY "Users can delete centro copiado files from their company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'centro-copiado-archivos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);