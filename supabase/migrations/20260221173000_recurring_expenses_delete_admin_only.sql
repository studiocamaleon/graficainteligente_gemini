/*
  # Recurring Expenses - Delete permission hardening

  Objetivo:
  - Mantener gestión (insert/update) para roles operativos actuales.
  - Permitir DELETE solamente a admin y super_admin.
*/

ALTER TABLE IF EXISTS public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas legacy que podían otorgar DELETE por FOR ALL.
DROP POLICY IF EXISTS "Admin/Manager/Contador can manage recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Authorized users can manage recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can manage their company recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can insert recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can update recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can delete recurring expenses" ON public.recurring_expenses;

-- INSERT: roles operativos habilitados.
CREATE POLICY "Users can insert recurring expenses"
  ON public.recurring_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'manager', 'contador', 'owner')
    )
  );

-- UPDATE: roles operativos habilitados.
CREATE POLICY "Users can update recurring expenses"
  ON public.recurring_expenses
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'manager', 'contador', 'owner')
    )
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'manager', 'contador', 'owner')
    )
  );

-- DELETE: solo admin/super_admin.
CREATE POLICY "Users can delete recurring expenses"
  ON public.recurring_expenses
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );
