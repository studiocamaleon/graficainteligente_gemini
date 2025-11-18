/*
  # Crear Tabla de Precios para Productos Gran Formato

  ## Descripción
  Esta migración crea la tabla de precios para productos de impresión gran formato,
  permitiendo almacenar precios base por combinación de producto, tecnología, tinta y rango.

  ## Nuevas Tablas

  ### productos_gran_formato_precios
  Almacena los precios base para todas las configuraciones de productos gran formato

  **Campos:**
  - `id` (uuid, primary key) - Identificador único del precio
  - `company_id` (uuid, FK a companies) - Empresa propietaria
  - `producto_gran_formato_id` (uuid, FK a productos_gran_formato) - Producto al que pertenece
  - `tecnologia_id` (uuid, FK a tecnologias) - Tecnología de impresión
  - `tinta` (text) - Tipo de tinta (ej: 'CMYK', 'CMYK+W', 'K')
  - `rango_precio_min` (decimal) - Valor mínimo del rango (en unidad del rango)
  - `rango_precio_max` (decimal) - Valor máximo del rango (en unidad del rango)
  - `precio` (decimal) - Precio unitario para esta configuración
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad
  - RLS habilitado basado en company_id del usuario autenticado
  - Políticas restrictivas para SELECT, INSERT, UPDATE, DELETE
  - Validación de integridad referencial con CASCADE en deletes

  ## Índices
  - Índices en company_id para optimizar queries por empresa
  - Índices en producto_gran_formato_id para búsquedas por producto
  - Índices en tecnologia_id para filtrado por tecnología
  - Índice compuesto para búsquedas complejas

  ## Validaciones
  - Precios deben ser positivos
  - Rangos deben ser válidos (min < max o min = max para valores exactos)
  - Constraint de unicidad para evitar duplicados en configuración
*/

-- =====================================================
-- 1. TABLA PRINCIPAL: productos_gran_formato_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_gran_formato_id uuid NOT NULL REFERENCES productos_gran_formato(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tinta text NOT NULL,
  rango_precio_min decimal(10,2) NOT NULL,
  rango_precio_max decimal(10,2) NOT NULL,
  precio decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraint para validar que el precio sea positivo
  CONSTRAINT check_precio_positivo CHECK (precio >= 0),
  
  -- Constraint para validar que el rango sea válido
  CONSTRAINT check_rango_valido CHECK (rango_precio_min <= rango_precio_max),
  
  -- Constraint unique para evitar duplicados en la configuración
  CONSTRAINT unique_precio_gf_configuracion UNIQUE (
    producto_gran_formato_id,
    tecnologia_id,
    tinta,
    rango_precio_min,
    rango_precio_max
  )
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pgf_precios_company ON productos_gran_formato_precios(company_id);
CREATE INDEX IF NOT EXISTS idx_pgf_precios_producto ON productos_gran_formato_precios(producto_gran_formato_id);
CREATE INDEX IF NOT EXISTS idx_pgf_precios_tecnologia ON productos_gran_formato_precios(tecnologia_id);
CREATE INDEX IF NOT EXISTS idx_pgf_precios_tinta ON productos_gran_formato_precios(tinta);
CREATE INDEX IF NOT EXISTS idx_pgf_precios_rangos ON productos_gran_formato_precios(rango_precio_min, rango_precio_max);

-- Índice compuesto para búsquedas complejas
CREATE INDEX IF NOT EXISTS idx_pgf_precios_lookup ON productos_gran_formato_precios(
  producto_gran_formato_id,
  tecnologia_id,
  tinta
);

COMMENT ON TABLE productos_gran_formato_precios IS
  'Almacena los precios base para productos de gran formato por combinación de producto, tecnología, tinta y rango';

COMMENT ON COLUMN productos_gran_formato_precios.tinta IS
  'Tipo de tinta utilizada (ej: K, CMYK, CMYK+W, CMYK+W+V)';

COMMENT ON COLUMN productos_gran_formato_precios.rango_precio_min IS
  'Valor mínimo del rango en la unidad de medida correspondiente (m², metro lineal)';

COMMENT ON COLUMN productos_gran_formato_precios.rango_precio_max IS
  'Valor máximo del rango en la unidad de medida correspondiente (m², metro lineal)';

-- =====================================================
-- 3. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_gran_formato_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_gran_formato_precios_timestamp
  BEFORE UPDATE ON productos_gran_formato_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_gran_formato_precios_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_gran_formato_precios ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Los usuarios pueden ver precios de su empresa
CREATE POLICY "Users can view prices from their company"
  ON productos_gran_formato_precios FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política INSERT: Los usuarios pueden insertar precios para su empresa
CREATE POLICY "Users can insert prices for their company"
  ON productos_gran_formato_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política UPDATE: Los usuarios pueden actualizar precios de su empresa
CREATE POLICY "Users can update prices from their company"
  ON productos_gran_formato_precios FOR UPDATE
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

-- Política DELETE: Los usuarios pueden eliminar precios de su empresa
CREATE POLICY "Users can delete prices from their company"
  ON productos_gran_formato_precios FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
