/*
  # Solución para Precios Huérfanos de Materiales Rígidos

  ## Descripción
  Crea funciones para diagnosticar y corregir inconsistencias de datos
  en productos de materiales rígidos, específicamente precios que no tienen
  su correspondiente entrada en la tabla de materiales.

  ## Problema
  El trigger `validate_precio_mr_combination_trigger` valida que cada precio
  tenga una combinación válida de material-variante-espesor en la tabla
  `productos_materiales_rigidos_materiales`. Si existen precios huérfanos,
  operaciones como UPDATE fallan.

  ## Funciones Creadas
  1. fn_diagnosticar_precios_huerfanos_mr - Identifica precios sin combinación válida
  2. fn_eliminar_precios_huerfanos_mr - Elimina precios huérfanos
  3. fn_recrear_combinaciones_faltantes_mr - Crea combinaciones faltantes
  4. fn_aumentar_precios_materiales_rigidos - Versión mejorada con validación previa

  ## Seguridad
  - Todas las funciones respetan company_id del usuario autenticado
  - Solo usuarios autenticados pueden ejecutar estas funciones
  - Las operaciones son auditables
*/

-- =====================================================
-- FUNCIÓN: Diagnosticar Precios Huérfanos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_diagnosticar_precios_huerfanos_mr(
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  precio_id uuid,
  producto_id uuid,
  producto_nombre text,
  material_id uuid,
  material_nombre text,
  variante_nombre text,
  espesor numeric,
  precio_placa numeric,
  ancho_placa numeric,
  alto_placa numeric,
  created_at timestamptz
) AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Obtener company_id del usuario autenticado
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  -- Retornar precios que no tienen combinación válida en materiales
  RETURN QUERY
  SELECT
    pmrp.id as precio_id,
    pmrp.producto_materiales_rigidos_id as producto_id,
    pmr.nombre as producto_nombre,
    pmrp.material_id,
    m.nombre as material_nombre,
    pmrp.variante_nombre,
    pmrp.espesor,
    pmrp.precio_placa,
    pmrp.ancho_placa,
    pmrp.alto_placa,
    pmrp.created_at
  FROM productos_materiales_rigidos_precios pmrp
  JOIN productos_materiales_rigidos pmr ON pmr.id = pmrp.producto_materiales_rigidos_id
  JOIN materiales m ON m.id = pmrp.material_id
  WHERE pmrp.company_id = v_company_id
  AND NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales pmrm
    WHERE pmrm.producto_materiales_rigidos_id = pmrp.producto_materiales_rigidos_id
    AND pmrm.material_id = pmrp.material_id
    AND pmrm.variante_nombre = pmrp.variante_nombre
    AND (
      (pmrp.espesor IS NULL AND pmrm.espesor IS NULL) OR
      (pmrp.espesor IS NOT NULL AND pmrm.espesor = pmrp.espesor)
    )
  )
  ORDER BY pmr.nombre, m.nombre, pmrp.variante_nombre, pmrp.espesor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_diagnosticar_precios_huerfanos_mr IS
  'Identifica precios de materiales rígidos que no tienen una combinación válida en la tabla de materiales';

-- =====================================================
-- FUNCIÓN: Eliminar Precios Huérfanos
-- =====================================================

CREATE OR REPLACE FUNCTION fn_eliminar_precios_huerfanos_mr(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_eliminados integer := 0;
  v_precios_huerfanos uuid[];
BEGIN
  -- Obtener company_id del usuario autenticado
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  -- Obtener IDs de precios huérfanos
  SELECT ARRAY_AGG(pmrp.id)
  INTO v_precios_huerfanos
  FROM productos_materiales_rigidos_precios pmrp
  WHERE pmrp.company_id = v_company_id
  AND NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales pmrm
    WHERE pmrm.producto_materiales_rigidos_id = pmrp.producto_materiales_rigidos_id
    AND pmrm.material_id = pmrp.material_id
    AND pmrm.variante_nombre = pmrp.variante_nombre
    AND (
      (pmrp.espesor IS NULL AND pmrm.espesor IS NULL) OR
      (pmrp.espesor IS NOT NULL AND pmrm.espesor = pmrp.espesor)
    )
  );

  -- Si no hay precios huérfanos, retornar
  IF v_precios_huerfanos IS NULL OR array_length(v_precios_huerfanos, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'registros_eliminados', 0,
      'mensaje', 'No se encontraron precios huérfanos'
    );
  END IF;

  -- Eliminar precios huérfanos
  DELETE FROM productos_materiales_rigidos_precios
  WHERE id = ANY(v_precios_huerfanos);

  GET DIAGNOSTICS v_registros_eliminados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'registros_eliminados', v_registros_eliminados,
    'mensaje', format('Se eliminaron %s precios huérfanos', v_registros_eliminados)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_eliminar_precios_huerfanos_mr IS
  'Elimina precios de materiales rígidos que no tienen una combinación válida en la tabla de materiales';

