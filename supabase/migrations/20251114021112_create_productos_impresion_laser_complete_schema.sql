/*
  # Crear Sistema Completo de Productos de Impresión Láser

  ## Descripción
  Esta migración crea el esquema completo para el módulo de Productos de Impresión Láser,
  incluyendo la tabla principal y todas sus tablas de relaciones dedicadas.

  ## Nuevas Tablas

  ### 1. productos_impresion_laser
  Tabla principal de productos de impresión láser
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK a companies)
  - `nombre` (text, nombre del producto)
  - `medidas_disponibles` (jsonb, array de objetos con ancho y alto)
  - `caras_impresas` (text[], opciones: solo_frente, frente_y_dorso)
  - `producto_impreso` (boolean, si es producto impreso o no)
  - `tipo_venta` (text, enum: unidades, medidas, cantidades_fijas)
  - `cantidades_fijas` (integer[], cantidades disponibles si tipo_venta es cantidades_fijas)
  - `impuesto_iva` (decimal, porcentaje de IVA a aplicar)
  - `is_active` (boolean, estado activo/inactivo)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos_impresion_laser_tecnologias
  Relación entre productos láser y tecnologías de impresión
  - `id` (uuid, primary key)
  - `producto_laser_id` (uuid, FK a productos_impresion_laser)
  - `tecnologia_id` (uuid, FK a tecnologias)
  - `tintas` (uuid[], array de IDs de tintas seleccionadas)
  - `created_at` (timestamptz)

  ### 3. productos_impresion_laser_materiales
  Relación entre productos láser y materiales
  - `id` (uuid, primary key)
  - `producto_laser_id` (uuid, FK a productos_impresion_laser)
  - `material_id` (uuid, FK a materiales)
  - `variante_nombre` (text, nombre de la variante seleccionada)
  - `espesor` (decimal, espesor en mm si aplica)
  - `created_at` (timestamptz)

  ### 4. productos_impresion_laser_servicios
  Relación entre productos láser y servicios adicionales
  - `id` (uuid, primary key)
  - `producto_laser_id` (uuid, FK a productos_impresion_laser)
  - `servicio_id` (uuid, FK a servicios)
  - `is_active` (boolean, si el servicio está activo)
  - `created_at` (timestamptz)

  ### 5. productos_impresion_laser_acabados
  Relación entre productos láser y acabados
  - `id` (uuid, primary key)
  - `producto_laser_id` (uuid, FK a productos_impresion_laser)
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
-- 1. TABLA PRINCIPAL: productos_impresion_laser
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  medidas_disponibles jsonb NOT NULL DEFAULT '[]'::jsonb,
  caras_impresas text[] NOT NULL DEFAULT ARRAY[]::text[],
  producto_impreso boolean NOT NULL DEFAULT true,
  tipo_venta text NOT NULL CHECK (tipo_venta IN ('unidades', 'medidas', 'cantidades_fijas')),
  cantidades_fijas integer[] DEFAULT ARRAY[]::integer[],
  impuesto_iva decimal(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_nombre_por_company UNIQUE (company_id, nombre),
  CONSTRAINT check_caras_impresas CHECK (caras_impresas <@ ARRAY['solo_frente', 'frente_y_dorso']::text[]),
  CONSTRAINT check_impuesto_iva CHECK (impuesto_iva >= 0 AND impuesto_iva <= 100)
);

CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_company ON productos_impresion_laser(company_id);
CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_active ON productos_impresion_laser(is_active);
CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_nombre ON productos_impresion_laser(nombre);

COMMENT ON TABLE productos_impresion_laser IS 
  'Productos de impresión láser con todas sus configuraciones específicas';

-- =====================================================
-- 2. TABLA: productos_impresion_laser_tecnologias
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_laser_id uuid NOT NULL REFERENCES productos_impresion_laser(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_tecnologia UNIQUE (producto_laser_id, tecnologia_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_tecnologias_producto ON productos_impresion_laser_tecnologias(producto_laser_id);
CREATE INDEX IF NOT EXISTS idx_pl_tecnologias_tecnologia ON productos_impresion_laser_tecnologias(tecnologia_id);

COMMENT ON TABLE productos_impresion_laser_tecnologias IS 
  'Relación entre productos de impresión láser y tecnologías con sus tintas seleccionadas';

-- =====================================================
-- 3. TABLA: productos_impresion_laser_materiales
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_laser_id uuid NOT NULL REFERENCES productos_impresion_laser(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesor decimal(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_material UNIQUE (producto_laser_id, material_id, variante_nombre)
);

CREATE INDEX IF NOT EXISTS idx_pl_materiales_producto ON productos_impresion_laser_materiales(producto_laser_id);
CREATE INDEX IF NOT EXISTS idx_pl_materiales_material ON productos_impresion_laser_materiales(material_id);

COMMENT ON TABLE productos_impresion_laser_materiales IS 
  'Relación entre productos de impresión láser y materiales con variantes y espesores';

-- =====================================================
-- 4. TABLA: productos_impresion_laser_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_laser_id uuid NOT NULL REFERENCES productos_impresion_laser(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_servicio UNIQUE (producto_laser_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_servicios_producto ON productos_impresion_laser_servicios(producto_laser_id);
CREATE INDEX IF NOT EXISTS idx_pl_servicios_servicio ON productos_impresion_laser_servicios(servicio_id);
CREATE INDEX IF NOT EXISTS idx_pl_servicios_active ON productos_impresion_laser_servicios(is_active);

COMMENT ON TABLE productos_impresion_laser_servicios IS 
  'Relación entre productos de impresión láser y servicios adicionales disponibles';

-- =====================================================
-- 5. TABLA: productos_impresion_laser_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_laser_id uuid NOT NULL REFERENCES productos_impresion_laser(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_acabado UNIQUE (producto_laser_id, acabado_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_acabados_producto ON productos_impresion_laser_acabados(producto_laser_id);
CREATE INDEX IF NOT EXISTS idx_pl_acabados_acabado ON productos_impresion_laser_acabados(acabado_id);
CREATE INDEX IF NOT EXISTS idx_pl_acabados_active ON productos_impresion_laser_acabados(is_active);

COMMENT ON TABLE productos_impresion_laser_acabados IS 
  'Relación entre productos de impresión láser y acabados disponibles';

-- =====================================================
-- 6. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_impresion_laser_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_impresion_laser_timestamp
  BEFORE UPDATE ON productos_impresion_laser
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_impresion_laser_updated_at();

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_impresion_laser ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_impresion_laser_tecnologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_impresion_laser_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_impresion_laser_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_impresion_laser_acabados ENABLE ROW LEVEL SECURITY;

-- Políticas para productos_impresion_laser
CREATE POLICY "Users can view products from their company"
  ON productos_impresion_laser FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products to their company"
  ON productos_impresion_laser FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update products from their company"
  ON productos_impresion_laser FOR UPDATE
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
  ON productos_impresion_laser FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para productos_impresion_laser_tecnologias
CREATE POLICY "Users can view product technologies from their company"
  ON productos_impresion_laser_tecnologias FOR SELECT
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product technologies from their company"
  ON productos_impresion_laser_tecnologias FOR ALL
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_impresion_laser_materiales
CREATE POLICY "Users can view product materials from their company"
  ON productos_impresion_laser_materiales FOR SELECT
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product materials from their company"
  ON productos_impresion_laser_materiales FOR ALL
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_impresion_laser_servicios
CREATE POLICY "Users can view product services from their company"
  ON productos_impresion_laser_servicios FOR SELECT
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product services from their company"
  ON productos_impresion_laser_servicios FOR ALL
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Políticas para productos_impresion_laser_acabados
CREATE POLICY "Users can view product finishes from their company"
  ON productos_impresion_laser_acabados FOR SELECT
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage product finishes from their company"
  ON productos_impresion_laser_acabados FOR ALL
  TO authenticated
  USING (
    producto_laser_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );