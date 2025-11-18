/*
  # Crear Sistema Completo de Productos de Impresión Gran Formato

  ## Descripción
  Esta migración crea el esquema completo para el módulo de Productos de Impresión Gran Formato,
  incluyendo la tabla principal y todas sus tablas de relaciones dedicadas.

  ## Nuevas Tablas

  ### 1. productos_gran_formato
  Tabla principal de productos de impresión gran formato
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK a companies)
  - `nombre` (text, nombre del producto)
  - `tipo_venta` (text, enum: 'mt2' o 'mt_lineal')
  - `anchos_disponibles` (integer[], anchos en cm para tipo_venta mt_lineal)
  - `impuesto_iva` (decimal, porcentaje de IVA a aplicar)
  - `rango_precio_id` (uuid, FK a rangos_precio, nullable)
  - `is_active` (boolean, estado activo/inactivo)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos_gran_formato_tecnologias
  Relación entre productos gran formato y tecnologías de impresión
  - `id` (uuid, primary key)
  - `producto_gran_formato_id` (uuid, FK a productos_gran_formato)
  - `tecnologia_id` (uuid, FK a tecnologias)
  - `tintas` (text[], array de tintas seleccionadas)
  - `created_at` (timestamptz)

  ### 3. productos_gran_formato_materiales
  Relación entre productos gran formato y materiales
  - `id` (uuid, primary key)
  - `producto_gran_formato_id` (uuid, FK a productos_gran_formato)
  - `material_id` (uuid, FK a materiales)
  - `variante_nombre` (text, nombre de la variante seleccionada)
  - `espesor` (decimal, espesor en mm si aplica)
  - `created_at` (timestamptz)

  ### 4. productos_gran_formato_servicios
  Relación entre productos gran formato y servicios adicionales
  - `id` (uuid, primary key)
  - `producto_gran_formato_id` (uuid, FK a productos_gran_formato)
  - `servicio_id` (uuid, FK a servicios)
  - `is_active` (boolean, si el servicio está activo)
  - `created_at` (timestamptz)

  ### 5. productos_gran_formato_acabados
  Relación entre productos gran formato y acabados
  - `id` (uuid, primary key)
  - `producto_gran_formato_id` (uuid, FK a productos_gran_formato)
  - `acabado_id` (uuid, FK a acabados)
  - `is_active` (boolean, si el acabado está activo)
  - `created_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas basadas en company_id del usuario autenticado
  - Validaciones de integridad referencial con CASCADE en deletes

  ## Índices
  - Índices en company_id para optimizar queries por empresa
  - Índices en todas las foreign keys
  - Índices en campos de búsqueda y filtrado
*/

