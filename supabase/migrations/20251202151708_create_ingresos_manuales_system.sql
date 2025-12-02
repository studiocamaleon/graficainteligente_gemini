/*
  # Sistema de Ingresos Manuales para Tesorería

  ## Descripción
  Implementa el registro y control de ingresos manuales (préstamos, ventas de activos,
  aportes de capital, etc.) con actualización automática de saldos de cajas.

  ## Nuevas Tablas

  ### 1. tipos_ingreso
  Categorías configurables de ingresos por empresa
  - Nombre y descripción
  - Código para reportes
  - Color e ícono para UI
  - Control de estado activo/inactivo

  ### 2. ingresos
  Registro de todos los ingresos manuales realizados
  - Asociado a una caja específica
  - Categorizado por tipo de ingreso
  - Información del origen y comprobante
  - Relación automática con cajas_movimientos

  ## Funcionalidad
  - Trigger automático crea movimiento en cajas_movimientos
  - Actualización automática del saldo_actual de la caja
  - Auditoría completa con created_by y timestamps
  - RLS por company_id
  - Soporte para comisiones por medio de cobro

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por rol
  - Managers y superiores pueden crear ingresos
  - Solo admins pueden eliminar ingresos
*/

-- =====================================================
-- TABLA: tipos_ingreso
-- =====================================================

