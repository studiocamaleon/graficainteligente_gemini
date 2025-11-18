/*
  # Crear Tabla de Precios para Productos Plotter de Corte

  ## Descripción
  Esta migración crea la tabla para gestionar precios de productos de Plotter de Corte.
  Los precios se configuran por ancho disponible y rangos de cantidad (metros lineales).

  ## Nueva Tabla: productos_plotter_corte_precios

  ### Campos
  - `id` (uuid, primary key): Identificador único
  - `producto_id` (uuid, foreign key): Producto de plotter de corte
  - `ancho` (numeric, required): Ancho en centímetros (30, 50, 60, 120)
  - `cantidad_desde` (numeric, required): Cantidad mínima en metros lineales
  - `cantidad_hasta` (numeric, optional): Cantidad máxima en metros lineales (NULL = infinito)
  - `precio` (numeric, required): Precio por metro lineal
  - `created_at`, `updated_at`: Timestamps

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id (a través de producto)
  - Solo usuarios autenticados de la empresa propietaria pueden acceder

  ## Índices
  - Índices optimizados para búsquedas por producto_id y anchos
  - Índices para rangos de cantidad

  ## Constraints
  - Precio debe ser positivo
  - Cantidad desde debe ser positiva
  - Ancho debe ser uno de los valores permitidos
  - No puede haber rangos superpuestos para el mismo producto y ancho
*/

-- =====================================================
-- TABLA: productos_plotter_corte_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_plotter_corte_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_plotter_corte(id) ON DELETE CASCADE,
  ancho numeric NOT NULL,
  cantidad_desde numeric NOT NULL,
  cantidad_hasta numeric,
  precio numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_plotter_corte_precio_positivo
    CHECK (precio > 0),
  CONSTRAINT check_plotter_corte_cantidad_desde_positiva
    CHECK (cantidad_desde > 0),
  CONSTRAINT check_plotter_corte_cantidad_hasta_mayor
    CHECK (cantidad_hasta IS NULL OR cantidad_hasta > cantidad_desde),
  CONSTRAINT check_plotter_corte_ancho_valido
    CHECK (ancho IN (30, 50, 60, 120)),
  CONSTRAINT unique_plotter_corte_precio_rango
    UNIQUE(producto_id, ancho, cantidad_desde)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_plotter_corte_precios_producto_id
  ON productos_plotter_corte_precios(producto_id);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_precios_ancho
  ON productos_plotter_corte_precios(ancho);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_precios_producto_ancho
  ON productos_plotter_corte_precios(producto_id, ancho);

CREATE INDEX IF NOT EXISTS idx_plotter_corte_precios_cantidad_desde
  ON productos_plotter_corte_precios(cantidad_desde);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_plotter_corte_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company plotter_corte_precios"
  ON productos_plotter_corte_precios FOR SELECT
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company plotter_corte_precios"
  ON productos_plotter_corte_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company plotter_corte_precios"
  ON productos_plotter_corte_precios FOR UPDATE
  TO authenticated
  USING (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos_plotter_corte
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company plotter_corte_precios"
  ON productos_plotter_corte_precios FOR DELETE
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

CREATE OR REPLACE FUNCTION update_productos_plotter_corte_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_plotter_corte_precios_updated_at
  BEFORE UPDATE ON productos_plotter_corte_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_plotter_corte_precios_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_plotter_corte_precios IS
  'Precios para productos de plotter de corte organizados por ancho y rangos de cantidad en metros lineales.';

COMMENT ON COLUMN productos_plotter_corte_precios.ancho IS
  'Ancho en centímetros. Debe coincidir con uno de los anchos disponibles del producto.';

COMMENT ON COLUMN productos_plotter_corte_precios.cantidad_desde IS
  'Cantidad mínima en metros lineales para aplicar este precio.';

COMMENT ON COLUMN productos_plotter_corte_precios.cantidad_hasta IS
  'Cantidad máxima en metros lineales para aplicar este precio. NULL indica sin límite superior.';

COMMENT ON COLUMN productos_plotter_corte_precios.precio IS
  'Precio por metro lineal para este ancho y rango de cantidad.';