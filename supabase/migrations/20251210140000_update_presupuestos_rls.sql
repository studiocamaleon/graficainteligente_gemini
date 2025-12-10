/*
  # Update Presupuestos RLS for Operador Diseno

  ## Descripción
  Esta migración actualiza las políticas de seguridad (RLS) de la tabla `presupuestos`
  para permitir que el rol `operador_diseno` pueda crear y editar presupuestos.

  ## Cambios
  1. Actualizar política de INSERT para incluir 'operador_diseno'.
  2. Actualizar política de UPDATE para incluir 'operador_diseno'.
  3. Asegurar que SELECT ya esté permitido (generalmente es para todos los autenticados de la compañía).
*/

-- 1. Actualizar INSERT policy
DROP POLICY IF EXISTS "Usuarios autorizados pueden crear presupuestos" ON presupuestos;
CREATE POLICY "Usuarios autorizados pueden crear presupuestos"
  ON presupuestos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
    )
  );

-- 2. Actualizar UPDATE policy
DROP POLICY IF EXISTS "Usuarios autorizados pueden actualizar presupuestos" ON presupuestos;
CREATE POLICY "Usuarios autorizados pueden actualizar presupuestos"
  ON presupuestos FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
    )
  );
