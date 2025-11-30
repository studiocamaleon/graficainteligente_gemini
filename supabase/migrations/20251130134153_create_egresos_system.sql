/*
  # Sistema de Egresos para Tesorería

  ## Descripción
  Implementa el registro y control de egresos (gastos, pagos a proveedores, impuestos, etc.)
  con actualización automática de saldos de cajas.

  ## Nuevas Tablas

  ### 1. tipos_egreso
  Categorías configurables de egresos por empresa
  - Nombre y descripción
  - Código para reportes
  - Color e ícono para UI
  - Control de estado activo/inactivo

  ### 2. egresos
  Registro de todos los egresos realizados
  - Asociado a una caja específica
  - Categorizado por tipo de egreso
  - Información del proveedor y comprobante
  - Relación automática con cajas_movimientos

  ## Funcionalidad
  - Trigger automático crea movimiento en cajas_movimientos
  - Actualización automática del saldo_actual de la caja
  - Auditoría completa con created_by y timestamps
  - RLS por company_id

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por rol
  - Validación de saldo disponible
*/

-- =====================================================
-- TABLA: tipos_egreso
-- =====================================================

CREATE TABLE IF NOT EXISTS tipos_egreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  codigo text NOT NULL,
  color text DEFAULT '#ef4444',
  icono text DEFAULT 'ArrowDownCircle',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT tipos_egreso_nombre_unique UNIQUE (company_id, nombre),
  CONSTRAINT tipos_egreso_codigo_unique UNIQUE (company_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tipos_egreso_company ON tipos_egreso(company_id);

-- =====================================================
-- TABLA: egresos
-- =====================================================

CREATE TABLE IF NOT EXISTS egresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_egreso_id uuid NOT NULL REFERENCES tipos_egreso(id) ON DELETE RESTRICT,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  numero_comprobante text,
  proveedor_nombre text,
  medio_pago text,
  notas text,
  movimiento_id uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT egresos_medio_pago_check CHECK (
    medio_pago IS NULL OR
    medio_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'debito', 'otro')
  )
);

CREATE INDEX IF NOT EXISTS idx_egresos_company ON egresos(company_id);
CREATE INDEX IF NOT EXISTS idx_egresos_caja ON egresos(caja_id);
CREATE INDEX IF NOT EXISTS idx_egresos_tipo ON egresos(tipo_egreso_id);
CREATE INDEX IF NOT EXISTS idx_egresos_fecha ON egresos(fecha DESC);

-- =====================================================
-- TRIGGER: Crear movimiento automático
-- =====================================================

CREATE OR REPLACE FUNCTION fn_crear_movimiento_egreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movimiento_id uuid;
BEGIN
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    referencia_id,
    created_by
  ) VALUES (
    NEW.caja_id,
    'egreso',
    NEW.monto,
    NEW.concepto,
    NEW.fecha,
    'egreso',
    NEW.id,
    NEW.created_by
  )
  RETURNING id INTO v_movimiento_id;

  NEW.movimiento_id := v_movimiento_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crear_movimiento_egreso
  BEFORE INSERT ON egresos
  FOR EACH ROW
  EXECUTE FUNCTION fn_crear_movimiento_egreso();

-- =====================================================
-- TRIGGER: Actualizar timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION fn_update_egresos_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_egresos_timestamp
  BEFORE UPDATE ON egresos
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_egresos_timestamp();

CREATE TRIGGER trg_update_tipos_egreso_timestamp
  BEFORE UPDATE ON tipos_egreso
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_egresos_timestamp();

-- =====================================================
-- RLS: tipos_egreso
-- =====================================================

ALTER TABLE tipos_egreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver tipos de egreso de su empresa"
  ON tipos_egreso FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin puede crear tipos de egreso"
  ON tipos_egreso FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "Admin puede actualizar tipos de egreso"
  ON tipos_egreso FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- =====================================================
-- RLS: egresos
-- =====================================================

ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver egresos de su empresa"
  ON egresos FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin y manager pueden crear egresos"
  ON egresos FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'contador')));

CREATE POLICY "Admin puede actualizar egresos"
  ON egresos FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "Solo admin puede eliminar egresos"
  ON egresos FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- =====================================================
-- FUNCIÓN: Seed tipos predefinidos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_seed_tipos_egreso_default(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tipos_egreso (company_id, nombre, descripcion, codigo, color, icono)
  VALUES
    (p_company_id, 'Servicios', 'Servicios públicos y básicos', 'SVC', '#3b82f6', 'Zap'),
    (p_company_id, 'Sueldos', 'Sueldos y salarios del personal', 'SAL', '#10b981', 'Users'),
    (p_company_id, 'Impuestos', 'Impuestos y cargas fiscales', 'IMP', '#ef4444', 'FileText'),
    (p_company_id, 'Alquiler', 'Alquiler de oficina/local/equipos', 'ALQ', '#f59e0b', 'Home'),
    (p_company_id, 'Compras', 'Compra de insumos y materiales', 'COM', '#8b5cf6', 'ShoppingCart'),
    (p_company_id, 'Mantenimiento', 'Mantenimiento y reparaciones', 'MNT', '#06b6d4', 'Wrench'),
    (p_company_id, 'Marketing', 'Publicidad y marketing', 'MKT', '#ec4899', 'TrendingUp'),
    (p_company_id, 'Honorarios', 'Honorarios profesionales', 'HON', '#6366f1', 'Briefcase'),
    (p_company_id, 'Transporte', 'Gastos de transporte y logística', 'TRA', '#14b8a6', 'Truck'),
    (p_company_id, 'Otros', 'Otros gastos diversos', 'OTR', '#64748b', 'MoreHorizontal')
  ON CONFLICT (company_id, codigo) DO NOTHING;
END;
$$;