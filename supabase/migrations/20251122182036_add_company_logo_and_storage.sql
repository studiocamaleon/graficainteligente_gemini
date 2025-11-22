/*
  # Agregar Logo Personalizado por Empresa

  ## Descripción
  Esta migración agrega la capacidad de que cada empresa tenga su propio logo personalizado
  que se mostrará en el favicon del navegador y en el sidebar de la aplicación.

  ## Cambios en la Base de Datos

  ### 1. Nueva Columna en Companies
  - `logo_url` (text, nullable) - URL del logo de la empresa almacenado en Supabase Storage

  ### 2. Storage Bucket
  - Crea el bucket `company-logos` para almacenar los logos
  - Configura políticas de acceso:
    - Lectura pública para todos los usuarios autenticados de la empresa
    - Escritura solo para super_admin y admin de la empresa

  ## Seguridad
  - Solo super_admin y admin pueden subir/modificar logos
  - Los logos son accesibles públicamente una vez subidos (necesario para favicon)
  - Tamaño máximo de archivo: 2MB (configurado en las políticas)
  - Formatos permitidos: PNG, JPG, JPEG, ICO
*/

-- 1. Agregar columna logo_url a la tabla companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url text;
  END IF;
END $$;

-- Comentario en la columna para documentación
COMMENT ON COLUMN companies.logo_url IS 'URL del logo de la empresa almacenado en Supabase Storage';

-- 2. Crear el bucket de storage para logos de empresas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon'];

-- 3. Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Public read access for company logos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can delete logos" ON storage.objects;

-- 4. Política de lectura pública para logos (necesario para favicon y sidebar)
CREATE POLICY "Public read access for company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- 5. Política de escritura: solo super_admin y admin pueden subir logos de su empresa
CREATE POLICY "Company admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
      AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  )
);

-- 6. Política de actualización: solo super_admin y admin pueden actualizar logos de su empresa
CREATE POLICY "Company admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
      AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  )
);

-- 7. Política de eliminación: solo super_admin y admin pueden eliminar logos de su empresa
CREATE POLICY "Company admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
      AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  )
);

-- 8. Crear índice para mejorar consultas por logo_url
CREATE INDEX IF NOT EXISTS idx_companies_logo_url ON companies(logo_url) WHERE logo_url IS NOT NULL;