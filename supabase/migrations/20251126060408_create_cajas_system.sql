/*
  # Sistema de Cajas y Tesorería

  ## Descripción
  Este migration crea el sistema completo de cajas para control de tesorería.
  Las cajas son contenedores de dinero (bancos, pasarelas, efectivo) y los
  medios de cobro se asocian a cajas específicas.

  ## Nuevas Tablas

  ### 1. cajas
  Contenedores principales de dinero (bancos, pasarelas, efectivo)
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text) - Nombre de la caja (ej: "Mercado Pago", "Banco Santander")
  - `tipo` (text) - Tipo: 'efectivo', 'banco', 'pasarela'
  - `identificador` (text, nullable) - Número de cuenta, CBU, email, etc
  - `saldo_actual` (numeric) - Saldo actual calculado automáticamente
  - `moneda` (text) - Moneda (ARS, USD, EUR, etc)
  - `color` (text, nullable) - Color para UI (#hex)
  - `icono` (text, nullable) - Nombre del icono lucide-react
  - `es_principal` (boolean) - Si es la caja principal
  - `is_active` (boolean) - Si está activa
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. cajas_movimientos
  Registro de todos los movimientos de entrada y salida de cajas
  - `id` (uuid, primary key)
  - `caja_id` (uuid, foreign key to cajas)
  - `tipo_movimiento` (text) - 'ingreso', 'egreso', 'transferencia', 'ajuste'
  - `monto` (numeric) - Monto del movimiento
  - `concepto` (text) - Descripción del movimiento
  - `fecha` (date) - Fecha del movimiento
  - `referencia_tipo` (text, nullable) - Tipo: 'pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste'
  - `referencia_id` (uuid, nullable) - ID del registro referenciado
  - `medio_cobro_id` (uuid, nullable) - Medio de cobro usado (para ingresos)
  - `caja_destino_id` (uuid, nullable) - Caja destino (para transferencias)
  - `comision_aplicada` (numeric) - Comisión descontada (si aplica)
  - `notas` (text, nullable) - Notas adicionales
  - `created_by` (uuid, foreign key to profiles)
  - `created_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Filtrado automático por company_id
  - Políticas restrictivas según roles
*/

-- =====================================================
-- TABLA: cajas
-- =====================================================

CREATE TABLE IF NOT EXISTS cajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('efectivo', 'banco', 'pasarela')),
  identificador text,
  saldo_actual numeric DEFAULT 0 NOT NULL,
  moneda text DEFAULT 'ARS' NOT NULL,
  color text,
  icono text,
  es_principal boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT cajas_nombre_company_unique UNIQUE(company_id, nombre),
  CONSTRAINT cajas_saldo_no_negativo CHECK (saldo_actual >= 0)
);

CREATE INDEX idx_cajas_company_id ON cajas(company_id);
CREATE INDEX idx_cajas_tipo ON cajas(tipo);
CREATE INDEX idx_cajas_active ON cajas(is_active);

-- RLS para cajas
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company cajas"
  ON cajas FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert cajas"
  ON cajas FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can update own company cajas"
  ON cajas FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete own company cajas"
  ON cajas FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- TABLA: cajas_movimientos
-- =====================================================

CREATE TABLE IF NOT EXISTS cajas_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'egreso', 'transferencia', 'ajuste')),
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  referencia_tipo text CHECK (referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste')),
  referencia_id uuid,
  medio_cobro_id uuid REFERENCES medios_cobro(id) ON DELETE SET NULL,
  caja_destino_id uuid REFERENCES cajas(id) ON DELETE SET NULL,
  comision_aplicada numeric DEFAULT 0 NOT NULL CHECK (comision_aplicada >= 0),
  notas text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_cajas_movimientos_caja_id ON cajas_movimientos(caja_id);
CREATE INDEX idx_cajas_movimientos_fecha ON cajas_movimientos(fecha);
CREATE INDEX idx_cajas_movimientos_tipo ON cajas_movimientos(tipo_movimiento);
CREATE INDEX idx_cajas_movimientos_referencia ON cajas_movimientos(referencia_tipo, referencia_id);
CREATE INDEX idx_cajas_movimientos_medio_cobro ON cajas_movimientos(medio_cobro_id);

-- RLS para cajas_movimientos
ALTER TABLE cajas_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company cajas_movimientos"
  ON cajas_movimientos FOR SELECT
  TO authenticated
  USING (
    caja_id IN (
      SELECT id FROM cajas
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Managers can insert cajas_movimientos"
  ON cajas_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (
    caja_id IN (
      SELECT id FROM cajas
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager')
      )
    )
  );

-- =====================================================
-- TRIGGER: Actualizar updated_at
-- =====================================================

CREATE TRIGGER update_cajas_updated_at
  BEFORE UPDATE ON cajas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCIÓN: Actualizar saldo de caja automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_saldo_caja()
RETURNS TRIGGER AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular nuevo saldo sumando todos los movimientos
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = NEW.caja_id OR caja_destino_id = NEW.caja_id;

  -- Actualizar saldo en la caja
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo
  WHERE id = NEW.caja_id;

  -- Si es transferencia, también actualizar caja destino
  IF NEW.tipo_movimiento = 'transferencia' AND NEW.caja_destino_id IS NOT NULL THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN tipo_movimiento = 'ingreso' THEN monto
          WHEN tipo_movimiento = 'egreso' THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_destino_id THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_destino_id THEN monto
          WHEN tipo_movimiento = 'ajuste' THEN monto
          ELSE 0
        END
      ), 0
    ) INTO v_nuevo_saldo
    FROM cajas_movimientos
    WHERE caja_id = NEW.caja_destino_id OR caja_destino_id = NEW.caja_destino_id;

    UPDATE cajas
    SET saldo_actual = v_nuevo_saldo
    WHERE id = NEW.caja_destino_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_saldo_caja
  AFTER INSERT ON cajas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_caja();
