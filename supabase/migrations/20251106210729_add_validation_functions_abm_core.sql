/*
  # Funciones de Validación para ABM Core

  ## Descripción
  Agrega funciones de validación y triggers para garantizar la integridad de datos
  en el sistema ABM Core, previniendo operaciones que violen reglas de negocio.

  ## Funciones Creadas

  ### 1. check_categoria_has_dependencies
  Verifica si una categoría tiene servicios o acabados asociados antes de eliminarla o desactivarla.

  ### 2. check_estacion_has_dependencies
  Verifica si una estación de trabajo tiene pasos asociados antes de desactivarla.

  ### 3. check_paso_has_dependencies
  Verifica si un paso está siendo usado en grupos de pasos, servicios o acabados.

  ### 4. check_grupo_paso_has_dependencies
  Verifica si un grupo de pasos está siendo usado en servicios o acabados.

  ### 5. validate_material_variantes
  Valida la estructura de variantes en materiales (nombres únicos, espesores válidos).

  ## Triggers
  - Trigger en UPDATE de categorias para validar desactivación
  - Trigger en UPDATE de estaciones_trabajo para validar desactivación
  - Trigger en UPDATE de pasos para validar desactivación
  - Trigger en INSERT/UPDATE de materiales para validar variantes

  ## Seguridad
  Todas las funciones son SECURITY DEFINER para operar con privilegios elevados
  pero solo ejecutan validaciones, no modifican datos sensibles.
*/

-- =====================================================
-- 1. FUNCIÓN: Verificar dependencias de Categoría
-- =====================================================

