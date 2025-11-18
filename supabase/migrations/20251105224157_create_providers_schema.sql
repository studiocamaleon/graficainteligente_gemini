/*
  # Create Providers Schema

  1. New Tables
    - `providers`
      - **Identification**
        - `id` (uuid, primary key, auto-generated)
        - `company_id` (uuid, foreign key to companies, required) - Multi-tenant isolation

      - **Fiscal Information**
        - `nombre_fantasia` (text, required) - Trade name
        - `razon_social` (text, required) - Legal business name
        - `tipo_documento` (text, required) - Document type: DNI, CUIT, CUIL
        - `numero_documento` (text, required) - Document number

      - **Contact Information**
        - `whatsapp` (text, nullable) - WhatsApp number
        - `email` (text, nullable) - Email address

      - **Location Information**
        - `domicilio` (text, nullable) - Street address
        - `country_id` (uuid, foreign key to countries, nullable)
        - `province_id` (uuid, foreign key to provinces, nullable)
        - `city_id` (uuid, foreign key to cities, nullable)
        - `codigo_postal` (text, nullable) - Postal code

      - **Banking Information**
        - `banco` (text, nullable) - Bank name
        - `tipo_cuenta` (text, nullable) - Account type: Caja de Ahorro, Cuenta Corriente
        - `tipo_identificador_bancario` (text, nullable) - Bank ID type: CBU, CVU, Alias
        - `identificador_bancario` (text, nullable) - Bank account identifier

      - **Payment Methods**
        - `acepta_transferencias` (boolean, default false) - Accepts bank transfers
        - `acepta_cheques` (boolean, default false) - Accepts checks
        - `acepta_tarjetas_credito` (boolean, default false) - Accepts credit cards
        - `acepta_otros` (boolean, default false) - Accepts other payment methods

      - **Audit & Control**
        - `is_active` (boolean, default true) - Provider status
        - `created_by` (uuid, foreign key to profiles, nullable) - Creator user
        - `updated_by` (uuid, foreign key to profiles, nullable) - Last updater user
        - `created_at` (timestamptz, auto) - Creation timestamp
        - `updated_at` (timestamptz, auto) - Last update timestamp

  2. Security
    - Enable RLS on `providers` table
    - Users can only view providers from their own company
    - Only admin, super_admin, and manager roles can insert providers
    - Only admin, super_admin, and manager roles can update providers from their company
    - Only super_admin can delete providers from their company

  3. Indexes
    - Index on `company_id` (critical for multi-tenant queries)
    - Index on `nombre_fantasia` (for searches)
    - Index on `razon_social` (for searches)
    - Index on `numero_documento` (for lookups and validation)
    - Index on `email` (for searches)
    - Index on `is_active` (for filtering)
    - Index on `created_at` DESC (for sorting)
    - Composite index on (company_id, is_active, nombre_fantasia) for optimized searches
    - Unique constraint on (company_id, numero_documento) to prevent duplicates

  4. Constraints
    - CHECK constraint for `tipo_documento` values
    - CHECK constraint for `tipo_cuenta` values
    - CHECK constraint for `tipo_identificador_bancario` values

  5. Triggers
    - Auto-update `updated_at` timestamp on row changes
    - Auto-set `created_by` and `updated_by` fields
*/

-- Create providers table
CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Fiscal Information
  nombre_fantasia text NOT NULL,
  razon_social text NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('DNI', 'CUIT', 'CUIL')),
  numero_documento text NOT NULL,

  -- Contact Information
  whatsapp text,
  email text,

  -- Location Information
  domicilio text,
  country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  codigo_postal text,

  -- Banking Information
  banco text,
  tipo_cuenta text CHECK (tipo_cuenta IN ('Caja de Ahorro', 'Cuenta Corriente') OR tipo_cuenta IS NULL),
  tipo_identificador_bancario text CHECK (tipo_identificador_bancario IN ('CBU', 'CVU', 'Alias') OR tipo_identificador_bancario IS NULL),
  identificador_bancario text,

  -- Payment Methods
  acepta_transferencias boolean DEFAULT false NOT NULL,
  acepta_cheques boolean DEFAULT false NOT NULL,
  acepta_tarjetas_credito boolean DEFAULT false NOT NULL,
  acepta_otros boolean DEFAULT false NOT NULL,

  -- Audit & Control
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Unique constraint: one document per company
  CONSTRAINT unique_provider_document_per_company UNIQUE (company_id, numero_documento)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_providers_company_id ON providers(company_id);
CREATE INDEX IF NOT EXISTS idx_providers_nombre_fantasia ON providers(nombre_fantasia);
CREATE INDEX IF NOT EXISTS idx_providers_razon_social ON providers(razon_social);
CREATE INDEX IF NOT EXISTS idx_providers_numero_documento ON providers(numero_documento);
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(is_active);
CREATE INDEX IF NOT EXISTS idx_providers_created_at ON providers(created_at DESC);

-- Composite index for optimized searches within company
CREATE INDEX IF NOT EXISTS idx_providers_company_active_name
  ON providers(company_id, is_active, nombre_fantasia);

-- Enable Row Level Security
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view providers from their own company
CREATE POLICY "Users can view providers from their company"
  ON providers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = providers.company_id
    )
  );

-- Policy: Admin, super_admin, and manager can insert providers
CREATE POLICY "Admin, super_admin, and manager can insert providers"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = providers.company_id
      AND profiles.role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Policy: Admin, super_admin, and manager can update providers from their company
CREATE POLICY "Admin, super_admin, and manager can update providers"
  ON providers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = providers.company_id
      AND profiles.role IN ('admin', 'super_admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = providers.company_id
      AND profiles.role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Policy: Only super_admin can delete providers from their company
CREATE POLICY "Super admin can delete providers from their company"
  ON providers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = providers.company_id
      AND profiles.role = 'super_admin'
    )
  );

-- Create function to set audit fields automatically
CREATE OR REPLACE FUNCTION set_provider_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    NEW.created_by := OLD.created_by; -- Preserve original creator
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to auto-set audit fields
CREATE TRIGGER set_providers_audit_fields
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION set_provider_audit_fields();
