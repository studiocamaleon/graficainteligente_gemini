/*
  # Sistema de Archivos para Órdenes de Trabajo (GI)

  ## Descripción
  Sistema para adjuntar archivos e imágenes a órdenes de trabajo generales (GI) con:
  - Soporte para adjuntos manuales y capturas de pantalla
  - Storage multi-tenant seguro
  - Límite de 200MB total por orden
  - Soporte para orden_temporal_id durante la creación

  ## Nuevas Tablas

  ### 1. ordenes_trabajo_archivos
  - Almacena archivos adjuntos a órdenes de trabajo
  - Límite: 200MB total por orden
*/

-- =====================================================
-- 1. TABLA: ordenes_trabajo_archivos
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  orden_temporal_id uuid, -- Para soporte durante la creación
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT check_tamano_archivo_gi_valido CHECK (tamano_bytes > 0 AND tamano_bytes <= 209715200),
  CONSTRAINT check_tiene_id_referencia CHECK (orden_id IS NOT NULL OR orden_temporal_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gi_archivos_orden ON ordenes_trabajo_archivos(orden_id, company_id);
CREATE INDEX IF NOT EXISTS idx_gi_archivos_created ON ordenes_trabajo_archivos(created_at DESC);

-- Asegurar que la columna existe si la tabla ya fue creada previamente (hotfix)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ordenes_trabajo_archivos' 
    AND column_name = 'orden_temporal_id'
  ) THEN
    ALTER TABLE ordenes_trabajo_archivos ADD COLUMN orden_temporal_id uuid;
  END IF;

  -- Asegurar que orden_id sea opcional (puede ser NULL si hay orden_temporal_id)
  ALTER TABLE ordenes_trabajo_archivos ALTER COLUMN orden_id DROP NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_gi_archivos_temporal ON ordenes_trabajo_archivos(orden_temporal_id);

COMMENT ON TABLE ordenes_trabajo_archivos IS 'Archivos adjuntos a órdenes de trabajo (GI).';

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE ordenes_trabajo_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gi archivos from their company"
  ON ordenes_trabajo_archivos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert gi archivos for their company"
  ON ordenes_trabajo_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update gi archivos from their company"
  ON ordenes_trabajo_archivos
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

CREATE POLICY "Users can delete gi archivos from their company"
  ON ordenes_trabajo_archivos
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 3. STORAGE BUCKET
-- =====================================================

INSERT INTO storage.buckets (id, name)
VALUES (
  'ordenes-trabajo-archivos',
  'ordenes-trabajo-archivos'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. STORAGE RLS POLICIES
-- =====================================================

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can view gi files from their company'
  ) THEN
    CREATE POLICY "Users can view gi files from their company"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'ordenes-trabajo-archivos' AND
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
    AND policyname = 'Users can upload gi files for their company'
  ) THEN
    CREATE POLICY "Users can upload gi files for their company"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'ordenes-trabajo-archivos' AND
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
    AND policyname = 'Users can delete gi files from their company'
  ) THEN
    CREATE POLICY "Users can delete gi files from their company"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'ordenes-trabajo-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;
END $$;
