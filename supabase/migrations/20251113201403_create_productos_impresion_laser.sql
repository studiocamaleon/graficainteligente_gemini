/*
  # Crear Tabla de Productos de Impresión Laser

  ## Descripción
  Esta migración crea una tabla específica para productos de Impresión Laser,
  eliminando campos innecesarios y simplificando la estructura de datos.

  ## Nueva Tabla: productos_impresion_laser

  ### Campos
  - `id` (uuid, primary key): Identificador único del producto
  - `company_id` (uuid, foreign key): Empresa propietaria (multi-tenant)
  - `nombre` (text, required): Nombre del producto
  - `medidas_disponibles` (jsonb, required): Array de {ancho, alto} disponibles
  - `caras_impresas` (text[], required): Opciones de impresión ['solo_frente', 'frente_y_dorso']
  - `producto_impreso` (boolean, default false): Si se vende impreso
  - `is_active` (boolean, default true): Estado del producto
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de última actualización

  ### Campos Eliminados (vs tabla productos)
  - `categoria_id`: No necesario, la tabla ya identifica la categoría
  - `medidas_ancho`: No aplica, se usan medidas_disponibles
  - `medidas_alto`: No aplica, se usan medidas_disponibles
  - `tipo_medida`: Siempre es 'medidas_multiples' para Laser
  - `ancho_maximo`: No aplica a Impresión Laser

  ## Seguridad
  - RLS habilitado con políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE
  - Solo usuarios autenticados de la misma empresa pueden acceder

  ## Índices
  - company_id para filtrado multi-tenant
  - nombre para búsquedas
  - is_active para filtros de estado

  ## Constraints
  - medidas_disponibles debe tener al menos una medida
  - caras_impresas debe tener al menos una opción
  - nombre único por empresa
*/

-- =====================================================
-- CREAR TABLA productos_impresion_laser
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_impresion_laser (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  medidas_disponibles jsonb NOT NULL DEFAULT '[]'::jsonb,
  caras_impresas text[] NOT NULL DEFAULT ARRAY['solo_frente'::text],
  producto_impreso boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_medidas_disponibles_not_empty 
    CHECK (jsonb_array_length(medidas_disponibles) > 0),
  CONSTRAINT check_caras_impresas_not_empty 
    CHECK (array_length(caras_impresas, 1) > 0),
  CONSTRAINT check_caras_impresas_valid_values 
    CHECK (caras_impresas <@ ARRAY['solo_frente', 'frente_y_dorso']::text[]),
  CONSTRAINT unique_nombre_por_empresa 
    UNIQUE(company_id, nombre)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_company_id 
  ON productos_impresion_laser(company_id);

CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_nombre 
  ON productos_impresion_laser(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_is_active 
  ON productos_impresion_laser(is_active);

CREATE INDEX IF NOT EXISTS idx_productos_impresion_laser_company_active 
  ON productos_impresion_laser(company_id, is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE productos_impresion_laser ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_impresion_laser"
  ON productos_impresion_laser FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos_impresion_laser"
  ON productos_impresion_laser FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos_impresion_laser"
  ON productos_impresion_laser FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos_impresion_laser"
  ON productos_impresion_laser FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_impresion_laser_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_impresion_laser_updated_at
  BEFORE UPDATE ON productos_impresion_laser
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_impresion_laser_updated_at();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_impresion_laser IS 
  'Productos de Impresión Laser con múltiples medidas disponibles y opciones de caras de impresión';

COMMENT ON COLUMN productos_impresion_laser.medidas_disponibles IS 
  'Array JSONB de objetos {ancho: number, alto: number} con las medidas disponibles para este producto';

COMMENT ON COLUMN productos_impresion_laser.caras_impresas IS 
  'Array de opciones de impresión: solo_frente, frente_y_dorso, o ambas';

COMMENT ON COLUMN productos_impresion_laser.producto_impreso IS 
  'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';
