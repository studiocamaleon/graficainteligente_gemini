/*
  # Revertir Cambios Incorrectos de RLS

  ## Descripción
  Revertir las políticas RLS a su estado correcto.
  Solo las categorías son datos del sistema (company_id NULL).
  El resto de tablas requieren company_id del usuario.

  ## Cambios
  Restaurar políticas originales que requieren company_id del usuario.
*/

-- Revertir materiales
DROP POLICY IF EXISTS "Users can view system and own company materiales" ON materiales;

CREATE POLICY "Users can view own company materiales"
  ON materiales FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Revertir tecnologias
DROP POLICY IF EXISTS "Users can view system and own company tecnologias" ON tecnologias;

CREATE POLICY "Users can view own company tecnologias"
  ON tecnologias FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Revertir servicios
DROP POLICY IF EXISTS "Users can view system and own company servicios" ON servicios;

CREATE POLICY "Users can view own company servicios"
  ON servicios FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Revertir acabados
DROP POLICY IF EXISTS "Users can view system and own company acabados" ON acabados;

CREATE POLICY "Users can view own company acabados"
  ON acabados FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
