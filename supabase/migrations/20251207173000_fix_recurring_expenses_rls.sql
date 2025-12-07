/*
  # Fix Recurring Expenses RLS
  
  1. Changes
     - Update RLS policy for `recurring_expenses` to include 'super_admin' and 'owner' roles.
     - The previous policy only allowed 'admin', 'manager', 'contador', blocking super admins.
*/

DROP POLICY IF EXISTS "Admin/Manager/Contador can manage recurring expenses" ON recurring_expenses;

CREATE POLICY "Authorized users can manage recurring expenses"
  ON recurring_expenses FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) 
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'owner', 'admin', 'manager', 'contador'))
    )
  );
