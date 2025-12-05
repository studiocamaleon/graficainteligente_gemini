/*
  # Sistema de Servicios y Acabados Compartidos

  ## Descripción
  Este sistema permite aplicar servicios y acabados a nivel de orden/presupuesto completo,
  con prorrateo automático del costo entre los items según diferentes métodos.

  ## Nuevas Tablas
  
  ### `ordenes_trabajo_servicios_compartidos`
  - `id` (uuid, PK): Identificador único
  - `orden_trabajo_id` (uuid, FK): Referencia a la orden
  - `servicio_id` (uuid, FK): Referencia al servicio
  - `configuracion` (jsonb): Configuración del servicio (niveles, valores, etc.)
  - `metodo_prorrateo` (enum): Método de distribución del costo (proporcional, uniforme, manual)
  - `prorrateos` (jsonb): Almacena la distribución calculada por item
  - `precio_total` (numeric): Precio total del servicio compartido
  - `notas` (text): Notas adicionales
  - `created_at`, `updated_at`

  ### `ordenes_trabajo_acabados_compartidos`
  - Misma estructura que servicios compartidos, pero para acabados
  
  ### `presupuestos_servicios_compartidos`
  - Similar a ordenes, pero vinculado a presupuestos
  
  ### `presupuestos_acabados_compartidos`
  - Similar a ordenes, pero vinculado a presupuestos

  ## Enums
  - `metodo_prorrateo_type`: proporcional, uniforme, manual

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas basadas en company_id de la orden/presupuesto
*/

-- Crear enum para método de prorrateo
DO $$ BEGIN
  CREATE TYPE metodo_prorrateo_type AS ENUM ('proporcional', 'uniforme', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLAS PARA ÓRDENES DE TRABAJO
-- =====================================================

-- Servicios compartidos en órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo_servicios_compartidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  configuracion jsonb DEFAULT '{}'::jsonb,
  metodo_prorrateo metodo_prorrateo_type NOT NULL DEFAULT 'proporcional',
  prorrateos jsonb DEFAULT '{}'::jsonb,
  precio_total numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT ordenes_trabajo_servicios_compartidos_precio_total_positive 
    CHECK (precio_total >= 0),
  CONSTRAINT ordenes_trabajo_servicios_compartidos_unique_servicio
    UNIQUE (orden_trabajo_id, servicio_id)
);

-- Acabados compartidos en órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo_acabados_compartidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  configuracion jsonb DEFAULT '{}'::jsonb,
  metodo_prorrateo metodo_prorrateo_type NOT NULL DEFAULT 'proporcional',
  prorrateos jsonb DEFAULT '{}'::jsonb,
  precio_total numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT ordenes_trabajo_acabados_compartidos_precio_total_positive 
    CHECK (precio_total >= 0),
  CONSTRAINT ordenes_trabajo_acabados_compartidos_unique_acabado
    UNIQUE (orden_trabajo_id, acabado_id)
);

-- =====================================================
-- TABLAS PARA PRESUPUESTOS
-- =====================================================

-- Servicios compartidos en presupuestos
CREATE TABLE IF NOT EXISTS presupuestos_servicios_compartidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  configuracion jsonb DEFAULT '{}'::jsonb,
  metodo_prorrateo metodo_prorrateo_type NOT NULL DEFAULT 'proporcional',
  prorrateos jsonb DEFAULT '{}'::jsonb,
  precio_total numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT presupuestos_servicios_compartidos_precio_total_positive 
    CHECK (precio_total >= 0),
  CONSTRAINT presupuestos_servicios_compartidos_unique_servicio
    UNIQUE (presupuesto_id, servicio_id)
);

