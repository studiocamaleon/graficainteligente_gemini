/*
  # Sistema de Auto-Registro de Clientes

  1. Modificaciones a tabla clients
    - Agregar columna `status_aprobacion` (pending, approved, rejected) con default 'approved'
    - Agregar columna `fecha_registro` (timestamptz) para tracking de cuándo se registró
    - Agregar columna `notas_rechazo` (text) para documentar rechazos
    - Agregar columna `aprobado_por` (uuid) referencia a profiles, quién aprobó/rechazó
    - Agregar columna `fecha_aprobacion` (timestamptz) cuándo se aprobó/rechazó
    - Agregar columna `ip_registro` (text) para seguridad y auditoría

  2. Nueva tabla: cliente_registro_intentos
    - Tabla para rate limiting y prevención de spam
    - Tracking de intentos por IP y company
    - Sistema de bloqueo temporal por exceso de intentos

  3. Funciones de negocio
    - `fn_aprobar_cliente` - Aprobar un cliente pendiente
    - `fn_rechazar_cliente` - Rechazar un cliente pendiente con notas
    - `fn_contar_clientes_pendientes` - Obtener cantidad de clientes pendientes por empresa

  4. Índices
    - Optimización de búsquedas por status_aprobacion
    - Optimización de búsquedas por fecha_registro

  5. Seguridad
    - RLS policies existentes se mantienen
    - Grants necesarios para las funciones nuevas
*/

-- =====================================================
-- 1. AGREGAR COLUMNAS A TABLA CLIENTS
-- =====================================================

-- Agregar columna status_aprobacion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'status_aprobacion'
  ) THEN
    ALTER TABLE clients ADD COLUMN status_aprobacion text NOT NULL DEFAULT 'approved'
      CHECK (status_aprobacion IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Agregar columna fecha_registro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'fecha_registro'
  ) THEN
    ALTER TABLE clients ADD COLUMN fecha_registro timestamptz DEFAULT now();
  END IF;
END $$;

-- Agregar columna notas_rechazo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'notas_rechazo'
  ) THEN
    ALTER TABLE clients ADD COLUMN notas_rechazo text;
  END IF;
END $$;

-- Agregar columna aprobado_por
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'aprobado_por'
  ) THEN
    ALTER TABLE clients ADD COLUMN aprobado_por uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Agregar columna fecha_aprobacion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'fecha_aprobacion'
  ) THEN
    ALTER TABLE clients ADD COLUMN fecha_aprobacion timestamptz;
  END IF;
END $$;

-- Agregar columna ip_registro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients' 
      AND column_name = 'ip_registro'
  ) THEN
    ALTER TABLE clients ADD COLUMN ip_registro text;
  END IF;
END $$;

-- Actualizar clientes existentes como 'approved' y con fecha de registro
UPDATE clients 
SET 
  status_aprobacion = 'approved',
  fecha_registro = COALESCE(created_at, now())
