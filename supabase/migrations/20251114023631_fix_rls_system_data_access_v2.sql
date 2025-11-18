/*
  # Corregir Políticas RLS para Permitir Acceso a Datos del Sistema

  ## Descripción
  Esta migración actualiza las políticas RLS de materiales, tecnologías, servicios y acabados
  para permitir que los usuarios autenticados puedan ver datos del sistema (company_id IS NULL)
  además de los datos de su propia compañía.

  ## Cambios
  1. Actualizar política SELECT de `materiales` para incluir datos del sistema
  2. Actualizar política SELECT de `tecnologias` para incluir datos del sistema
  3. Actualizar política SELECT de `servicios` para incluir datos del sistema
  4. Actualizar política SELECT de `acabados` para incluir datos del sistema

  ## Notas
  - Los datos del sistema (company_id IS NULL) son de solo lectura para todos los usuarios
  - Los usuarios solo pueden modificar/eliminar datos de su propia compañía
*/

-- Actualizar política SELECT de materiales
DROP POLICY IF EXISTS "Users can view own company materiales" ON materiales;

CREATE POLICY "Users can view system and own company materiales"
  ON materiales FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Actualizar política SELECT de tecnologias  
DROP POLICY IF EXISTS "Users can view own company tecnologias" ON tecnologias;

CREATE POLICY "Users can view system and own company tecnologias"
  ON tecnologias FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Actualizar política SELECT de servicios
DROP POLICY IF EXISTS "Users can view own company servicios" ON servicios;

CREATE POLICY "Users can view system and own company servicios"
  ON servicios FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Actualizar política SELECT de acabados
DROP POLICY IF EXISTS "Users can view own company acabados" ON acabados;

CREATE POLICY "Users can view system and own company acabados"
  ON acabados FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