CREATE TABLE IF NOT EXISTS tipos_ingreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  codigo text NOT NULL,
  color text DEFAULT '#10b981',
  icono text DEFAULT 'ArrowUpCircle',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT tipos_ingreso_nombre_unique UNIQUE (company_id, nombre),
  CONSTRAINT tipos_ingreso_codigo_unique UNIQUE (company_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tipos_ingreso_company ON tipos_ingreso(company_id);
CREATE INDEX IF NOT EXISTS idx_tipos_ingreso_active ON tipos_ingreso(is_active) WHERE is_active = true;

COMMENT ON TABLE tipos_ingreso IS 'Categorías configurables de ingresos manuales por empresa';

-- =====================================================
-- TABLA: ingresos
-- =====================================================

CREATE TABLE IF NOT EXISTS ingresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_ingreso_id uuid NOT NULL REFERENCES tipos_ingreso(id) ON DELETE RESTRICT,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  numero_comprobante text,
  origen text,
  medio_cobro_id uuid REFERENCES medios_cobro(id) ON DELETE SET NULL,
  notas text,
  movimiento_id uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingresos_company ON ingresos(company_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_caja ON ingresos(caja_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_tipo ON ingresos(tipo_ingreso_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ingresos_movimiento ON ingresos(movimiento_id);

COMMENT ON TABLE ingresos IS 'Registro de ingresos manuales (no provenientes de ventas)';
COMMENT ON COLUMN ingresos.origen IS 'Describe de quién o dónde proviene el ingreso (ej: nombre del prestamista, comprador del activo, etc.)';
COMMENT ON COLUMN ingresos.numero_comprobante IS 'Número de factura, recibo o comprobante asociado';
COMMENT ON COLUMN ingresos.movimiento_id IS 'Referencia al movimiento automático creado en cajas_movimientos';

-- =====================================================
-- ACTUALIZAR: Constraint en cajas_movimientos
-- =====================================================

-- Agregar 'ingreso_manual' y 'egreso' al constraint de referencia_tipo
-- Nota: 'egreso' ya existe en datos pero no estaba en constraint original
ALTER TABLE cajas_movimientos DROP CONSTRAINT IF EXISTS cajas_movimientos_referencia_tipo_check;

ALTER TABLE cajas_movimientos ADD CONSTRAINT cajas_movimientos_referencia_tipo_check
CHECK (referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'egreso', 'transferencia', 'ajuste', 'ingreso_manual'));

-- =====================================================
-- FUNCIÓN: Crear movimiento automático de ingreso
-- =====================================================

CREATE OR REPLACE FUNCTION fn_crear_movimiento_ingreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movimiento_id uuid;
  v_comision numeric := 0;
BEGIN
  -- Obtener comisión del medio de cobro si existe
  IF NEW.medio_cobro_id IS NOT NULL THEN
    SELECT COALESCE(porcentaje_comision, 0) INTO v_comision
    FROM medios_cobro
    WHERE id = NEW.medio_cobro_id;

    v_comision := (NEW.monto * v_comision / 100);
  END IF;

  -- Crear movimiento de ingreso en la caja
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    referencia_id,
    medio_cobro_id,
    comision_aplicada,
    notas,
    created_by
  ) VALUES (
    NEW.caja_id,
    'ingreso',
    NEW.monto,
    NEW.concepto,
    NEW.fecha,
    'ingreso_manual',
    NEW.id,
    NEW.medio_cobro_id,
    v_comision,
    NEW.notas,
    NEW.created_by
  ) RETURNING id INTO v_movimiento_id;

  -- Actualizar movimiento_id en el ingreso
  UPDATE ingresos
  SET movimiento_id = v_movimiento_id
  WHERE id = NEW.id;

  -- Si hay comisión, crear movimiento de egreso
  IF v_comision > 0 THEN
    INSERT INTO cajas_movimientos (
      caja_id,
      tipo_movimiento,
      monto,
      concepto,
      fecha,
      referencia_tipo,
      referencia_id,
      notas,
      created_by
    ) VALUES (
      NEW.caja_id,
      'egreso',
      v_comision,
      'Comisión ' || NEW.concepto,
      NEW.fecha,
      'ingreso_manual',
      NEW.id,
      'Comisión aplicada por medio de cobro',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_crear_movimiento_ingreso IS
'Crea automáticamente un movimiento en cajas_movimientos cuando se registra un ingreso manual.
Si el medio de cobro tiene comisión, crea también un movimiento de egreso por la comisión.';

-- =====================================================
-- TRIGGER: Crear movimiento al insertar ingreso
-- =====================================================

DROP TRIGGER IF EXISTS trg_ingresos_crear_movimiento ON ingresos;

CREATE TRIGGER trg_ingresos_crear_movimiento
AFTER INSERT ON ingresos
FOR EACH ROW EXECUTE FUNCTION fn_crear_movimiento_ingreso();

-- =====================================================
-- FUNCIÓN: Eliminar movimientos al eliminar ingreso
-- =====================================================

CREATE OR REPLACE FUNCTION fn_eliminar_movimiento_ingreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Eliminar movimiento(s) asociado(s)
  -- Esto incluye el movimiento de ingreso y el de comisión si existe
  DELETE FROM cajas_movimientos
  WHERE referencia_tipo = 'ingreso_manual'
  AND referencia_id = OLD.id;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION fn_eliminar_movimiento_ingreso IS
'Elimina automáticamente los movimientos en cajas_movimientos cuando se elimina un ingreso manual.
Esto revierte el saldo de la caja correctamente.';

-- =====================================================
-- TRIGGER: Eliminar movimientos al eliminar ingreso
-- =====================================================

DROP TRIGGER IF EXISTS trg_ingresos_eliminar_movimiento ON ingresos;

CREATE TRIGGER trg_ingresos_eliminar_movimiento
BEFORE DELETE ON ingresos
FOR EACH ROW EXECUTE FUNCTION fn_eliminar_movimiento_ingreso();

-- =====================================================
-- TRIGGERS: Actualizar updated_at
-- =====================================================

DROP TRIGGER IF EXISTS update_tipos_ingreso_updated_at ON tipos_ingreso;

CREATE TRIGGER update_tipos_ingreso_updated_at
BEFORE UPDATE ON tipos_ingreso
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ingresos_updated_at ON ingresos;

CREATE TRIGGER update_ingresos_updated_at
BEFORE UPDATE ON ingresos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS: tipos_ingreso
-- =====================================================

ALTER TABLE tipos_ingreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company tipos_ingreso" ON tipos_ingreso;
CREATE POLICY "Users can view own company tipos_ingreso"
ON tipos_ingreso FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert tipos_ingreso" ON tipos_ingreso;
CREATE POLICY "Admins can insert tipos_ingreso"
ON tipos_ingreso FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can update own company tipos_ingreso" ON tipos_ingreso;
CREATE POLICY "Admins can update own company tipos_ingreso"
ON tipos_ingreso FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

DROP POLICY IF EXISTS "Super admins can delete tipos_ingreso" ON tipos_ingreso;
CREATE POLICY "Super admins can delete tipos_ingreso"
ON tipos_ingreso FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- =====================================================
-- RLS: ingresos
-- =====================================================

ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company ingresos" ON ingresos;
CREATE POLICY "Users can view own company ingresos"
ON ingresos FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Managers can insert ingresos" ON ingresos;
CREATE POLICY "Managers can insert ingresos"
ON ingresos FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  )
);

DROP POLICY IF EXISTS "Admins can delete own company ingresos" ON ingresos;
CREATE POLICY "Admins can delete own company ingresos"
ON ingresos FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Sistema de Ingresos Manuales Creado ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tabla tipos_ingreso creada';
  RAISE NOTICE '✅ Tabla ingresos creada';
  RAISE NOTICE '✅ Constraint cajas_movimientos.referencia_tipo actualizado';
  RAISE NOTICE '✅ Función fn_crear_movimiento_ingreso() creada';
  RAISE NOTICE '✅ Función fn_eliminar_movimiento_ingreso() creada';
  RAISE NOTICE '✅ Triggers configurados';
  RAISE NOTICE '✅ RLS habilitado en ambas tablas';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximos pasos:';
  RAISE NOTICE '   1. Crear categorías iniciales de tipos_ingreso por empresa';
  RAISE NOTICE '   2. Implementar hooks de TypeScript';
  RAISE NOTICE '   3. Crear componentes de UI';
  RAISE NOTICE '';
END $$;
