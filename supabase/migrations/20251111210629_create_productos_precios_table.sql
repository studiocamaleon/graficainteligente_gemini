/*
  # Creación de Tabla para Gestión de Precios de Productos

  ## Descripción
  Este migration crea la tabla `productos_precios` que almacena los precios de venta
  para cada producto según sus diferentes combinaciones de tecnología, tipo de tinta,
  cara de impresión y cantidad.

  ## Nueva Tabla

  ### productos_precios
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `producto_id` (uuid, foreign key to productos)
  - `tecnologia_id` (uuid, foreign key to tecnologias, nullable para productos sin impresión)
  - `tipo_tinta` (text, nullable - valores: 'K', 'CMYK', etc.)
  - `cara_impresion` (text, nullable - valores: 'solo_frente', 'frente_y_dorso')
  - `cantidad` (numeric, required - cantidad específica para este precio)
  - `precio_venta` (numeric, required - precio de venta para esta combinación)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Restricciones
  - Constraint único para evitar duplicados de combinación producto-tecnologia-tinta-cara-cantidad
  - Check constraint para asegurar que precio_venta y cantidad sean positivos

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índice compuesto en (producto_id, tecnologia_id, tipo_tinta, cara_impresion, cantidad)
  - Índices en company_id y producto_id para optimizar consultas
*/

-- =====================================================
-- TABLA PRODUCTOS_PRECIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tecnologia_id uuid REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tipo_tinta text,
  cara_impresion text,
  cantidad numeric NOT NULL,
  precio_venta numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_precio_positivo CHECK (precio_venta >= 0),
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_cara_impresion_valida CHECK (
    cara_impresion IS NULL OR
    cara_impresion IN ('solo_frente', 'frente_y_dorso')
  ),
  CONSTRAINT unique_precio_combinacion UNIQUE NULLS NOT DISTINCT (
    producto_id,
    tecnologia_id,
    tipo_tinta,
    cara_impresion,
    cantidad
  )
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_precios_company_id
  ON productos_precios(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_precios_producto_id
  ON productos_precios(producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_precios_tecnologia_id
  ON productos_precios(tecnologia_id);

CREATE INDEX IF NOT EXISTS idx_productos_precios_combinacion
  ON productos_precios(producto_id, tecnologia_id, tipo_tinta, cara_impresion, cantidad);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_precios"
  ON productos_precios FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_precios"
  ON productos_precios FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_precios"
  ON productos_precios FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_precios"
  ON productos_precios FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_precios_updated_at
  BEFORE UPDATE ON productos_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_precios_updated_at();
