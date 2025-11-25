/*
  # Funciones para Sistema de Cuentas Corrientes

  1. Función para generar números de liquidación
  2. Función para calcular saldo de cuenta corriente
  3. Función para obtener estado de cuenta
  4. Función para obtener órdenes pendientes de liquidar
  5. Triggers para automatización
*/

-- =====================================================
-- FUNCIÓN: Generar número de liquidación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_generar_numero_liquidacion(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_numero_actual INTEGER;
  v_numero_liquidacion TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_liquidacion FROM 5) AS INTEGER)), 0) + 1
  INTO v_numero_actual
  FROM liquidaciones
  WHERE company_id = p_company_id
    AND numero_liquidacion ~ '^LIQ-[0-9]+$';

  v_numero_liquidacion := 'LIQ-' || LPAD(v_numero_actual::TEXT, 6, '0');

  RETURN v_numero_liquidacion;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Calcular saldo de cuenta corriente
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_saldo_cuenta_corriente(
  p_cliente_id UUID,
  p_fecha_hasta DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_saldo NUMERIC;
BEGIN
  SELECT COALESCE(SUM(monto_debe - monto_haber), 0)
  INTO v_saldo
  FROM cuentas_corrientes_movimientos
  WHERE cliente_id = p_cliente_id
    AND fecha <= p_fecha_hasta;

  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_calcular_saldo_cuenta_corriente TO authenticated;

-- =====================================================
-- FUNCIÓN: Obtener estado de cuenta
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_estado_cuenta(
  p_company_id UUID,
  p_cliente_id UUID,
  p_fecha_desde DATE DEFAULT NULL,
  p_fecha_hasta DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  fecha DATE,
  tipo_movimiento TEXT,
  descripcion TEXT,
  orden_id UUID,
  numero_orden TEXT,
  monto_debe NUMERIC,
  monto_haber NUMERIC,
  saldo_acumulado NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.fecha,
    m.tipo_movimiento,
    m.descripcion,
    m.orden_id,
    o.numero_orden,
    m.monto_debe,
    m.monto_haber,
    m.saldo_acumulado
  FROM cuentas_corrientes_movimientos m
  LEFT JOIN ordenes_trabajo o ON m.orden_id = o.id
  WHERE m.company_id = p_company_id
    AND m.cliente_id = p_cliente_id
    AND (p_fecha_desde IS NULL OR m.fecha >= p_fecha_desde)
    AND m.fecha <= p_fecha_hasta
  ORDER BY m.fecha ASC, m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_obtener_estado_cuenta TO authenticated;

-- =====================================================
-- FUNCIÓN: Obtener órdenes pendientes de liquidar
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_ordenes_pendientes_liquidar(
  p_company_id UUID,
  p_cliente_id UUID,
  p_fecha_desde DATE DEFAULT NULL,
  p_fecha_hasta DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  orden_id UUID,
  numero_orden TEXT,
  fecha_creacion TIMESTAMPTZ,
  total NUMERIC,
  estado TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.numero_orden,
    o.fecha_creacion,
    o.total,
    o.estado
  FROM ordenes_trabajo o
  WHERE o.company_id = p_company_id
    AND o.cliente_id = p_cliente_id
    AND o.estado = 'completado'
    AND NOT EXISTS (
      SELECT 1 FROM liquidaciones_items li
      WHERE li.orden_id = o.id
    )
    AND (p_fecha_desde IS NULL OR DATE(o.fecha_creacion) >= p_fecha_desde)
    AND DATE(o.fecha_creacion) <= p_fecha_hasta
  ORDER BY o.fecha_creacion ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_obtener_ordenes_pendientes_liquidar TO authenticated;

-- =====================================================
-- TRIGGER: Registrar cargo al completar orden de cliente con CC
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_registrar_cargo_cc_orden_completada()
RETURNS TRIGGER AS $$
DECLARE
  v_tiene_cc BOOLEAN;
  v_saldo_anterior NUMERIC;
BEGIN
  IF NEW.estado = 'completado' AND (OLD.estado IS NULL OR OLD.estado != 'completado') THEN
    SELECT tiene_cuenta_corriente INTO v_tiene_cc
    FROM clients
    WHERE id = NEW.cliente_id;

    IF v_tiene_cc = true THEN
      SELECT COALESCE(
        (SELECT saldo_acumulado 
         FROM cuentas_corrientes_movimientos 
         WHERE cliente_id = NEW.cliente_id 
         ORDER BY fecha DESC, created_at DESC 
         LIMIT 1), 
        0
      ) INTO v_saldo_anterior;

      INSERT INTO cuentas_corrientes_movimientos (
        company_id,
        cliente_id,
        tipo_movimiento,
        fecha,
        orden_id,
        descripcion,
        monto_debe,
        monto_haber,
        saldo_acumulado,
        created_by
      ) VALUES (
        NEW.company_id,
        NEW.cliente_id,
        'cargo',
        CURRENT_DATE,
        NEW.id,
        'Cargo por orden ' || NEW.numero_orden,
        NEW.total,
        0,
        v_saldo_anterior + NEW.total,
        auth.uid()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_registrar_cargo_cc ON ordenes_trabajo;
CREATE TRIGGER trigger_registrar_cargo_cc
  AFTER UPDATE OF estado ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION trigger_registrar_cargo_cc_orden_completada();

-- =====================================================
-- TRIGGER: Registrar pago en CC
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_registrar_pago_cc()
RETURNS TRIGGER AS $$
DECLARE
  v_orden RECORD;
  v_tiene_cc BOOLEAN;
  v_saldo_anterior NUMERIC;
BEGIN
  SELECT o.*, c.tiene_cuenta_corriente INTO v_orden
  FROM ordenes_trabajo o
  INNER JOIN clients c ON o.cliente_id = c.id
  WHERE o.id = NEW.orden_id;

  IF v_orden.tiene_cuenta_corriente = true THEN
    SELECT COALESCE(
      (SELECT saldo_acumulado 
       FROM cuentas_corrientes_movimientos 
       WHERE cliente_id = v_orden.cliente_id 
       ORDER BY fecha DESC, created_at DESC 
       LIMIT 1), 
      0
    ) INTO v_saldo_anterior;

    INSERT INTO cuentas_corrientes_movimientos (
      company_id,
      cliente_id,
      tipo_movimiento,
      fecha,
      orden_id,
      pago_id,
      descripcion,
      monto_debe,
      monto_haber,
      saldo_acumulado,
      created_by
    ) VALUES (
      v_orden.company_id,
      v_orden.cliente_id,
      'pago',
      NEW.fecha_pago,
      NEW.orden_id,
      NEW.id,
      'Pago de orden ' || v_orden.numero_orden,
      0,
      NEW.monto,
      v_saldo_anterior - NEW.monto,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_registrar_pago_cc ON ordenes_trabajo_pagos;
CREATE TRIGGER trigger_registrar_pago_cc
  AFTER INSERT ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_registrar_pago_cc();

-- =====================================================
-- TRIGGER: Actualizar estado de liquidación
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_actualizar_estado_liquidacion()
RETURNS TRIGGER AS $$
DECLARE
  v_liquidacion RECORD;
BEGIN
  SELECT
    l.id,
    l.total_general,
    COALESCE(SUM(lp.monto_aplicado), 0) as total_pagado
  INTO v_liquidacion
  FROM liquidaciones l
  LEFT JOIN liquidaciones_pagos lp ON l.id = lp.liquidacion_id
  WHERE l.id = NEW.liquidacion_id
  GROUP BY l.id, l.total_general;

  UPDATE liquidaciones
  SET
    total_pagado = v_liquidacion.total_pagado,
    saldo_pendiente = v_liquidacion.total_general - v_liquidacion.total_pagado,
    estado = CASE
      WHEN v_liquidacion.total_pagado = 0 THEN 'pendiente'
      WHEN v_liquidacion.total_pagado >= v_liquidacion.total_general THEN 'pagada_total'
      ELSE 'pagada_parcial'
    END,
    updated_at = now()
  WHERE id = NEW.liquidacion_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_actualizar_estado_liquidacion ON liquidaciones_pagos;
CREATE TRIGGER trigger_actualizar_estado_liquidacion
  AFTER INSERT OR UPDATE ON liquidaciones_pagos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_actualizar_estado_liquidacion();