/*
  # Módulo Centro de Copiado - Schema Completo

  ## Descripción
  Sistema completo de gestión para Centro de Copiado con configuración de precios,
  servicios de anillado, plastificado y gestión de órdenes de copiado.

  ## Nuevas Tablas

  ### Configuración de Tamaños y Papeles
  1. `centro_copiado_tamanios_papel`
     - Tamaños de papel disponibles (A4, SRA3, etc.)
  
  2. `centro_copiado_papeles`
     - Papeles disponibles referenciando materiales del sistema
     - Almacena variante y espesor como JSONB para flexibilidad

  ### Servicios de Anillado y Plastificado
  3. `centro_copiado_rangos_anillado`
     - Rangos de cantidad de hojas con precios por tipo de anillado
  
  4. `centro_copiado_plastificados`
     - Precios de plastificado por tipo (A4, SRA3, Carnet)

  ### Sistema de Precios de Impresión
  5. `centro_copiado_rangos_precio_impresion`
     - Rangos de cantidad de hojas para escalar precios
  
  6. `centro_copiado_precios_impresion`
     - Matriz de precios por tamaño, papel, tinta, rango y cara

  ### Órdenes de Copiado
  7. `centro_copiado_ordenes`
     - Órdenes independientes o vinculadas a órdenes de trabajo principales
  
  8. `centro_copiado_ordenes_items`
     - Items de las órdenes (impresiones, anillados, plastificados)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id
  - Solo usuarios autenticados pueden acceder a sus datos de empresa
*/

-- ============================================================================
-- TAMAÑOS DE PAPEL
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_tamanios_papel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  ancho_mm numeric(10,2) NOT NULL CHECK (ancho_mm > 0),
  alto_mm numeric(10,2) NOT NULL CHECK (alto_mm > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_tamanios_papel_nombre_company_unique UNIQUE(company_id, nombre)
);

ALTER TABLE centro_copiado_tamanios_papel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company tamaños papel"
  ON centro_copiado_tamanios_papel FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company tamaños papel"
  ON centro_copiado_tamanios_papel FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company tamaños papel"
  ON centro_copiado_tamanios_papel FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company tamaños papel"
  ON centro_copiado_tamanios_papel FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- PAPELES (MATERIALES DISPONIBLES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_papeles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
  variante_nombre text NOT NULL,
  espesor numeric(10,2),
  unidad_espesor text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_papeles_unique UNIQUE(company_id, material_id, variante_nombre, espesor)
);

ALTER TABLE centro_copiado_papeles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company papeles"
  ON centro_copiado_papeles FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company papeles"
  ON centro_copiado_papeles FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company papeles"
  ON centro_copiado_papeles FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company papeles"
  ON centro_copiado_papeles FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- RANGOS DE ANILLADO
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_rangos_anillado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  hojas_desde integer NOT NULL CHECK (hojas_desde > 0),
  hojas_hasta integer CHECK (hojas_hasta IS NULL OR hojas_hasta >= hojas_desde),
  precio_ring_wire numeric(10,2) NOT NULL CHECK (precio_ring_wire >= 0),
  precio_plastico numeric(10,2) NOT NULL CHECK (precio_plastico >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE centro_copiado_rangos_anillado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company rangos anillado"
  ON centro_copiado_rangos_anillado FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company rangos anillado"
  ON centro_copiado_rangos_anillado FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company rangos anillado"
  ON centro_copiado_rangos_anillado FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company rangos anillado"
  ON centro_copiado_rangos_anillado FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- PLASTIFICADOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_plastificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('A4', 'SRA3', 'Carnet')),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_plastificados_tipo_company_unique UNIQUE(company_id, tipo)
);

ALTER TABLE centro_copiado_plastificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company plastificados"
  ON centro_copiado_plastificados FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company plastificados"
  ON centro_copiado_plastificados FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company plastificados"
  ON centro_copiado_plastificados FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company plastificados"
  ON centro_copiado_plastificados FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- RANGOS DE PRECIO IMPRESIÓN
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_rangos_precio_impresion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  hojas_desde integer NOT NULL CHECK (hojas_desde > 0),
  hojas_hasta integer CHECK (hojas_hasta IS NULL OR hojas_hasta >= hojas_desde),
  orden integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_rangos_precio_nombre_company_unique UNIQUE(company_id, nombre)
);