-- =====================================================
-- 1. TABLA PRINCIPAL: productos_gran_formato
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_venta text NOT NULL CHECK (tipo_venta IN ('mt2', 'mt_lineal')),
  anchos_disponibles integer[] DEFAULT ARRAY[]::integer[],
  impuesto_iva decimal(5,2) NOT NULL,
  rango_precio_id uuid REFERENCES rangos_precio(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_nombre_gran_formato_por_company UNIQUE (company_id, nombre),
  CONSTRAINT check_impuesto_iva_gran_formato CHECK (impuesto_iva >= 0 AND impuesto_iva <= 100),
  CONSTRAINT check_anchos_disponibles_valid CHECK (
    (tipo_venta = 'mt2' AND anchos_disponibles = ARRAY[]::integer[]) OR
    (tipo_venta = 'mt_lineal' AND array_length(anchos_disponibles, 1) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_company ON productos_gran_formato(company_id);
CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_active ON productos_gran_formato(is_active);
CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_nombre ON productos_gran_formato(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_tipo_venta ON productos_gran_formato(tipo_venta);
CREATE INDEX IF NOT EXISTS idx_productos_gran_formato_rango_precio ON productos_gran_formato(rango_precio_id);

COMMENT ON TABLE productos_gran_formato IS
  'Productos de impresión gran formato con configuraciones específicas para venta por m2 o metro lineal';

COMMENT ON COLUMN productos_gran_formato.tipo_venta IS
  'Tipo de venta: mt2 (metros cuadrados) o mt_lineal (metros lineales)';

COMMENT ON COLUMN productos_gran_formato.anchos_disponibles IS
  'Array de anchos disponibles en cm (solo para tipo_venta mt_lineal). Valores típicos: 30, 60, 120';

COMMENT ON COLUMN productos_gran_formato.rango_precio_id IS
  'Rango de precios asociado (opcional). Debe coincidir con la unidad_medida del tipo_venta';

-- =====================================================
-- 2. TABLA: productos_gran_formato_tecnologias
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_gran_formato_id uuid NOT NULL REFERENCES productos_gran_formato(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_gf_tecnologia UNIQUE (producto_gran_formato_id, tecnologia_id)
);

CREATE INDEX IF NOT EXISTS idx_pgf_tecnologias_producto ON productos_gran_formato_tecnologias(producto_gran_formato_id);
CREATE INDEX IF NOT EXISTS idx_pgf_tecnologias_tecnologia ON productos_gran_formato_tecnologias(tecnologia_id);

COMMENT ON TABLE productos_gran_formato_tecnologias IS
  'Relación entre productos de gran formato y tecnologías con sus tintas seleccionadas';

COMMENT ON COLUMN productos_gran_formato_tecnologias.tintas IS
  'Array de tintas disponibles para esta tecnología (ej: K, CMYK, CMYK+W)';

-- =====================================================
-- 3. TABLA: productos_gran_formato_materiales
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_gran_formato_id uuid NOT NULL REFERENCES productos_gran_formato(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesor decimal(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_gf_material UNIQUE (producto_gran_formato_id, material_id, variante_nombre)
);

CREATE INDEX IF NOT EXISTS idx_pgf_materiales_producto ON productos_gran_formato_materiales(producto_gran_formato_id);
CREATE INDEX IF NOT EXISTS idx_pgf_materiales_material ON productos_gran_formato_materiales(material_id);

COMMENT ON TABLE productos_gran_formato_materiales IS
  'Relación entre productos de gran formato y materiales con variantes y espesores';

-- =====================================================
-- 4. TABLA: productos_gran_formato_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_gran_formato_id uuid NOT NULL REFERENCES productos_gran_formato(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_gf_servicio UNIQUE (producto_gran_formato_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_pgf_servicios_producto ON productos_gran_formato_servicios(producto_gran_formato_id);
CREATE INDEX IF NOT EXISTS idx_pgf_servicios_servicio ON productos_gran_formato_servicios(servicio_id);
CREATE INDEX IF NOT EXISTS idx_pgf_servicios_active ON productos_gran_formato_servicios(is_active);

COMMENT ON TABLE productos_gran_formato_servicios IS
  'Relación entre productos de gran formato y servicios adicionales disponibles';

-- =====================================================
-- 5. TABLA: productos_gran_formato_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_gran_formato_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_gran_formato_id uuid NOT NULL REFERENCES productos_gran_formato(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_gf_acabado UNIQUE (producto_gran_formato_id, acabado_id)
);

CREATE INDEX IF NOT EXISTS idx_pgf_acabados_producto ON productos_gran_formato_acabados(producto_gran_formato_id);
CREATE INDEX IF NOT EXISTS idx_pgf_acabados_acabado ON productos_gran_formato_acabados(acabado_id);
CREATE INDEX IF NOT EXISTS idx_pgf_acabados_active ON productos_gran_formato_acabados(is_active);

COMMENT ON TABLE productos_gran_formato_acabados IS
  'Relación entre productos de gran formato y acabados disponibles';

-- =====================================================
-- 6. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_gran_formato_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_gran_formato_timestamp
  BEFORE UPDATE ON productos_gran_formato
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_gran_formato_updated_at();

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_gran_formato ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_gran_formato_tecnologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_gran_formato_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_gran_formato_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_gran_formato_acabados ENABLE ROW LEVEL SECURITY;

-- Políticas para productos_gran_formato
CREATE POLICY "Users can view products from their company"
  ON productos_gran_formato FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products to their company"
  ON productos_gran_formato FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update products from their company"
  ON productos_gran_formato FOR UPDATE
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

CREATE POLICY "Users can delete products from their company"
  ON productos_gran_formato FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para productos_gran_formato_tecnologias
CREATE POLICY "Users can view product technologies from their company"
  ON productos_gran_formato_tecnologias FOR SELECT
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product technologies from their company"
  ON productos_gran_formato_tecnologias FOR ALL
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_gran_formato_materiales
CREATE POLICY "Users can view product materials from their company"
  ON productos_gran_formato_materiales FOR SELECT
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product materials from their company"
  ON productos_gran_formato_materiales FOR ALL
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_gran_formato_servicios
CREATE POLICY "Users can view product services from their company"
  ON productos_gran_formato_servicios FOR SELECT
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product services from their company"
  ON productos_gran_formato_servicios FOR ALL
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_gran_formato_acabados
CREATE POLICY "Users can view product acabados from their company"
  ON productos_gran_formato_acabados FOR SELECT
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product acabados from their company"
  ON productos_gran_formato_acabados FOR ALL
  TO authenticated
  USING (
    producto_gran_formato_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );