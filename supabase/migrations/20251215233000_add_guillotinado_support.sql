
/*
  # Add Guillotinado Support
  
  1. New Table: `centro_copiado_rangos_guillotinado`
     - ranges for cutting prices based on sheet count
  
  2. Constraint Update
     - `centro_copiado_ordenes_items`: Add 'guillotinado' to tipo_item check
*/

-- 1. Create Table
CREATE TABLE IF NOT EXISTS centro_copiado_rangos_guillotinado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  hojas_desde integer NOT NULL CHECK (hojas_desde > 0),
  hojas_hasta integer CHECK (hojas_hasta IS NULL OR hojas_hasta >= hojas_desde),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE centro_copiado_rangos_guillotinado ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own company rangos guillotinado"
  ON centro_copiado_rangos_guillotinado FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company rangos guillotinado"
  ON centro_copiado_rangos_guillotinado FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company rangos guillotinado"
  ON centro_copiado_rangos_guillotinado FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company rangos guillotinado"
  ON centro_copiado_rangos_guillotinado FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Index
CREATE INDEX IF NOT EXISTS idx_centro_copiado_rangos_guillotinado_company
  ON centro_copiado_rangos_guillotinado(company_id) WHERE is_active = true;

-- 2. Update Check Constraint via unsafe operations mostly, but we can try to be safe
-- We need to drop the existing constraint and add the new one.
-- The name of the constraint is usually `centro_copiado_ordenes_items_tipo_item_check`
-- We'll try to drop it if exists.

DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'centro_copiado_ordenes_items_tipo_item_check'
  ) THEN
    ALTER TABLE centro_copiado_ordenes_items 
    DROP CONSTRAINT centro_copiado_ordenes_items_tipo_item_check;
  END IF;

  -- Add new constraint
  ALTER TABLE centro_copiado_ordenes_items
  ADD CONSTRAINT centro_copiado_ordenes_items_tipo_item_check 
  CHECK (tipo_item IN ('impresion', 'anillado', 'plastificado', 'guillotinado'));
END $$;
