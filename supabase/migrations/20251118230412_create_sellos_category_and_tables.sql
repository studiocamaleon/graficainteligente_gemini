/*
  # Crear Categoría y Tablas para Productos de Sellos

  ## Descripción
  Esta migración crea la categoría "Sellos" y las tablas necesarias para gestionar
  productos de sellos, repuestos, polímeros, tintas y accesorios relacionados.

  ## Nueva Categoría
  - ID: 00000000-0000-0000-0000-000000000005
  - Nombre: Sellos
  - Descripción: Productos de sellos y accesorios
  - Color: #8B5CF6 (violeta)
  - Es categoría del sistema (is_system_category = true)

  ## Nueva Tabla: productos_sellos
  ### Campos Principales
  - `id` (uuid, primary key): Identificador único
  - `company_id` (uuid, foreign key): Empresa propietaria
  - `nombre` (text, required): Nombre del producto
  - `tipo_producto` (text, required): Tipo de producto (sello, repuesto, polimero, tinta, accesorios)
  - `impuesto_iva` (numeric, required): Impuesto IVA (10.5 o 21)
  - `ruta_produccion_id` (uuid, optional): Ruta de producción asignada
  - `is_active` (boolean): Estado del producto

  ### Campos Condicionales (según tipo_producto)
  - `tipo_sello` (text, optional): Manual o Automático (solo para tipo=sello)
  - `marca` (text, optional): Trodat, ColoP, Shiny (solo para tipo=sello)
  - `medida_ancho` (numeric, optional): Ancho en mm
  - `medida_alto` (numeric, optional): Alto en mm
  - `tipo_tinta` (text, optional): Textil o Papel (solo para tipo=tinta)

  ## Nueva Tabla: productos_sellos_precios
  ### Campos
  - `id` (uuid, primary key): Identificador único
  - `producto_id` (uuid, foreign key): Producto de sello
  - `precio_unitario` (numeric, required): Precio por unidad
  - `created_at`, `updated_at`: Timestamps

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Solo usuarios autenticados de la empresa propietaria pueden acceder

  ## Índices
  - Índices optimizados para búsquedas por company_id y tipo_producto
*/

-- =====================================================
-- INSERTAR CATEGORÍA SELLOS
-- =====================================================

INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  NULL,
  'Sellos',
  'Productos de sellos y accesorios',
  '#8B5CF6',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABLA PRINCIPAL: productos_sellos
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_sellos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_producto text NOT NULL,
  tipo_sello text,
  marca text,
  medida_ancho numeric,
  medida_alto numeric,
  tipo_tinta text,
  impuesto_iva numeric NOT NULL DEFAULT 21,
  ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_sellos_tipo_producto_valido
    CHECK (tipo_producto IN ('sello', 'repuesto', 'polimero', 'tinta', 'accesorios')),
  CONSTRAINT check_sellos_tipo_sello_valido
    CHECK (tipo_sello IS NULL OR tipo_sello IN ('manual', 'automatico')),
  CONSTRAINT check_sellos_marca_valida
    CHECK (marca IS NULL OR marca IN ('Trodat', 'ColoP', 'Shiny')),
  CONSTRAINT check_sellos_tipo_tinta_valido
    CHECK (tipo_tinta IS NULL OR tipo_tinta IN ('textil', 'papel')),
  CONSTRAINT check_sellos_impuesto_valido
    CHECK (impuesto_iva IN (10.5, 21)),
  CONSTRAINT check_sellos_medidas_positivas
    CHECK (medida_ancho IS NULL OR medida_ancho > 0),
  CONSTRAINT check_sellos_medidas_alto_positivas
    CHECK (medida_alto IS NULL OR medida_alto > 0),
  CONSTRAINT check_sellos_tipo_sello_condicional
    CHECK (
      (tipo_producto = 'sello' AND tipo_sello IS NOT NULL) OR
      (tipo_producto != 'sello' AND tipo_sello IS NULL)
    ),
  CONSTRAINT check_sellos_marca_condicional
    CHECK (
      (tipo_producto = 'sello' AND marca IS NOT NULL) OR
      (tipo_producto != 'sello' AND marca IS NULL)
    ),
  CONSTRAINT check_sellos_tipo_tinta_condicional
    CHECK (
      (tipo_producto = 'tinta' AND tipo_tinta IS NOT NULL) OR
      (tipo_producto != 'tinta' AND tipo_tinta IS NULL)
    )
);

-- =====================================================
-- TABLA: productos_sellos_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_sellos_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_sellos(id) ON DELETE CASCADE,
  precio_unitario numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_sellos_precio_positivo
    CHECK (precio_unitario > 0),
  CONSTRAINT unique_sellos_precio_producto
    UNIQUE(producto_id)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_sellos_company_id
  ON productos_sellos(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_sellos_tipo_producto
  ON productos_sellos(tipo_producto);

CREATE INDEX IF NOT EXISTS idx_productos_sellos_is_active
  ON productos_sellos(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_sellos_nombre
  ON productos_sellos(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_sellos_ruta
  ON productos_sellos(ruta_produccion_id);

CREATE INDEX IF NOT EXISTS idx_sellos_precios_producto_id
  ON productos_sellos_precios(producto_id);

-- =====================================================
-- ROW LEVEL SECURITY - productos_sellos
-- =====================================================

ALTER TABLE productos_sellos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company sellos products"
  ON productos_sellos FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own company sellos products"
  ON productos_sellos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own company sellos products"
  ON productos_sellos FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own company sellos products"
  ON productos_sellos FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- =====================================================
-- ROW LEVEL SECURITY - productos_sellos_precios
-- =====================================================

ALTER TABLE productos_sellos_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company sellos precios"
  ON productos_sellos_precios FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_sellos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company sellos precios"
  ON productos_sellos_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_sellos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company sellos precios"
  ON productos_sellos_precios FOR UPDATE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_sellos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_sellos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company sellos precios"
  ON productos_sellos_precios FOR DELETE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_sellos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_sellos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_sellos_updated_at
  BEFORE UPDATE ON productos_sellos
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_sellos_updated_at();

CREATE OR REPLACE FUNCTION update_productos_sellos_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_sellos_precios_updated_at
  BEFORE UPDATE ON productos_sellos_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_sellos_precios_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_sellos IS
  'Productos de sellos, repuestos, polímeros, tintas y accesorios relacionados.';

COMMENT ON COLUMN productos_sellos.tipo_producto IS
  'Tipo de producto: sello, repuesto, polimero, tinta, accesorios';

COMMENT ON COLUMN productos_sellos.tipo_sello IS
  'Tipo de sello: manual o automatico (solo para tipo_producto=sello)';

COMMENT ON COLUMN productos_sellos.marca IS
  'Marca del sello: Trodat, ColoP, Shiny (solo para tipo_producto=sello)';

COMMENT ON COLUMN productos_sellos.medida_ancho IS
  'Ancho del producto en milímetros';

COMMENT ON COLUMN productos_sellos.medida_alto IS
  'Alto del producto en milímetros';

COMMENT ON COLUMN productos_sellos.tipo_tinta IS
  'Tipo de tinta: textil o papel (solo para tipo_producto=tinta)';

COMMENT ON TABLE productos_sellos_precios IS
  'Precios unitarios para productos de sellos.';

COMMENT ON COLUMN productos_sellos_precios.precio_unitario IS
  'Precio por unidad del producto';