/*
  # Crear Tabla de Precios para Productos Portabanners

  ## Descripción
  Esta migración crea la tabla de precios para productos portabanners,
  permitiendo almacenar precios base por combinación de producto, medida y rango de cantidad.

  ## Nueva Tabla: productos_portabanners_precios

  ### Campos
  - `id` (uuid, primary key) - Identificador único del precio
  - `company_id` (uuid, FK a companies) - Empresa propietaria
  - `producto_id` (uuid, FK a productos_portabanners) - Producto al que pertenece
  - `ancho_cm` (numeric) - Ancho en centímetros del producto
  - `alto_cm` (numeric) - Alto en centímetros del producto
  - `cantidad_desde` (numeric) - Cantidad mínima del rango
  - `cantidad_hasta` (numeric, nullable) - Cantidad máxima del rango (null = infinito)
  - `precio` (numeric) - Precio unitario para esta configuración
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad
  - RLS habilitado basado en company_id del usuario autenticado
  - Políticas restrictivas para SELECT, INSERT, UPDATE, DELETE
  - Validación de integridad referencial con CASCADE en deletes

  ## Índices
  - Índices en company_id para optimizar queries por empresa
  - Índices en producto_id para búsquedas por producto
  - Índice compuesto para búsquedas complejas

  ## Validaciones
  - Precios deben ser positivos
  - Cantidades deben ser positivas
  - Medidas deben ser positivas
  - Constraint de unicidad para evitar duplicados en configuración
*/

-- =====================================================
-- 1. TABLA PRINCIPAL: productos_portabanners_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_portabanners_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos_portabanners(id) ON DELETE CASCADE,
  ancho_cm numeric NOT NULL,
  alto_cm numeric NOT NULL,
  cantidad_desde numeric NOT NULL,
  cantidad_hasta numeric,
  precio numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_portabanners_precio_positivo
    CHECK (precio >= 0),
  CONSTRAINT check_portabanners_cantidad_desde_positiva
    CHECK (cantidad_desde > 0),
  CONSTRAINT check_portabanners_cantidad_hasta_valida
    CHECK (cantidad_hasta IS NULL OR cantidad_hasta >= cantidad_desde),
  CONSTRAINT check_portabanners_ancho_positivo
    CHECK (ancho_cm > 0),
  CONSTRAINT check_portabanners_alto_positivo
    CHECK (alto_cm > 0),
  CONSTRAINT unique_portabanners_precio_configuracion
    UNIQUE (
      producto_id,
      ancho_cm,
      alto_cm,
      cantidad_desde,
      cantidad_hasta
    )
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_portabanners_precios_company
  ON productos_portabanners_precios(company_id);

CREATE INDEX IF NOT EXISTS idx_portabanners_precios_producto
  ON productos_portabanners_precios(producto_id);

CREATE INDEX IF NOT EXISTS idx_portabanners_precios_medidas
  ON productos_portabanners_precios(ancho_cm, alto_cm);

CREATE INDEX IF NOT EXISTS idx_portabanners_precios_rangos
  ON productos_portabanners_precios(cantidad_desde, cantidad_hasta);

CREATE INDEX IF NOT EXISTS idx_portabanners_precios_lookup
  ON productos_portabanners_precios(
    producto_id,
    ancho_cm,
    alto_cm
  );

COMMENT ON TABLE productos_portabanners_precios IS
  'Almacena los precios para productos portabanners por combinación de producto, medidas y rango de cantidad';

COMMENT ON COLUMN productos_portabanners_precios.ancho_cm IS
  'Ancho del portabanner en centímetros';

COMMENT ON COLUMN productos_portabanners_precios.alto_cm IS
  'Alto del portabanner en centímetros';

COMMENT ON COLUMN productos_portabanners_precios.cantidad_desde IS
  'Cantidad mínima del rango (unidades)';

COMMENT ON COLUMN productos_portabanners_precios.cantidad_hasta IS
  'Cantidad máxima del rango (unidades). NULL indica infinito';

-- =====================================================
-- 3. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_portabanners_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_portabanners_precios_timestamp
  BEFORE UPDATE ON productos_portabanners_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_portabanners_precios_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_portabanners_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prices from their company"
  ON productos_portabanners_precios FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert prices for their company"
  ON productos_portabanners_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update prices from their company"
  ON productos_portabanners_precios FOR UPDATE
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

CREATE POLICY "Users can delete prices from their company"
  ON productos_portabanners_precios FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
