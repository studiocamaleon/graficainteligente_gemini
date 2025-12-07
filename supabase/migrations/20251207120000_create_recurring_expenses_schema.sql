/*
  # Create Recurring Expenses and Link Providers to Expense Types

  1. Changes to Providers
     - Add `tipo_egreso_id` to `providers` to categorize them automatically (e.g. "Papelera" -> "Insumos").
  
  2. New Table: `recurring_expenses` (Gastos Recurrentes / Fijos)
     - For tracking rent, salaries, subscriptions, etc.
     - Projects cashflow based on frequency.
*/

-- 1. Add default expense type to providers
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS tipo_egreso_id uuid REFERENCES tipos_egreso(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_providers_tipo_egreso ON providers(tipo_egreso_id);

-- 2. Create Recurring Expenses Table
CREATE TYPE recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- What is it?
  description text NOT NULL,
  
  -- How much?
  amount numeric NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'ARS',
  
  -- Who & What category?
  provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
  tipo_egreso_id uuid NOT NULL REFERENCES tipos_egreso(id) ON DELETE RESTRICT,
  
  -- Frequency
  frequency recurring_frequency NOT NULL DEFAULT 'monthly',
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31), -- Preference for monthly
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),   -- Preference for weekly
  
  -- Timing
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date, -- NULL = Indefinite
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_company ON recurring_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurring expenses of their company"
  ON recurring_expenses FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin/Manager/Contador can manage recurring expenses"
  ON recurring_expenses FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) 
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'contador'))
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_update_recurring_expenses_timestamp
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_egresos_timestamp();
