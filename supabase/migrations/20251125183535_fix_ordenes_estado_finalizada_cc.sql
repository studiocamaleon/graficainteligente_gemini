/*
  # Corrección: Estado de Órdenes para Cuenta Corriente

  ## Problema
  Las funciones de cuenta corriente estaban configuradas para detectar el estado
  'completado', pero las órdenes de trabajo realmente usan el estado 'finalizada'.
  Esto causaba que las órdenes NO impactaran en la cuenta corriente.

  ## Solución
  1. Actualizar trigger para detectar estado 'finalizada' en lugar de 'completado'
  2. Actualizar función de órdenes pendientes para buscar estado 'finalizada'

  ## Cambios
  - `trigger_registrar_cargo_cc_orden_completada()`: Cambiado 'completado' → 'finalizada'
  - `fn_obtener_ordenes_pendientes_liquidar()`: Cambiado 'completado' → 'finalizada'

  ## Impacto
  Después de este cambio:
  - Las órdenes que pasen a 'finalizada' generarán cargo automático en CC
  - Las liquidaciones encontrarán correctamente las órdenes finalizadas
  - El sistema de cuenta corriente funcionará correctamente
*/

-- =====================================================
-- FUNCIÓN CORREGIDA: Trigger para registrar cargo en CC
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_registrar_cargo_cc_orden_completada()
RETURNS TRIGGER AS $$
DECLARE
  v_tiene_cc BOOLEAN;
  v_saldo_anterior NUMERIC;
BEGIN
  -- Detectar cambio a estado 'finalizada' (CORREGIDO)
  IF NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN
    -- Verificar si el cliente tiene cuenta corriente
    SELECT tiene_cuenta_corriente INTO v_tiene_cc
    FROM clients
    WHERE id = NEW.cliente_id;

    IF v_tiene_cc = true THEN
      -- Obtener el saldo anterior del cliente
      SELECT COALESCE(
        (SELECT saldo_acumulado
         FROM cuentas_corrientes_movimientos
         WHERE cliente_id = NEW.cliente_id
         ORDER BY fecha DESC, created_at DESC
         LIMIT 1),
        0
      ) INTO v_saldo_anterior;

      -- Registrar el cargo en cuenta corriente
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

-- =====================================================
-- FUNCIÓN CORREGIDA: Obtener órdenes pendientes de liquidar
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
    AND o.estado = 'finalizada' -- CORREGIDO: era 'completado'
    AND NOT EXISTS (
      SELECT 1 FROM liquidaciones_items li
      WHERE li.orden_id = o.id
    )
    AND (p_fecha_desde IS NULL OR DATE(o.fecha_creacion) >= p_fecha_desde)
    AND DATE(o.fecha_creacion) <= p_fecha_hasta
  ORDER BY o.fecha_creacion ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIO: Recrear el trigger
-- =====================================================
-- El trigger ya existe, pero al reemplazar la función, automáticamente
-- usará la versión corregida. No es necesario recrear el trigger.

-- Trigger actual:
-- CREATE TRIGGER trigger_registrar_cargo_cc
--   AFTER UPDATE OF estado ON ordenes_trabajo
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_registrar_cargo_cc_orden_completada();
