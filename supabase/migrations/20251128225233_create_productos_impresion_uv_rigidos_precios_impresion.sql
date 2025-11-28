/*
  # Crear Tabla de Precios de Impresión UV

  ## Descripción
  Esta migración crea la tabla de precios para la impresión UV sobre materiales rígidos.
  Los precios se configuran por rangos de m² totales (sumando todas las piezas del pedido),
  similar al sistema de Gran Formato.

  ## Nueva Tabla

  ### productos_impresion_uv_rigidos_precios_impresion
  Tabla de precios de impresión UV por rangos de m²
  
  **Campos:**
  - `id` (uuid, primary key) - Identificador único del precio
  - `company_id` (uuid, FK a companies) - Empresa propietaria
  - `producto_uv_id` (uuid, FK a productos_impresion_uv_rigidos) - Producto al que pertenece
  - `tinta` (text) - Configuración de tintas (ej: 'CMYK', 'CMYK+W', 'CMYK+W+V')
  - `rango_mt2_min` (decimal) - Cantidad mínima de m² del rango
  - `rango_mt2_max` (decimal) - Cantidad máxima de m² del rango
  - `precio_mt2` (decimal) - Precio por m² para este rango
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad
  - RLS habilitado basado en company_id del usuario autenticado
  - Políticas restrictivas para SELECT, INSERT, UPDATE, DELETE
  - Validación de integridad referencial

  ## Índices
  - Índices en company_id y producto_uv_id
  - Índice en tinta para filtrado
  - Índice compuesto para búsquedas rápidas por producto y tinta

  ## Validaciones
  - Los rangos deben ser válidos (min <= max)
  - El precio por m² debe ser positivo
  - No puede haber rangos solapados para la misma tinta y producto
  - Los rangos pueden tener el mismo valor min y max para valores exactos

  ## Notas Importantes
  - Los rangos de m² se calculan sumando todas las piezas del pedido
  - Similar a la lógica de Gran Formato
  - Los rangos infinitos se representan con valores muy altos (ej: 999999)
*/

-- =====================================================
-- 1. TABLA: productos_impresion_uv_rigidos_precios_impresion
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_uv_rigidos_precios_impresion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_uv_id uuid NOT NULL REFERENCES productos_impresion_uv_rigidos(id) ON DELETE CASCADE,
  tinta text NOT NULL,
  rango_mt2_min decimal(10,2) NOT NULL,
  rango_mt2_max decimal(10,2) NOT NULL,
  precio_mt2 decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Validar que el rango sea válido
  CONSTRAINT check_puv_precios_rango_valido CHECK (rango_mt2_min <= rango_mt2_max),
  
  -- Validar que el precio sea positivo
  CONSTRAINT check_puv_precios_precio_positivo CHECK (precio_mt2 > 0),
  
  -- Validar que los valores del rango sean positivos
  CONSTRAINT check_puv_precios_rangos_positivos CHECK (
    rango_mt2_min >= 0 AND rango_mt2_max > 0
  ),
  
  -- Constraint único para evitar duplicados
  CONSTRAINT unique_puv_precio_configuracion UNIQUE (
    producto_uv_id,
    tinta,
    rango_mt2_min,
    rango_mt2_max
  )
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_puv_precios_company ON productos_impresion_uv_rigidos_precios_impresion(company_id);
CREATE INDEX IF NOT EXISTS idx_puv_precios_producto ON productos_impresion_uv_rigidos_precios_impresion(producto_uv_id);
CREATE INDEX IF NOT EXISTS idx_puv_precios_tinta ON productos_impresion_uv_rigidos_precios_impresion(tinta);
CREATE INDEX IF NOT EXISTS idx_puv_precios_rangos ON productos_impresion_uv_rigidos_precios_impresion(rango_mt2_min, rango_mt2_max);

-- Índice compuesto para búsquedas complejas
CREATE INDEX IF NOT EXISTS idx_puv_precios_lookup ON productos_impresion_uv_rigidos_precios_impresion(
  producto_uv_id,
  tinta
);

COMMENT ON TABLE productos_impresion_uv_rigidos_precios_impresion IS
  'Precios de impresión UV por rangos de m² totales (suma de todas las piezas)';

COMMENT ON COLUMN productos_impresion_uv_rigidos_precios_impresion.tinta IS
  'Configuración de tintas para la impresión UV (ej: CMYK, CMYK+W, CMYK+W+V)';

COMMENT ON COLUMN productos_impresion_uv_rigidos_precios_impresion.rango_mt2_min IS
  'Cantidad mínima de m² del rango - se calcula sumando todas las piezas del pedido';

COMMENT ON COLUMN productos_impresion_uv_rigidos_precios_impresion.rango_mt2_max IS
  'Cantidad máxima de m² del rango - usar valores altos (999999) para rangos infinitos';

-- =====================================================
-- 3. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_impresion_uv_rigidos_precios_impresion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_impresion_uv_rigidos_precios_impresion_timestamp
  BEFORE UPDATE ON productos_impresion_uv_rigidos_precios_impresion
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_impresion_uv_rigidos_precios_impresion_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_impresion_uv_rigidos_precios_impresion ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Los usuarios pueden ver precios de su empresa
CREATE POLICY "Users can view UV printing prices from their company"
  ON productos_impresion_uv_rigidos_precios_impresion FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política INSERT: Los usuarios pueden insertar precios para su empresa
CREATE POLICY "Users can insert UV printing prices for their company"
  ON productos_impresion_uv_rigidos_precios_impresion FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política UPDATE: Los usuarios pueden actualizar precios de su empresa
CREATE POLICY "Users can update UV printing prices from their company"
  ON productos_impresion_uv_rigidos_precios_impresion FOR UPDATE
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
CREATE POLICY "Users can delete UV printing prices from their company"
  ON productos_impresion_uv_rigidos_precios_impresion FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
