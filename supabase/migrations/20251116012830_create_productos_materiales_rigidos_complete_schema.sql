/*
  # Crear Sistema Completo de Productos de Materiales Rígidos

  ## Descripción
  Esta migración crea el esquema completo para el módulo de Productos de Materiales Rígidos,
  incluyendo la tabla principal y todas sus tablas de relaciones dedicadas.

  ## Nuevas Tablas

  ### 1. productos_materiales_rigidos
  Tabla principal de productos de materiales rígidos
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK a companies)
  - `nombre` (text, nombre del producto)
  - `medidas_ancho` (decimal, ancho de la placa en cm)
  - `medidas_alto` (decimal, alto de la placa en cm)
  - `tipo_venta` (text, siempre 'mt2')
  - `rango_precio_id` (uuid, FK a rangos_precio, nullable)
  - `impuesto_iva` (decimal, porcentaje de IVA)
  - `is_active` (boolean, estado activo/inactivo)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos_materiales_rigidos_materiales
  Relación entre productos de materiales rígidos y materiales
  - `id` (uuid, primary key)
  - `producto_materiales_rigidos_id` (uuid, FK a productos_materiales_rigidos)
  - `material_id` (uuid, FK a materiales)
  - `variante_nombre` (text, nombre de la variante)
  - `espesores` (decimal[], array de espesores disponibles)
  - `created_at` (timestamptz)

  ### 3. productos_materiales_rigidos_servicios
  Relación entre productos de materiales rígidos y servicios
  - `id` (uuid, primary key)
  - `producto_materiales_rigidos_id` (uuid, FK a productos_materiales_rigidos)
  - `servicio_id` (uuid, FK a servicios)
  - `is_active` (boolean, si el servicio está activo)
  - `created_at` (timestamptz)

  ### 4. productos_materiales_rigidos_acabados
  Relación entre productos de materiales rígidos y acabados
  - `id` (uuid, primary key)
  - `producto_materiales_rigidos_id` (uuid, FK a productos_materiales_rigidos)
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
-- 1. TABLA PRINCIPAL: productos_materiales_rigidos
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  medidas_ancho decimal(10,2) NOT NULL,
  medidas_alto decimal(10,2) NOT NULL,
  tipo_venta text NOT NULL DEFAULT 'mt2',
  rango_precio_id uuid REFERENCES rangos_precio(id) ON DELETE SET NULL,
  impuesto_iva decimal(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_nombre_materiales_rigidos_por_company UNIQUE (company_id, nombre),
  CONSTRAINT check_materiales_rigidos_medidas_positivas CHECK (medidas_ancho > 0 AND medidas_alto > 0),
  CONSTRAINT check_materiales_rigidos_tipo_venta CHECK (tipo_venta = 'mt2'),
  CONSTRAINT check_materiales_rigidos_impuesto_iva CHECK (impuesto_iva >= 0 AND impuesto_iva <= 100)
);

CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_company ON productos_materiales_rigidos(company_id);
CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_active ON productos_materiales_rigidos(is_active);
CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_nombre ON productos_materiales_rigidos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_materiales_rigidos_rango_precio ON productos_materiales_rigidos(rango_precio_id);

COMMENT ON TABLE productos_materiales_rigidos IS
  'Productos de Materiales Rígidos con dimensiones de materia prima y venta por metros cuadrados';

-- =====================================================
-- 2. TABLA: productos_materiales_rigidos_materiales
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_materiales_rigidos_id uuid NOT NULL REFERENCES productos_materiales_rigidos(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesores decimal[] NOT NULL DEFAULT ARRAY[]::decimal[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_mr_material UNIQUE (producto_materiales_rigidos_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_pmr_materiales_producto ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id);
CREATE INDEX IF NOT EXISTS idx_pmr_materiales_material ON productos_materiales_rigidos_materiales(material_id);

COMMENT ON TABLE productos_materiales_rigidos_materiales IS
  'Relación entre productos de materiales rígidos y materiales con variantes y espesores';

-- =====================================================
-- 3. TABLA: productos_materiales_rigidos_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_materiales_rigidos_id uuid NOT NULL REFERENCES productos_materiales_rigidos(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_mr_servicio UNIQUE (producto_materiales_rigidos_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_pmr_servicios_producto ON productos_materiales_rigidos_servicios(producto_materiales_rigidos_id);
CREATE INDEX IF NOT EXISTS idx_pmr_servicios_servicio ON productos_materiales_rigidos_servicios(servicio_id);
CREATE INDEX IF NOT EXISTS idx_pmr_servicios_active ON productos_materiales_rigidos_servicios(is_active);

COMMENT ON TABLE productos_materiales_rigidos_servicios IS
  'Relación entre productos de materiales rígidos y servicios adicionales disponibles';

-- =====================================================
-- 4. TABLA: productos_materiales_rigidos_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_materiales_rigidos_id uuid NOT NULL REFERENCES productos_materiales_rigidos(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_mr_acabado UNIQUE (producto_materiales_rigidos_id, acabado_id)
);

CREATE INDEX IF NOT EXISTS idx_pmr_acabados_producto ON productos_materiales_rigidos_acabados(producto_materiales_rigidos_id);
CREATE INDEX IF NOT EXISTS idx_pmr_acabados_acabado ON productos_materiales_rigidos_acabados(acabado_id);
CREATE INDEX IF NOT EXISTS idx_pmr_acabados_active ON productos_materiales_rigidos_acabados(is_active);

COMMENT ON TABLE productos_materiales_rigidos_acabados IS
  'Relación entre productos de materiales rígidos y acabados disponibles';

-- =====================================================
-- 5. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_materiales_rigidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_materiales_rigidos_timestamp
  BEFORE UPDATE ON productos_materiales_rigidos
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_materiales_rigidos_updated_at();

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_materiales_rigidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_materiales_rigidos_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_materiales_rigidos_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_materiales_rigidos_acabados ENABLE ROW LEVEL SECURITY;

-- Políticas para productos_materiales_rigidos
CREATE POLICY "Users can view products from their company"
  ON productos_materiales_rigidos FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products to their company"
  ON productos_materiales_rigidos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update products from their company"
  ON productos_materiales_rigidos FOR UPDATE
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
  ON productos_materiales_rigidos FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para productos_materiales_rigidos_materiales
CREATE POLICY "Users can view product materials from their company"
  ON productos_materiales_rigidos_materiales FOR SELECT
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product materials from their company"
  ON productos_materiales_rigidos_materiales FOR ALL
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_materiales_rigidos_servicios
CREATE POLICY "Users can view product services from their company"
  ON productos_materiales_rigidos_servicios FOR SELECT
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product services from their company"
  ON productos_materiales_rigidos_servicios FOR ALL
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_materiales_rigidos_acabados
CREATE POLICY "Users can view product finishes from their company"
  ON productos_materiales_rigidos_acabados FOR SELECT
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product finishes from their company"
  ON productos_materiales_rigidos_acabados FOR ALL
  TO authenticated
  USING (
    producto_materiales_rigidos_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
