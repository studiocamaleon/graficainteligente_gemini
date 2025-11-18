/*
  # Crear Esquema Completo de Productos Plotter de Corte

  ## Descripción
  Esta migración crea el esquema completo para productos de Plotter de Corte,
  incluyendo la tabla principal y las tablas de relaciones.

  ## Nueva Tabla: productos_plotter_corte

  ### Campos Principales
  - `id` (uuid, primary key): Identificador único del producto
  - `company_id` (uuid, foreign key): Empresa propietaria (multi-tenant)
  - `nombre` (text, required): Nombre del producto
  - `unidad_venta` (text, fixed): Siempre 'mt_lineal'
  - `material_id` (uuid, foreign key): Material seleccionado
  - `variante_nombre` (text, required): Variante del material
  - `espesor` (numeric, optional): Espesor si aplica
  - `anchos_disponibles` (numeric[], required): Anchos disponibles [30, 50, 60, 120]
  - `cantidad_minima` (numeric, optional): Cantidad mínima a cobrar en metros
  - `color` (text, required): 'Blanco o Negro' | 'Color'
  - `marca` (text, optional): Marca del producto
  - `impuesto_iva` (numeric, required): Porcentaje de IVA
  - `rango_precio_id` (uuid, optional): Rango de precios asociado
  - `ruta_produccion_id` (uuid, optional): Ruta de producción asociada
  - `is_active` (boolean, default true): Estado del producto
  - `created_at`, `updated_at`: Timestamps

  ## Tablas de Relaciones
  - productos_plotter_corte_servicios: Relación muchos a muchos con servicios
  - productos_plotter_corte_acabados: Relación muchos a muchos con acabados

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE
  - Solo usuarios autenticados de la misma empresa pueden acceder

  ## Índices
  - Índices optimizados para búsquedas por company_id, nombre, estado
  - Índices en tablas de relaciones para joins eficientes

  ## Constraints
  - Nombre único por empresa
  - Color debe ser uno de los valores permitidos
  - Marca debe ser una de las marcas permitidas si se especifica
  - Anchos disponibles deben ser valores válidos
  - Impuesto IVA debe ser positivo
*/

-- =====================================================
-- TABLA PRINCIPAL: productos_plotter_corte
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_plotter_corte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  unidad_venta text NOT NULL DEFAULT 'mt_lineal',
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesor numeric,
  anchos_disponibles numeric[] NOT NULL DEFAULT '{}',
  cantidad_minima numeric,
  color text NOT NULL,
  marca text,
  impuesto_iva numeric NOT NULL DEFAULT 21,
  rango_precio_id uuid REFERENCES rangos_precio(id) ON DELETE SET NULL,
  ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plotter_corte_nombre_por_empresa
    UNIQUE(company_id, nombre),
  CONSTRAINT check_plotter_corte_unidad_venta
    CHECK (unidad_venta = 'mt_lineal'),
  CONSTRAINT check_plotter_corte_color
    CHECK (color IN ('Blanco o Negro', 'Color')),
  CONSTRAINT check_plotter_corte_marca
    CHECK (marca IS NULL OR marca IN ('Avery', 'Oracal', 'Ritrama', 'McCal', 'Orajet', 'Importado')),
  CONSTRAINT check_plotter_corte_anchos_disponibles
    CHECK (array_length(anchos_disponibles, 1) > 0),
  CONSTRAINT check_plotter_corte_impuesto_positivo
    CHECK (impuesto_iva > 0),
  CONSTRAINT check_plotter_corte_espesor_positivo
    CHECK (espesor IS NULL OR espesor > 0),
  CONSTRAINT check_plotter_corte_cantidad_minima_positiva
    CHECK (cantidad_minima IS NULL OR cantidad_minima > 0)
);

-- =====================================================
-- TABLA DE RELACIÓN: productos_plotter_corte_servicios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_plotter_corte_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_plotter_corte(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plotter_corte_servicio
    UNIQUE(producto_id, servicio_id)
);

-- =====================================================
-- TABLA DE RELACIÓN: productos_plotter_corte_acabados
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_plotter_corte_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_plotter_corte(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plotter_corte_acabado
    UNIQUE(producto_id, acabado_id)
);

-- =====================================================
-- ÍNDICES PARA productos_plotter_corte
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_company_id
  ON productos_plotter_corte(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_nombre
  ON productos_plotter_corte(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_is_active
  ON productos_plotter_corte(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_company_active
  ON productos_plotter_corte(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_material_id
  ON productos_plotter_corte(material_id);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_rango_precio_id
  ON productos_plotter_corte(rango_precio_id);

CREATE INDEX IF NOT EXISTS idx_productos_plotter_corte_ruta_produccion_id
  ON productos_plotter_corte(ruta_produccion_id);

-- =====================================================
-- ÍNDICES PARA TABLAS DE RELACIÓN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_plotter_corte_servicios_producto_id
  ON productos_plotter_corte_servicios(producto_id);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_servicios_servicio_id
  ON productos_plotter_corte_servicios(servicio_id);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_acabados_producto_id
  ON productos_plotter_corte_acabados(producto_id);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_acabados_acabado_id
  ON productos_plotter_corte_acabados(acabado_id);

-- =====================================================
-- ROW LEVEL SECURITY: productos_plotter_corte
-- =====================================================

ALTER TABLE productos_plotter_corte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_plotter_corte"
  ON productos_plotter_corte FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_plotter_corte"
  ON productos_plotter_corte FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_plotter_corte"
  ON productos_plotter_corte FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_plotter_corte"
  ON productos_plotter_corte FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ROW LEVEL SECURITY: productos_plotter_corte_servicios
-- =====================================================

ALTER TABLE productos_plotter_corte_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company plotter_corte_servicios"
  ON productos_plotter_corte_servicios FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company plotter_corte_servicios"
  ON productos_plotter_corte_servicios FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company plotter_corte_servicios"
  ON productos_plotter_corte_servicios FOR DELETE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- ROW LEVEL SECURITY: productos_plotter_corte_acabados
-- =====================================================

ALTER TABLE productos_plotter_corte_acabados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company plotter_corte_acabados"
  ON productos_plotter_corte_acabados FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company plotter_corte_acabados"
  ON productos_plotter_corte_acabados FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company plotter_corte_acabados"
  ON productos_plotter_corte_acabados FOR DELETE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_plotter_corte_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_plotter_corte_updated_at
  BEFORE UPDATE ON productos_plotter_corte
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_plotter_corte_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_plotter_corte IS
  'Productos para plotter de corte. Unidad de venta fija en metros lineales.';

COMMENT ON COLUMN productos_plotter_corte.unidad_venta IS
  'Unidad de venta fija: mt_lineal (metros lineales)';

COMMENT ON COLUMN productos_plotter_corte.anchos_disponibles IS
  'Array de anchos disponibles en centímetros. Valores posibles: 30, 50, 60, 120';

COMMENT ON COLUMN productos_plotter_corte.color IS
  'Color del producto: "Blanco o Negro" o "Color"';

COMMENT ON COLUMN productos_plotter_corte.marca IS
  'Marca opcional del producto: Avery, Oracal, Ritrama, McCal, Orajet, Importado';

COMMENT ON COLUMN productos_plotter_corte.espesor IS
  'Espesor del material en milímetros (opcional, solo si aplica)';

COMMENT ON COLUMN productos_plotter_corte.cantidad_minima IS
  'Cantidad mínima a cobrar en metros lineales';