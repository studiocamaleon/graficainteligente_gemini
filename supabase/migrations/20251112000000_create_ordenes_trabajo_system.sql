/*
  # Sistema de Gestión de Órdenes de Trabajo

  ## Descripción
  Este migration crea todas las tablas necesarias para el sistema completo de
  gestión de órdenes de trabajo, incluyendo items, servicios, acabados, pagos
  e historial.

  ## Nuevas Tablas

  ### 1. ordenes_trabajo
  Tabla principal de órdenes de trabajo
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `cliente_id` (uuid, foreign key to clients)
  - `numero_orden` (text, unique por company, formato GI-XXXXXX)
  - `vendedor_id` (uuid, foreign key to profiles)
  - `canal_venta` (text: 'Web', 'WhatsApp', 'Mostrador')
  - `estado` (text: 'borrador', 'cotizacion', 'confirmado', 'en_produccion', 'completado', 'cancelado')
  - `fecha_creacion` (timestamptz)
  - `fecha_estimada_entrega` (timestamptz, nullable)
  - `notas_internas` (text, nullable)
  - `subtotal` (numeric, default 0)
  - `total_descuentos` (numeric, default 0)
  - `total` (numeric, default 0)
  - `created_by` (uuid, nullable)
  - `updated_by` (uuid, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. ordenes_trabajo_items
  Items/productos dentro de cada orden
  - `id` (uuid, primary key)
  - `orden_id` (uuid, foreign key to ordenes_trabajo)
  - `producto_id` (uuid, foreign key to productos)
  - `cantidad` (numeric, required)
  - `configuracion` (jsonb, almacena toda la configuración seleccionada)
  - `precio_base` (numeric, precio base del producto)
  - `precio_servicios` (numeric, suma de servicios)
  - `precio_acabados` (numeric, suma de acabados)
  - `precio_unitario_final` (numeric, precio final por unidad)
  - `precio_total` (numeric, precio_unitario_final * cantidad)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. ordenes_trabajo_servicios_items
  Servicios aplicados a cada item
  - `id` (uuid, primary key)
  - `orden_item_id` (uuid, foreign key to ordenes_trabajo_items)
  - `servicio_id` (uuid, foreign key to servicios)
  - `nivel_precio_id` (uuid, nullable)
  - `precio_aplicado` (numeric, precio calculado de este servicio)
  - `created_at` (timestamptz)

  ### 4. ordenes_trabajo_acabados_items
  Acabados aplicados a cada item
  - `id` (uuid, primary key)
  - `orden_item_id` (uuid, foreign key to ordenes_trabajo_items)
  - `acabado_id` (uuid, foreign key to acabados)
  - `nivel_precio_id` (uuid, nullable)
  - `precio_aplicado` (numeric, precio calculado de este acabado)
  - `created_at` (timestamptz)

  ### 5. ordenes_trabajo_pagos
  Pagos realizados a cada orden
  - `id` (uuid, primary key)
  - `orden_id` (uuid, foreign key to ordenes_trabajo)
  - `fecha_pago` (date, required)
  - `monto` (numeric, required)
  - `metodo_pago` (text: 'Efectivo', 'Transferencia', 'Tarjeta Credito', 'Tarjeta Debito', 'Cheque', 'Otro')
  - `referencia_pago` (text, nullable)
  - `comprobante_url` (text, nullable)
  - `notas` (text, nullable)
  - `created_by` (uuid, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. ordenes_trabajo_historial
  Registro de todos los eventos de cada orden
  - `id` (uuid, primary key)
  - `orden_id` (uuid, foreign key to ordenes_trabajo)
  - `usuario_id` (uuid, foreign key to profiles, nullable)
  - `tipo_evento` (text: varios tipos de eventos)
  - `descripcion` (text, required)
  - `metadata` (jsonb, datos adicionales del evento)
  - `ip_address` (text, nullable)
  - `created_at` (timestamptz)

  ## Funciones

  ### generate_numero_orden()
  Función que genera automáticamente el número de orden en formato GI-XXXXXX
  de forma incremental por company_id.

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índices en company_id, cliente_id, vendedor_id, estado
  - Índices en foreign keys para optimizar joins
  - Índice único en (company_id, numero_orden)
*/

-- =====================================================
-- 1. TABLA ORDENES_TRABAJO
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  numero_orden text NOT NULL,
  vendedor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  canal_venta text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_estimada_entrega timestamptz,
  notas_internas text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_descuentos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_canal_venta CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador')),
  CONSTRAINT check_estado CHECK (estado IN ('borrador', 'cotizacion', 'confirmado', 'en_produccion', 'completado', 'cancelado')),
  CONSTRAINT check_subtotal_positivo CHECK (subtotal >= 0),
  CONSTRAINT check_total_positivo CHECK (total >= 0),
  CONSTRAINT unique_numero_orden_por_company UNIQUE(company_id, numero_orden)
);

