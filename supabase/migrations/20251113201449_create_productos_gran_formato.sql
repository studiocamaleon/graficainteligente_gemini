/*
  # Crear Tabla de Productos de Impresión Gran Formato

  ## Descripción
  Esta migración crea una tabla específica para productos de Impresión Gran Formato,
  con campos adaptados a las necesidades de esta categoría.

  ## Nueva Tabla: productos_gran_formato

  ### Campos
  - `id` (uuid, primary key): Identificador único del producto
  - `company_id` (uuid, foreign key): Empresa propietaria (multi-tenant)
  - `nombre` (text, required): Nombre del producto
  - `ancho_maximo` (numeric, required): Ancho máximo de impresión en mm
  - `alto_maximo` (numeric, required): Alto máximo de impresión en mm
  - `producto_impreso` (boolean, default false): Si se vende impreso
  - `is_active` (boolean, default true): Estado del producto
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de última actualización

  ### Campos Eliminados (vs tabla productos)
  - `categoria_id`: No necesario, la tabla ya identifica la categoría
  - `medidas_ancho`: Reemplazado por ancho_maximo
  - `medidas_alto`: Reemplazado por alto_maximo
  - `tipo_medida`: No aplica, siempre son medidas máximas
  - `medidas_disponibles`: No aplica a Gran Formato
  - `caras_impresas`: NO APLICA - Gran Formato se imprime de una sola forma

  ### Nota Importante sobre Caras de Impresión
  Los productos de Gran Formato NO tienen el campo `caras_impresas` porque
  se imprimen de una sola forma (no hay opción de frente/dorso como en Laser).
  Las medidas finales del trabajo se definen en la orden de trabajo.

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE
  - Solo usuarios autenticados de la misma empresa pueden acceder

  ## Índices
  - company_id para filtrado multi-tenant
  - nombre para búsquedas
  - is_active para filtros de estado

  ## Constraints
  - ancho_maximo y alto_maximo deben ser positivos
  - nombre único por empresa
*/

-- =====================================================
-- CREAR TABLA productos_gran_formato
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  ancho_maximo numeric NOT NULL,
  alto_maximo numeric NOT NULL,
  producto_impreso boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_gran_formato_ancho_maximo_positivo 
    CHECK (ancho_maximo > 0),
  CONSTRAINT check_gran_formato_alto_maximo_positivo 
    CHECK (alto_maximo > 0),
  CONSTRAINT unique_gran_formato_nombre_por_empresa 
    UNIQUE(company_id, nombre)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_company_id 
  ON productos_gran_formato(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_nombre 
  ON productos_gran_formato(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_is_active 
  ON productos_gran_formato(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_company_active 
  ON productos_gran_formato(company_id, is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_gran_formato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_gran_formato"
  ON productos_gran_formato FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_gran_formato"
  ON productos_gran_formato FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_gran_formato"
  ON productos_gran_formato FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_gran_formato"
  ON productos_gran_formato FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_gran_formato_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_gran_formato_updated_at
  BEFORE UPDATE ON productos_gran_formato
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_gran_formato_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_gran_formato IS 
  'Productos de Impresión Gran Formato. NO tienen campo caras_impresas porque se imprimen de una sola forma.';

COMMENT ON COLUMN productos_gran_formato.ancho_maximo IS 
  'Ancho máximo de impresión en milímetros. La medida final del trabajo se define en la orden.';

COMMENT ON COLUMN productos_gran_formato.alto_maximo IS 
  'Alto máximo de impresión en milímetros. La medida final del trabajo se define en la orden.';

COMMENT ON COLUMN productos_gran_formato.producto_impreso IS 
  'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';