ALTER TABLE centro_copiado_rangos_precio_impresion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company rangos precio impresion"
  ON centro_copiado_rangos_precio_impresion FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company rangos precio impresion"
  ON centro_copiado_rangos_precio_impresion FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company rangos precio impresion"
  ON centro_copiado_rangos_precio_impresion FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company rangos precio impresion"
  ON centro_copiado_rangos_precio_impresion FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- PRECIOS DE IMPRESIÓN
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_precios_impresion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tamanio_papel_id uuid NOT NULL REFERENCES centro_copiado_tamanios_papel(id) ON DELETE CASCADE,
  papel_id uuid NOT NULL REFERENCES centro_copiado_papeles(id) ON DELETE CASCADE,
  tipo_tinta text NOT NULL CHECK (tipo_tinta IN ('CMYK', 'K')),
  rango_precio_id uuid NOT NULL REFERENCES centro_copiado_rangos_precio_impresion(id) ON DELETE CASCADE,
  cara_impresa text NOT NULL CHECK (cara_impresa IN ('frente', 'frente_y_dorso')),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_precios_impresion_unique UNIQUE(
    company_id, tamanio_papel_id, papel_id, tipo_tinta, rango_precio_id, cara_impresa
  )
);

ALTER TABLE centro_copiado_precios_impresion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company precios impresion"
  ON centro_copiado_precios_impresion FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company precios impresion"
  ON centro_copiado_precios_impresion FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company precios impresion"
  ON centro_copiado_precios_impresion FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company precios impresion"
  ON centro_copiado_precios_impresion FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- ÓRDENES DE COPIADO
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_ordenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero_orden text NOT NULL,
  orden_trabajo_id uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada')),
  fecha_solicitud timestamptz NOT NULL DEFAULT now(),
  fecha_entrega_estimada timestamptz,
  fecha_entrega_real timestamptz,
  total numeric(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  observaciones text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centro_copiado_ordenes_numero_company_unique UNIQUE(company_id, numero_orden)
);

ALTER TABLE centro_copiado_ordenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes copiado"
  ON centro_copiado_ordenes FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company ordenes copiado"
  ON centro_copiado_ordenes FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company ordenes copiado"
  ON centro_copiado_ordenes FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company ordenes copiado"
  ON centro_copiado_ordenes FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- ITEMS DE ÓRDENES DE COPIADO
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_ordenes_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_copiado_id uuid NOT NULL REFERENCES centro_copiado_ordenes(id) ON DELETE CASCADE,
  tipo_item text NOT NULL CHECK (tipo_item IN ('impresion', 'anillado', 'plastificado')),
  tamanio_papel_id uuid REFERENCES centro_copiado_tamanios_papel(id) ON DELETE SET NULL,
  papel_id uuid REFERENCES centro_copiado_papeles(id) ON DELETE SET NULL,
  tipo_tinta text CHECK (tipo_tinta IS NULL OR tipo_tinta IN ('CMYK', 'K')),
  cara_impresa text CHECK (cara_impresa IS NULL OR cara_impresa IN ('frente', 'frente_y_dorso')),
  cantidad_hojas integer CHECK (cantidad_hojas IS NULL OR cantidad_hojas > 0),
  tipo_anillado text CHECK (tipo_anillado IS NULL OR tipo_anillado IN ('ring_wire', 'plastico')),
  tipo_plastificado text CHECK (tipo_plastificado IS NULL OR tipo_plastificado IN ('A4', 'SRA3', 'Carnet')),
  cantidad_unidades integer NOT NULL CHECK (cantidad_unidades > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal numeric(10,2) NOT NULL CHECK (subtotal >= 0),
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE centro_copiado_ordenes_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes items"
  ON centro_copiado_ordenes_items FOR SELECT
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company ordenes items"
  ON centro_copiado_ordenes_items FOR INSERT
  TO authenticated
  WITH CHECK (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company ordenes items"
  ON centro_copiado_ordenes_items FOR UPDATE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company ordenes items"
  ON centro_copiado_ordenes_items FOR DELETE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_centro_copiado_tamanios_papel_company
  ON centro_copiado_tamanios_papel(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_papeles_company
  ON centro_copiado_papeles(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_rangos_anillado_company
  ON centro_copiado_rangos_anillado(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_plastificados_company
  ON centro_copiado_plastificados(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_rangos_precio_impresion_company
  ON centro_copiado_rangos_precio_impresion(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_rangos_precio_impresion_orden
  ON centro_copiado_rangos_precio_impresion(company_id, orden) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_centro_copiado_precios_impresion_company
  ON centro_copiado_precios_impresion(company_id);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_precios_impresion_lookup
  ON centro_copiado_precios_impresion(tamanio_papel_id, papel_id, tipo_tinta, rango_precio_id);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_company
  ON centro_copiado_ordenes(company_id);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_estado
  ON centro_copiado_ordenes(company_id, estado);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_fecha
  ON centro_copiado_ordenes(company_id, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_items_orden
  ON centro_copiado_ordenes_items(orden_copiado_id);