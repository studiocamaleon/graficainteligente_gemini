/*
  # Crear Tabla de Precios para Productos de Materiales Rígidos

  ## Descripción
  Esta migración crea el sistema de precios para productos de materiales rígidos.
  Los materiales rígidos se compran en placas de distintas medidas y se venden por m².

  ## Nueva Tabla

  ### productos_materiales_rigidos_precios
  Tabla de precios para productos de materiales rígidos
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK a companies)
  - `producto_materiales_rigidos_id` (uuid, FK a productos_materiales_rigidos)
  - `material_id` (uuid, FK a materiales, para facilitar agrupamiento)
  - `variante_nombre` (text, nombre de la variante del material)
  - `espesores` (decimal[], espesores del producto)
  - `medida_placa_ancho` (decimal, ancho de la placa en cm)
  - `medida_placa_alto` (decimal, alto de la placa en cm)
  - `precio_placa` (decimal, precio de venta de la placa completa)
  - `precio_mt2` (decimal, precio por metro cuadrado calculado)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Políticas basadas en company_id del usuario autenticado
  - Validaciones de integridad referencial

  ## Índices
  - Índices en company_id, producto_materiales_rigidos_id y material_id
  - Índice compuesto para búsquedas rápidas por empresa y producto

  ## Notas Importantes
  - El precio_mt2 se calcula automáticamente: precio_placa / ((ancho * alto) / 10000)
  - Solo puede existir un precio por producto (constraint unique)
  - Las medidas se copian desde el producto para facilitar consultas
*/

-- =====================================================
-- 1. TABLA: productos_materiales_rigidos_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_rigidos_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_materiales_rigidos_id uuid NOT NULL REFERENCES productos_materiales_rigidos(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesores decimal[] NOT NULL DEFAULT ARRAY[]::decimal[],
  medida_placa_ancho decimal(10,2) NOT NULL,
  medida_placa_alto decimal(10,2) NOT NULL,
  precio_placa decimal(10,2) NOT NULL,
  precio_mt2 decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_precio_por_producto_mr UNIQUE (company_id, producto_materiales_rigidos_id),
  CONSTRAINT check_pmr_precios_medidas_positivas CHECK (medida_placa_ancho > 0 AND medida_placa_alto > 0),
  CONSTRAINT check_pmr_precios_precio_placa_positivo CHECK (precio_placa > 0),
  CONSTRAINT check_pmr_precios_precio_mt2_positivo CHECK (precio_mt2 > 0)
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_pmr_precios_company ON productos_materiales_rigidos_precios(company_id);
CREATE INDEX IF NOT EXISTS idx_pmr_precios_producto ON productos_materiales_rigidos_precios(producto_materiales_rigidos_id);
CREATE INDEX IF NOT EXISTS idx_pmr_precios_material ON productos_materiales_rigidos_precios(material_id);
CREATE INDEX IF NOT EXISTS idx_pmr_precios_company_producto ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id);

COMMENT ON TABLE productos_materiales_rigidos_precios IS
  'Precios de productos de materiales rígidos vendidos por m² pero comprados por placa';

-- =====================================================
-- 2. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_pmr_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pmr_precios_timestamp ON productos_materiales_rigidos_precios;
CREATE TRIGGER update_pmr_precios_timestamp
  BEFORE UPDATE ON productos_materiales_rigidos_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_pmr_precios_updated_at();

-- =====================================================
-- 3. FUNCIÓN: Calcular precio por m² automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_precio_mt2_placa()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular m² de la placa: (ancho_cm * alto_cm) / 10000
  -- Luego calcular precio por m²: precio_placa / m²_placa
  NEW.precio_mt2 = NEW.precio_placa / ((NEW.medida_placa_ancho * NEW.medida_placa_alto) / 10000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calcular_precio_mt2_before_insert_update ON productos_materiales_rigidos_precios;
CREATE TRIGGER calcular_precio_mt2_before_insert_update
  BEFORE INSERT OR UPDATE ON productos_materiales_rigidos_precios
  FOR EACH ROW
  EXECUTE FUNCTION calcular_precio_mt2_placa();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_materiales_rigidos_precios ENABLE ROW LEVEL SECURITY;

-- Política SELECT: usuarios pueden ver precios de su empresa
-- Política SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view prices from their company' AND tablename = 'productos_materiales_rigidos_precios'
  ) THEN
    CREATE POLICY "Users can view prices from their company"
      ON productos_materiales_rigidos_precios FOR SELECT
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Política INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert prices to their company' AND tablename = 'productos_materiales_rigidos_precios'
  ) THEN
    CREATE POLICY "Users can insert prices to their company"
      ON productos_materiales_rigidos_precios FOR INSERT
      TO authenticated
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Política UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update prices from their company' AND tablename = 'productos_materiales_rigidos_precios'
  ) THEN
    CREATE POLICY "Users can update prices from their company"
      ON productos_materiales_rigidos_precios FOR UPDATE
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
  END IF;
END $$;

-- Política DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete prices from their company' AND tablename = 'productos_materiales_rigidos_precios'
  ) THEN
    CREATE POLICY "Users can delete prices from their company"
      ON productos_materiales_rigidos_precios FOR DELETE
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;