/*
  # Crear Tabla de Precios para Productos de Impresión Láser

  ## Descripción
  Esta migración crea el sistema de precios base para productos de impresión láser.
  Los precios se configuran por cada combinación única de:
  - Producto
  - Medida (ancho x alto)
  - Tinta
  - Cantidad
  - Cara impresa (solo_frente o frente_y_dorso)

  ## Nueva Tabla

  ### productos_impresion_laser_precios
  Almacena los precios base para todas las configuraciones de productos láser

  **Campos:**
  - `id` (uuid, primary key) - Identificador único del precio
  - `company_id` (uuid, FK a companies) - Empresa propietaria
  - `producto_laser_id` (uuid, FK a productos_impresion_laser) - Producto al que pertenece
  - `medida_ancho` (decimal) - Ancho de la medida en mm
  - `medida_alto` (decimal) - Alto de la medida en mm
  - `tinta_id` (uuid) - ID de la tinta seleccionada (referencia a tecnologias_tintas_pasos)
  - `cantidad` (integer) - Cantidad específica (1 para unidades, valor fijo para cantidades_fijas)
  - `cara_impresa` (text) - Opción de impresión: 'solo_frente' o 'frente_y_dorso'
  - `precio` (decimal) - Precio unitario para esta configuración
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Seguridad
  - RLS habilitado basado en company_id del usuario autenticado
  - Políticas restrictivas para SELECT, INSERT, UPDATE, DELETE
  - Validación de integridad referencial con CASCADE en deletes

  ## Índices
  - Índices en company_id, producto_laser_id y tinta_id para optimizar queries
  - Índice compuesto para búsquedas por producto y medida
  - Constraint unique para evitar duplicados

  ## Validaciones
  - Precio debe ser mayor a 0
  - Medidas deben ser mayores a 0
  - Cantidad debe ser mayor a 0
  - cara_impresa solo acepta valores válidos
*/

-- =====================================================
-- 1. TABLA PRINCIPAL: productos_impresion_laser_precios
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_laser_id uuid NOT NULL REFERENCES productos_impresion_laser(id) ON DELETE CASCADE,
  medida_ancho decimal(10,2) NOT NULL,
  medida_alto decimal(10,2) NOT NULL,
  tinta_id uuid NOT NULL,
  cantidad integer NOT NULL,
  cara_impresa text NOT NULL CHECK (cara_impresa IN ('solo_frente', 'frente_y_dorso')),
  precio decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraint unique para evitar duplicados en la configuración
  CONSTRAINT unique_precio_configuracion UNIQUE (
    producto_laser_id,
    medida_ancho,
    medida_alto,
    tinta_id,
    cantidad,
    cara_impresa
  ),

  -- Validaciones de valores positivos
  CONSTRAINT check_medida_ancho_positivo CHECK (medida_ancho > 0),
  CONSTRAINT check_medida_alto_positivo CHECK (medida_alto > 0),
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_precio_positivo CHECK (precio > 0)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_pl_precios_company ON productos_impresion_laser_precios(company_id);
CREATE INDEX IF NOT EXISTS idx_pl_precios_producto ON productos_impresion_laser_precios(producto_laser_id);
CREATE INDEX IF NOT EXISTS idx_pl_precios_tinta ON productos_impresion_laser_precios(tinta_id);
CREATE INDEX IF NOT EXISTS idx_pl_precios_producto_medida ON productos_impresion_laser_precios(producto_laser_id, medida_ancho, medida_alto);

COMMENT ON TABLE productos_impresion_laser_precios IS
  'Precios base para productos de impresión láser por configuración específica (medida, tinta, cantidad, cara)';

COMMENT ON COLUMN productos_impresion_laser_precios.medida_ancho IS
  'Ancho de la medida en milímetros';

COMMENT ON COLUMN productos_impresion_laser_precios.medida_alto IS
  'Alto de la medida en milímetros';

COMMENT ON COLUMN productos_impresion_laser_precios.tinta_id IS
  'ID de la tinta seleccionada (referencia a tecnologias_tintas_pasos)';

COMMENT ON COLUMN productos_impresion_laser_precios.cantidad IS
  'Cantidad específica: 1 para tipo_venta unidades, valor fijo para cantidades_fijas';

COMMENT ON COLUMN productos_impresion_laser_precios.cara_impresa IS
  'Opción de impresión: solo_frente o frente_y_dorso';

COMMENT ON COLUMN productos_impresion_laser_precios.precio IS
  'Precio unitario base para esta configuración específica';

-- =====================================================
-- 2. TRIGGER: updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_pl_precios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pl_precios_timestamp
  BEFORE UPDATE ON productos_impresion_laser_precios
  FOR EACH ROW
  EXECUTE FUNCTION update_pl_precios_updated_at();

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_impresion_laser_precios ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: usuarios pueden ver precios de su empresa
CREATE POLICY "Users can view prices from their company"
  ON productos_impresion_laser_precios FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política de INSERT: usuarios pueden crear precios para su empresa
CREATE POLICY "Users can insert prices to their company"
  ON productos_impresion_laser_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política de UPDATE: usuarios pueden actualizar precios de su empresa
CREATE POLICY "Users can update prices from their company"
  ON productos_impresion_laser_precios FOR UPDATE
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

-- Política de DELETE: usuarios pueden eliminar precios de su empresa
CREATE POLICY "Users can delete prices from their company"
  ON productos_impresion_laser_precios FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 4. ACTUALIZAR CONSTRAINT EN productos_impresion_laser
-- =====================================================

-- Actualizar el constraint de tipo_venta para excluir 'medidas'
-- Solo para productos láser, permitiendo solo 'unidades' y 'cantidades_fijas'

DO $$
BEGIN
  -- Primero verificar si existe algún producto con tipo_venta = 'medidas'
  IF EXISTS (
    SELECT 1 FROM productos_impresion_laser
    WHERE tipo_venta = 'medidas'
  ) THEN
    -- Si existen, actualizar a 'unidades' por defecto
    UPDATE productos_impresion_laser
    SET tipo_venta = 'unidades'
    WHERE tipo_venta = 'medidas';
  END IF;

  -- Eliminar el constraint anterior si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'productos_impresion_laser'
    AND constraint_name LIKE '%tipo_venta%'
  ) THEN
    ALTER TABLE productos_impresion_laser
    DROP CONSTRAINT IF EXISTS productos_impresion_laser_tipo_venta_check;
  END IF;

  -- Crear el nuevo constraint solo con 'unidades' y 'cantidades_fijas'
  ALTER TABLE productos_impresion_laser
  ADD CONSTRAINT productos_impresion_laser_tipo_venta_check
  CHECK (tipo_venta IN ('unidades', 'cantidades_fijas'));
END $$;

COMMENT ON CONSTRAINT productos_impresion_laser_tipo_venta_check ON productos_impresion_laser IS
  'Tipo de venta para productos láser: unidades o cantidades_fijas (medidas no aplica para esta categoría)';
