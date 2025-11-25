/*
  # Sistema de Cuentas Corrientes

  1. Nuevas Tablas
    - `cuentas_corrientes_movimientos`: Registra todos los movimientos de CC
    - `liquidaciones`: Agrupa órdenes para facturación
    - `liquidaciones_items`: Items de cada liquidación
    - `liquidaciones_pagos`: Pagos aplicados a liquidaciones

  2. Funciones
    - `fn_generar_numero_liquidacion()`: Genera números secuenciales
    - `fn_calcular_saldo_cuenta_corriente()`: Calcula saldo actual
    - `fn_obtener_ordenes_pendientes_liquidar()`: Lista órdenes sin liquidar

  3. Triggers
    - Registrar cargo automático al completar orden
    - Registrar pago en movimientos
    - Actualizar estado de liquidación

  4. Seguridad
    - RLS habilitado en todas las tablas
    - Filtrado por company_id
*/

-- =====================================================
-- TABLA: cuentas_corrientes_movimientos
-- =====================================================

CREATE TABLE IF NOT EXISTS cuentas_corrientes_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('cargo', 'pago', 'ajuste', 'nota_credito', 'nota_debito')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  orden_id uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  pago_id uuid REFERENCES ordenes_trabajo_pagos(id) ON DELETE SET NULL,
  liquidacion_id uuid,
  descripcion text NOT NULL,
  monto_debe numeric DEFAULT 0 NOT NULL CHECK (monto_debe >= 0),
  monto_haber numeric DEFAULT 0 NOT NULL CHECK (monto_haber >= 0),
  saldo_acumulado numeric DEFAULT 0 NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_debe_o_haber CHECK (
    (monto_debe > 0 AND monto_haber = 0) OR 
    (monto_haber > 0 AND monto_debe = 0) OR
    (tipo_movimiento = 'ajuste' AND (monto_debe > 0 OR monto_haber > 0))
  )
);

CREATE INDEX idx_cc_movimientos_company_id ON cuentas_corrientes_movimientos(company_id);
CREATE INDEX idx_cc_movimientos_cliente_id ON cuentas_corrientes_movimientos(cliente_id);
CREATE INDEX idx_cc_movimientos_fecha ON cuentas_corrientes_movimientos(fecha);
CREATE INDEX idx_cc_movimientos_tipo ON cuentas_corrientes_movimientos(tipo_movimiento);
CREATE INDEX idx_cc_movimientos_orden_id ON cuentas_corrientes_movimientos(orden_id);
CREATE INDEX idx_cc_movimientos_liquidacion_id ON cuentas_corrientes_movimientos(liquidacion_id);

ALTER TABLE cuentas_corrientes_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company cc_movimientos"
  ON cuentas_corrientes_movimientos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can insert cc_movimientos"
  ON cuentas_corrientes_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can update own company cc_movimientos"
  ON cuentas_corrientes_movimientos FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- =====================================================
-- TABLA: liquidaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  numero_liquidacion text NOT NULL,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  periodo_desde date,
  periodo_hasta date,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada_parcial', 'pagada_total', 'vencida', 'cancelada')),
  subtotal_ordenes numeric DEFAULT 0 NOT NULL CHECK (subtotal_ordenes >= 0),
  total_ajustes numeric DEFAULT 0 NOT NULL,
  total_general numeric DEFAULT 0 NOT NULL CHECK (total_general >= 0),
  total_pagado numeric DEFAULT 0 NOT NULL CHECK (total_pagado >= 0),
  saldo_pendiente numeric DEFAULT 0 NOT NULL,
  notas text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_numero_liquidacion_por_company UNIQUE(company_id, numero_liquidacion)
);

CREATE INDEX idx_liquidaciones_company_id ON liquidaciones(company_id);
CREATE INDEX idx_liquidaciones_cliente_id ON liquidaciones(cliente_id);
CREATE INDEX idx_liquidaciones_numero ON liquidaciones(numero_liquidacion);
CREATE INDEX idx_liquidaciones_estado ON liquidaciones(estado);
CREATE INDEX idx_liquidaciones_fecha_emision ON liquidaciones(fecha_emision);

ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company liquidaciones"
  ON liquidaciones FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can insert liquidaciones"
  ON liquidaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can update own company liquidaciones"
  ON liquidaciones FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- =====================================================
-- TABLA: liquidaciones_items
-- =====================================================

CREATE TABLE IF NOT EXISTS liquidaciones_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,
  descripcion text NOT NULL,
  fecha_orden date NOT NULL,
  numero_orden text NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_liquidaciones_items_liquidacion_id ON liquidaciones_items(liquidacion_id);
CREATE INDEX idx_liquidaciones_items_orden_id ON liquidaciones_items(orden_id);

ALTER TABLE liquidaciones_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view liquidaciones_items via liquidacion"
  ON liquidaciones_items FOR SELECT
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- TABLA: liquidaciones_pagos
-- =====================================================

CREATE TABLE IF NOT EXISTS liquidaciones_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  pago_id uuid NOT NULL REFERENCES ordenes_trabajo_pagos(id) ON DELETE RESTRICT,
  monto_aplicado numeric NOT NULL CHECK (monto_aplicado > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(liquidacion_id, pago_id)
);

CREATE INDEX idx_liquidaciones_pagos_liquidacion_id ON liquidaciones_pagos(liquidacion_id);
CREATE INDEX idx_liquidaciones_pagos_pago_id ON liquidaciones_pagos(pago_id);

ALTER TABLE liquidaciones_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view liquidaciones_pagos via liquidacion"
  ON liquidaciones_pagos FOR SELECT
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- AGREGAR FK liquidacion_id a cuentas_corrientes_movimientos
-- =====================================================

ALTER TABLE cuentas_corrientes_movimientos
  ADD CONSTRAINT fk_cc_movimientos_liquidacion
  FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones(id) ON DELETE SET NULL;

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================

CREATE TRIGGER update_cc_movimientos_updated_at
  BEFORE UPDATE ON cuentas_corrientes_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidaciones_updated_at
  BEFORE UPDATE ON liquidaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();