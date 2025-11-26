/*
  # Funciones de Migración y Agrupación de Cajas

  ## Descripción
  Funciones para crear cajas automáticamente desde medios de cobro existentes
  y migrar datos históricos de pagos hacia el sistema de cajas.

  ## Funciones Creadas

  ### 1. fn_crear_cajas_desde_medios_cobro(p_company_id)
  Analiza los medios de cobro existentes y crea cajas agrupadas inteligentemente:
  - Pasarelas: agrupa por categoría (Mercado Pago, PayPal, etc)
  - Bancarios: crea caja "Cuenta Bancaria Principal"
  - Efectivo: crea cajas por moneda

  ### 2. fn_migrar_pagos_historicos_a_cajas(p_company_id)
  Recorre todos los pagos existentes y crea movimientos en cajas correspondientes

  ### 3. fn_obtener_resumen_cajas(p_company_id)
  Retorna resumen de cajas agrupadas por tipo con saldos totales
*/

-- =====================================================
-- FUNCIÓN: Crear cajas desde medios de cobro existentes
-- =====================================================

CREATE OR REPLACE FUNCTION fn_crear_cajas_desde_medios_cobro(p_company_id uuid)
RETURNS void AS $$
DECLARE
  v_medio RECORD;
  v_caja_id uuid;
  v_caja_nombre text;
  v_icono text;
  v_color text;
