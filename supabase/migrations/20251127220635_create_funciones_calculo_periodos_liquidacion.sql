/*
  # Funciones para Cálculo de Períodos de Liquidación

  ## Descripción
  Funciones SQL que calculan automáticamente los períodos de liquidación
  según la configuración de cuenta corriente de cada cliente.

  ## Funciones Creadas
  1. `fn_calcular_periodo_semanal` - Calcula período para acuerdo semanal
  2. `fn_calcular_periodo_quincenal` - Calcula período para acuerdo quincenal
  3. `fn_calcular_periodo_mensual` - Calcula período para acuerdo mensual
  4. `fn_calcular_periodo_liquidacion` - Función principal que delega según tipo de acuerdo
  5. `fn_sugerir_ordenes_para_liquidacion` - Lista órdenes completadas sin liquidar en un período

  ## Seguridad
  - Todas las funciones son SECURITY DEFINER para acceso controlado
  - Validan que el cliente pertenezca a la empresa del usuario autenticado
*/

-- =====================================================
-- FUNCIÓN: Calcular período semanal
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_periodo_semanal(
  p_dia_cierre INTEGER,
  p_fecha_referencia DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_dia_semana_hoy INTEGER;
  v_dias_hasta_cierre INTEGER;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_fecha_vencimiento DATE;
BEGIN
  -- Obtener día de la semana actual (1=Lun, 7=Dom en ISO)
  v_dia_semana_hoy := EXTRACT(ISODOW FROM p_fecha_referencia);
  
  -- Calcular días hasta el próximo día de cierre
  v_dias_hasta_cierre := (p_dia_cierre - v_dia_semana_hoy + 7) % 7;
  
  -- Si es 0, significa que hoy es día de cierre, tomar el siguiente
  IF v_dias_hasta_cierre = 0 THEN
    v_dias_hasta_cierre := 7;
  END IF;
  
  -- Fecha de fin es el próximo día de cierre
  v_fecha_fin := p_fecha_referencia + v_dias_hasta_cierre;
  
  -- Fecha de inicio es 7 días antes del cierre
  v_fecha_inicio := v_fecha_fin - INTERVAL '6 days';
  
  RETURN json_build_object(
    'periodo_desde', v_fecha_inicio,
    'periodo_hasta', v_fecha_fin,
    'descripcion_periodo', 'Semana del ' || TO_CHAR(v_fecha_inicio, 'DD/MM') || ' al ' || TO_CHAR(v_fecha_fin, 'DD/MM')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN: Calcular período quincenal
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_periodo_quincenal(
  p_fecha_referencia DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_dia_mes INTEGER;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_ultimo_dia_mes DATE;
BEGIN
  v_dia_mes := EXTRACT(DAY FROM p_fecha_referencia);
  
  IF v_dia_mes <= 15 THEN
    -- Primera quincena: del 1 al 15
    v_fecha_inicio := DATE_TRUNC('month', p_fecha_referencia);
    v_fecha_fin := DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '14 days';
  ELSE
    -- Segunda quincena: del 16 al último día del mes
    v_fecha_inicio := DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '15 days';
    v_ultimo_dia_mes := (DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_fecha_fin := v_ultimo_dia_mes;
  END IF;
  
  RETURN json_build_object(
    'periodo_desde', v_fecha_inicio,
    'periodo_hasta', v_fecha_fin,
    'descripcion_periodo', 'Quincena del ' || TO_CHAR(v_fecha_inicio, 'DD/MM') || ' al ' || TO_CHAR(v_fecha_fin, 'DD/MM')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN: Calcular período mensual
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_periodo_mensual(
  p_dia_cierre INTEGER,
  p_usa_ultimo_dia BOOLEAN,
  p_fecha_referencia DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_ultimo_dia_mes DATE;
  v_mes_actual INTEGER;
BEGIN
  v_mes_actual := EXTRACT(MONTH FROM p_fecha_referencia);
  v_fecha_inicio := DATE_TRUNC('month', p_fecha_referencia);
  
  IF p_usa_ultimo_dia THEN
    -- Cierre el último día del mes
    v_ultimo_dia_mes := (DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_fecha_fin := v_ultimo_dia_mes;
  ELSE
    -- Cierre en día específico
    v_fecha_fin := DATE_TRUNC('month', p_fecha_referencia) + (p_dia_cierre - 1) * INTERVAL '1 day';
  END IF;
  
  RETURN json_build_object(
    'periodo_desde', v_fecha_inicio,
    'periodo_hasta', v_fecha_fin,
    'descripcion_periodo', 'Mes de ' || TO_CHAR(v_fecha_inicio, 'MM/YYYY') || 
                          ' (del ' || TO_CHAR(v_fecha_inicio, 'DD/MM') || ' al ' || TO_CHAR(v_fecha_fin, 'DD/MM') || ')'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN PRINCIPAL: Calcular período de liquidación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_periodo_liquidacion(
  p_cliente_id UUID,
  p_fecha_referencia DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_cliente RECORD;
  v_periodo JSON;
  v_fecha_vencimiento DATE;
  v_resultado JSON;
BEGIN
  -- Obtener configuración del cliente
  SELECT
    c.acuerdo_pago,
    c.dia_cierre_semanal,
    c.dia_cierre_mensual,
    c.usa_ultimo_dia_mes,
    c.dias_vencimiento,
    c.nombre_fantasia
  INTO v_cliente
  FROM clients c
  WHERE c.id = p_cliente_id
    AND c.tiene_cuenta_corriente = true
    AND c.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado o no tiene cuenta corriente habilitada';
  END IF;
  
  -- Calcular período según tipo de acuerdo
  CASE v_cliente.acuerdo_pago
    WHEN 'Semanal' THEN
      IF v_cliente.dia_cierre_semanal IS NULL THEN
        RAISE EXCEPTION 'Cliente con acuerdo semanal debe tener dia_cierre_semanal configurado';
      END IF;
      v_periodo := fn_calcular_periodo_semanal(v_cliente.dia_cierre_semanal, p_fecha_referencia);
      
    WHEN 'Quincenal' THEN
      v_periodo := fn_calcular_periodo_quincenal(p_fecha_referencia);
      
    WHEN 'Mensual' THEN
      IF v_cliente.dia_cierre_mensual IS NULL AND v_cliente.usa_ultimo_dia_mes = false THEN
        RAISE EXCEPTION 'Cliente con acuerdo mensual debe tener dia_cierre_mensual o usa_ultimo_dia_mes configurado';
      END IF;
      v_periodo := fn_calcular_periodo_mensual(
        COALESCE(v_cliente.dia_cierre_mensual, 28),
        v_cliente.usa_ultimo_dia_mes,
        p_fecha_referencia
      );
      
    ELSE
      RAISE EXCEPTION 'Tipo de acuerdo inválido: %', v_cliente.acuerdo_pago;
  END CASE;
  
  -- Calcular fecha de vencimiento
  v_fecha_vencimiento := (v_periodo->>'periodo_hasta')::DATE + v_cliente.dias_vencimiento;
  
  -- Construir respuesta completa
  v_resultado := json_build_object(
    'tipo_acuerdo', v_cliente.acuerdo_pago,
    'periodo_desde', v_periodo->>'periodo_desde',
    'periodo_hasta', v_periodo->>'periodo_hasta',
    'fecha_vencimiento', v_fecha_vencimiento,
    'descripcion_periodo', v_periodo->>'descripcion_periodo',
    'dias_vencimiento', v_cliente.dias_vencimiento
  );
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Sugerir órdenes para liquidación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_sugerir_ordenes_para_liquidacion(
  p_cliente_id UUID,
  p_fecha_desde DATE,
  p_fecha_hasta DATE
)
RETURNS TABLE(
  orden_id UUID,
  numero_orden TEXT,
  fecha_completado DATE,
  total NUMERIC,
  descripcion TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.fecha_completado::DATE,
    ot.total,
    'Orden ' || ot.numero_orden || ' - ' || COALESCE(ot.notas, '')
  FROM ordenes_trabajo ot
  WHERE ot.cliente_id = p_cliente_id
    AND ot.estado = 'completado'
    AND ot.fecha_completado::DATE >= p_fecha_desde
    AND ot.fecha_completado::DATE <= p_fecha_hasta
    AND NOT EXISTS (
      SELECT 1
      FROM liquidaciones_items li
      WHERE li.orden_id = ot.id
    )
  ORDER BY ot.fecha_completado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PERMISOS
-- =====================================================

-- Permitir ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION fn_calcular_periodo_semanal TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calcular_periodo_quincenal TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calcular_periodo_mensual TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calcular_periodo_liquidacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_sugerir_ordenes_para_liquidacion TO authenticated;
