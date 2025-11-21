/*
  # Crear Sistema Completo de Productos de Talonarios

  ## Descripción
  Esta migración crea el esquema completo para el módulo de Productos de Talonarios,
  incluyendo la categoría, tabla principal y todas sus tablas de relaciones dedicadas.

  ## Categoría del Sistema

  ### Talonarios (ID: 00000000-0000-0000-0000-000000000007)
  Categoría para productos de talonarios y formularios con duplicado, triplicado o cuadruplicado

  ## Nuevas Tablas

  ### 1. productos_talonarios
  ### 2. productos_talonarios_tecnologias
  ### 3. productos_talonarios_materiales
  ### 4. productos_talonarios_servicios
  ### 5. productos_talonarios_acabados
  ### 6. productos_talonarios_precios

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas basadas en company_id del usuario autenticado
*/

-- =====================================================
-- 0. CREAR CATEGORÍA EN EL SISTEMA
-- =====================================================

INSERT INTO categorias (id, nombre, descripcion, color, is_system_category, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000007',
  'Talonarios',
  'Productos de talonarios y formularios con duplicado, triplicado o cuadruplicado',
  '#14B8A6',
  true,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 1. TABLA PRINCIPAL: productos_talonarios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  medidas_disponibles jsonb NOT NULL DEFAULT '[]'::jsonb,
  tipo_copia text[] NOT NULL DEFAULT ARRAY[]::text[],
  producto_impreso boolean NOT NULL DEFAULT true,
  tipo_venta text NOT NULL CHECK (tipo_venta IN ('unidades', 'cantidades_fijas')),
  cantidades_fijas integer[] DEFAULT ARRAY[]::integer[],
  impuesto_iva decimal(5,2) NOT NULL,
  ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_nombre_talonario_por_company UNIQUE (company_id, nombre),
  CONSTRAINT check_tipo_copia CHECK (tipo_copia <@ ARRAY['duplicado', 'triplicado', 'cuadruplicado']::text[]),
  CONSTRAINT check_impuesto_iva_talonario CHECK (impuesto_iva >= 0 AND impuesto_iva <= 100)
);