BEGIN
  -- Verificar si ya existen cajas para esta empresa
  IF EXISTS (SELECT 1 FROM cajas WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  -- =====================================================
  -- PASARELAS: Crear caja por cada categoría única
  -- =====================================================
  FOR v_medio IN 
    SELECT DISTINCT categoria, tipo
    FROM medios_cobro
    WHERE company_id = p_company_id
      AND tipo = 'pasarela'
      AND categoria IS NOT NULL
      AND is_active = true
  LOOP
    -- Determinar icono y color según categoría
    CASE v_medio.categoria
      WHEN 'Mercado Pago' THEN
        v_icono := 'Wallet';
        v_color := '#00B1EA';
      WHEN 'PayPal' THEN
        v_icono := 'CreditCard';
        v_color := '#003087';
      WHEN 'Stripe' THEN
        v_icono := 'Zap';
        v_color := '#635BFF';
      ELSE
        v_icono := 'DollarSign';
        v_color := '#10B981';
    END CASE;

    -- Crear caja para esta pasarela
    INSERT INTO cajas (company_id, nombre, tipo, moneda, icono, color, es_principal, is_active)
    VALUES (p_company_id, v_medio.categoria, 'pasarela', 'ARS', v_icono, v_color, false, true)
    RETURNING id INTO v_caja_id;

    -- Asignar todos los medios de esta categoría a la caja
    UPDATE medios_cobro
    SET caja_id = v_caja_id
    WHERE company_id = p_company_id
      AND tipo = 'pasarela'
      AND categoria = v_medio.categoria;
  END LOOP;

  -- =====================================================
  -- BANCARIOS: Crear caja principal
  -- =====================================================
  IF EXISTS (
    SELECT 1 FROM medios_cobro
    WHERE company_id = p_company_id AND tipo = 'bancario' AND is_active = true
  ) THEN
    INSERT INTO cajas (company_id, nombre, tipo, moneda, icono, color, es_principal, is_active)
    VALUES (p_company_id, 'Cuenta Bancaria Principal', 'banco', 'ARS', 'Landmark', '#3B82F6', false, true)
    RETURNING id INTO v_caja_id;

    -- Asignar todos los medios bancarios a esta caja
    UPDATE medios_cobro
    SET caja_id = v_caja_id
    WHERE company_id = p_company_id
      AND tipo = 'bancario';
  END IF;

  -- =====================================================
  -- EFECTIVO: Crear cajas por moneda
  -- =====================================================
  FOR v_medio IN 
    SELECT nombre, tipo
    FROM medios_cobro
    WHERE company_id = p_company_id
      AND tipo = 'efectivo'
      AND is_active = true
  LOOP
    -- Determinar moneda del nombre
    IF v_medio.nombre ILIKE '%dólar%' OR v_medio.nombre ILIKE '%dollar%' OR v_medio.nombre ILIKE '%usd%' THEN
      v_caja_nombre := 'Efectivo USD';
      INSERT INTO cajas (company_id, nombre, tipo, moneda, icono, color, es_principal, is_active)
      VALUES (p_company_id, v_caja_nombre, 'efectivo', 'USD', 'Banknote', '#F59E0B', false, true)
      ON CONFLICT (company_id, nombre) DO NOTHING
      RETURNING id INTO v_caja_id;
    ELSE
      v_caja_nombre := 'Efectivo ARS';
      INSERT INTO cajas (company_id, nombre, tipo, moneda, icono, color, es_principal, is_active)
      VALUES (p_company_id, v_caja_nombre, 'efectivo', 'ARS', 'Banknote', '#10B981', true, true)
      ON CONFLICT (company_id, nombre) DO NOTHING
      RETURNING id INTO v_caja_id;
    END IF;

    -- Asignar medio de efectivo a su caja
    IF v_caja_id IS NOT NULL THEN
      UPDATE medios_cobro
      SET caja_id = v_caja_id
      WHERE company_id = p_company_id
        AND tipo = 'efectivo'
        AND nombre = v_medio.nombre;
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Migrar pagos históricos a cajas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_migrar_pagos_historicos_a_cajas(p_company_id uuid)
RETURNS void AS $$
DECLARE
  v_pago RECORD;
  v_medio RECORD;
  v_caja_id uuid;
  v_concepto text;
BEGIN
  -- Recorrer todos los pagos de órdenes de trabajo
  FOR v_pago IN 
    SELECT p.*, ot.numero_orden
    FROM ordenes_trabajo_pagos p
    INNER JOIN ordenes_trabajo ot ON p.orden_id = ot.id
    WHERE ot.company_id = p_company_id
      AND p.medio_cobro_id IS NOT NULL
    ORDER BY p.fecha_pago ASC
  LOOP
    -- Obtener medio de cobro y su caja
    SELECT mc.caja_id, mc.nombre INTO v_medio
    FROM medios_cobro mc
    WHERE mc.id = v_pago.medio_cobro_id;

    -- Si el medio tiene caja asignada, crear movimiento
    IF v_medio.caja_id IS NOT NULL THEN
      v_concepto := 'Pago OT ' || v_pago.numero_orden;
      
      -- Crear movimiento de ingreso
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
        created_by
      ) VALUES (
        v_medio.caja_id,
        'ingreso',
        v_pago.monto,
        v_concepto,
        v_pago.fecha_pago::date,
        'pago_orden',
        v_pago.id,
        v_pago.medio_cobro_id,
        0,
        v_pago.created_by
      )
      ON CONFLICT DO NOTHING;

      -- Si hay comisión, crear movimiento de egreso
      IF v_pago.comision_aplicada > 0 THEN
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
          created_by
        ) VALUES (
          v_medio.caja_id,
          'egreso',
          v_pago.comision_aplicada,
          'Comisión ' || v_medio.nombre || ' - ' || v_concepto,
          v_pago.fecha_pago::date,
          'pago_orden',
          v_pago.id,
          v_pago.medio_cobro_id,
          v_pago.comision_aplicada,
          v_pago.created_by
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Obtener resumen de cajas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_resumen_cajas(p_company_id uuid)
RETURNS TABLE (
  tipo text,
  total_saldo numeric,
  cantidad_cajas bigint,
  cajas json
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.tipo,
    SUM(c.saldo_actual) as total_saldo,
    COUNT(*) as cantidad_cajas,
    json_agg(
      json_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'saldo_actual', c.saldo_actual,
        'moneda', c.moneda,
        'icono', c.icono,
        'color', c.color,
        'es_principal', c.es_principal
      ) ORDER BY c.es_principal DESC, c.nombre
    ) as cajas
  FROM cajas c
  WHERE c.company_id = p_company_id
    AND c.is_active = true
  GROUP BY c.tipo
  ORDER BY 
    CASE c.tipo
      WHEN 'efectivo' THEN 1
      WHEN 'banco' THEN 2
      WHEN 'pasarela' THEN 3
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- EJECUTAR: Crear cajas para empresas existentes
-- =====================================================

DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id FROM companies LOOP
    PERFORM fn_crear_cajas_desde_medios_cobro(v_company.id);
    PERFORM fn_migrar_pagos_historicos_a_cajas(v_company.id);
  END LOOP;
END $$;

-- =====================================================
-- TRIGGER: Crear cajas para nuevas empresas
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_crear_cajas_para_nueva_empresa()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM fn_crear_cajas_desde_medios_cobro(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crear_cajas_nueva_empresa ON companies;

CREATE TRIGGER trigger_crear_cajas_nueva_empresa
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crear_cajas_para_nueva_empresa();
