/*
  # Row Level Security Policies para Módulo de Presupuestos

  ## Políticas Creadas

  ### presupuestos
  - SELECT: Usuarios de la company pueden ver presupuestos de su company
  - INSERT: Usuarios autenticados pueden crear presupuestos
  - UPDATE: Usuarios de la company pueden actualizar
  - DELETE: Solo super_admin y admin pueden eliminar

  ### presupuestos_items
  - Heredan permisos del presupuesto padre

  ### presupuestos_condiciones_comerciales
  - SELECT: Todos los usuarios de la company pueden leer
  - INSERT/UPDATE/DELETE: Solo admin y super_admin

  ### presupuestos_archivos
  - Similar a ordenes_trabajo_archivos

  ### presupuestos_historial
  - SELECT: Solo lectura para usuarios de la company
  - INSERT/UPDATE/DELETE: Manejado por triggers, no por usuarios directos

  ## Funciones Helper
  - Reutiliza funciones existentes de autenticación y company_id
*/

-- ============================================================================
-- POLÍTICAS RLS: presupuestos
-- ============================================================================

-- SELECT: Ver presupuestos de su company
DROP POLICY IF EXISTS "Users can view presupuestos from their company" ON presupuestos;
CREATE POLICY "Users can view presupuestos from their company"
  ON presupuestos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: Crear presupuestos en su company
DROP POLICY IF EXISTS "Users can create presupuestos in their company" ON presupuestos;
CREATE POLICY "Users can create presupuestos in their company"
  ON presupuestos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: Actualizar presupuestos de su company
DROP POLICY IF EXISTS "Users can update presupuestos from their company" ON presupuestos;
CREATE POLICY "Users can update presupuestos from their company"
  ON presupuestos
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Solo admin puede eliminar
DROP POLICY IF EXISTS "Only admins can delete presupuestos" ON presupuestos;
CREATE POLICY "Only admins can delete presupuestos"
  ON presupuestos
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: presupuestos_items
-- ============================================================================

-- SELECT: Ver items de presupuestos de su company
DROP POLICY IF EXISTS "Users can view items from their company presupuestos" ON presupuestos_items;
CREATE POLICY "Users can view items from their company presupuestos"
  ON presupuestos_items
  FOR SELECT
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- INSERT: Crear items en presupuestos de su company
DROP POLICY IF EXISTS "Users can create items in their company presupuestos" ON presupuestos_items;
CREATE POLICY "Users can create items in their company presupuestos"
  ON presupuestos_items
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

-- UPDATE: Actualizar items de presupuestos de su company
DROP POLICY IF EXISTS "Users can update items from their company presupuestos" ON presupuestos_items;
CREATE POLICY "Users can update items from their company presupuestos"
  ON presupuestos_items
  FOR UPDATE
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- DELETE: Eliminar items de presupuestos de su company
DROP POLICY IF EXISTS "Users can delete items from their company presupuestos" ON presupuestos_items;
CREATE POLICY "Users can delete items from their company presupuestos"
  ON presupuestos_items
  FOR DELETE
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: presupuestos_condiciones_comerciales
-- ============================================================================

-- SELECT: Todos leen condiciones de su company
DROP POLICY IF EXISTS "Users can view condiciones from their company" ON presupuestos_condiciones_comerciales;
CREATE POLICY "Users can view condiciones from their company"
  ON presupuestos_condiciones_comerciales
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: Solo admin crea condiciones
DROP POLICY IF EXISTS "Only admins can create condiciones" ON presupuestos_condiciones_comerciales;
CREATE POLICY "Only admins can create condiciones"
  ON presupuestos_condiciones_comerciales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- UPDATE: Solo admin actualiza condiciones
DROP POLICY IF EXISTS "Only admins can update condiciones" ON presupuestos_condiciones_comerciales;
CREATE POLICY "Only admins can update condiciones"
  ON presupuestos_condiciones_comerciales
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Solo admin elimina condiciones
DROP POLICY IF EXISTS "Only admins can delete condiciones" ON presupuestos_condiciones_comerciales;
CREATE POLICY "Only admins can delete condiciones"
  ON presupuestos_condiciones_comerciales
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: presupuestos_archivos
-- ============================================================================

-- SELECT: Ver archivos de presupuestos de su company
DROP POLICY IF EXISTS "Users can view archivos from their company" ON presupuestos_archivos;
CREATE POLICY "Users can view archivos from their company"
  ON presupuestos_archivos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: Subir archivos a presupuestos de su company
DROP POLICY IF EXISTS "Users can upload archivos to their company" ON presupuestos_archivos;
CREATE POLICY "Users can upload archivos to their company"
  ON presupuestos_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: Actualizar archivos de su company
DROP POLICY IF EXISTS "Users can update archivos from their company" ON presupuestos_archivos;
CREATE POLICY "Users can update archivos from their company"
  ON presupuestos_archivos
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Eliminar archivos de su company
DROP POLICY IF EXISTS "Users can delete archivos from their company" ON presupuestos_archivos;
CREATE POLICY "Users can delete archivos from their company"
  ON presupuestos_archivos
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: presupuestos_historial
-- ============================================================================

-- SELECT: Solo lectura del historial de presupuestos de su company
DROP POLICY IF EXISTS "Users can view historial from their company" ON presupuestos_historial;
CREATE POLICY "Users can view historial from their company"
  ON presupuestos_historial
  FOR SELECT
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- INSERT/UPDATE/DELETE: Solo a través de triggers
-- No se permiten modificaciones directas por usuarios
