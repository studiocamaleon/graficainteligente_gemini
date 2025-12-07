/*
  # Create Cheques Cartera (Issued Checks)
  
  1. New Types
     - `cheque_type`: 'fisico', 'echeq'
     - `cheque_status`: 'pendiente', 'pagado', 'anulado', 'vencido'

  2. New Table: `cheques_cartera`
     - Stores issued checks for financial projection.
     - Linked to providers (optional).
     - RLS policies for security.
*/

-- Create Enums
CREATE TYPE cheque_type AS ENUM ('fisico', 'echeq');
CREATE TYPE cheque_status AS ENUM ('pendiente', 'pagado', 'anulado', 'vencido');

-- Create Table
CREATE TABLE IF NOT EXISTS cheques_cartera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Cheque Details
  tipo cheque_type NOT NULL DEFAULT 'fisico',
  numero_cheque text NOT NULL,
  banco text NOT NULL,
  
  -- Dates
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_pago date NOT NULL, -- The crucial date for cashflow
  
  -- Financials
  monto numeric NOT NULL CHECK (monto > 0),
  
  -- Payee info
  destinatario text, -- Name of the person/entity
  proveedor_id uuid REFERENCES providers(id) ON DELETE SET NULL, -- Optional link to system provider
  
  -- Status & Meta
  estado cheque_status NOT NULL DEFAULT 'pendiente',
  descripcion text,
  comprobante_url text,
  
  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cheques_company ON cheques_cartera(company_id);
CREATE INDEX IF NOT EXISTS idx_cheques_fecha_pago ON cheques_cartera(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_cheques_estado ON cheques_cartera(estado);

-- RLS
ALTER TABLE cheques_cartera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can manage cheques"
  ON cheques_cartera FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) 
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'owner', 'admin', 'manager', 'contador'))
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_update_cheques_timestamp
  BEFORE UPDATE ON cheques_cartera
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_egresos_timestamp();
