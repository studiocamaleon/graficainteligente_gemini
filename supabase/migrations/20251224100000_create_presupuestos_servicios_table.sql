/*
  # Create Presupuestos Servicios Table

  1. New Tables
    - `presupuestos_servicios` (mirrors `ordenes_trabajo_servicios` but for budgets)
      - `id` (uuid, primary key)
      - `presupuesto_id` (uuid, foreign key to presupuestos)
      - `servicio_id` (uuid, foreign key to servicios, nullable)
      - `descripcion` (text)
      - `cantidad` (numeric)
      - `precio_unitario` (numeric)
      - `subtotal` (numeric)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `created_by` (uuid)

  2. Security
    - Enable RLS on `presupuestos_servicios`
    - Add policies for authenticated users (same pattern as presupuestos)
*/

CREATE TABLE IF NOT EXISTS presupuestos_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  servicio_id uuid REFERENCES servicios(id) ON DELETE SET NULL,
  descripcion text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_subtotal_positivo CHECK (subtotal >= 0)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_presupuestos_servicios_presupuesto_id ON presupuestos_servicios(presupuesto_id);

-- RLS
ALTER TABLE presupuestos_servicios ENABLE ROW LEVEL SECURITY;

-- Policies (Matching presupuestos policies)
CREATE POLICY "Users can view own company presupuestos_servicios"
  ON presupuestos_servicios FOR SELECT
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company presupuestos_servicios"
  ON presupuestos_servicios FOR INSERT
  TO authenticated
  WITH CHECK (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company presupuestos_servicios"
  ON presupuestos_servicios FOR UPDATE
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company presupuestos_servicios"
  ON presupuestos_servicios FOR DELETE
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
