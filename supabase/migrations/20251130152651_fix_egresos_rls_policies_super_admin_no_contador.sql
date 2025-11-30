/*
  # Fix políticas RLS de egresos - Agregar super_admin a DELETE y remover contador

  ## Descripción
  Actualiza las políticas RLS de egresos para:
  - Permitir que super_admin pueda eliminar egresos (además de admin)
  - Remover el rol 'contador' que no existe en el sistema
  - Usar solo manager en lugar de contador

  ## Cambios
  - DROP y recrear política INSERT sin 'contador'
  - DROP y recrear política DELETE para incluir 'super_admin'
  - Mantener validación de company_id

  ## Seguridad
  - Solo super_admin y admin pueden DELETE
  - Solo super_admin, admin y manager pueden INSERT
  - Todos los cambios validan company_id
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Usuarios autorizados pueden crear egresos" ON egresos;
DROP POLICY IF EXISTS "Solo admin puede eliminar egresos" ON egresos;

-- Crear nueva política INSERT sin contador
CREATE POLICY "Usuarios autorizados pueden crear egresos"
  ON egresos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Crear nueva política DELETE con super_admin
CREATE POLICY "Admin y super_admin pueden eliminar egresos"
  ON egresos FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );
