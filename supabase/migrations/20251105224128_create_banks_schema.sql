/*
  # Create Banks Schema

  1. New Tables
    - `banks`
      - `id` (uuid, primary key, auto-generated)
      - `name` (text, required) - Nombre del banco
      - `code` (text, nullable) - Código bancario oficial
      - `is_active` (boolean, default true) - Estado del banco
      - `created_at` (timestamptz, auto) - Fecha de creación
      - `updated_at` (timestamptz, auto) - Fecha de última actualización

  2. Security
    - Enable RLS on `banks` table
    - Add policy for authenticated users to read all banks (needed for forms)
    - Add policy for super_admin to insert banks
    - Add policy for super_admin to update banks
    - Add policy for super_admin to delete banks

  3. Indexes
    - Index on `name` for fast searches
    - Index on `code` for lookups by bank code
    - Index on `is_active` for filtering active banks

  4. Triggers
    - Auto-update `updated_at` timestamp on row changes

  5. Initial Data
    - Pre-populate with major Argentine banks
*/

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_banks_name ON banks(name);
CREATE INDEX IF NOT EXISTS idx_banks_code ON banks(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_banks_is_active ON banks(is_active);

-- Enable Row Level Security
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all banks (needed for provider forms)
CREATE POLICY "Authenticated users can view all banks"
  ON banks FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only super_admin can insert banks
CREATE POLICY "Super admin can insert banks"
  ON banks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Only super_admin can update banks
CREATE POLICY "Super admin can update banks"
  ON banks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Only super_admin can delete banks
CREATE POLICY "Super admin can delete banks"
  ON banks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_banks_updated_at
  BEFORE UPDATE ON banks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data: Major Argentine Banks
INSERT INTO banks (name, code, is_active) VALUES
  ('Banco de la Nación Argentina', '011', true),
  ('Banco de la Provincia de Buenos Aires', '014', true),
  ('Banco Ciudad de Buenos Aires', '029', true),
  ('BBVA Argentina', '017', true),
  ('Banco Santander Río', '072', true),
  ('Banco Galicia', '007', true),
  ('Banco Macro', '285', true),
  ('Industrial and Commercial Bank of China (ICBC)', '015', true),
  ('HSBC Bank Argentina', '150', true),
  ('Banco Supervielle', '027', true),
  ('Banco Patagonia', '034', true),
  ('Banco Hipotecario', '044', true),
  ('Banco de la Pampa', '093', true),
  ('Banco del Chubut', '083', true),
  ('Banco de Santa Cruz', '086', true),
  ('Banco de Tierra del Fuego', '268', true),
  ('Banco de San Juan', '045', true),
  ('Banco de Santiago del Estero', '321', true),
  ('Banco de Corrientes', '094', true),
  ('Banco Comafi', '299', true),
  ('Banco Credicoop', '191', true),
  ('Banco Itaú Argentina', '259', true),
  ('Banco Columbia', '389', true),
  ('Mercado Pago', 'MP', true),
  ('Brubank', 'BRUBANK', true),
  ('Ualá', 'UALA', true),
  ('Naranja X', 'NARANJA', true),
  ('Banco de Valores', '198', true),
  ('Banco Roela', '247', true),
  ('Wilobank', 'WILO', true),
  ('Banco CMF', '319', true),
  ('Banco Voii', 'VOII', true),
  ('Banco Bind', 'BIND', true),
  ('Otro', 'OTHER', true)
ON CONFLICT DO NOTHING;
