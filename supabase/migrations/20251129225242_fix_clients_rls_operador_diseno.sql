/*
  # Fix: Permitir a operador_diseno crear y editar clientes
  
  ## Problema
  El operador de diseño no puede crear clientes porque las políticas RLS
  solo permiten super_admin, admin y manager.
  
  Error: "new row violates row-level security policy for table clients"
  
  ## Solución
  Actualizar políticas INSERT y UPDATE en tabla clients para incluir
  el rol operador_diseno.
  
  ## Justificación
  El operador de diseño gestiona el ciclo completo de órdenes de trabajo,
  lo que incluye crear clientes nuevos cuando llegan solicitudes de diseño.
  
  ## Seguridad
  - Mantiene aislamiento por company_id
  - Solo puede crear/editar clientes de su propia empresa
  - No afecta políticas de DELETE (solo super_admin)
  - Auditoría completa con created_by/updated_by
  
  ## Flujo del Error (ANTES):
  1. Usuario operador_diseno intenta crear cliente
  2. Frontend llama useClient.createClient()
  3. INSERT en tabla clients
  4. RLS verifica: role IN ('super_admin', 'admin', 'manager')?
  5. operador_diseno NO está → ❌ RECHAZADO
  
  ## Flujo Corregido (DESPUÉS):
  1. Usuario operador_diseno intenta crear cliente
  2. Frontend llama useClient.createClient()
  3. INSERT en tabla clients
  4. RLS verifica: role IN ('super_admin', 'admin', 'manager', 'operador_diseno')?
  5. operador_diseno SÍ está → ✅ ACEPTADO
  
  ## Fecha: 2025-11-29
*/

-- =====================================================
-- STEP 1: Drop políticas restrictivas existentes
-- =====================================================

DROP POLICY IF EXISTS "Admins and managers can create clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can update clients" ON clients;

-- Si existe la política consolidada permisiva, también la eliminamos
DROP POLICY IF EXISTS "Users can manage company clients" ON clients;

-- =====================================================
-- STEP 2: Recrear política INSERT con operador_diseno
-- =====================================================

CREATE POLICY "Admins and managers can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
    )
  );

-- =====================================================
-- STEP 3: Recrear política UPDATE con operador_diseno
-- =====================================================

CREATE POLICY "Admins and managers can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager', 'operador_diseno')
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
  );

-- =====================================================
-- STEP 4: Comentarios para documentación
-- =====================================================

COMMENT ON POLICY "Admins and managers can create clients" ON clients IS
'Permite a super_admin, admin, manager y operador_diseno crear clientes.
Restricción: Solo en su propia company_id.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir gestión completa de órdenes de trabajo.';

COMMENT ON POLICY "Admins and managers can update clients" ON clients IS
'Permite a super_admin, admin, manager y operador_diseno editar clientes.
Restricción: Solo clientes de su propia company_id.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir gestión completa de órdenes de trabajo.';