/*
  # Crear Tabla de Productos de Materiales Rígidos

  ## Descripción
  Esta migración crea una tabla específica para productos de Materiales Rígidos,
  con campos adaptados a las necesidades de esta categoría.

  ## Nueva Tabla: productos_materiales_rigidos

  ### Campos
  - `id` (uuid, primary key): Identificador único del producto
  - `company_id` (uuid, foreign key): Empresa propietaria (multi-tenant)
  - `nombre` (text, required): Nombre del producto
  - `medidas_ancho` (numeric, required): Ancho de la placa en mm
  - `medidas_alto` (numeric, required): Alto de la placa en mm
  - `caras_impresas` (text[], required): Opciones de impresión ['solo_frente', 'frente_y_dorso']
  - `producto_impreso` (boolean, default false): Si se vende impreso
  - `is_active` (boolean, default true): Estado del producto
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de última actualización

  ### Campos Eliminados (vs tabla productos)
  - `categoria_id`: No necesario, la tabla ya identifica la categoría
  - `tipo_medida`: Siempre es 'medida_unica' para Materiales Rígidos
  - `medidas_disponibles`: No aplica, solo hay un tamaño de placa
  - `ancho_maximo`: No aplica a Materiales Rígidos

  ### Nota sobre Medidas
  Los productos de Materiales Rígidos tienen una sola medida que representa
  el tamaño de la placa del material. La medida final del trabajo se define
  en la orden de trabajo y el precio se calcula por m².

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE
  - Solo usuarios autenticados de la misma empresa pueden acceder

  ## Índices
  - company_id para filtrado multi-tenant
  - nombre para búsquedas
  - is_active para filtros de estado

  ## Constraints
  - medidas_ancho y medidas_alto deben ser positivos
  - caras_impresas debe tener al menos una opción
  - nombre único por empresa
*/

-- =====================================================
-- CREAR TABLA productos_materiales_rigidos
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  medidas_ancho numeric NOT NULL,
  medidas_alto numeric NOT NULL,
  caras_impresas text[] NOT NULL DEFAULT ARRAY['solo_frente'::text],
  producto_impreso boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_materiales_rigidos_medidas_positivas 
    CHECK (medidas_ancho > 0 AND medidas_alto > 0),
  CONSTRAINT check_materiales_rigidos_caras_not_empty 
    CHECK (array_length(caras_impresas, 1) > 0),
  CONSTRAINT check_materiales_rigidos_caras_valid 
    CHECK (caras_impresas <@ ARRAY['solo_frente', 'frente_y_dorso']::text[]),
  CONSTRAINT unique_materiales_rigidos_nombre_por_empresa 
    UNIQUE(company_id, nombre)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_company_id 
  ON productos_materiales_rigidos(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_nombre 
  ON productos_materiales_rigidos(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_is_active 
  ON productos_materiales_rigidos(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_company_active 
  ON productos_materiales_rigidos(company_id, is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_materiales_rigidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_materiales_rigidos"
  ON productos_materiales_rigidos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_materiales_rigidos"
  ON productos_materiales_rigidos FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_materiales_rigidos"
  ON productos_materiales_rigidos FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_materiales_rigidos"
  ON productos_materiales_rigidos FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_materiales_rigidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_materiales_rigidos_updated_at
  BEFORE UPDATE ON productos_materiales_rigidos
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_materiales_rigidos_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_materiales_rigidos IS 
  'Productos de Materiales Rígidos con tamaño de placa fijo y opciones de caras de impresión';

COMMENT ON COLUMN productos_materiales_rigidos.medidas_ancho IS 
  'Ancho de la placa del material en milímetros';

COMMENT ON COLUMN productos_materiales_rigidos.medidas_alto IS 
  'Alto de la placa del material en milímetros';

COMMENT ON COLUMN productos_materiales_rigidos.caras_impresas IS 
  'Array de opciones de impresión: solo_frente, frente_y_dorso, o ambas';

COMMENT ON COLUMN productos_materiales_rigidos.producto_impreso IS 
  'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';
