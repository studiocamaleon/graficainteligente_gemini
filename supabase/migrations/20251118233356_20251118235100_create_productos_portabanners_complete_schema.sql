/*
  # Crear Sistema Completo de Productos Portabanners

  ## Descripción
  Esta migración crea el esquema completo para el módulo de Productos Portabanners,
  incluyendo la tabla principal y todas sus tablas de relaciones.

  ## Nuevas Tablas

  ### 1. productos_portabanners
  Tabla principal de productos portabanners
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK a companies)
  - `nombre` (text, nombre del producto)
  - `ancho_cm` (numeric, ancho en centímetros)
  - `alto_cm` (numeric, alto en centímetros)
  - `tecnologia_id` (uuid, FK a tecnologias)
  - `tintas` (text[], array de tintas seleccionadas según tecnología)
  - `impuesto_iva` (decimal, porcentaje de IVA a aplicar)
  - `rango_precio_id` (uuid, FK a rangos_precio, nullable)
  - `ruta_produccion_id` (uuid, FK a rutas_produccion, nullable)
  - `is_active` (boolean, estado activo/inactivo)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos_portabanners_servicios
  Relación entre productos portabanners y servicios adicionales
  - `id` (uuid, primary key)
  - `producto_id` (uuid, FK a productos_portabanners)
  - `servicio_id` (uuid, FK a servicios)
  - `created_at` (timestamptz)

  ### 3. productos_portabanners_acabados
  Relación entre productos portabanners y acabados
  - `id` (uuid, primary key)
  - `producto_id` (uuid, FK a productos_portabanners)
  - `acabado_id` (uuid, FK a acabados)
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
-- 1. TABLA PRINCIPAL: productos_portabanners
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_portabanners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  ancho_cm numeric NOT NULL,
  alto_cm numeric NOT NULL,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas text[] NOT NULL DEFAULT ARRAY[]::text[],
  impuesto_iva numeric NOT NULL DEFAULT 21,
  rango_precio_id uuid REFERENCES rangos_precio(id) ON DELETE SET NULL,
  ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_portabanner_nombre_por_empresa
    UNIQUE(company_id, nombre),
  CONSTRAINT check_portabanner_ancho_positivo
    CHECK (ancho_cm > 0),
  CONSTRAINT check_portabanner_alto_positivo
    CHECK (alto_cm > 0),
  CONSTRAINT check_portabanner_impuesto_positivo
    CHECK (impuesto_iva >= 0 AND impuesto_iva <= 100),
  CONSTRAINT check_portabanner_tintas_no_vacio
    CHECK (array_length(tintas, 1) > 0)
);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_company_id
  ON productos_portabanners(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_nombre
  ON productos_portabanners(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_is_active
  ON productos_portabanners(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_company_active
  ON productos_portabanners(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_tecnologia_id
  ON productos_portabanners(tecnologia_id);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_rango_precio_id
  ON productos_portabanners(rango_precio_id);

CREATE INDEX IF NOT EXISTS idx_productos_portabanners_ruta_produccion_id
  ON productos_portabanners(ruta_produccion_id);

COMMENT ON TABLE productos_portabanners IS
  'Productos de portabanners con medidas personalizadas (ancho x alto) y tecnología de impresión';

COMMENT ON COLUMN productos_portabanners.ancho_cm IS
  'Ancho del portabanner en centímetros';

COMMENT ON COLUMN productos_portabanners.alto_cm IS
  'Alto del portabanner en centímetros';

COMMENT ON COLUMN productos_portabanners.tintas IS
  'Array de tintas seleccionadas para la tecnología de impresión (ej: CMYK, K, CMYK+W)';

-- =====================================================
-- 2. TABLA DE RELACIÓN: productos_portabanners_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_portabanners_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_portabanners(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_portabanner_servicio
    UNIQUE(producto_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_portabanners_servicios_producto_id
  ON productos_portabanners_servicios(producto_id);

CREATE INDEX IF NOT EXISTS idx_portabanners_servicios_servicio_id
  ON productos_portabanners_servicios(servicio_id);

COMMENT ON TABLE productos_portabanners_servicios IS
  'Relación entre productos portabanners y servicios adicionales';

-- =====================================================
-- 3. TABLA DE RELACIÓN: productos_portabanners_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_portabanners_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_portabanners(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_portabanner_acabado
    UNIQUE(producto_id, acabado_id)
);

CREATE INDEX IF NOT EXISTS idx_portabanners_acabados_producto_id
  ON productos_portabanners_acabados(producto_id);

CREATE INDEX IF NOT EXISTS idx_portabanners_acabados_acabado_id
  ON productos_portabanners_acabados(acabado_id);

COMMENT ON TABLE productos_portabanners_acabados IS
  'Relación entre productos portabanners y acabados adicionales';

-- =====================================================
-- 4. TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_portabanners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_portabanners_updated_at
  BEFORE UPDATE ON productos_portabanners
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_portabanners_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY: productos_portabanners
-- =====================================================

ALTER TABLE productos_portabanners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_portabanners"
  ON productos_portabanners FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_portabanners"
  ON productos_portabanners FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_portabanners"
  ON productos_portabanners FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_portabanners"
  ON productos_portabanners FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- 6. ROW LEVEL SECURITY: productos_portabanners_servicios
-- =====================================================

ALTER TABLE productos_portabanners_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company portabanners_servicios"
  ON productos_portabanners_servicios FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company portabanners_servicios"
  ON productos_portabanners_servicios FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company portabanners_servicios"
  ON productos_portabanners_servicios FOR DELETE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- 7. ROW LEVEL SECURITY: productos_portabanners_acabados
-- =====================================================

ALTER TABLE productos_portabanners_acabados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company portabanners_acabados"
  ON productos_portabanners_acabados FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company portabanners_acabados"
  ON productos_portabanners_acabados FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company portabanners_acabados"
  ON productos_portabanners_acabados FOR DELETE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_portabanners
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
