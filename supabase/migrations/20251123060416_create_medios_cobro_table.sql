/*
  # Sistema de Medios de Cobro

  ## Descripción
  Este módulo permite a cada empresa configurar sus propios medios de cobro,
  incluyendo pasarelas de pago (Mercado Pago, PayPal, etc.), medios bancarios
  y efectivo. Incluye información de comisiones y tiempos de liberación para
  proyección de ingresos.

  ## Nueva Tabla

  ### medios_cobro
  Tabla principal para gestionar todos los medios de cobro disponibles
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text) - Nombre descriptivo del medio (ej: "Mercado Pago - Link de Pago")
  - `tipo` (text) - Tipo: 'pasarela', 'bancario', 'efectivo'
  - `categoria` (text, nullable) - Para pasarelas: nombre de la pasarela
  - `forma_cobro` (text, nullable) - Para pasarelas: "Link", "QR", "Point", "Web"
  - `comision_porcentaje` (numeric, nullable) - % de comisión aplicado
  - `dias_liberacion` (integer, nullable) - Días hasta liberación del dinero
  - `is_active` (boolean) - Si está activo para usar
  - `orden` (integer) - Para ordenar en selectores
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Usuarios pueden ver medios de su empresa
  - Solo admin y super_admin pueden crear/modificar/eliminar
*/

-- =====================================================
-- TABLA: medios_cobro
-- =====================================================

CREATE TABLE IF NOT EXISTS medios_cobro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL,
  categoria text,
  forma_cobro text,
  comision_porcentaje numeric DEFAULT 0,
  dias_liberacion integer DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  orden integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT check_tipo_medio_cobro CHECK (tipo IN ('pasarela', 'bancario', 'efectivo')),
  CONSTRAINT check_comision_valida CHECK (comision_porcentaje >= 0 AND comision_porcentaje <= 100),
  CONSTRAINT check_dias_liberacion_valido CHECK (dias_liberacion >= 0),
  CONSTRAINT unique_nombre_por_empresa UNIQUE (company_id, nombre)
);

-- Índices para medios_cobro
CREATE INDEX IF NOT EXISTS idx_medios_cobro_company_id ON medios_cobro(company_id);
CREATE INDEX IF NOT EXISTS idx_medios_cobro_tipo ON medios_cobro(tipo);
CREATE INDEX IF NOT EXISTS idx_medios_cobro_active ON medios_cobro(is_active);
CREATE INDEX IF NOT EXISTS idx_medios_cobro_orden ON medios_cobro(orden);

-- Trigger para updated_at
CREATE TRIGGER update_medios_cobro_updated_at
  BEFORE UPDATE ON medios_cobro
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE medios_cobro ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Usuarios pueden ver medios de su empresa
CREATE POLICY "Users can view own company medios_cobro"
  ON medios_cobro FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: INSERT - Solo admin y super_admin pueden crear
CREATE POLICY "Admins can insert medios_cobro"
  ON medios_cobro FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: UPDATE - Solo admin y super_admin pueden actualizar
CREATE POLICY "Admins can update own company medios_cobro"
  ON medios_cobro FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: DELETE - Solo admin y super_admin pueden eliminar
CREATE POLICY "Admins can delete own company medios_cobro"
  ON medios_cobro FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );