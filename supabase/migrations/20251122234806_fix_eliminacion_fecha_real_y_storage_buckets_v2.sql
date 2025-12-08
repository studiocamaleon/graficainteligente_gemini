/*
  # Corrección de Sistema de Eliminación y Creación de Storage Buckets

  ## Cambios Principales
  
  1. Agregar campo fecha_entrega_real a ordenes_trabajo
  2. Corregir trigger de eliminación para usar fecha REAL
  3. Crear storage buckets automáticamente
  4. Crear políticas RLS multi-tenant
*/

-- =====================================================
-- 1. AGREGAR CAMPO fecha_entrega_real
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ordenes_trabajo' AND column_name = 'fecha_entrega_real'
  ) THEN
    ALTER TABLE ordenes_trabajo 
    ADD COLUMN fecha_entrega_real timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN ordenes_trabajo.fecha_entrega_real IS 'Fecha real cuando la orden fue marcada como entregada';

-- =====================================================
-- 2. TRIGGER PARA ACTUALIZAR fecha_entrega_real
-- =====================================================

CREATE OR REPLACE FUNCTION fn_actualizar_fecha_entrega_real()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregada' AND (OLD.estado IS NULL OR OLD.estado != 'entregada') THEN
    NEW.fecha_entrega_real = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_entrega_real ON ordenes_trabajo;

CREATE TRIGGER trigger_actualizar_fecha_entrega_real
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_fecha_entrega_real();

-- =====================================================
-- 3. CORREGIR TRIGGER DE ELIMINACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION fn_marcar_archivos_para_eliminacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregada' AND (OLD.estado IS NULL OR OLD.estado != 'entregada') THEN

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id, orden_id, company_id, tipo_recurso, storage_path,
      fecha_orden_completada, fecha_eliminacion_programada
    )
    SELECT
      id, orden_id, company_id, 'archivo_cliente', storage_path,
      NEW.fecha_entrega_real,
      NEW.fecha_entrega_real + interval '5 days'
    FROM ordenes_trabajo_archivos
    WHERE orden_id = NEW.id;

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id, orden_id, company_id, tipo_recurso, storage_path,
      fecha_orden_completada, fecha_eliminacion_programada
    )
    SELECT
      id, orden_id, company_id, 'archivo_produccion', storage_path,
      NEW.fecha_entrega_real,
      NEW.fecha_entrega_real + interval '5 days'
    FROM ordenes_trabajo_archivos_produccion
    WHERE orden_id = NEW.id;

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id, orden_id, company_id, tipo_recurso, storage_path,
      fecha_orden_completada, fecha_eliminacion_programada
    )
    SELECT
      id, orden_id, company_id, 'link', NULL,
      NEW.fecha_entrega_real,
      NEW.fecha_entrega_real + interval '5 days'
    FROM ordenes_trabajo_links
    WHERE orden_id = NEW.id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREAR STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name)
VALUES (
  'orden-trabajo-archivos',
  'orden-trabajo-archivos'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name)
VALUES (
  'orden-produccion-archivos',
  'orden-produccion-archivos'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. POLÍTICAS RLS PARA STORAGE
-- =====================================================

DO $$
BEGIN
  -- orden-trabajo-archivos: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view files from their company - cliente'
  ) THEN
    CREATE POLICY "Users can view files from their company - cliente"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'orden-trabajo-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-trabajo-archivos: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload files for their company - cliente'
  ) THEN
    CREATE POLICY "Users can upload files for their company - cliente"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'orden-trabajo-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-trabajo-archivos: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update files from their company - cliente'
  ) THEN
    CREATE POLICY "Users can update files from their company - cliente"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'orden-trabajo-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-trabajo-archivos: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete files from their company - cliente'
  ) THEN
    CREATE POLICY "Users can delete files from their company - cliente"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'orden-trabajo-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-produccion-archivos: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view files from their company - produccion'
  ) THEN
    CREATE POLICY "Users can view files from their company - produccion"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'orden-produccion-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-produccion-archivos: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authorized users can upload files - produccion'
  ) THEN
    CREATE POLICY "Authorized users can upload files - produccion"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'orden-produccion-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      ) AND
      auth.uid() IN (
        SELECT id FROM profiles WHERE role IN ('operator', 'admin', 'super_admin')
      )
    );
  END IF;

  -- orden-produccion-archivos: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update files from their company - produccion'
  ) THEN
    CREATE POLICY "Users can update files from their company - produccion"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'orden-produccion-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;

  -- orden-produccion-archivos: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete files from their company - produccion'
  ) THEN
    CREATE POLICY "Users can delete files from their company - produccion"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'orden-produccion-archivos' AND
      (storage.foldername(name))[1] IN (
        SELECT company_id::text FROM profiles WHERE id = auth.uid()
      )
    );
  END IF;
END $$;

-- =====================================================
-- 6. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_entrega_real 
ON ordenes_trabajo(fecha_entrega_real) 
WHERE fecha_entrega_real IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_estado_entregada 
ON ordenes_trabajo(estado) 
WHERE estado = 'entregada';

-- =====================================================
-- 7. ACTUALIZAR ÓRDENES EXISTENTES
-- =====================================================

UPDATE ordenes_trabajo
SET fecha_entrega_real = fecha_creacion
WHERE estado = 'entregada' AND fecha_entrega_real IS NULL;
