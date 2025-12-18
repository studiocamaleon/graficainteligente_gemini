/*
  # Constructor de Productos - Schema de Productos Personalizados

  ## Descripción
  Este schema permite la creación de productos "construidos" o "personalizados" 
  que no encajan en una única categoría física pero que deben ser reportados 
  bajo una categoría del sistema.

  ## Tablas
  1. `productos_personalizados`
     - Contenedor principal del producto construido.
     - Referencia a una categoría de reporte.
     - Referencia a una plantilla de ruta de producción única.
  
  2. `producto_personalizado_componentes`
     - Detalle de los elementos que componen el producto.
     - Referencia a ítems existentes en otras tablas (laser, gran formato, etc.).

  ## Seguridad
  - RLS habilitado.
  - Políticas por company_id.
*/

-- ============================================================================
-- PRODUCTOS PERSONALIZADOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS productos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  
  -- Categoría para reportes
  categoria_id uuid NOT NULL REFERENCES categorias(id),
  
  -- Ruta de Producción Maestra (Plantilla reutilizable)
  ruta_produccion_id uuid REFERENCES rutas_produccion(id) ON DELETE SET NULL,
  
  -- Configuración Principal (Snapshot para el producto final)
  tecnologia_id uuid REFERENCES tecnologias(id) ON DELETE SET NULL,
  tinta text, -- Enum TintaType compatible
  
  -- Medidas Finales del Producto
  medidas_ancho numeric(10,2) NOT NULL DEFAULT 0,
  medidas_alto numeric(10,2) NOT NULL DEFAULT 0,
  
  -- Estado y Relación con el Catálogo
  es_plantilla boolean NOT NULL DEFAULT false, -- true = aparece en catálogo, false = configuración de una orden específica
  is_active boolean NOT NULL DEFAULT true,
  
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE productos_personalizados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para productos_personalizados
CREATE POLICY "Users can view own company productos personalizados"
  ON productos_personalizados FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos personalizados"
  ON productos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos personalizados"
  ON productos_personalizados FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos personalizados"
  ON productos_personalizados FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- COMPONENTES DE PRODUCTOS PERSONALIZADOS (LA RECETA)
-- ============================================================================

CREATE TYPE tipo_componente_personalizado AS ENUM ('laser', 'gran_formato', 'materiales_rigidos', 'plotter_corte', 'portabanners', 'sellos', 'talonarios', 'centro_copiado', 'servicio', 'acabado', 'insumo');

CREATE TABLE IF NOT EXISTS producto_personalizado_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_personalizado_id uuid NOT NULL REFERENCES productos_personalizados(id) ON DELETE CASCADE,
  
  tipo_componente tipo_componente_personalizado NOT NULL,
  referencia_id uuid, -- ID del producto base, servicio o acabado. Puede ser NULL si es un componente genérico.
  
  nombre_personalizado text, -- Nombre descriptivo opcional para esta parte (ej: "Tapa", "Interior")
  cantidad_por_unidad numeric(10,4) NOT NULL DEFAULT 1, -- Cuántos de este componente lleva 1 unidad del producto final
  
  -- Configuración específica del componente (snapshot de lo elegido: papel, tinta, etc.)
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE producto_personalizado_componentes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para componentes
CREATE POLICY "Users can view own company componentes personalizados"
  ON producto_personalizado_componentes FOR SELECT
  TO authenticated
  USING (
    producto_personalizado_id IN (
      SELECT id FROM productos_personalizados
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company componentes personalizados"
  ON producto_personalizado_componentes FOR INSERT
  TO authenticated
  WITH CHECK (
    producto_personalizado_id IN (
      SELECT id FROM productos_personalizados
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company componentes personalizados"
  ON producto_personalizado_componentes FOR UPDATE
  TO authenticated
  USING (
    producto_personalizado_id IN (
      SELECT id FROM productos_personalizados
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    producto_personalizado_id IN (
      SELECT id FROM productos_personalizados
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company componentes personalizados"
  ON producto_personalizado_componentes FOR DELETE
  TO authenticated
  USING (
    producto_personalizado_id IN (
      SELECT id FROM productos_personalizados
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_prod_personalizados_company ON productos_personalizados(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_personalizados_categoria ON productos_personalizados(categoria_id);
CREATE INDEX IF NOT EXISTS idx_prod_personalizados_plantilla ON productos_personalizados(es_plantilla) WHERE es_plantilla = true;
CREATE INDEX IF NOT EXISTS idx_prod_pers_componentes_parent ON producto_personalizado_componentes(producto_personalizado_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prod_personalizados_updated_at
  BEFORE UPDATE ON productos_personalizados
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_prod_pers_componentes_updated_at
  BEFORE UPDATE ON producto_personalizado_componentes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
