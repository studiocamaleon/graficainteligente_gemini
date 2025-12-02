/*
  # Función para Crear Tipos de Ingreso Predefinidos

  ## Descripción
  Crea tipos de ingreso predefinidos para una empresa cuando no tiene ninguno configurado.

  ## Categorías Predefinidas
  - Préstamo recibido
  - Venta de activos
  - Aporte de capital
  - Reintegro
  - Subsidio/Subvención
  - Ingreso por alquiler
  - Otro ingreso
*/

-- =====================================================
-- FUNCIÓN: Crear tipos de ingreso predefinidos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_seed_tipos_ingreso_default(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo insertar si la empresa no tiene tipos de ingreso
  IF NOT EXISTS (
    SELECT 1 FROM tipos_ingreso WHERE company_id = p_company_id
  ) THEN
    INSERT INTO tipos_ingreso (company_id, nombre, descripcion, codigo, color, icono) VALUES
      (p_company_id, 'Préstamo recibido', 'Préstamos de terceros', 'PREST', '#10b981', 'Landmark'),
      (p_company_id, 'Venta de activos', 'Venta de equipos, muebles, vehículos, etc.', 'VACT', '#10b981', 'Package'),
      (p_company_id, 'Aporte de capital', 'Aportes de socios o propietarios', 'APORT', '#10b981', 'TrendingUp'),
      (p_company_id, 'Reintegro', 'Devoluciones y reintegros', 'REINT', '#10b981', 'RotateCcw'),
      (p_company_id, 'Subsidio', 'Subsidios y subvenciones gubernamentales', 'SUBSI', '#10b981', 'Award'),
      (p_company_id, 'Ingreso por alquiler', 'Alquileres cobrados', 'ALQUI', '#10b981', 'Home'),
      (p_company_id, 'Otro ingreso', 'Ingresos diversos no categorizados', 'OTRO', '#10b981', 'DollarSign');
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_seed_tipos_ingreso_default IS 
'Crea tipos de ingreso predefinidos para una empresa. Solo se ejecuta si la empresa no tiene ningún tipo de ingreso configurado.';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Función fn_seed_tipos_ingreso_default creada';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso: SELECT fn_seed_tipos_ingreso_default(''<company_id>'');';
  RAISE NOTICE '';
END $$;
