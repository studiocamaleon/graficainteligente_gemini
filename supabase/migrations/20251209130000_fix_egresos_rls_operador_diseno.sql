/*
  # Fix políticas RLS de egresos para incluir operador_diseno

  ## Descripción
  Permite que el rol 'operador_diseno' pueda registrar egresos (INSERT).
  Esto es necesario para el registro de salidas de caja desde el módulo de Tesorería/Cajas.
*/

-- Actualizar política INSERT para incluir operador_diseno
DROP POLICY IF EXISTS "Usuarios autorizados pueden crear egresos" ON egresos;

CREATE POLICY "Usuarios autorizados pueden crear egresos"
  ON egresos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager', 'contador', 'operador_diseno')
    )
  );