-- =====================================================
-- FUNCIÓN: Recrear Combinaciones Faltantes
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recrear_combinaciones_faltantes_mr(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registros_creados integer := 0;
  v_combinacion record;
BEGIN
  -- Obtener company_id del usuario autenticado
  v_company_id := COALESCE(
    p_company_id,
    (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario';
  END IF;

  -- Insertar combinaciones faltantes
  FOR v_combinacion IN
    SELECT DISTINCT
      pmrp.producto_materiales_rigidos_id,
      pmrp.material_id,
      pmrp.variante_nombre,
      pmrp.espesor
    FROM productos_materiales_rigidos_precios pmrp
    WHERE pmrp.company_id = v_company_id
    AND NOT EXISTS (
      SELECT 1 FROM productos_materiales_rigidos_materiales pmrm
      WHERE pmrm.producto_materiales_rigidos_id = pmrp.producto_materiales_rigidos_id
      AND pmrm.material_id = pmrp.material_id
      AND pmrm.variante_nombre = pmrp.variante_nombre
      AND (
        (pmrp.espesor IS NULL AND pmrm.espesor IS NULL) OR
        (pmrp.espesor IS NOT NULL AND pmrm.espesor = pmrp.espesor)
      )
    )
  LOOP
    -- Insertar la combinación faltante
    INSERT INTO productos_materiales_rigidos_materiales (
      producto_materiales_rigidos_id,
      material_id,
      variante_nombre,
      espesor
    ) VALUES (
      v_combinacion.producto_materiales_rigidos_id,
      v_combinacion.material_id,
      v_combinacion.variante_nombre,
      v_combinacion.espesor
    )
    ON CONFLICT DO NOTHING;

    v_registros_creados := v_registros_creados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'registros_creados', v_registros_creados,
    'mensaje', format('Se crearon %s combinaciones de materiales faltantes', v_registros_creados)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_recrear_combinaciones_faltantes_mr IS
  'Crea las combinaciones de material-variante-espesor faltantes en la tabla de materiales para precios huérfanos';

-- =====================================================
-- FUNCIÓN MEJORADA: Aumentar Precios con Validación
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
  v_precios_huerfanos integer := 0;
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

  -- Validación previa: verificar si hay precios huérfanos
  SELECT COUNT(*)
  INTO v_precios_huerfanos
  FROM productos_materiales_rigidos_precios pmrp
  WHERE pmrp.company_id = v_company_id
  AND (p_productos_ids IS NULL OR pmrp.producto_materiales_rigidos_id = ANY(p_productos_ids))
  AND NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales pmrm
    WHERE pmrm.producto_materiales_rigidos_id = pmrp.producto_materiales_rigidos_id
    AND pmrm.material_id = pmrp.material_id
    AND pmrm.variante_nombre = pmrp.variante_nombre
    AND (
      (pmrp.espesor IS NULL AND pmrm.espesor IS NULL) OR
      (pmrp.espesor IS NOT NULL AND pmrm.espesor = pmrp.espesor)
    )
  );

  -- Si hay precios huérfanos, retornar error con instrucciones
  IF v_precios_huerfanos > 0 THEN
    RAISE EXCEPTION 'PRECIOS_HUERFANOS:Se encontraron % precios sin configuración válida de material. Ejecuta fn_diagnosticar_precios_huerfanos_mr() para ver detalles y fn_recrear_combinaciones_faltantes_mr() o fn_eliminar_precios_huerfanos_mr() para corregir el problema.', v_precios_huerfanos;
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
  'Aplica un aumento o reducción porcentual a precios de productos de materiales rígidos. Incluye validación previa de precios huérfanos.';

-- =====================================================
-- PERMISOS
-- =====================================================

REVOKE ALL ON FUNCTION fn_diagnosticar_precios_huerfanos_mr FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_eliminar_precios_huerfanos_mr FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_recrear_combinaciones_faltantes_mr FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_diagnosticar_precios_huerfanos_mr TO authenticated;
GRANT EXECUTE ON FUNCTION fn_eliminar_precios_huerfanos_mr TO authenticated;
GRANT EXECUTE ON FUNCTION fn_recrear_combinaciones_faltantes_mr TO authenticated;
