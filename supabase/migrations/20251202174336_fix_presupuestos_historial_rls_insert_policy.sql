/*
  # Fix presupuestos_historial RLS INSERT policy

  ## Problema
  La tabla presupuestos_historial solo tiene política SELECT, pero los triggers
  intentan insertar registros y fallan con error 42501 (RLS violation).

  ## Solución
  1. Agregar política INSERT para presupuestos_historial
  2. Permitir inserts automáticos desde triggers
  3. La política valida que el presupuesto pertenezca a la company del usuario

  ## Cambios
  - Nueva política INSERT en presupuestos_historial
*/

-- ============================================================================
-- POLÍTICA INSERT: presupuestos_historial
-- ============================================================================

-- Permitir INSERT cuando el presupuesto asociado pertenece a la company del usuario
DROP POLICY IF EXISTS "Users can insert historial for their company presupuestos" ON presupuestos_historial;
CREATE POLICY "Users can insert historial for their company presupuestos"
  ON presupuestos_historial
  FOR INSERT
  TO authenticated
  WITH CHECK (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
