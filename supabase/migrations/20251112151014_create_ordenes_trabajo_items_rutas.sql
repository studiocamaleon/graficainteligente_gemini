/*
  # Sistema de Rutas de Producción para Items de Órdenes de Trabajo

  ## Descripción
  Esta migración crea la tabla para almacenar las rutas de producción específicas
  de cada item dentro de las órdenes de trabajo. Esto permite que cada producto
  en una orden tenga su propia ruta personalizada y que los vendedores puedan
  agregar comentarios específicos para el operador de producción.

  ## Nueva Tabla

  ### ordenes_trabajo_items_rutas
  Rutas de producción personalizadas por item de orden
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `orden_item_id` (uuid, foreign key to ordenes_trabajo_items)
  - `tipo_etapa` (text: 'pre_prensa', 'principal', 'post_prensa')
  - `paso_id` (uuid, foreign key to pasos, nullable)
  - `grupo_paso_id` (uuid, foreign key to grupos_pasos, nullable)
  - `paso_nombre` (text, nombre del paso para referencia)
  - `orden` (integer, orden secuencial dentro de la ruta)
  - `es_modificado` (boolean, indica si fue modificado manualmente por el vendedor)
  - `origen_plantilla_id` (uuid, referencia a la plantilla original si aplica, nullable)
  - `comentario_vendedor` (text, comentarios del vendedor para el operador, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en la tabla
  - Políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índice en orden_item_id para búsquedas rápidas por item
  - Índice en company_id para filtrado eficiente
  - Índice compuesto en (orden_item_id, orden) para ordenamiento
*/

-- =====================================================
-- 1. CREAR TABLA ordenes_trabajo_items_rutas
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_items_rutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  orden_item_id uuid NOT NULL REFERENCES ordenes_trabajo_items(id) ON DELETE CASCADE,
  tipo_etapa text NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE SET NULL,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE SET NULL,
  paso_nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  es_modificado boolean DEFAULT false NOT NULL,
  origen_plantilla_id uuid REFERENCES productos_rutas_plantillas(id) ON DELETE SET NULL,
  comentario_vendedor text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT check_tipo_etapa_item_ruta CHECK (tipo_etapa IN (
    'pre_prensa', 'principal', 'post_prensa'
  )),
  CONSTRAINT check_paso_o_grupo CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  ),
  CONSTRAINT check_orden_positivo CHECK (orden >= 0)
);

-- =====================================================
-- 2. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_orden_item 
  ON ordenes_trabajo_items_rutas(orden_item_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_company 
  ON ordenes_trabajo_items_rutas(company_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_orden_item_orden 
  ON ordenes_trabajo_items_rutas(orden_item_id, orden);

CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_tipo_etapa 
  ON ordenes_trabajo_items_rutas(tipo_etapa);

-- =====================================================
-- 3. TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_ordenes_items_rutas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ordenes_items_rutas_updated_at ON ordenes_trabajo_items_rutas;

CREATE TRIGGER trigger_ordenes_items_rutas_updated_at
  BEFORE UPDATE ON ordenes_trabajo_items_rutas
  FOR EACH ROW
  EXECUTE FUNCTION update_ordenes_items_rutas_updated_at();

-- =====================================================
-- 4. CONFIGURAR RLS
-- =====================================================

ALTER TABLE ordenes_trabajo_items_rutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes items rutas"
  ON ordenes_trabajo_items_rutas FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company ordenes items rutas"
  ON ordenes_trabajo_items_rutas FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company ordenes items rutas"
  ON ordenes_trabajo_items_rutas FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company ordenes items rutas"
  ON ordenes_trabajo_items_rutas FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- 5. FUNCIÓN PARA COPIAR RUTA DESDE PLANTILLA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_copiar_ruta_desde_plantilla(
  p_orden_item_id uuid,
  p_producto_id uuid,
  p_company_id uuid
)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO ordenes_trabajo_items_rutas (
    company_id,
    orden_item_id,
    tipo_etapa,
    paso_id,
    grupo_paso_id,
    paso_nombre,
    orden,
    es_modificado,
    origen_plantilla_id
  )
  SELECT
    p_company_id,
    p_orden_item_id,
    prp.tipo_etapa,
    prp.paso_id,
    prp.grupo_paso_id,
    COALESCE(
      p.nombre,
      gp.nombre,
      prp.nombre_display,
      'Paso sin nombre'
    ),
    prp.orden,
    false,
    prp.id
  FROM productos_rutas_plantillas prp
  LEFT JOIN pasos p ON p.id = prp.paso_id
  LEFT JOIN grupos_pasos gp ON gp.id = prp.grupo_paso_id
  WHERE prp.producto_id = p_producto_id
    AND prp.es_condicional = false
  ORDER BY prp.tipo_etapa, prp.orden;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. COMENTARIOS
-- =====================================================

COMMENT ON TABLE ordenes_trabajo_items_rutas IS 'Rutas de producción personalizadas para cada item de orden de trabajo';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.es_modificado IS 'Indica si la ruta fue modificada manualmente por el vendedor';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.comentario_vendedor IS 'Comentarios del vendedor para el operador de producción';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.origen_plantilla_id IS 'Referencia a la plantilla original de donde se copió este paso';
COMMENT ON FUNCTION fn_copiar_ruta_desde_plantilla IS 'Copia los pasos fijos de la plantilla de producto a la ruta del item de orden';