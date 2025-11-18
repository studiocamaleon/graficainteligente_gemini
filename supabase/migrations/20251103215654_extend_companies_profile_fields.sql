/*
  # Extensión del Perfil de Empresa

  ## Descripción
  Esta migración extiende la tabla `companies` para incluir información completa del perfil de empresa,
  permitiendo a los super_admin y admin gestionar información de contacto, ubicación, fiscal y configuración regional.

  ## Nuevos Campos

  ### Información de Contacto
  - `contact_phone` (text) - Teléfono de contacto de la empresa
  - `contact_email` (text) - Email de contacto de la empresa
  - `website` (text) - Sitio web de la empresa

  ### Información de Ubicación
  - `address` (text) - Dirección completa de la empresa
  - `country_id` (uuid, FK) - Referencia a countries
  - `province_id` (uuid, FK) - Referencia a provinces
  - `city_id` (uuid, FK) - Referencia a cities
  - `postal_code` (text) - Código postal

  ### Información Fiscal
  - `legal_name` (text) - Razón social de la empresa
  - `tax_id_type` (text) - Tipo de identificación fiscal: DNI, CUIT, CUIL
  - `tax_id_number` (text) - Número de identificación fiscal
  - `tax_condition` (text) - Condición IVA: Responsable Inscripto, Monotributo, Exento, etc.

  ### Configuración Regional
  - `timezone` (text) - Zona horaria preferida
  - `currency` (text) - Moneda preferida (por defecto ARS)
  - `language` (text) - Idioma preferido (por defecto es)

  ### Información Adicional
  - `description` (text) - Descripción de la empresa
  - `industry` (text) - Sector o industria

  ## Seguridad
  - Las políticas RLS existentes ya permiten que super_admin y admin actualicen la empresa
  - Se mantiene la restricción de que los usuarios solo pueden ver su propia empresa
*/

-- Agregar nuevos campos a la tabla companies
DO $$
BEGIN
  -- Información de contacto
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'website'
  ) THEN
    ALTER TABLE companies ADD COLUMN website text;
  END IF;

  -- Información de ubicación
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'address'
  ) THEN
    ALTER TABLE companies ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN country_id uuid REFERENCES countries(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'province_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN province_id uuid REFERENCES provinces(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'city_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN city_id uuid REFERENCES cities(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN postal_code text;
  END IF;

  -- Información fiscal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'legal_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN legal_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'tax_id_type'
  ) THEN
    ALTER TABLE companies ADD COLUMN tax_id_type text CHECK (tax_id_type IN ('DNI', 'CUIT', 'CUIL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'tax_id_number'
  ) THEN
    ALTER TABLE companies ADD COLUMN tax_id_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'tax_condition'
  ) THEN
    ALTER TABLE companies ADD COLUMN tax_condition text;
  END IF;

  -- Configuración regional
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN timezone text DEFAULT 'America/Argentina/Buenos_Aires';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'currency'
  ) THEN
    ALTER TABLE companies ADD COLUMN currency text DEFAULT 'ARS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'language'
  ) THEN
    ALTER TABLE companies ADD COLUMN language text DEFAULT 'es';
  END IF;

  -- Información adicional
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'description'
  ) THEN
    ALTER TABLE companies ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'industry'
  ) THEN
    ALTER TABLE companies ADD COLUMN industry text;
  END IF;
END $$;

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_companies_country_id ON companies(country_id);
CREATE INDEX IF NOT EXISTS idx_companies_province_id ON companies(province_id);
CREATE INDEX IF NOT EXISTS idx_companies_city_id ON companies(city_id);
CREATE INDEX IF NOT EXISTS idx_companies_tax_id_number ON companies(tax_id_number);

-- Comentarios en las columnas para documentación
COMMENT ON COLUMN companies.contact_phone IS 'Teléfono de contacto de la empresa';
COMMENT ON COLUMN companies.contact_email IS 'Email de contacto de la empresa';
COMMENT ON COLUMN companies.website IS 'Sitio web de la empresa';
COMMENT ON COLUMN companies.address IS 'Dirección completa de la empresa';
COMMENT ON COLUMN companies.legal_name IS 'Razón social de la empresa';
COMMENT ON COLUMN companies.tax_id_type IS 'Tipo de identificación fiscal (DNI, CUIT, CUIL)';
COMMENT ON COLUMN companies.tax_id_number IS 'Número de identificación fiscal';
COMMENT ON COLUMN companies.tax_condition IS 'Condición ante IVA';
COMMENT ON COLUMN companies.timezone IS 'Zona horaria preferida de la empresa';
COMMENT ON COLUMN companies.currency IS 'Moneda preferida de la empresa';
COMMENT ON COLUMN companies.language IS 'Idioma preferido de la empresa';
COMMENT ON COLUMN companies.description IS 'Descripción de la empresa';
COMMENT ON COLUMN companies.industry IS 'Sector o industria de la empresa';
