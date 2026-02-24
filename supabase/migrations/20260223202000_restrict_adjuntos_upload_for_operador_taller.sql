-- Restringe carga de adjuntos de órdenes para operador_taller/operator
-- Regla de negocio: todos pueden adjuntar excepto operador_taller.

-- =====================================================
-- 1) Tabla ordenes_trabajo_archivos (INSERT)
-- =====================================================
DROP POLICY IF EXISTS "Users can insert gi archivos for their company" ON public.ordenes_trabajo_archivos;
DROP POLICY IF EXISTS "Users can insert own company order files" ON public.ordenes_trabajo_archivos;

CREATE POLICY "Users can insert gi archivos for their company except taller"
  ON public.ordenes_trabajo_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, '') NOT IN ('operador_taller', 'operator')
    )
  );

-- =====================================================
-- 2) Storage bucket ordenes-trabajo-archivos (INSERT)
-- =====================================================
DROP POLICY IF EXISTS "Users can upload gi files for their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload order files for their company" ON storage.objects;

CREATE POLICY "Users can upload gi files for their company except taller"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ordenes-trabajo-archivos'
    AND (storage.foldername(name))[1] IN (
      SELECT p.company_id::text
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, '') NOT IN ('operador_taller', 'operator')
    )
  );
