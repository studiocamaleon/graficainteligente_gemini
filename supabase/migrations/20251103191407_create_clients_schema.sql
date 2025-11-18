/*
  # Sistema de Gestión de Clientes Multi-Tenant

  ## Descripción
  Esta migración crea la estructura completa para gestionar clientes con información fiscal,
  datos de contacto, ubicación y cuenta corriente. Respeta el aislamiento multi-tenant.

  ## Nueva Tabla

  ### `clients` (Clientes)
  - `id` (uuid, PK) - Identificador único del cliente
  - `company_id` (uuid, FK) - Referencia a companies (multi-tenant)
  - **Información Fiscal**
    - `nombre_fantasia` (text) - Nombre comercial del cliente
    - `razon_social` (text) - Razón social oficial
    - `tipo_documento` (text) - Tipo: DNI, CUIT, CUIL
    - `numero_documento` (text) - Número de documento
  - **Contacto**
    - `whatsapp` (text) - Número en formato internacional (ej: 5492966671081)
    - `email` (text) - Email del cliente
  - **Ubicación**
    - `domicilio` (text) - Dirección completa
    - `country_id` (uuid, FK) - Referencia a countries
    - `province_id` (uuid, FK) - Referencia a provinces
    - `city_id` (uuid, FK) - Referencia a cities
    - `codigo_postal` (text) - Código postal
  - **Cuenta Corriente**
    - `tiene_cuenta_corriente` (boolean) - Si tiene cuenta corriente habilitada
    - `acuerdo_pago` (text) - Semanal, Quincenal, Mensual (nullable)
  - **Estado y Auditoría**
    - `is_active` (boolean) - Cliente activo o inactivo
    - `created_by` (uuid, FK) - Usuario que creó el cliente
    - `updated_by` (uuid, FK) - Último usuario que modificó
    - `created_at` (timestamptz) - Fecha de creación
    - `updated_at` (timestamptz) - Última actualización

  ## Seguridad (Row Level Security)
  - RLS habilitado para aislamiento multi-tenant estricto
  - Los usuarios solo pueden ver clientes de su empresa (company_id)
  - Solo admin, super_admin y manager pueden crear/editar clientes
  - Los operators y viewers solo pueden leer

  ## Validaciones
  - nombre_fantasia y razon_social son obligatorios
  - tipo_documento debe ser DNI, CUIT o CUIL
  - Formato de WhatsApp validado en aplicación
  - No se permiten duplicados de documento por empresa
  - acuerdo_pago solo puede ser Semanal, Quincenal o Mensual
*/

-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Información Fiscal
  nombre_fantasia text NOT NULL,
  razon_social text NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('DNI', 'CUIT', 'CUIL')),
  numero_documento text NOT NULL,
  
  -- Contacto
  whatsapp text,
  email text,
  
  -- Ubicación
  domicilio text,
  country_id uuid REFERENCES countries(id),
  province_id uuid REFERENCES provinces(id),
  city_id uuid REFERENCES cities(id),
  codigo_postal text,
  
  -- Cuenta Corriente
  tiene_cuenta_corriente boolean NOT NULL DEFAULT false,
  acuerdo_pago text CHECK (acuerdo_pago IS NULL OR acuerdo_pago IN ('Semanal', 'Quincenal', 'Mensual')),
  
  -- Estado y Auditoría
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: No duplicar número de documento por empresa
  UNIQUE(company_id, numero_documento)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_nombre_fantasia ON clients(nombre_fantasia);
CREATE INDEX IF NOT EXISTS idx_clients_razon_social ON clients(razon_social);
CREATE INDEX IF NOT EXISTS idx_clients_numero_documento ON clients(numero_documento);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Índice compuesto para búsquedas multi-campo
CREATE INDEX IF NOT EXISTS idx_clients_search ON clients(company_id, is_active, nombre_fantasia, razon_social);

-- Habilitar Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver clientes de su empresa
CREATE POLICY "Users can view clients from their company"
  ON clients FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
  );

-- Política: Admin, super_admin y manager pueden crear clientes
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
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Política: Admin, super_admin y manager pueden actualizar clientes de su empresa
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
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
  );

-- Política: Solo super_admin puede eliminar clientes (soft delete recomendado)
CREATE POLICY "Only super_admin can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Función para setear created_by y updated_by automáticamente
CREATE OR REPLACE FUNCTION set_client_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- En INSERT, establecer created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  END IF;
  
  -- En UPDATE, establecer updated_by
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    -- Preservar created_by original
    NEW.created_by := OLD.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auditoría
DROP TRIGGER IF EXISTS set_client_audit_fields_trigger ON clients;
CREATE TRIGGER set_client_audit_fields_trigger
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_client_audit_fields();