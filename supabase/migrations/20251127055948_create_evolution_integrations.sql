/*
  # Integración con Evolution API para WhatsApp

  ## Descripción
  Esta migración crea la tabla para almacenar las configuraciones de Evolution API
  para conectar WhatsApp en el sistema multi-tenant.

  ## Tabla: evolution_integrations

  ### Campos
  - `id` (uuid, PK) - Identificador único
  - `company_id` (uuid, FK) - Referencia a companies (tenant)
  - `base_url` (text) - URL base de Evolution API
  - `instance_id` (text) - ID de instancia en Evolution API
  - `api_key` (text) - API Key para autenticación (nunca se expone al frontend)
  - `connection_state` (text) - Estado de conexión: disconnected, connecting, open, error
  - `last_connected_at` (timestamptz) - Última vez que se conectó exitosamente
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad (RLS)
  - Solo el company_id propietario puede ver/modificar sus registros
  - Usa el mismo patrón de seguridad que el resto del sistema
  - API Key nunca se expone en queries del frontend

  ## Constraints
  - Un solo registro por company (UNIQUE en company_id)
  - Estados válidos: disconnected, connecting, open, error
  - Campos obligatorios: company_id, instance_id, base_url, api_key
*/

-- =====================================================
-- TABLA: evolution_integrations
-- =====================================================

CREATE TABLE IF NOT EXISTS public.evolution_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  base_url text NOT NULL DEFAULT 'https://api.evoapicloud.com',
  instance_id text NOT NULL,
  api_key text NOT NULL,
  connection_state text NOT NULL DEFAULT 'disconnected' 
    CHECK (connection_state IN ('disconnected', 'connecting', 'open', 'error')),
  last_connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Solo una integración por empresa
  CONSTRAINT evolution_integrations_company_unique UNIQUE (company_id)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

-- Índice para búsquedas por company_id
CREATE INDEX IF NOT EXISTS evolution_integrations_company_idx 
  ON public.evolution_integrations (company_id);

-- Índice para búsquedas por estado de conexión
CREATE INDEX IF NOT EXISTS evolution_integrations_state_idx 
  ON public.evolution_integrations (connection_state);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.evolution_integrations ENABLE ROW LEVEL SECURITY;

-- Política SELECT: usuarios pueden ver solo la integración de su empresa
CREATE POLICY "Users can view own company evolution integration"
  ON public.evolution_integrations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Política INSERT: usuarios pueden crear integración solo para su empresa
CREATE POLICY "Users can create evolution integration for own company"
  ON public.evolution_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Política UPDATE: usuarios pueden actualizar solo la integración de su empresa
CREATE POLICY "Users can update own company evolution integration"
  ON public.evolution_integrations
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Política DELETE: usuarios pueden eliminar solo la integración de su empresa
CREATE POLICY "Users can delete own company evolution integration"
  ON public.evolution_integrations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGER: actualizar updated_at automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_evolution_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evolution_integrations_updated_at
  BEFORE UPDATE ON public.evolution_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_integrations_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.evolution_integrations IS 
  'Configuraciones de Evolution API para integración con WhatsApp. Una por empresa.';

COMMENT ON COLUMN public.evolution_integrations.company_id IS 
  'ID de la empresa propietaria de esta integración';

COMMENT ON COLUMN public.evolution_integrations.api_key IS 
  'API Key de Evolution API - NUNCA debe exponerse al frontend';

COMMENT ON COLUMN public.evolution_integrations.connection_state IS 
  'Estado actual de la conexión: disconnected, connecting, open, error';

COMMENT ON COLUMN public.evolution_integrations.last_connected_at IS 
  'Timestamp de la última conexión exitosa con WhatsApp';