-- Índices para ordenes_trabajo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_company_id ON ordenes_trabajo(company_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_cliente_id ON ordenes_trabajo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_vendedor_id ON ordenes_trabajo(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha_creacion ON ordenes_trabajo(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_numero_orden ON ordenes_trabajo(numero_orden);

-- RLS para ordenes_trabajo
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo"
  ON ordenes_trabajo FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company ordenes_trabajo"
  ON ordenes_trabajo FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company ordenes_trabajo"
  ON ordenes_trabajo FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company ordenes_trabajo"
  ON ordenes_trabajo FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- 2. TABLA ORDENES_TRABAJO_ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL,
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  precio_base numeric NOT NULL DEFAULT 0,
  precio_servicios numeric NOT NULL DEFAULT 0,
  precio_acabados numeric NOT NULL DEFAULT 0,
  precio_unitario_final numeric NOT NULL DEFAULT 0,
  precio_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_precio_base_positivo CHECK (precio_base >= 0),
  CONSTRAINT check_precio_servicios_positivo CHECK (precio_servicios >= 0),
  CONSTRAINT check_precio_acabados_positivo CHECK (precio_acabados >= 0),
  CONSTRAINT check_precio_unitario_positivo CHECK (precio_unitario_final >= 0),
  CONSTRAINT check_precio_total_positivo CHECK (precio_total >= 0)
);

-- Índices para ordenes_trabajo_items
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_orden_id ON ordenes_trabajo_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_producto_id ON ordenes_trabajo_items(producto_id);

-- RLS para ordenes_trabajo_items
ALTER TABLE ordenes_trabajo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo_items"
  ON ordenes_trabajo_items FOR SELECT
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company ordenes_trabajo_items"
  ON ordenes_trabajo_items FOR INSERT
  TO authenticated
  WITH CHECK (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company ordenes_trabajo_items"
  ON ordenes_trabajo_items FOR UPDATE
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company ordenes_trabajo_items"
  ON ordenes_trabajo_items FOR DELETE
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 3. TABLA ORDENES_TRABAJO_SERVICIOS_ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_servicios_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_item_id uuid NOT NULL REFERENCES ordenes_trabajo_items(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  nivel_precio_id uuid,
  precio_aplicado numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_precio_servicio_positivo CHECK (precio_aplicado >= 0)
);

-- Índices para ordenes_trabajo_servicios_items
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_servicios_items_orden_item_id ON ordenes_trabajo_servicios_items(orden_item_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_servicios_items_servicio_id ON ordenes_trabajo_servicios_items(servicio_id);

-- RLS para ordenes_trabajo_servicios_items
ALTER TABLE ordenes_trabajo_servicios_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo_servicios_items"
  ON ordenes_trabajo_servicios_items FOR SELECT
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can insert own company ordenes_trabajo_servicios_items"
  ON ordenes_trabajo_servicios_items FOR INSERT
  TO authenticated
  WITH CHECK (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can update own company ordenes_trabajo_servicios_items"
  ON ordenes_trabajo_servicios_items FOR UPDATE
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ))
  WITH CHECK (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can delete own company ordenes_trabajo_servicios_items"
  ON ordenes_trabajo_servicios_items FOR DELETE
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

-- =====================================================
-- 4. TABLA ORDENES_TRABAJO_ACABADOS_ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_acabados_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_item_id uuid NOT NULL REFERENCES ordenes_trabajo_items(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  nivel_precio_id uuid,
  precio_aplicado numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_precio_acabado_positivo CHECK (precio_aplicado >= 0)
);

-- Índices para ordenes_trabajo_acabados_items
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_acabados_items_orden_item_id ON ordenes_trabajo_acabados_items(orden_item_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_acabados_items_acabado_id ON ordenes_trabajo_acabados_items(acabado_id);

-- RLS para ordenes_trabajo_acabados_items
ALTER TABLE ordenes_trabajo_acabados_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo_acabados_items"
  ON ordenes_trabajo_acabados_items FOR SELECT
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can insert own company ordenes_trabajo_acabados_items"
  ON ordenes_trabajo_acabados_items FOR INSERT
  TO authenticated
  WITH CHECK (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can update own company ordenes_trabajo_acabados_items"
  ON ordenes_trabajo_acabados_items FOR UPDATE
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ))
  WITH CHECK (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can delete own company ordenes_trabajo_acabados_items"
  ON ordenes_trabajo_acabados_items FOR DELETE
  TO authenticated
  USING (orden_item_id IN (
    SELECT id FROM ordenes_trabajo_items WHERE orden_id IN (
      SELECT id FROM ordenes_trabajo WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  ));

-- =====================================================
-- 5. TABLA ORDENES_TRABAJO_PAGOS
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  fecha_pago date NOT NULL,
  monto numeric NOT NULL,
  metodo_pago text NOT NULL,
  referencia_pago text,
  comprobante_url text,
  notas text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_metodo_pago CHECK (metodo_pago IN ('Efectivo', 'Transferencia', 'Tarjeta Credito', 'Tarjeta Debito', 'Cheque', 'Otro')),
  CONSTRAINT check_monto_positivo CHECK (monto > 0)
);

-- Índices para ordenes_trabajo_pagos
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_pagos_orden_id ON ordenes_trabajo_pagos(orden_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_pagos_fecha_pago ON ordenes_trabajo_pagos(fecha_pago);

-- RLS para ordenes_trabajo_pagos
ALTER TABLE ordenes_trabajo_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR SELECT
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR INSERT
  TO authenticated
  WITH CHECK (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR UPDATE
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR DELETE
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 6. TABLA ORDENES_TRABAJO_HISTORIAL
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tipo_evento text NOT NULL,
  descripcion text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_tipo_evento CHECK (tipo_evento IN (
    'creacion', 'modificacion', 'cambio_estado', 'pago_registrado',
    'nota_agregada', 'item_agregado', 'item_modificado', 'item_eliminado',
    'cotizacion_enviada', 'orden_confirmada', 'orden_cancelada'
  ))
);

-- Índices para ordenes_trabajo_historial
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_historial_orden_id ON ordenes_trabajo_historial(orden_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_historial_usuario_id ON ordenes_trabajo_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_historial_tipo_evento ON ordenes_trabajo_historial(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_historial_created_at ON ordenes_trabajo_historial(created_at);

-- RLS para ordenes_trabajo_historial
ALTER TABLE ordenes_trabajo_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes_trabajo_historial"
  ON ordenes_trabajo_historial FOR SELECT
  TO authenticated
  USING (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company ordenes_trabajo_historial"
  ON ordenes_trabajo_historial FOR INSERT
  TO authenticated
  WITH CHECK (orden_id IN (SELECT id FROM ordenes_trabajo WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 7. FUNCIÓN PARA GENERAR NÚMERO DE ORDEN
-- =====================================================

CREATE OR REPLACE FUNCTION generate_numero_orden(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_max_numero integer;
  v_nuevo_numero text;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN numero_orden ~ '^GI-[0-9]+$'
      THEN CAST(SUBSTRING(numero_orden FROM 4) AS integer)
      ELSE 0
    END
  ), 0) INTO v_max_numero
  FROM ordenes_trabajo
  WHERE company_id = p_company_id;

  v_nuevo_numero := 'GI-' || LPAD((v_max_numero + 1)::text, 6, '0');

  RETURN v_nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGER PARA GENERAR NÚMERO DE ORDEN AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_generate_numero_orden()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_orden IS NULL OR NEW.numero_orden = '' THEN
    NEW.numero_orden := generate_numero_orden(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_ordenes_trabajo_numero_orden
  BEFORE INSERT ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_numero_orden();

-- =====================================================
-- 9. TRIGGERS PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_ordenes_trabajo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ordenes_trabajo_updated_at
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION update_ordenes_trabajo_updated_at();

CREATE TRIGGER trigger_update_ordenes_trabajo_items_updated_at
  BEFORE UPDATE ON ordenes_trabajo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ordenes_trabajo_updated_at();

CREATE TRIGGER trigger_update_ordenes_trabajo_pagos_updated_at
  BEFORE UPDATE ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION update_ordenes_trabajo_updated_at();

-- =====================================================
-- 10. COMENTARIOS EN TABLAS
-- =====================================================

COMMENT ON TABLE ordenes_trabajo IS 'Tabla principal de órdenes de trabajo';
COMMENT ON TABLE ordenes_trabajo_items IS 'Items/productos dentro de cada orden';
COMMENT ON TABLE ordenes_trabajo_servicios_items IS 'Servicios aplicados a cada item';
COMMENT ON TABLE ordenes_trabajo_acabados_items IS 'Acabados aplicados a cada item';
COMMENT ON TABLE ordenes_trabajo_pagos IS 'Pagos realizados a cada orden';
COMMENT ON TABLE ordenes_trabajo_historial IS 'Registro de eventos de cada orden';

COMMENT ON COLUMN ordenes_trabajo.numero_orden IS 'Número de orden formato GI-XXXXXX generado automáticamente';
COMMENT ON COLUMN ordenes_trabajo_items.configuracion IS 'JSON con toda la configuración del item: tecnología, tintas, material, medidas, etc.';
