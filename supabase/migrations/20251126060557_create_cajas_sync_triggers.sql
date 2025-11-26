/*
  # Triggers de Sincronización Automática con Cajas

  ## Descripción
  Triggers que sincronizan automáticamente los pagos con movimientos de cajas.
  Cuando se registra un pago, automáticamente se crea el movimiento correspondiente
  en la caja asociada al medio de cobro.

  ## Triggers Creados

  ### 1. trigger_sincronizar_pago_con_caja
  Al insertar un pago en ordenes_trabajo_pagos:
  - Crea movimiento de ingreso en la caja
  - Si hay comisión, crea movimiento de egreso por comisión

  ### 2. Actualización de función existente
  Modifica calcular_datos_pago_from_medio_cobro para registrar en caja
*/

-- =====================================================
-- FUNCIÓN: Sincronizar pago con caja
-- =====================================================

CREATE OR REPLACE FUNCTION fn_sincronizar_pago_con_caja()
RETURNS TRIGGER AS $$
DECLARE
  v_medio RECORD;
  v_orden RECORD;
  v_concepto text;
BEGIN
  -- Solo procesar si tiene medio_cobro_id
  IF NEW.medio_cobro_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener medio de cobro y su caja
  SELECT mc.*, c.id as caja_id, c.nombre as caja_nombre
  INTO v_medio
  FROM medios_cobro mc
  LEFT JOIN cajas c ON mc.caja_id = c.id
  WHERE mc.id = NEW.medio_cobro_id;

  -- Si el medio no tiene caja asignada, salir
  IF v_medio.caja_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener información de la orden
  SELECT numero_orden INTO v_orden
  FROM ordenes_trabajo
  WHERE id = NEW.orden_id;

  v_concepto := 'Pago OT ' || COALESCE(v_orden.numero_orden, NEW.orden_id::text);

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
    v_medio.caja_id,
    'ingreso',
    NEW.monto,
    v_concepto,
    NEW.fecha_pago::date,
    'pago_orden',
    NEW.id,
    NEW.medio_cobro_id,
    0,
    NEW.notas,
    NEW.created_by
  );

  -- Si hay comisión aplicada, crear movimiento de egreso
  IF NEW.comision_aplicada > 0 THEN
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
      v_medio.caja_id,
      'egreso',
      NEW.comision_aplicada,
      'Comisión ' || v_medio.nombre || ' - ' || v_concepto,
      NEW.fecha_pago::date,
      'pago_orden',
      NEW.id,
      NEW.medio_cobro_id,
      NEW.comision_aplicada,
      'Comisión descontada automáticamente',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Sincronizar al insertar pago
-- =====================================================

DROP TRIGGER IF EXISTS trigger_sincronizar_pago_con_caja ON ordenes_trabajo_pagos;

CREATE TRIGGER trigger_sincronizar_pago_con_caja
  AFTER INSERT ON ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_sincronizar_pago_con_caja();

-- =====================================================
-- FUNCIÓN: Obtener saldos pendientes de cobro
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_saldos_pendientes_cobro(p_company_id uuid)
RETURNS TABLE (
  total_pendiente numeric,
  total_cc numeric,
  total_sin_cc numeric,
  cantidad_ordenes_cc bigint,
  cantidad_ordenes_sin_cc bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden AS (
    SELECT 
      orden_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos
    GROUP BY orden_id
  ),
  ordenes_pendientes AS (
    SELECT 
      ot.id,
      ot.total,
      COALESCE(p.total_pagado, 0) as pagado,
      (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM ordenes_trabajo ot
    LEFT JOIN pagos_por_orden p ON ot.orden_id = p.orden_id
    LEFT JOIN clients c ON ot.cliente_id = c.id
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelado')
      AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
  )
  SELECT 
    COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
    COALESCE(SUM(CASE WHEN tiene_cuenta_corriente THEN saldo_pendiente ELSE 0 END), 0) as total_cc,
    COALESCE(SUM(CASE WHEN NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL THEN saldo_pendiente ELSE 0 END), 0) as total_sin_cc,
    COUNT(*) FILTER (WHERE tiene_cuenta_corriente) as cantidad_ordenes_cc,
    COUNT(*) FILTER (WHERE NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL) as cantidad_ordenes_sin_cc
  FROM ordenes_pendientes;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Obtener detalle de órdenes por cobrar
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_detalle_por_cobrar(
  p_company_id uuid,
  p_tipo_cliente text DEFAULT NULL
)
RETURNS TABLE (
  orden_id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  tiene_cuenta_corriente boolean,
  total numeric,
  pagado numeric,
  saldo_pendiente numeric,
  dias_transcurridos integer,
  estado text
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden AS (
    SELECT 
      orden_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos
    GROUP BY orden_id
  )
  SELECT 
    ot.id as orden_id,
    ot.numero_orden,
    ot.fecha_creacion,
    ot.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    c.numero_documento as cliente_documento,
    COALESCE(c.tiene_cuenta_corriente, false) as tiene_cuenta_corriente,
    ot.total,
    COALESCE(p.total_pagado, 0) as pagado,
    (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
    EXTRACT(DAY FROM (CURRENT_DATE - ot.fecha_creacion::date))::integer as dias_transcurridos,
    ot.estado
  FROM ordenes_trabajo ot
  LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelado')
    AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )
  ORDER BY ot.fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql;
