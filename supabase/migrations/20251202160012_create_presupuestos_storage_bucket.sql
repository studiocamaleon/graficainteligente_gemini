/*
  # Storage Bucket para Presupuestos

  ## Bucket Creado
  - `presupuestos-archivos`: Para PDFs generados y archivos adjuntos

  ## Configuración
  - Privado (public = false)
  - Límite: 50MB por archivo
  - Tipos MIME permitidos: PDF, imágenes, documentos, archivos de diseño

  ## Políticas de Storage
  - SELECT: Usuarios de la company pueden ver
  - INSERT: Usuarios de la company pueden subir
  - UPDATE: Usuarios de la company pueden actualizar
  - DELETE: Usuarios de la company pueden eliminar
*/

-- ============================================================================
-- CREAR BUCKET: presupuestos-archivos
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'presupuestos-archivos'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES (
      'presupuestos-archivos',
      'presupuestos-archivos'
    );
  END IF;
END $$;

-- ============================================================================
-- POLÍTICAS DE STORAGE: presupuestos-archivos
-- ============================================================================

-- SELECT: Ver archivos de su company
DROP POLICY IF EXISTS "Users can view presupuesto files from their company" ON storage.objects;
CREATE POLICY "Users can view presupuesto files from their company"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'presupuestos-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: Subir archivos a su company
DROP POLICY IF EXISTS "Users can upload presupuesto files to their company" ON storage.objects;
CREATE POLICY "Users can upload presupuesto files to their company"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'presupuestos-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: Actualizar archivos de su company
DROP POLICY IF EXISTS "Users can update presupuesto files from their company" ON storage.objects;
CREATE POLICY "Users can update presupuesto files from their company"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'presupuestos-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'presupuestos-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Eliminar archivos de su company
DROP POLICY IF EXISTS "Users can delete presupuesto files from their company" ON storage.objects;
CREATE POLICY "Users can delete presupuesto files from their company"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'presupuestos-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );
