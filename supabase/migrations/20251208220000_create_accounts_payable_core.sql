/*
  # Accounts Payable Core Schema
  
  1. New Table: `compras_proveedores` (Manual Bills / One-off Debts)
     - Stores invoices or debts that are not recurring (e.g. "Factura Insumos").
     - Tracks: Provider, Amounts, Due Date, Invoice Number, Attachment.
  
  2. New Table: `recurring_executions` (Control de Ejecución de Recurrentes)
     - Tracks specific periods of recurring expenses that have been "Closed" manually or fully paid.
     - Allows "Partial Payment -> Close" workflow (Flexible logic).
  
  3. Updates to `egresos`
     - Add `compra_id` to link a payment to a specific manual bill.
*/

-- 1. Tabla de Compras / Facturas Pendientes (Manuales)
CREATE TABLE IF NOT EXISTS compras_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
  
  descripcion text NOT NULL, -- Ej: "Compra 50 resmas", "Flete Maquinaria"
  numero_factura text,       -- Opcional: "A-0001-12345678"
  
  monto_total numeric NOT NULL CHECK (monto_total > 0),
  fecha_emision date DEFAULT CURRENT_DATE,
  fecha_vencimiento date NOT NULL,
  
  archivo_url text, -- Foto de la factura
  
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  notas text,
  
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_compras_company ON compras_proveedores(company_id);
CREATE INDEX IF NOT EXISTS idx_compras_provider ON compras_proveedores(provider_id);
CREATE INDEX IF NOT EXISTS idx_compras_estado ON compras_proveedores(estado);


-- 2. Tabla de Cierres de Recurrentes (Para manejar la flexibilidad)
CREATE TABLE IF NOT EXISTS recurring_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  
  periodo date NOT NULL, -- Fecha representativa del período (ej: '2025-01-01' para Enero Monthly)
  
  estado text DEFAULT 'cerrado' CHECK (estado IN ('cerrado', 'omitido')),
  
  cerrado_manualmente boolean DEFAULT false, -- True si se cerró con diferencia de saldo (Switch "Cerrar")
  diferencia_saldo numeric DEFAULT 0, -- Monto que se "perdonó" o se pagó de más/menos
  
  observaciones text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(recurring_id, periodo)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_recurring_exec_lookup ON recurring_executions(recurring_id, periodo);


-- 3. Vincular Egresos a Compras
ALTER TABLE egresos
ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES compras_proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_egresos_compra ON egresos(compra_id);


-- 4. RLS Policies

-- Compras
ALTER TABLE compras_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view compras of their company"
  ON compras_proveedores FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin/Manager can manage compras"
  ON compras_proveedores FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) 
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'manager', 'contador')))
  );

-- Recurring Executions
ALTER TABLE recurring_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurring executions of their company"
  ON recurring_executions FOR SELECT TO authenticated
  USING (recurring_id IN (SELECT id FROM recurring_expenses WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Admin/Manager can manage recurring executions"
  ON recurring_executions FOR ALL TO authenticated
  USING (
    recurring_id IN (SELECT id FROM recurring_expenses WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'manager', 'contador')))
  );
