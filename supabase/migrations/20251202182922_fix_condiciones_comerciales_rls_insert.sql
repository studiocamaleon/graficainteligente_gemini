/*
  # Fix RLS Policies - Condiciones Comerciales
  
  1. Cambios
    - Permitir que todos los usuarios autenticados puedan crear condiciones
    - Mantener restricción de company_id
    - Solo admin puede actualizar/eliminar
*/

-- INSERT: Todos los usuarios autenticados pueden crear condiciones de su company
DROP POLICY IF EXISTS "Only admins can create condiciones" ON presupuestos_condiciones_comerciales;
CREATE POLICY "Users can create condiciones from their company"
  ON presupuestos_condiciones_comerciales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