WHERE status_aprobacion IS NULL OR fecha_registro IS NULL;

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_clients_status_aprobacion ON clients(status_aprobacion);
CREATE INDEX IF NOT EXISTS idx_clients_fecha_registro ON clients(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_clients_company_status ON clients(company_id, status_aprobacion);

-- =====================================================
-- 2. TABLA DE RATE LIMITING
-- =====================================================

CREATE TABLE IF NOT EXISTS cliente_registro_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  intentos integer NOT NULL DEFAULT 1,
  ultima_fecha timestamptz NOT NULL DEFAULT now(),
  bloqueado_hasta timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índice para búsquedas rápidas por IP y company
CREATE INDEX IF NOT EXISTS idx_registro_intentos_ip_company 
  ON cliente_registro_intentos(ip_address, company_id);

-- Índice para limpiezas periódicas de datos antiguos
CREATE INDEX IF NOT EXISTS idx_registro_intentos_created_at
  ON cliente_registro_intentos(created_at);

-- RLS: Solo service_role puede acceder (usado por edge function)
ALTER TABLE cliente_registro_intentos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. FUNCIÓN PARA APROBAR CLIENTE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aprobar_cliente(
  p_cliente_id uuid,
  p_aprobado_por uuid
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente clients;
  v_result json;
BEGIN
  -- Verificar que el cliente existe y está pendiente
  SELECT * INTO v_cliente 
  FROM clients 
  WHERE id = p_cliente_id AND status_aprobacion = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente no encontrado o ya fue procesado'
    );
  END IF;

  -- Aprobar cliente
  UPDATE clients SET
    status_aprobacion = 'approved',
    is_active = true,
    aprobado_por = p_aprobado_por,
    fecha_aprobacion = now(),
    updated_by = p_aprobado_por,
    updated_at = now()
  WHERE id = p_cliente_id;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'nombre', v_cliente.nombre_fantasia,
    'whatsapp', v_cliente.whatsapp,
    'email', v_cliente.email
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN PARA RECHAZAR CLIENTE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_rechazar_cliente(
  p_cliente_id uuid,
  p_rechazado_por uuid,
  p_notas text DEFAULT NULL
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente clients;
  v_result json;
BEGIN
  -- Verificar que el cliente existe y está pendiente
  SELECT * INTO v_cliente 
  FROM clients 
  WHERE id = p_cliente_id AND status_aprobacion = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente no encontrado o ya fue procesado'
    );
  END IF;

  -- Rechazar cliente
  UPDATE clients SET
    status_aprobacion = 'rejected',
    is_active = false,
    aprobado_por = p_rechazado_por,
    fecha_aprobacion = now(),
    notas_rechazo = p_notas,
    updated_by = p_rechazado_por,
    updated_at = now()
  WHERE id = p_cliente_id;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'nombre', v_cliente.nombre_fantasia
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 5. FUNCIÓN PARA CONTAR CLIENTES PENDIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION fn_contar_clientes_pendientes(
  p_company_id uuid
) RETURNS integer 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_count
  FROM clients
  WHERE company_id = p_company_id
    AND status_aprobacion = 'pending';
  
  RETURN v_count;
END;
$$;

-- =====================================================
-- 6. FUNCIÓN PARA OBTENER CLIENTES PENDIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_clientes_pendientes(
  p_company_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid,
  nombre_fantasia text,
  tipo_documento text,
  numero_documento text,
  whatsapp text,
  email text,
  fecha_registro timestamptz,
  ip_registro text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nombre_fantasia,
    c.tipo_documento,
    c.numero_documento,
    c.whatsapp,
    c.email,
    c.fecha_registro,
    c.ip_registro
  FROM clients c
  WHERE c.company_id = p_company_id
    AND c.status_aprobacion = 'pending'
  ORDER BY c.fecha_registro DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- 7. GRANTS PARA LAS FUNCIONES
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_aprobar_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_rechazar_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_contar_clientes_pendientes TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_clientes_pendientes TO authenticated;

-- =====================================================
-- 8. COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN clients.status_aprobacion IS 'Estado de aprobación del cliente: pending (esperando aprobación), approved (aprobado y activo), rejected (rechazado)';
COMMENT ON COLUMN clients.fecha_registro IS 'Fecha y hora en que el cliente se registró en el sistema';
COMMENT ON COLUMN clients.notas_rechazo IS 'Notas del operador explicando por qué se rechazó el cliente';
COMMENT ON COLUMN clients.aprobado_por IS 'ID del usuario que aprobó o rechazó el cliente';
COMMENT ON COLUMN clients.fecha_aprobacion IS 'Fecha y hora en que el cliente fue aprobado o rechazado';
COMMENT ON COLUMN clients.ip_registro IS 'Dirección IP desde donde se realizó el registro (para auditoría y seguridad)';

COMMENT ON TABLE cliente_registro_intentos IS 'Tabla para rate limiting y prevención de registros maliciosos. Tracking de intentos por IP.';

COMMENT ON FUNCTION fn_aprobar_cliente IS 'Aprueba un cliente pendiente, lo activa y registra quién lo aprobó';
COMMENT ON FUNCTION fn_rechazar_cliente IS 'Rechaza un cliente pendiente con notas explicativas';
COMMENT ON FUNCTION fn_contar_clientes_pendientes IS 'Retorna la cantidad de clientes pendientes de aprobación para una empresa';
COMMENT ON FUNCTION fn_obtener_clientes_pendientes IS 'Obtiene la lista de clientes pendientes de aprobación con paginación';