-- Acabados compartidos en presupuestos
CREATE TABLE IF NOT EXISTS presupuestos_acabados_compartidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  configuracion jsonb DEFAULT '{}'::jsonb,
  metodo_prorrateo metodo_prorrateo_type NOT NULL DEFAULT 'proporcional',
  prorrateos jsonb DEFAULT '{}'::jsonb,
  precio_total numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT presupuestos_acabados_compartidos_precio_total_positive 
    CHECK (precio_total >= 0),
  CONSTRAINT presupuestos_acabados_compartidos_unique_acabado
    UNIQUE (presupuesto_id, acabado_id)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ordenes_servicios_compartidos_orden 
  ON ordenes_trabajo_servicios_compartidos(orden_trabajo_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_servicios_compartidos_servicio 
  ON ordenes_trabajo_servicios_compartidos(servicio_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_acabados_compartidos_orden 
  ON ordenes_trabajo_acabados_compartidos(orden_trabajo_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_acabados_compartidos_acabado 
  ON ordenes_trabajo_acabados_compartidos(acabado_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_servicios_compartidos_presupuesto 
  ON presupuestos_servicios_compartidos(presupuesto_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_servicios_compartidos_servicio 
  ON presupuestos_servicios_compartidos(servicio_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_acabados_compartidos_presupuesto 
  ON presupuestos_acabados_compartidos(presupuesto_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_acabados_compartidos_acabado 
  ON presupuestos_acabados_compartidos(acabado_id);

-- =====================================================
-- TRIGGERS DE UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ordenes_servicios_compartidos_updated_at 
  ON ordenes_trabajo_servicios_compartidos;
CREATE TRIGGER update_ordenes_servicios_compartidos_updated_at
  BEFORE UPDATE ON ordenes_trabajo_servicios_compartidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ordenes_acabados_compartidos_updated_at 
  ON ordenes_trabajo_acabados_compartidos;
CREATE TRIGGER update_ordenes_acabados_compartidos_updated_at
  BEFORE UPDATE ON ordenes_trabajo_acabados_compartidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_presupuestos_servicios_compartidos_updated_at 
  ON presupuestos_servicios_compartidos;
CREATE TRIGGER update_presupuestos_servicios_compartidos_updated_at
  BEFORE UPDATE ON presupuestos_servicios_compartidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_presupuestos_acabados_compartidos_updated_at 
  ON presupuestos_acabados_compartidos;
CREATE TRIGGER update_presupuestos_acabados_compartidos_updated_at
  BEFORE UPDATE ON presupuestos_acabados_compartidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS
ALTER TABLE ordenes_trabajo_servicios_compartidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo_acabados_compartidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_servicios_compartidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_acabados_compartidos ENABLE ROW LEVEL SECURITY;

-- Políticas para ordenes_trabajo_servicios_compartidos
CREATE POLICY "Users can view servicios compartidos from their company"
  ON ordenes_trabajo_servicios_compartidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert servicios compartidos in their company orders"
  ON ordenes_trabajo_servicios_compartidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update servicios compartidos in their company orders"
  ON ordenes_trabajo_servicios_compartidos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete servicios compartidos in their company orders"
  ON ordenes_trabajo_servicios_compartidos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

-- Políticas para ordenes_trabajo_acabados_compartidos
CREATE POLICY "Users can view acabados compartidos from their company"
  ON ordenes_trabajo_acabados_compartidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert acabados compartidos in their company orders"
  ON ordenes_trabajo_acabados_compartidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update acabados compartidos in their company orders"
  ON ordenes_trabajo_acabados_compartidos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete acabados compartidos in their company orders"
  ON ordenes_trabajo_acabados_compartidos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo ot
      INNER JOIN profiles p ON p.company_id = ot.company_id
      WHERE ot.id = orden_trabajo_id
      AND p.id = auth.uid()
    )
  );

-- Políticas para presupuestos_servicios_compartidos
CREATE POLICY "Users can view servicios compartidos from their company presupuestos"
  ON presupuestos_servicios_compartidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert servicios compartidos in their company presupuestos"
  ON presupuestos_servicios_compartidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can update servicios compartidos in their company presupuestos"
  ON presupuestos_servicios_compartidos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete servicios compartidos in their company presupuestos"
  ON presupuestos_servicios_compartidos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

-- Políticas para presupuestos_acabados_compartidos
CREATE POLICY "Users can view acabados compartidos from their company presupuestos"
  ON presupuestos_acabados_compartidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert acabados compartidos in their company presupuestos"
  ON presupuestos_acabados_compartidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can update acabados compartidos in their company presupuestos"
  ON presupuestos_acabados_compartidos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete acabados compartidos in their company presupuestos"
  ON presupuestos_acabados_compartidos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presupuestos p
      INNER JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = presupuesto_id
      AND prof.id = auth.uid()
    )
  );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE ordenes_trabajo_servicios_compartidos IS 
  'Servicios aplicados a nivel de orden completa con prorrateo entre items';
  
COMMENT ON TABLE ordenes_trabajo_acabados_compartidos IS 
  'Acabados aplicados a nivel de orden completa con prorrateo entre items';
  
COMMENT ON TABLE presupuestos_servicios_compartidos IS 
  'Servicios aplicados a nivel de presupuesto completo con prorrateo entre items';
  
COMMENT ON TABLE presupuestos_acabados_compartidos IS 
  'Acabados aplicados a nivel de presupuesto completo con prorrateo entre items';

COMMENT ON COLUMN ordenes_trabajo_servicios_compartidos.configuracion IS 
  'Almacena la configuración del servicio (ej: niveles seleccionados, valores adicionales)';
  
COMMENT ON COLUMN ordenes_trabajo_servicios_compartidos.metodo_prorrateo IS 
  'Método de distribución del costo: proporcional (por precio), uniforme (partes iguales), manual (personalizado)';
  
COMMENT ON COLUMN ordenes_trabajo_servicios_compartidos.prorrateos IS 
  'JSON con la distribución calculada: { "item_id": monto_prorrateado, ... }';
