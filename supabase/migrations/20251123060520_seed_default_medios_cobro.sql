/*
  # Datos Semilla - Medios de Cobro Por Defecto

  ## Descripción
  Crea medios de cobro por defecto para todas las empresas existentes.
  Incluye pasarelas de pago populares, medios bancarios y efectivo.

  ## Medios incluidos

  ### Pasarelas de Pago
  - Mercado Pago (Link, QR, Point, Web Checkout)
  - PayPal
  - Stripe

  ### Medios Bancarios
  - Transferencia Bancaria
  - Cheque al día
  - Cheque diferido
  - Depósito Bancario

  ### Efectivo
  - Pesos Argentinos
  - Dólares

  ## Notas
  - Los valores de comisión y días de liberación son aproximados
  - Cada empresa puede modificar o eliminar estos medios
  - El orden determina cómo aparecen en los selectores
*/

-- =====================================================
-- FUNCIÓN PARA CREAR MEDIOS DE COBRO POR DEFECTO
-- =====================================================

CREATE OR REPLACE FUNCTION crear_medios_cobro_default(p_company_id uuid)
RETURNS void AS $$
BEGIN
  -- Verificar si ya existen medios de cobro para esta empresa
  IF EXISTS (SELECT 1 FROM medios_cobro WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  -- =====================================================
  -- PASARELAS DE PAGO
  -- =====================================================

  -- Mercado Pago - Link de Pago
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Mercado Pago - Link de Pago', 'pasarela', 'Mercado Pago', 'Link', 4.99, 14, true, 1);

  -- Mercado Pago - QR
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Mercado Pago - QR', 'pasarela', 'Mercado Pago', 'QR', 3.99, 14, true, 2);

  -- Mercado Pago - Point
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Mercado Pago - Point', 'pasarela', 'Mercado Pago', 'Point', 2.99, 30, true, 3);

  -- Mercado Pago - Web Checkout
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Mercado Pago - Web Checkout', 'pasarela', 'Mercado Pago', 'Web', 5.99, 14, true, 4);

  -- PayPal
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'PayPal', 'pasarela', 'PayPal', 'Web', 4.99, 21, true, 5);

  -- Stripe
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Stripe', 'pasarela', 'Stripe', 'Web', 3.6, 7, true, 6);

  -- =====================================================
  -- MEDIOS BANCARIOS
  -- =====================================================

  -- Transferencia Bancaria
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Transferencia Bancaria', 'bancario', NULL, 'Transferencia', 0, 0, true, 7);

  -- Cheque al día
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Cheque al día', 'bancario', NULL, 'Cheque', 0, 0, true, 8);

  -- Cheque diferido (30 días)
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Cheque diferido (30 días)', 'bancario', NULL, 'Cheque', 0, 30, true, 9);

  -- Cheque diferido (60 días)
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Cheque diferido (60 días)', 'bancario', NULL, 'Cheque', 0, 60, true, 10);

  -- Depósito Bancario
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Depósito Bancario', 'bancario', NULL, 'Depósito', 0, 0, true, 11);

  -- =====================================================
  -- EFECTIVO
  -- =====================================================

  -- Pesos Argentinos
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Efectivo - Pesos', 'efectivo', NULL, NULL, 0, 0, true, 12);

  -- Dólares
  INSERT INTO medios_cobro (company_id, nombre, tipo, categoria, forma_cobro, comision_porcentaje, dias_liberacion, is_active, orden)
  VALUES (p_company_id, 'Efectivo - Dólares', 'efectivo', NULL, NULL, 0, 0, true, 13);

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREAR MEDIOS DE COBRO PARA TODAS LAS EMPRESAS EXISTENTES
-- =====================================================

DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id FROM companies LOOP
    PERFORM crear_medios_cobro_default(v_company.id);
  END LOOP;
END $$;

-- =====================================================
-- TRIGGER: Crear medios por defecto para nuevas empresas
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_crear_medios_cobro_default()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM crear_medios_cobro_default(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crear_medios_cobro_para_nueva_empresa ON companies;

CREATE TRIGGER trigger_crear_medios_cobro_para_nueva_empresa
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crear_medios_cobro_default();