CREATE OR REPLACE FUNCTION check_categoria_has_dependencies(categoria_id_param uuid)
RETURNS TABLE(has_dependencies boolean, dependency_count integer, dependency_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  servicios_count integer;
  acabados_count integer;
  total_count integer;
  details jsonb;
BEGIN
  SELECT COUNT(*) INTO servicios_count
  FROM servicios
  WHERE categoria_id = categoria_id_param AND is_active = true;

  SELECT COUNT(*) INTO acabados_count
  FROM acabados
  WHERE categoria_id = categoria_id_param AND is_active = true;

  total_count := servicios_count + acabados_count;

  details := jsonb_build_object(
    'servicios', servicios_count,
    'acabados', acabados_count,
    'total', total_count
  );

  RETURN QUERY SELECT 
    (total_count > 0) as has_dependencies,
    total_count as dependency_count,
    details as dependency_details;
END;
$$;

-- =====================================================
-- 2. FUNCIÓN: Verificar dependencias de Estación
-- =====================================================

CREATE OR REPLACE FUNCTION check_estacion_has_dependencies(estacion_id_param uuid)
RETURNS TABLE(has_dependencies boolean, dependency_count integer, dependency_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pasos_count integer;
  details jsonb;
BEGIN
  SELECT COUNT(*) INTO pasos_count
  FROM pasos
  WHERE estacion_id = estacion_id_param AND is_active = true;

  details := jsonb_build_object(
    'pasos_activos', pasos_count
  );

  RETURN QUERY SELECT 
    (pasos_count > 0) as has_dependencies,
    pasos_count as dependency_count,
    details as dependency_details;
END;
$$;

-- =====================================================
-- 3. FUNCIÓN: Verificar dependencias de Paso
-- =====================================================

CREATE OR REPLACE FUNCTION check_paso_has_dependencies(paso_id_param uuid)
RETURNS TABLE(has_dependencies boolean, dependency_count integer, dependency_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  grupos_count integer;
  servicios_niveles_count integer;
  servicios_directos_count integer;
  acabados_niveles_count integer;
  acabados_directos_count integer;
  total_count integer;
  details jsonb;
BEGIN
  SELECT COUNT(DISTINCT grupo_paso_id) INTO grupos_count
  FROM grupos_pasos_items
  WHERE paso_id = paso_id_param;

  SELECT COUNT(*) INTO servicios_niveles_count
  FROM servicios_niveles_precio
  WHERE paso_id = paso_id_param;

  SELECT COUNT(*) INTO servicios_directos_count
  FROM servicios_pasos
  WHERE paso_id = paso_id_param;

  SELECT COUNT(*) INTO acabados_niveles_count
  FROM acabados_niveles_precio
  WHERE paso_id = paso_id_param;

  SELECT COUNT(*) INTO acabados_directos_count
  FROM acabados_pasos
  WHERE paso_id = paso_id_param;

  total_count := grupos_count + servicios_niveles_count + servicios_directos_count + 
                 acabados_niveles_count + acabados_directos_count;

  details := jsonb_build_object(
    'grupos_pasos', grupos_count,
    'servicios_niveles', servicios_niveles_count,
    'servicios_directos', servicios_directos_count,
    'acabados_niveles', acabados_niveles_count,
    'acabados_directos', acabados_directos_count,
    'total', total_count
  );

  RETURN QUERY SELECT 
    (total_count > 0) as has_dependencies,
    total_count as dependency_count,
    details as dependency_details;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN: Verificar dependencias de Grupo de Pasos
-- =====================================================

CREATE OR REPLACE FUNCTION check_grupo_paso_has_dependencies(grupo_paso_id_param uuid)
RETURNS TABLE(has_dependencies boolean, dependency_count integer, dependency_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  servicios_niveles_count integer;
  servicios_directos_count integer;
  acabados_niveles_count integer;
  acabados_directos_count integer;
  total_count integer;
  details jsonb;
BEGIN
  SELECT COUNT(*) INTO servicios_niveles_count
  FROM servicios_niveles_precio
  WHERE grupo_paso_id = grupo_paso_id_param;

  SELECT COUNT(*) INTO servicios_directos_count
  FROM servicios_pasos
  WHERE grupo_paso_id = grupo_paso_id_param;

  SELECT COUNT(*) INTO acabados_niveles_count
  FROM acabados_niveles_precio
  WHERE grupo_paso_id = grupo_paso_id_param;

  SELECT COUNT(*) INTO acabados_directos_count
  FROM acabados_pasos
  WHERE grupo_paso_id = grupo_paso_id_param;

  total_count := servicios_niveles_count + servicios_directos_count + 
                 acabados_niveles_count + acabados_directos_count;

  details := jsonb_build_object(
    'servicios_niveles', servicios_niveles_count,
    'servicios_directos', servicios_directos_count,
    'acabados_niveles', acabados_niveles_count,
    'acabados_directos', acabados_directos_count,
    'total', total_count
  );

  RETURN QUERY SELECT 
    (total_count > 0) as has_dependencies,
    total_count as dependency_count,
    details as dependency_details;
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: Validar estructura de variantes de Material
-- =====================================================

CREATE OR REPLACE FUNCTION validate_material_variantes(variantes_param jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  variante jsonb;
  nombres_vistos text[];
  nombre_actual text;
  espesor numeric;
  espesores jsonb;
  espesor_item jsonb;
BEGIN
  IF variantes_param IS NULL OR jsonb_array_length(variantes_param) = 0 THEN
    RETURN true;
  END IF;

  nombres_vistos := ARRAY[]::text[];

  FOR variante IN SELECT * FROM jsonb_array_elements(variantes_param)
  LOOP
    nombre_actual := variante->>'nombre';
    
    IF nombre_actual IS NULL OR trim(nombre_actual) = '' THEN
      RAISE EXCEPTION 'Cada variante debe tener un nombre válido';
    END IF;

    IF nombre_actual = ANY(nombres_vistos) THEN
      RAISE EXCEPTION 'Los nombres de las variantes deben ser únicos. Nombre duplicado: %', nombre_actual;
    END IF;

    nombres_vistos := array_append(nombres_vistos, nombre_actual);

    espesores := variante->'espesores';
    IF espesores IS NOT NULL THEN
      FOR espesor_item IN SELECT * FROM jsonb_array_elements(espesores)
      LOOP
        BEGIN
          espesor := (espesor_item)::text::numeric;
          IF espesor < 0 THEN
            RAISE EXCEPTION 'Los espesores deben ser valores positivos';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE EXCEPTION 'Los espesores deben ser valores numéricos válidos';
        END;
      END LOOP;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- =====================================================
-- TRIGGER: Validar desactivación de categorías
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_categoria_deactivation_with_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dep_check record;
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    SELECT * INTO dep_check 
    FROM check_categoria_has_dependencies(NEW.id);
    
    IF dep_check.has_dependencies THEN
      RAISE EXCEPTION 'No se puede desactivar la categoría porque tiene % servicios/acabados activos asociados', 
        dep_check.dependency_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_categoria_deactivation ON categorias;
CREATE TRIGGER trigger_validate_categoria_deactivation
  BEFORE UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION prevent_categoria_deactivation_with_dependencies();

-- =====================================================
-- TRIGGER: Validar desactivación de estaciones
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_estacion_deactivation_with_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dep_check record;
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    SELECT * INTO dep_check 
    FROM check_estacion_has_dependencies(NEW.id);
    
    IF dep_check.has_dependencies THEN
      RAISE EXCEPTION 'No se puede desactivar la estación porque tiene % pasos activos asociados. Desactiva primero los pasos que la utilizan.', 
        dep_check.dependency_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_estacion_deactivation ON estaciones_trabajo;
CREATE TRIGGER trigger_validate_estacion_deactivation
  BEFORE UPDATE ON estaciones_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION prevent_estacion_deactivation_with_dependencies();

-- =====================================================
-- TRIGGER: Validar desactivación de pasos
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_paso_deactivation_with_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dep_check record;
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    SELECT * INTO dep_check 
    FROM check_paso_has_dependencies(NEW.id);
    
    IF dep_check.has_dependencies THEN
      RAISE EXCEPTION 'No se puede desactivar el paso porque está siendo usado en % lugares (grupos de pasos, servicios o acabados).', 
        dep_check.dependency_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_paso_deactivation ON pasos;
CREATE TRIGGER trigger_validate_paso_deactivation
  BEFORE UPDATE ON pasos
  FOR EACH ROW
  EXECUTE FUNCTION prevent_paso_deactivation_with_dependencies();

-- =====================================================
-- TRIGGER: Validar desactivación de grupos de pasos
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_grupo_paso_deactivation_with_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dep_check record;
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    SELECT * INTO dep_check 
    FROM check_grupo_paso_has_dependencies(NEW.id);
    
    IF dep_check.has_dependencies THEN
      RAISE EXCEPTION 'No se puede desactivar el grupo de pasos porque está siendo usado en % servicios o acabados.', 
        dep_check.dependency_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_grupo_paso_deactivation ON grupos_pasos;
CREATE TRIGGER trigger_validate_grupo_paso_deactivation
  BEFORE UPDATE ON grupos_pasos
  FOR EACH ROW
  EXECUTE FUNCTION prevent_grupo_paso_deactivation_with_dependencies();

-- =====================================================
-- TRIGGER: Validar variantes de materiales
-- =====================================================

CREATE OR REPLACE FUNCTION validate_material_variantes_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.aplica_espesor = true AND NEW.variantes IS NOT NULL THEN
    PERFORM validate_material_variantes(NEW.variantes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_material_variantes ON materiales;
CREATE TRIGGER trigger_validate_material_variantes
  BEFORE INSERT OR UPDATE ON materiales
  FOR EACH ROW
  EXECUTE FUNCTION validate_material_variantes_trigger();

-- =====================================================
-- ÍNDICES ADICIONALES para mejorar performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_servicios_categoria_id_active ON servicios(categoria_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_acabados_categoria_id_active ON acabados(categoria_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pasos_estacion_id_active ON pasos(estacion_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_grupos_pasos_items_paso_id ON grupos_pasos_items(paso_id);
CREATE INDEX IF NOT EXISTS idx_servicios_niveles_precio_paso_id ON servicios_niveles_precio(paso_id) WHERE paso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_servicios_niveles_precio_grupo_paso_id ON servicios_niveles_precio(grupo_paso_id) WHERE grupo_paso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acabados_niveles_precio_paso_id ON acabados_niveles_precio(paso_id) WHERE paso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acabados_niveles_precio_grupo_paso_id ON acabados_niveles_precio(grupo_paso_id) WHERE grupo_paso_id IS NOT NULL;
