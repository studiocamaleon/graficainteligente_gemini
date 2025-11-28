/*
  # Crear Tabla de Materiales para Productos UV sobre Rígidos

  ## Descripción
  Esta migración crea la tabla que vincula productos de Impresión UV con materiales rígidos del catálogo.
  Permite especificar qué materiales están disponibles para cada producto UV y almacenar información
  de dimensiones y variantes de cada material.

  ## Nueva Tabla

  ### productos_impresion_uv_rigidos_materiales
  Tabla de relación N:M entre productos UV y materiales del catálogo
  
  **Campos:**
  - `id` (uuid, primary key) - Identificador único de la relación
  - `company_id` (uuid, FK a companies) - Empresa propietaria
  - `producto_uv_id` (uuid, FK a productos_impresion_uv_rigidos) - Producto UV al que pertenece
  - `material_id` (uuid, FK a materiales) - Material del catálogo disponible
  - `variante_nombre` (text) - Nombre de la variante del material (ej: "Blanco", "Transparente")
  - `espesor_mm` (decimal, nullable) - Espesor del material en milímetros
  - `ancho_placa_cm` (decimal) - Ancho de la placa del material en cm
  - `alto_placa_cm` (decimal) - Alto de la placa del material en cm
  - `precio_placa` (decimal) - Precio de la placa completa del material
  - `precio_mt2` (decimal) - Precio por m² calculado automáticamente
  - `is_active` (boolean) - Estado activo/inactivo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad
  - RLS habilitado basado en company_id del usuario autenticado
  - Políticas restrictivas para SELECT, INSERT, UPDATE, DELETE
  - Validación de integridad referencial

  ## Índices
  - Índices en company_id, producto_uv_id y material_id
  - Índice compuesto para búsquedas por producto

  ## Validaciones
  - Dimensiones de placa deben ser positivas
  - Precios deben ser positivos
  - No puede haber duplicados (mismo producto + material + variante + espesor)

  ## Triggers
  - Cálculo automático de precio_mt2 basado en dimensiones y precio_placa
*/

-- =====================================================
-- 1. TABLA: productos_impresion_uv_rigidos_materiales
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_uv_rigidos_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_uv_id uuid NOT NULL REFERENCES productos_impresion_uv_rigidos(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesor_mm decimal(10,2),
  ancho_placa_cm decimal(10,2) NOT NULL,
  alto_placa_cm decimal(10,2) NOT NULL,
  precio_placa decimal(10,2) NOT NULL,
  precio_mt2 decimal(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Validar que las dimensiones sean positivas
  CONSTRAINT check_puv_mat_dimensiones_positivas CHECK (
    ancho_placa_cm > 0 AND alto_placa_cm > 0
  ),
  
  -- Validar que los precios sean positivos
  CONSTRAINT check_puv_mat_precios_positivos CHECK (
    precio_placa > 0 AND precio_mt2 > 0
  ),
  
  -- Validar que el espesor sea positivo si se especifica
  CONSTRAINT check_puv_mat_espesor_positivo CHECK (
    espesor_mm IS NULL OR espesor_mm > 0
  ),
  
  -- Constraint único: no puede haber el mismo material con misma variante y espesor para un producto
  CONSTRAINT unique_puv_material_variante UNIQUE (
    producto_uv_id, 
    material_id, 
    variante_nombre, 
    espesor_mm
  )
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_puv_mat_company ON productos_impresion_uv_rigidos_materiales(company_id);
CREATE INDEX IF NOT EXISTS idx_puv_mat_producto ON productos_impresion_uv_rigidos_materiales(producto_uv_id);
CREATE INDEX IF NOT EXISTS idx_puv_mat_material ON productos_impresion_uv_rigidos_materiales(material_id);
CREATE INDEX IF NOT EXISTS idx_puv_mat_is_active ON productos_impresion_uv_rigidos_materiales(is_active);

-- Índice compuesto para búsquedas por producto activo
CREATE INDEX IF NOT EXISTS idx_puv_mat_producto_active ON productos_impresion_uv_rigidos_materiales(producto_uv_id, is_active);

COMMENT ON TABLE productos_impresion_uv_rigidos_materiales IS
  'Materiales del catálogo disponibles para productos de Impresión UV sobre Rígidos';

COMMENT ON COLUMN productos_impresion_uv_rigidos_materiales.variante_nombre IS
  'Nombre de la variante del material (ej: Blanco, Transparente, Negro)';

COMMENT ON COLUMN productos_impresion_uv_rigidos_materiales.precio_mt2 IS
  'Precio por metro cuadrado calculado automáticamente: precio_placa / ((ancho * alto) / 10000)';

-- =====================================================
-- 3. FUNCIÓN: Calcular precio por m² automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_precio_mt2_uv_material()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular m² de la placa: (ancho_cm * alto_cm) / 10000
  -- Luego calcular precio por m²: precio_placa / m²_placa
  NEW.precio_mt2 = NEW.precio_placa / ((NEW.ancho_placa_cm * NEW.alto_placa_cm) / 10000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calcular_precio_mt2_uv_material_trigger
  BEFORE INSERT OR UPDATE ON productos_impresion_uv_rigidos_materiales
  FOR EACH ROW
  EXECUTE FUNCTION calcular_precio_mt2_uv_material();

-- =====================================================
-- 4. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_impresion_uv_rigidos_materiales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_impresion_uv_rigidos_materiales_timestamp
  BEFORE UPDATE ON productos_impresion_uv_rigidos_materiales
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_impresion_uv_rigidos_materiales_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_impresion_uv_rigidos_materiales ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Los usuarios pueden ver materiales de su empresa
CREATE POLICY "Users can view UV materials from their company"
  ON productos_impresion_uv_rigidos_materiales FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política INSERT: Los usuarios pueden insertar materiales para su empresa
CREATE POLICY "Users can insert UV materials for their company"
  ON productos_impresion_uv_rigidos_materiales FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política UPDATE: Los usuarios pueden actualizar materiales de su empresa
CREATE POLICY "Users can update UV materials from their company"
  ON productos_impresion_uv_rigidos_materiales FOR UPDATE
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

-- Política DELETE: Los usuarios pueden eliminar materiales de su empresa
CREATE POLICY "Users can delete UV materials from their company"
  ON productos_impresion_uv_rigidos_materiales FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
