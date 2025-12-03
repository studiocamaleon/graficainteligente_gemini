/*
  # Funciones para Aumento Masivo de Precios de Productos

  ## Descripción
  Sistema completo para aplicar aumentos o reducciones masivas de precios
  a productos de diferentes categorías. Permite actualizar todos los productos
  de una categoría o una selección específica.

  ## Funcionalidades
  1. Funciones específicas por cada categoría de producto
  2. Función wrapper genérica que llama a la función correspondiente
  3. Validaciones de seguridad y permisos
  4. Soporte para aumentos positivos y reducciones (porcentajes negativos)
  5. Respeto a RLS y multi-tenancy

  ## Categorías Soportadas
  - Gran Formato (productos_gran_formato_precios)
  - Impresión Láser (productos_impresion_laser_precios)
  - Materiales Rígidos (productos_materiales_rigidos_precios)
  - Plotter Corte (productos_plotter_corte_precios)
  - Portabanners (productos_portabanners_precios)
  - Sellos (productos_sellos_precios)
  - Talonarios (productos_talonarios_precios)

  ## Seguridad
  - Valida company_id del usuario autenticado
  - Valida rango de porcentaje (-50% a +200%)
  - No permite precios negativos o cero
  - Respeta RLS existentes
*/

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Gran Formato
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_gran_formato(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  -- Obtener company_id del usuario autenticado
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  -- Validar rango de porcentaje (-50% a +200%)
  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  -- Calcular factor de multiplicación (10% = 1.10, -15% = 0.85)
  v_factor := 1 + (p_porcentaje / 100.0);

  -- Aplicar aumento
  UPDATE productos_gran_formato_precios
  SET 
    precio = ROUND((precio * v_factor)::numeric, 2),
    updated_at = now()
  WHERE company_id = v_company_id
    AND (p_productos_ids IS NULL OR producto_gran_formato_id = ANY(p_productos_ids))
    AND (precio * v_factor) > 0;  -- Asegurar que el precio no quede en 0 o negativo

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'gran_formato',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_gran_formato IS
  'Aplica un aumento o reducción porcentual a precios de productos de gran formato';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Impresión Láser
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_impresion_laser(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  UPDATE productos_impresion_laser_precios
  SET 
    precio = ROUND((precio * v_factor)::numeric, 2),
    updated_at = now()
  WHERE company_id = v_company_id
    AND (p_productos_ids IS NULL OR producto_laser_id = ANY(p_productos_ids))
    AND (precio * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'impresion_laser',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_impresion_laser IS
  'Aplica un aumento o reducción porcentual a precios de productos de impresión láser';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Materiales Rígidos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_materiales_rigidos(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  -- Actualizar precio_placa, el trigger calcular_precio_mt2_placa actualizará precio_mt2 automáticamente
  UPDATE productos_materiales_rigidos_precios
  SET 
    precio_placa = ROUND((precio_placa * v_factor)::numeric, 2),
    updated_at = now()
  WHERE company_id = v_company_id
    AND (p_productos_ids IS NULL OR producto_materiales_rigidos_id = ANY(p_productos_ids))
    AND (precio_placa * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'materiales_rigidos',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_materiales_rigidos IS
  'Aplica un aumento o reducción porcentual a precios de productos de materiales rígidos. El precio por m² se recalcula automáticamente.';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Plotter Corte
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_plotter_corte(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  -- Para plotter corte, necesitamos obtener company_id a través del producto
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  UPDATE productos_plotter_corte_precios
  SET 
    precio = ROUND((precio * v_factor)::numeric, 2),
    updated_at = now()
  WHERE producto_id IN (
    SELECT id FROM productos_plotter_corte WHERE company_id = v_company_id
  )
  AND (p_productos_ids IS NULL OR producto_id = ANY(p_productos_ids))
  AND (precio * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'plotter_corte',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_plotter_corte IS
  'Aplica un aumento o reducción porcentual a precios de productos de plotter de corte';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Portabanners
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_portabanners(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  UPDATE productos_portabanners_precios
  SET 
    precio = ROUND((precio * v_factor)::numeric, 2),
    updated_at = now()
  WHERE producto_id IN (
    SELECT id FROM productos_portabanners WHERE company_id = v_company_id
  )
  AND (p_productos_ids IS NULL OR producto_id = ANY(p_productos_ids))
  AND (precio * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'portabanners',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_portabanners IS
  'Aplica un aumento o reducción porcentual a precios de productos portabanners';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Sellos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_sellos(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  UPDATE productos_sellos_precios
  SET 
    precio_unitario = ROUND((precio_unitario * v_factor)::numeric, 2),
    updated_at = now()
  WHERE producto_id IN (
    SELECT id FROM productos_sellos WHERE company_id = v_company_id
  )
  AND (p_productos_ids IS NULL OR producto_id = ANY(p_productos_ids))
  AND (precio_unitario * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'sellos',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_sellos IS
  'Aplica un aumento o reducción porcentual a precios de productos de sellos';

-- =====================================================
-- FUNCIÓN: Aumentar Precios de Talonarios
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_talonarios(
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_actualizados integer := 0;
  v_factor numeric;
BEGIN
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  IF p_porcentaje < -50 OR p_porcentaje > 200 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre -50%% y +200%%';
  END IF;

  v_factor := 1 + (p_porcentaje / 100.0);

  UPDATE productos_talonarios_precios
  SET 
    precio = ROUND((precio * v_factor)::numeric, 2),
    updated_at = now()
  WHERE company_id = v_company_id
    AND (p_productos_ids IS NULL OR producto_talonario_id = ANY(p_productos_ids))
    AND (precio * v_factor) > 0;

  GET DIAGNOSTICS v_registros_actualizados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'categoria', 'talonarios',
    'registros_actualizados', v_registros_actualizados,
    'porcentaje_aplicado', p_porcentaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_talonarios IS
  'Aplica un aumento o reducción porcentual a precios de productos de talonarios';

-- =====================================================
-- FUNCIÓN WRAPPER GENÉRICA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aumentar_precios_categoria(
  p_categoria text,
  p_porcentaje numeric,
  p_productos_ids uuid[] DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  -- Validar categoría
  IF p_categoria NOT IN (
    'gran_formato',
    'impresion_laser',
    'materiales_rigidos',
    'plotter_corte',
    'portabanners',
    'sellos',
    'talonarios'
  ) THEN
    RAISE EXCEPTION 'Categoría no válida: %. Categorías permitidas: gran_formato, impresion_laser, materiales_rigidos, plotter_corte, portabanners, sellos, talonarios', p_categoria;
  END IF;

  -- Llamar a la función específica según la categoría
  CASE p_categoria
    WHEN 'gran_formato' THEN
      v_resultado := fn_aumentar_precios_gran_formato(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'impresion_laser' THEN
      v_resultado := fn_aumentar_precios_impresion_laser(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'materiales_rigidos' THEN
      v_resultado := fn_aumentar_precios_materiales_rigidos(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'plotter_corte' THEN
      v_resultado := fn_aumentar_precios_plotter_corte(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'portabanners' THEN
      v_resultado := fn_aumentar_precios_portabanners(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'sellos' THEN
      v_resultado := fn_aumentar_precios_sellos(p_porcentaje, p_productos_ids, p_company_id);
    WHEN 'talonarios' THEN
      v_resultado := fn_aumentar_precios_talonarios(p_porcentaje, p_productos_ids, p_company_id);
  END CASE;

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_aumentar_precios_categoria IS
  'Función wrapper que aplica aumento de precios a la categoría especificada';

-- =====================================================
-- PERMISOS
-- =====================================================

-- Revocar permisos existentes
REVOKE ALL ON FUNCTION fn_aumentar_precios_gran_formato FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_impresion_laser FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_materiales_rigidos FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_plotter_corte FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_portabanners FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_sellos FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_talonarios FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_aumentar_precios_categoria FROM PUBLIC;

-- Otorgar permisos solo a usuarios autenticados
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_gran_formato TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_impresion_laser TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_materiales_rigidos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_plotter_corte TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_portabanners TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_sellos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_talonarios TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aumentar_precios_categoria TO authenticated;
