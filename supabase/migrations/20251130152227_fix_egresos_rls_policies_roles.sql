/*
  # Fix políticas RLS de egresos para incluir más roles

  ## Descripción
  Actualiza las políticas RLS de la tabla egresos para permitir que usuarios
  con roles super_admin, operador_diseno y otros roles relevantes puedan
  crear y gestionar egresos.

  ## Cambios
  - Actualiza política INSERT para incluir super_admin
  - Actualiza política UPDATE para incluir super_admin
  - Mantiene restricción para DELETE solo admin

  ## Seguridad
  - Mantiene validación de company_id
  - Solo roles autorizados pueden crear/editar egresos
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admin y manager pueden crear egresos" ON egresos;
DROP POLICY IF EXISTS "Admin puede actualizar egresos" ON egresos;

-- Crear nueva política INSERT con más roles
CREATE POLICY "Usuarios autorizados pueden crear egresos"
  ON egresos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager', 'contador')
    )
  );

-- Crear nueva política UPDATE con más roles
CREATE POLICY "Usuarios autorizados pueden actualizar egresos"
  ON egresos FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );
