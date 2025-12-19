-- Relax categorias constraint to allow late system category additions
-- ID: 20251217001500

-- Removing the constraint that blocks adding new system categories after its initial deployment
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS check_only_system_categories;

-- Ensure consistency for any existing rows that might have been hit by the previous constraint
UPDATE categorias 
SET is_system_category = true 
WHERE company_id IS NULL AND is_system_category = false;
