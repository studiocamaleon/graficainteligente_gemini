/*
  # Sistema de Archivos para Órdenes de Centro de Copiado

  ## Descripción
  Sistema completo para adjuntar archivos a órdenes de copiado con:
  - Detección automática de páginas en PDFs
  - Generación automática de items
  - Storage multi-tenant seguro
  - Límite de 200MB total por orden

  ## Nuevas Tablas

  ### 1. centro_copiado_ordenes_archivos
  - Almacena archivos enviados por clientes para imprimir
  - Límite: 200MB por archivo, 200MB total por orden
  - Detecta páginas en PDFs automáticamente
  - Puede vincular archivos a items generados

  ## Storage Bucket
  - Bucket: `centro-copiado-archivos`
  - Privado, multi-tenant por company_id
  - Límite: 200MB por archivo

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id
  - Solo usuarios autenticados pueden acceder a sus archivos
*/

-- =====================================================
-- 1. TABLA: centro_copiado_ordenes_archivos
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_copiado_ordenes_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_copiado_id uuid NOT NULL REFERENCES centro_copiado_ordenes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  paginas_detectadas integer,
  item_generado_id uuid REFERENCES centro_copiado_ordenes_items(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT check_tamano_archivo_copiado_valido CHECK (tamano_bytes > 0 AND tamano_bytes <= 209715200),
  CONSTRAINT check_paginas_positivas CHECK (paginas_detectadas IS NULL OR paginas_detectadas > 0)
);

CREATE INDEX IF NOT EXISTS idx_cc_archivos_orden ON centro_copiado_ordenes_archivos(orden_copiado_id, company_id);
CREATE INDEX IF NOT EXISTS idx_cc_archivos_uploaded_by ON centro_copiado_ordenes_archivos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cc_archivos_created ON centro_copiado_ordenes_archivos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_archivos_item ON centro_copiado_ordenes_archivos(item_generado_id) WHERE item_generado_id IS NOT NULL;

COMMENT ON TABLE centro_copiado_ordenes_archivos IS 'Archivos adjuntos a órdenes de copiado. Límite: 200MB total por orden.';
COMMENT ON COLUMN centro_copiado_ordenes_archivos.paginas_detectadas IS 'Número de páginas detectadas automáticamente en PDFs. NULL para otros formatos.';
COMMENT ON COLUMN centro_copiado_ordenes_archivos.item_generado_id IS 'Referencia al item de la orden generado automáticamente desde este archivo.';

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE centro_copiado_ordenes_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view archivos from their company"
  ON centro_copiado_ordenes_archivos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert archivos for their company"
  ON centro_copiado_ordenes_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update their own archivos"
  ON centro_copiado_ordenes_archivos
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own archivos or admins can delete any"
  ON centro_copiado_ordenes_archivos
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- =====================================================
-- 3. FUNCIÓN: Validar límite total de almacenamiento
-- =====================================================

CREATE OR REPLACE FUNCTION fn_validar_limite_total_archivos_copiado()
RETURNS TRIGGER AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 209715200; -- 200 MB
BEGIN
  -- Calcular total actual de archivos en la orden
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_actual
  FROM centro_copiado_ordenes_archivos
  WHERE orden_copiado_id = NEW.orden_copiado_id
    AND company_id = NEW.company_id;

  -- Validar que no exceda el límite
  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'La orden ha alcanzado el límite de almacenamiento de 200 MB. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_limite_archivos_copiado
  BEFORE INSERT ON centro_copiado_ordenes_archivos
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_limite_total_archivos_copiado();

-- =====================================================
-- 4. FUNCIÓN: Calcular espacio usado por orden
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_espacio_usado_copiado(p_orden_id uuid)
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
  -- Calcular total usado
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_usado
  FROM centro_copiado_ordenes_archivos
  WHERE orden_copiado_id = p_orden_id;

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

COMMENT ON FUNCTION fn_calcular_espacio_usado_copiado IS 'Calcula el espacio usado y disponible para una orden de copiado. Límite: 200MB.';

-- =====================================================
-- 5. STORAGE BUCKET
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'centro-copiado-archivos',
  'centro-copiado-archivos',
  false,
  209715200, -- 200 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.adobe.illustrator',
    'application/postscript',
    'image/vnd.adobe.photoshop',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'text/plain',
    'text/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 209715200,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- 6. STORAGE RLS POLICIES
-- =====================================================

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can view centro copiado files from their company'
  ) THEN
    CREATE POLICY "Users can view centro copiado files from their company"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'centro-copiado-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can upload centro copiado files for their company'
  ) THEN
    CREATE POLICY "Users can upload centro copiado files for their company"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'centro-copiado-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can update centro copiado files from their company'
  ) THEN
    CREATE POLICY "Users can update centro copiado files from their company"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'centro-copiado-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can delete centro copiado files from their company'
  ) THEN
    CREATE POLICY "Users can delete centro copiado files from their company"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'centro-copiado-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;
END $$;

-- =====================================================
-- 7. TRIGGER: Actualizar updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION fn_update_centro_copiado_archivos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_centro_copiado_archivos_updated_at
  BEFORE UPDATE ON centro_copiado_ordenes_archivos
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_centro_copiado_archivos_updated_at();