CREATE INDEX IF NOT EXISTS idx_productos_talonarios_company ON productos_talonarios(company_id);
CREATE INDEX IF NOT EXISTS idx_productos_talonarios_active ON productos_talonarios(is_active);
CREATE INDEX IF NOT EXISTS idx_productos_talonarios_nombre ON productos_talonarios(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_talonarios_ruta ON productos_talonarios(ruta_produccion_id);

COMMENT ON TABLE productos_talonarios IS
  'Productos de talonarios con todas sus configuraciones específicas';

-- =====================================================
-- 2. TABLA: productos_talonarios_tecnologias
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_talonario_id uuid NOT NULL REFERENCES productos_talonarios(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_talonario_tecnologia UNIQUE (producto_talonario_id, tecnologia_id)
);

CREATE INDEX IF NOT EXISTS idx_pt_tecnologias_producto ON productos_talonarios_tecnologias(producto_talonario_id);
CREATE INDEX IF NOT EXISTS idx_pt_tecnologias_tecnologia ON productos_talonarios_tecnologias(tecnologia_id);

COMMENT ON TABLE productos_talonarios_tecnologias IS
  'Relación entre productos de talonarios y tecnologías con sus tintas seleccionadas';

-- =====================================================
-- 3. TABLA: productos_talonarios_materiales
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_talonario_id uuid NOT NULL REFERENCES productos_talonarios(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesor decimal(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_talonario_material UNIQUE (producto_talonario_id, material_id, variante_nombre)
);

CREATE INDEX IF NOT EXISTS idx_pt_materiales_producto ON productos_talonarios_materiales(producto_talonario_id);
CREATE INDEX IF NOT EXISTS idx_pt_materiales_material ON productos_talonarios_materiales(material_id);

COMMENT ON TABLE productos_talonarios_materiales IS
  'Relación entre productos de talonarios y materiales con variantes y espesores';

-- =====================================================
-- 4. TABLA: productos_talonarios_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_talonario_id uuid NOT NULL REFERENCES productos_talonarios(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_talonario_servicio UNIQUE (producto_talonario_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_pt_servicios_producto ON productos_talonarios_servicios(producto_talonario_id);
CREATE INDEX IF NOT EXISTS idx_pt_servicios_servicio ON productos_talonarios_servicios(servicio_id);

COMMENT ON TABLE productos_talonarios_servicios IS
  'Relación entre productos de talonarios y servicios adicionales';

-- =====================================================
-- 5. TABLA: productos_talonarios_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_talonario_id uuid NOT NULL REFERENCES productos_talonarios(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_producto_talonario_acabado UNIQUE (producto_talonario_id, acabado_id)
);

CREATE INDEX IF NOT EXISTS idx_pt_acabados_producto ON productos_talonarios_acabados(producto_talonario_id);
CREATE INDEX IF NOT EXISTS idx_pt_acabados_acabado ON productos_talonarios_acabados(acabado_id);

COMMENT ON TABLE productos_talonarios_acabados IS
  'Relación entre productos de talonarios y acabados';

-- =====================================================
-- 6. TABLA: productos_talonarios_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_talonarios_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_talonario_id uuid NOT NULL REFERENCES productos_talonarios(id) ON DELETE CASCADE,
  medida_ancho decimal(10,2) NOT NULL,
  medida_alto decimal(10,2) NOT NULL,
  tinta_id uuid NOT NULL,
  cantidad integer NOT NULL,
  tipo_copia text NOT NULL CHECK (tipo_copia IN ('duplicado', 'triplicado', 'cuadruplicado')),
  precio decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_precio_talonario_configuracion UNIQUE (
    producto_talonario_id,
    medida_ancho,
    medida_alto,
    tinta_id,
    cantidad,
    tipo_copia
  ),

  CONSTRAINT check_medida_ancho_talonario_positivo CHECK (medida_ancho > 0),
  CONSTRAINT check_medida_alto_talonario_positivo CHECK (medida_alto > 0),
  CONSTRAINT check_cantidad_talonario_positiva CHECK (cantidad > 0),
  CONSTRAINT check_precio_talonario_positivo CHECK (precio > 0)
);

CREATE INDEX IF NOT EXISTS idx_pt_precios_company ON productos_talonarios_precios(company_id);
CREATE INDEX IF NOT EXISTS idx_pt_precios_producto ON productos_talonarios_precios(producto_talonario_id);
CREATE INDEX IF NOT EXISTS idx_pt_precios_tinta ON productos_talonarios_precios(tinta_id);
CREATE INDEX IF NOT EXISTS idx_pt_precios_producto_medida ON productos_talonarios_precios(producto_talonario_id, medida_ancho, medida_alto);

COMMENT ON TABLE productos_talonarios_precios IS
  'Precios base para productos de talonarios por configuración específica (medida, tinta, cantidad, tipo de copia)';

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================

-- productos_talonarios
ALTER TABLE productos_talonarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view productos_talonarios from their company"
  ON productos_talonarios FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert productos_talonarios in their company"
  ON productos_talonarios FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update productos_talonarios in their company"
  ON productos_talonarios FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete productos_talonarios in their company"
  ON productos_talonarios FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- productos_talonarios_tecnologias
ALTER TABLE productos_talonarios_tecnologias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage productos_talonarios_tecnologias"
  ON productos_talonarios_tecnologias FOR ALL
  TO authenticated
  USING (
    producto_talonario_id IN (
      SELECT id FROM productos_talonarios
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- productos_talonarios_materiales
ALTER TABLE productos_talonarios_materiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage productos_talonarios_materiales"
  ON productos_talonarios_materiales FOR ALL
  TO authenticated
  USING (
    producto_talonario_id IN (
      SELECT id FROM productos_talonarios
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- productos_talonarios_servicios
ALTER TABLE productos_talonarios_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage productos_talonarios_servicios"
  ON productos_talonarios_servicios FOR ALL
  TO authenticated
  USING (
    producto_talonario_id IN (
      SELECT id FROM productos_talonarios
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- productos_talonarios_acabados
ALTER TABLE productos_talonarios_acabados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage productos_talonarios_acabados"
  ON productos_talonarios_acabados FOR ALL
  TO authenticated
  USING (
    producto_talonario_id IN (
      SELECT id FROM productos_talonarios
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- productos_talonarios_precios
ALTER TABLE productos_talonarios_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view productos_talonarios_precios from their company"
  ON productos_talonarios_precios FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert productos_talonarios_precios in their company"
  ON productos_talonarios_precios FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update productos_talonarios_precios in their company"
  ON productos_talonarios_precios FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete productos_talonarios_precios in their company"
  ON productos_talonarios_precios FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
