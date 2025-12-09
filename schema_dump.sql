
\restrict quRwoglp0uNXsVrD8IDI30skyWOQ5BIFXtVG1D2Ru0sZ038s0ZAy5W8bXX8VgME


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Limpieza completa realizada: Todos los módulos de Catálogo y Pricing han sido eliminados. Sistema listo para rediseño desde cero.';



CREATE TYPE "public"."cheque_direction" AS ENUM (
    'emitido',
    'recibido'
);


ALTER TYPE "public"."cheque_direction" OWNER TO "postgres";


CREATE TYPE "public"."cheque_status" AS ENUM (
    'pendiente',
    'pagado',
    'anulado',
    'vencido'
);


ALTER TYPE "public"."cheque_status" OWNER TO "postgres";


CREATE TYPE "public"."cheque_type" AS ENUM (
    'fisico',
    'echeq'
);


ALTER TYPE "public"."cheque_type" OWNER TO "postgres";


CREATE TYPE "public"."metodo_prorrateo_type" AS ENUM (
    'proporcional',
    'uniforme',
    'manual'
);


ALTER TYPE "public"."metodo_prorrateo_type" OWNER TO "postgres";


CREATE TYPE "public"."recurring_frequency" AS ENUM (
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'yearly'
);


ALTER TYPE "public"."recurring_frequency" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_saldo_caja"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular nuevo saldo sumando todos los movimientos
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = NEW.caja_id OR caja_destino_id = NEW.caja_id;

  -- Actualizar saldo en la caja
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo
  WHERE id = NEW.caja_id;

  -- Si es transferencia, también actualizar caja destino
  IF NEW.tipo_movimiento = 'transferencia' AND NEW.caja_destino_id IS NOT NULL THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN tipo_movimiento = 'ingreso' THEN monto
          WHEN tipo_movimiento = 'egreso' THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_id = NEW.caja_destino_id THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = NEW.caja_destino_id THEN monto
          WHEN tipo_movimiento = 'ajuste' THEN monto
          ELSE 0
        END
      ), 0
    ) INTO v_nuevo_saldo
    FROM cajas_movimientos
    WHERE caja_id = NEW.caja_destino_id OR caja_destino_id = NEW.caja_destino_id;

    UPDATE cajas
    SET saldo_actual = v_nuevo_saldo
    WHERE id = NEW.caja_destino_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."actualizar_saldo_caja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_saldo_caja_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular nuevo saldo para la caja origen
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = OLD.caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = OLD.caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = OLD.caja_id OR caja_destino_id = OLD.caja_id;

  -- Actualizar saldo en la caja origen
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo
  WHERE id = OLD.caja_id;

  -- Si era transferencia, también actualizar caja destino
  IF OLD.tipo_movimiento = 'transferencia' AND OLD.caja_destino_id IS NOT NULL THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN tipo_movimiento = 'ingreso' THEN monto
          WHEN tipo_movimiento = 'egreso' THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_id = OLD.caja_destino_id THEN -monto
          WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = OLD.caja_destino_id THEN monto
          WHEN tipo_movimiento = 'ajuste' THEN monto
          ELSE 0
        END
      ), 0
    ) INTO v_nuevo_saldo
    FROM cajas_movimientos
    WHERE caja_id = OLD.caja_destino_id OR caja_destino_id = OLD.caja_destino_id;

    UPDATE cajas
    SET saldo_actual = v_nuevo_saldo
    WHERE id = OLD.caja_destino_id;
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."actualizar_saldo_caja_on_delete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_saldo_caja_on_delete"() IS 'Recalcula el saldo de la caja cuando se elimina un movimiento';



CREATE OR REPLACE FUNCTION "public"."actualizar_saldo_caja_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_caja_id_afectada uuid;
  v_caja_destino_id_afectada uuid;
BEGIN
  -- Determinar qué caja(s) actualizar según la operación
  IF TG_OP = 'DELETE' THEN
    v_caja_id_afectada := OLD.caja_id;
    v_caja_destino_id_afectada := OLD.caja_destino_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- En UPDATE, podría cambiar la caja, así que recalculamos ambas (vieja y nueva)
    v_caja_id_afectada := OLD.caja_id;
    v_caja_destino_id_afectada := OLD.caja_destino_id;
    
    -- También actualizar las nuevas cajas si cambiaron
    IF NEW.caja_id IS DISTINCT FROM OLD.caja_id THEN
      PERFORM fn_recalcular_saldo_caja_especifica(NEW.caja_id);
    END IF;
    
    IF NEW.caja_destino_id IS DISTINCT FROM OLD.caja_destino_id THEN
      PERFORM fn_recalcular_saldo_caja_especifica(NEW.caja_destino_id);
    END IF;
  ELSE -- INSERT
    v_caja_id_afectada := NEW.caja_id;
    v_caja_destino_id_afectada := NEW.caja_destino_id;
  END IF;

  -- Recalcular saldo de caja principal
  IF v_caja_id_afectada IS NOT NULL THEN
    PERFORM fn_recalcular_saldo_caja_especifica(v_caja_id_afectada);
  END IF;

  -- Recalcular saldo de caja destino (si existe)
  IF v_caja_destino_id_afectada IS NOT NULL THEN
    PERFORM fn_recalcular_saldo_caja_especifica(v_caja_destino_id_afectada);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."actualizar_saldo_caja_v2"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_saldo_caja_v2"() IS 'Trigger function mejorada que recalcula saldos en INSERT, UPDATE y DELETE de movimientos.';



CREATE OR REPLACE FUNCTION "public"."calcular_datos_pago_from_medio_cobro"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_medio_cobro medios_cobro%ROWTYPE;
BEGIN
  -- Si tiene medio_cobro_id, calcular comisión y fecha de liberación
  IF NEW.medio_cobro_id IS NOT NULL THEN
    -- Obtener datos del medio de cobro
    SELECT * INTO v_medio_cobro
    FROM medios_cobro
    WHERE id = NEW.medio_cobro_id;

    -- Calcular comisión aplicada (% del monto)
    IF v_medio_cobro.comision_porcentaje IS NOT NULL AND v_medio_cobro.comision_porcentaje > 0 THEN
      NEW.comision_aplicada := (NEW.monto * v_medio_cobro.comision_porcentaje / 100);
    ELSE
      NEW.comision_aplicada := 0;
    END IF;

    -- Calcular fecha de liberación estimada
    IF v_medio_cobro.dias_liberacion IS NOT NULL AND v_medio_cobro.dias_liberacion > 0 THEN
      NEW.fecha_liberacion_estimada := NEW.fecha_pago + (v_medio_cobro.dias_liberacion || ' days')::interval;
    ELSE
      NEW.fecha_liberacion_estimada := NEW.fecha_pago;
    END IF;
  ELSE
    -- Si no tiene medio_cobro_id, usar metodo_pago legacy (sin comisión ni liberación)
    NEW.comision_aplicada := 0;
    NEW.fecha_liberacion_estimada := NEW.fecha_pago;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calcular_datos_pago_from_medio_cobro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_precio_mt2_placa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Calcular m² de la placa: (ancho_cm * alto_cm) / 10000
  -- Luego calcular precio por m²: precio_placa / m²_placa
  NEW.precio_mt2 = NEW.precio_placa / ((NEW.medida_placa_ancho * NEW.medida_placa_alto) / 10000);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calcular_precio_mt2_placa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") RETURNS TABLE("has_dependencies" boolean, "dependency_count" integer, "dependency_details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  servicios_count integer;
  acabados_count integer;
  total_count integer;
  details jsonb;
BEGIN
  -- Contar servicios activos que tienen esta categoría
  -- Usa la tabla relacional servicios_categorias
  SELECT COUNT(DISTINCT s.id) INTO servicios_count
  FROM servicios s
  INNER JOIN servicios_categorias sc ON sc.servicio_id = s.id
  WHERE sc.categoria_id = categoria_id_param AND s.is_active = true;

  -- Contar acabados activos que tienen esta categoría
  -- Usa la tabla relacional acabados_categorias
  SELECT COUNT(DISTINCT a.id) INTO acabados_count
  FROM acabados a
  INNER JOIN acabados_categorias ac ON ac.acabado_id = a.id
  WHERE ac.categoria_id = categoria_id_param AND a.is_active = true;

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


ALTER FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") IS 'Verifica si una categoría tiene servicios o acabados activos asociados. Actualizado para trabajar con el esquema de múltiples categorías usando tablas relacionales servicios_categorias y acabados_categorias.';



CREATE OR REPLACE FUNCTION "public"."check_estacion_has_dependencies"("estacion_id_param" "uuid") RETURNS TABLE("has_dependencies" boolean, "dependency_count" integer, "dependency_details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."check_estacion_has_dependencies"("estacion_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_grupo_paso_has_dependencies"("grupo_paso_id_param" "uuid") RETURNS TABLE("has_dependencies" boolean, "dependency_count" integer, "dependency_details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."check_grupo_paso_has_dependencies"("grupo_paso_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_ip_restriction"("p_user_id" "uuid", "p_ip_address" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_has_restrictions boolean;
  v_ip_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_ip_restrictions 
    WHERE user_id = p_user_id AND is_active = true
  ) INTO v_has_restrictions;
  
  IF NOT v_has_restrictions THEN
    RETURN true;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM user_ip_restrictions 
    WHERE user_id = p_user_id 
    AND ip_address = p_ip_address 
    AND is_active = true
  ) INTO v_ip_allowed;
  
  RETURN v_ip_allowed;
END;
$$;


ALTER FUNCTION "public"."check_ip_restriction"("p_user_id" "uuid", "p_ip_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_paso_has_dependencies"("paso_id_param" "uuid") RETURNS TABLE("has_dependencies" boolean, "dependency_count" integer, "dependency_details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."check_paso_has_dependencies"("paso_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tintas_esperadas text[];
  v_tintas_configuradas text[];
BEGIN
  -- Obtener las tintas configuradas para la tecnología
  SELECT tintas INTO v_tintas_esperadas
  FROM tecnologias
  WHERE id = p_tecnologia_id;

  -- Si no existe la tecnología, retornar false
  IF v_tintas_esperadas IS NULL THEN
    RETURN false;
  END IF;

  -- Si no hay tintas configuradas, retornar false
  IF array_length(v_tintas_esperadas, 1) IS NULL OR array_length(v_tintas_esperadas, 1) = 0 THEN
    RETURN false;
  END IF;

  -- Obtener las tintas que ya tienen paso asignado
  SELECT array_agg(tinta) INTO v_tintas_configuradas
  FROM tecnologias_tintas_pasos
  WHERE tecnologia_id = p_tecnologia_id;

  -- Si no hay configuraciones, retornar false
  IF v_tintas_configuradas IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar que todas las tintas esperadas estén configuradas
  -- Retorna true solo si ambos arrays contienen los mismos elementos
  RETURN (
    SELECT COUNT(*) = array_length(v_tintas_esperadas, 1)
    FROM unnest(v_tintas_esperadas) AS tinta
    WHERE tinta = ANY(v_tintas_configuradas)
  );
END;
$$;


ALTER FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") IS 'Verifica si todas las tintas de una tecnología tienen un paso de producción asignado. Retorna true solo si está completa.';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_pasos_por_etapa"("p_ruta_id" "uuid", "p_etapa" "text") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COUNT(*)::integer
  FROM rutas_produccion_pasos
  WHERE ruta_id = p_ruta_id AND etapa = p_etapa;
$$;


ALTER FUNCTION "public"."count_pasos_por_etapa"("p_ruta_id" "uuid", "p_etapa" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_medios_cobro_default"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."crear_medios_cobro_default"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text" DEFAULT 'viewer'::"text", "p_custom_role_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_caller_profile profiles;
  v_new_user_id uuid;
  v_company_id uuid;
  v_encrypted_password text;
  v_profile_created boolean;
  v_max_attempts int := 5;
  v_attempt int := 0;
BEGIN
  -- Validar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No autenticado'
    );
  END IF;

  -- Obtener perfil del llamador
  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = auth.uid();

  -- Validar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes permisos para crear usuarios'
    );
  END IF;

  -- Validar empresa
  IF v_caller_profile.company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes una empresa asignada'
    );
  END IF;

  v_company_id := v_caller_profile.company_id;

  -- Validar email
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email inválido'
    );
  END IF;

  -- Validar contraseña
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  -- Verificar si el email ya existe en auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Este email ya está registrado'
    );
  END IF;

  -- Validar rol (CON NUEVOS ROLES: operador_diseno, operador_taller)
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'operador_diseno', 'operador_taller', 'viewer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Rol inválido'
    );
  END IF;

  -- Generar ID para el nuevo usuario
  v_new_user_id := gen_random_uuid();

  -- Encriptar contraseña
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  BEGIN
    -- Insertar usuario en auth.users con metadata enriquecido
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      v_encrypted_password,
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', p_full_name,
        'company_id', v_company_id::text,
        'role', p_role,
        'custom_role_id', p_custom_role_id::text,
        'created_by_admin', true
      ),
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- Esperar a que el trigger cree el perfil (con reintentos)
    LOOP
      v_attempt := v_attempt + 1;

      SELECT EXISTS(
        SELECT 1 FROM profiles
        WHERE id = v_new_user_id
        AND company_id = v_company_id
      ) INTO v_profile_created;

      EXIT WHEN v_profile_created OR v_attempt >= v_max_attempts;

      -- Pequeña pausa entre intentos
      PERFORM pg_sleep(0.1);
    END LOOP;

    -- Si el perfil no se creó después de los reintentos, intentar crearlo manualmente
    IF NOT v_profile_created THEN
      BEGIN
        INSERT INTO profiles (
          id,
          email,
          full_name,
          company_id,
          role,
          custom_role_id,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          v_new_user_id,
          p_email,
          p_full_name,
          v_company_id,
          p_role,
          p_custom_role_id,
          true,
          now(),
          now()
        )
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error al crear perfil manualmente: %', SQLERRM;
      END;
    END IF;

    -- Registrar en audit_log (CORREGIDO: columnas correctas)
    INSERT INTO audit_log (
      user_id,
      company_id,
      action,
      module_id,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      v_company_id,
      'create',
      'team',
      'user',
      v_new_user_id,
      jsonb_build_object(
        'email', p_email,
        'full_name', p_full_name,
        'role', p_role
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_new_user_id,
      'message', 'Usuario creado exitosamente'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al crear usuario: ' || SQLERRM
    );
  END;
END;
$_$;


ALTER FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text", "p_custom_role_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text", "p_custom_role_id" "uuid") IS 'Crea un nuevo miembro del equipo. Roles válidos: super_admin, admin, manager, operador_diseno, operador_taller, viewer.
Actualizado: 2025-11-29 - Corregidas columnas de audit_log (module_id, resource_type, resource_id).';



CREATE OR REPLACE FUNCTION "public"."deactivate_team_member"("p_user_id" "uuid", "p_is_active" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfiles
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  -- Verificar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  -- No permitir desactivar super_admins
  IF v_target_profile.role = 'super_admin' AND NOT p_is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes desactivar un super admin');
  END IF;

  -- Actualizar estado
  UPDATE profiles
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_user_id;

  -- Audit log
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    CASE WHEN p_is_active THEN 'user_activated' ELSE 'user_deactivated' END,
    'user',
    p_user_id,
    jsonb_build_object('target_user', v_target_profile.email, 'is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Estado actualizado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."deactivate_team_member"("p_user_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_team_member"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfiles
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  -- Verificar permisos (solo super_admin puede eliminar)
  IF v_caller_profile.role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Solo super admins pueden eliminar usuarios');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes eliminar usuarios de otra empresa');
  END IF;

  -- No permitir eliminar otros super_admins
  IF v_target_profile.role = 'super_admin' AND p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes eliminar otro super admin');
  END IF;

  -- Audit log ANTES de eliminar
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'user_deleted',
    'user',
    p_user_id,
    jsonb_build_object('deleted_user', v_target_profile.email)
  );

  -- Eliminar usuario de auth.users (el cascade eliminará el profile)
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."delete_team_member"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_actualizar_estado_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_pasos integer;
  v_pasos_pendientes integer;
  v_pasos_finalizados integer;
  v_nuevo_estado text;
BEGIN
  -- Contar pasos del item
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado_paso = 'pendiente'),
    COUNT(*) FILTER (WHERE estado_paso IN ('completado', 'omitido'))
  INTO v_total_pasos, v_pasos_pendientes, v_pasos_finalizados
  FROM ordenes_trabajo_items_rutas
  WHERE orden_item_id = NEW.orden_item_id;

  -- Si no hay pasos, mantener estado pendiente
  IF v_total_pasos = 0 THEN
    v_nuevo_estado := 'pendiente';
  -- Si todos los pasos están finalizados (completado u omitido)
  ELSIF v_pasos_finalizados = v_total_pasos THEN
    v_nuevo_estado := 'finalizado';
  -- Si todos los pasos están pendientes
  ELSIF v_pasos_pendientes = v_total_pasos THEN
    v_nuevo_estado := 'pendiente';
  -- En cualquier otro caso (al menos un paso iniciado pero no todos finalizados)
  ELSE
    v_nuevo_estado := 'en_proceso';
  END IF;

  -- Actualizar estado del item solo si cambió
  UPDATE ordenes_trabajo_items
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = NEW.orden_item_id
    AND estado != v_nuevo_estado;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_actualizar_estado_item"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_actualizar_estado_item"() IS 'Actualiza automáticamente el estado de un item basándose en el estado de sus pasos de producción';



CREATE OR REPLACE FUNCTION "public"."fn_actualizar_estado_orden"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_items integer;
  v_items_pendientes integer;
  v_items_finalizados integer;
  v_nuevo_estado text;
  v_orden_id uuid;
  v_estado_actual text;
BEGIN
  -- Obtener orden_id
  SELECT orden_id INTO v_orden_id
  FROM ordenes_trabajo_items
  WHERE id = NEW.id;

  -- Obtener estado actual de la orden
  SELECT estado INTO v_estado_actual
  FROM ordenes_trabajo
  WHERE id = v_orden_id;

  -- No actualizar si la orden está cancelada
  IF v_estado_actual = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- Contar items de la orden
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'pendiente'),
    COUNT(*) FILTER (WHERE estado = 'finalizado')
  INTO v_total_items, v_items_pendientes, v_items_finalizados
  FROM ordenes_trabajo_items
  WHERE orden_id = v_orden_id;

  -- Si no hay items, mantener estado actual (no debería ocurrir)
  IF v_total_items = 0 THEN
    RETURN NEW;
  END IF;

  -- Determinar nuevo estado de la orden
  IF v_items_finalizados = v_total_items THEN
    -- Todos los items finalizados
    v_nuevo_estado := 'finalizada';
  ELSIF v_items_pendientes = v_total_items THEN
    -- Todos los items pendientes
    v_nuevo_estado := 'pendiente';
  ELSE
    -- Al menos un item en proceso o finalizado, pero no todos finalizados
    v_nuevo_estado := 'en_proceso';
  END IF;

  -- Actualizar estado de la orden solo si cambió
  UPDATE ordenes_trabajo
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = v_orden_id
    AND estado != v_nuevo_estado
    AND estado != 'cancelada'  -- Doble verificación
    AND estado != 'entregada';  -- No sobrescribir si ya fue entregada

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_actualizar_estado_orden"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_actualizar_estado_orden"() IS 'Actualiza automáticamente el estado de una orden basándose en el estado de sus items';



CREATE OR REPLACE FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Solo si cambió el total o el estado y está asociada a una OT
  IF NEW.orden_trabajo_id IS NOT NULL AND
     (OLD.total IS DISTINCT FROM NEW.total OR OLD.estado IS DISTINCT FROM NEW.estado) THEN

    -- El trigger principal fn_actualizar_total_orden_trabajo se encargará
    -- Esta función es por si necesitamos lógica adicional
    NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_actualizar_total_orden_trabajo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_totales RECORD;
BEGIN
  -- Solo procesar si hay orden_trabajo_id
  IF (TG_OP = 'DELETE' AND OLD.orden_trabajo_id IS NOT NULL) OR
     (TG_OP IN ('INSERT', 'UPDATE') AND NEW.orden_trabajo_id IS NOT NULL) THEN

    -- Obtener el ID de la orden de trabajo
    DECLARE
      v_orden_trabajo_id uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        v_orden_trabajo_id := OLD.orden_trabajo_id;
      ELSE
        v_orden_trabajo_id := NEW.orden_trabajo_id;
      END IF;

      -- Calcular totales consolidados
      SELECT * INTO v_totales
      FROM fn_calcular_total_consolidado_orden(v_orden_trabajo_id);

      -- Actualizar el total de la orden de trabajo
      -- Nota: Mantenemos subtotal y total_descuentos de la OT sin cambios
      -- Solo actualizamos el campo 'total' con el valor consolidado
      UPDATE ordenes_trabajo
      SET
        total = v_totales.total_final,
        updated_at = now()
      WHERE id = v_orden_trabajo_id;

    END;
  END IF;

  -- Para UPDATE, también verificar si cambió el orden_trabajo_id
  IF TG_OP = 'UPDATE' AND
     OLD.orden_trabajo_id IS DISTINCT FROM NEW.orden_trabajo_id THEN

    -- Actualizar la orden de trabajo anterior (si existe)
    IF OLD.orden_trabajo_id IS NOT NULL THEN
      SELECT * INTO v_totales
      FROM fn_calcular_total_consolidado_orden(OLD.orden_trabajo_id);

      UPDATE ordenes_trabajo
      SET
        total = v_totales.total_final,
        updated_at = now()
      WHERE id = OLD.orden_trabajo_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."fn_actualizar_total_orden_trabajo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_actualizar_total_orden_trabajo"() IS 'Trigger function que actualiza automáticamente el total de la orden de trabajo cuando se asocia, desasocia o modifica una orden de copiado.';



CREATE OR REPLACE FUNCTION "public"."fn_actualizar_totales_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_presupuesto_id uuid;
  v_nuevo_subtotal numeric;
  v_nuevo_total numeric;
BEGIN
  -- Determinar el presupuesto_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_presupuesto_id := OLD.presupuesto_id;
  ELSE
    v_presupuesto_id := NEW.presupuesto_id;
  END IF;

  -- Calcular nuevos totales
  SELECT
    COALESCE(SUM(precio_total), 0),
    COALESCE(SUM(precio_total), 0) -- Por ahora igual, después se agregarán descuentos
  INTO v_nuevo_subtotal, v_nuevo_total
  FROM presupuestos_items
  WHERE presupuesto_id = v_presupuesto_id;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    subtotal = v_nuevo_subtotal,
    total = v_nuevo_total - total_descuentos,
    updated_at = now()
  WHERE id = v_presupuesto_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."fn_actualizar_totales_presupuesto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente clients;
  v_result json;
BEGIN
  -- Verificar que el cliente existe y está pendiente
  SELECT * INTO v_cliente 
  FROM clients 
  WHERE id = p_cliente_id AND status_aprobacion = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente no encontrado o ya fue procesado'
    );
  END IF;

  -- Aprobar cliente
  UPDATE clients SET
    status_aprobacion = 'approved',
    is_active = true,
    aprobado_por = p_aprobado_por,
    fecha_aprobacion = now(),
    updated_by = p_aprobado_por,
    updated_at = now()
  WHERE id = p_cliente_id;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'nombre', v_cliente.nombre_fantasia,
    'whatsapp', v_cliente.whatsapp,
    'email', v_cliente.email
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") IS 'Aprueba un cliente pendiente, lo activa y registra quién lo aprobó';



CREATE OR REPLACE FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") RETURNS TABLE("links_asociados" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Función simplificada - ya no hay sistema temporal
  -- Los links ahora se agregan directamente asociados a la orden
  RAISE LOG 'fn_asociar_adjuntos_temporales: Links se asocian directamente, no hay temporales';
  
  RETURN QUERY SELECT 0::integer;
END;
$$;


ALTER FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") IS 'Función simplificada - links ahora se asocian directamente a la orden (no hay sistema temporal)';



CREATE OR REPLACE FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") RETURNS TABLE("archivos_asociados" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count int;
BEGIN
  -- Actualizar archivos temporales a orden real
  UPDATE centro_copiado_ordenes_archivos
  SET
    orden_copiado_id = p_orden_copiado_id,
    orden_temporal_id = NULL,
    temporal_creado_en = NULL,
    updated_at = NOW()
  WHERE
    orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;


ALTER FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") IS 'Asocia archivos temporales con una orden real. Usado al guardar orden.';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Función wrapper que aplica aumento de precios a la categoría especificada';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de gran formato';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de impresión láser';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de materiales rígidos. Incluye validación previa de precios huérfanos.';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de plotter de corte';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos portabanners';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de sellos';



CREATE OR REPLACE FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") IS 'Aplica un aumento o reducción porcentual a precios de productos de talonarios';



CREATE OR REPLACE FUNCTION "public"."fn_auto_complete_liquidacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_company_id UUID;
  v_numero_liquidacion TEXT;
BEGIN
  -- Auto-completar company_id desde el perfil del usuario actual
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM profiles
    WHERE id = auth.uid();
    
    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo obtener company_id del usuario actual';
    END IF;
    
    NEW.company_id := v_company_id;
  END IF;
  
  -- Auto-generar numero_liquidacion si no existe
  IF NEW.numero_liquidacion IS NULL OR NEW.numero_liquidacion = '' THEN
    NEW.numero_liquidacion := fn_generar_numero_liquidacion(NEW.company_id);
  END IF;
  
  -- Auto-completar created_by con el usuario actual
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_auto_complete_liquidacion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_auto_complete_liquidacion"() IS 'Auto-completa company_id, numero_liquidacion y created_by antes de INSERT en liquidaciones';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN EXTRACT(EPOCH FROM (p_fecha_fin - p_fecha_inicio)) / 60.0;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) IS 'Calcula la duración de un paso en minutos';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") RETURNS TABLE("espacio_usado_bytes" bigint, "espacio_usado_mb" numeric, "espacio_disponible_bytes" bigint, "espacio_disponible_mb" numeric, "porcentaje_usado" numeric, "limite_total_bytes" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limite_maximo bigint := 209715200; -- 200 MB
  v_total_usado bigint;
BEGIN
  -- Calcular total usado
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_usado
  FROM centro_copiado_ordenes_archivos
  WHERE orden_copiado_id = p_orden_id;

  RETURN QUERY
  SELECT
    v_total_usado,
    ROUND(v_total_usado::numeric / 1048576, 2),
    v_limite_maximo - v_total_usado,
    ROUND((v_limite_maximo - v_total_usado)::numeric / 1048576, 2),
    ROUND((v_total_usado::numeric / v_limite_maximo * 100), 2),
    v_limite_maximo;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") IS 'Calcula el espacio usado y disponible para una orden de copiado. Límite: 200MB.';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid" DEFAULT NULL::"uuid", "p_orden_temporal_id" "text" DEFAULT NULL::"text") RETURNS TABLE("espacio_usado_bytes" bigint, "espacio_usado_mb" numeric, "espacio_disponible_bytes" bigint, "espacio_disponible_mb" numeric, "porcentaje_usado" numeric, "limite_total_bytes" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limite_maximo bigint := 209715200; -- 200 MB
  v_total_usado bigint;
BEGIN
  -- Calcular total usado según parámetro
  IF p_orden_temporal_id IS NOT NULL THEN
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_usado
    FROM centro_copiado_ordenes_archivos
    WHERE orden_temporal_id = p_orden_temporal_id;
  ELSIF p_orden_id IS NOT NULL THEN
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_usado
    FROM centro_copiado_ordenes_archivos
    WHERE orden_copiado_id = p_orden_id;
  ELSE
    v_total_usado := 0;
  END IF;

  RETURN QUERY
  SELECT
    v_total_usado,
    ROUND(v_total_usado::numeric / 1048576, 2),
    v_limite_maximo - v_total_usado,
    ROUND((v_limite_maximo - v_total_usado)::numeric / 1048576, 2),
    ROUND((v_total_usado::numeric / v_limite_maximo * 100), 2),
    v_limite_maximo;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid", "p_orden_temporal_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid", "p_orden_temporal_id" "text") IS 'Calcula espacio usado para orden real o temporal. Límite: 200MB.';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_periodo_liquidacion"("p_cliente_id" "uuid", "p_fecha_referencia" "date" DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_calcular_periodo_liquidacion"("p_cliente_id" "uuid", "p_fecha_referencia" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_periodo_mensual"("p_dia_cierre" integer, "p_usa_ultimo_dia" boolean, "p_fecha_referencia" "date" DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_calcular_periodo_mensual"("p_dia_cierre" integer, "p_usa_ultimo_dia" boolean, "p_fecha_referencia" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_periodo_quincenal"("p_fecha_referencia" "date" DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_calcular_periodo_quincenal"("p_fecha_referencia" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_periodo_semanal"("p_dia_cierre" integer, "p_fecha_referencia" "date" DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_calcular_periodo_semanal"("p_dia_cierre" integer, "p_fecha_referencia" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date" DEFAULT NULL::"date", "p_fecha_fin" "date" DEFAULT NULL::"date") RETURNS TABLE("fecha_inicio" "date", "fecha_fin" "date")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE p_preset
    WHEN 'hoy' THEN
      RETURN QUERY SELECT CURRENT_DATE, CURRENT_DATE;

    WHEN 'esta_semana' THEN
      RETURN QUERY SELECT
        date_trunc('week', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'este_mes' THEN
      RETURN QUERY SELECT
        date_trunc('month', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'mes_pasado' THEN
      RETURN QUERY SELECT
        date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;

    WHEN 'ultimos_3_meses' THEN
      RETURN QUERY SELECT
        (CURRENT_DATE - INTERVAL '3 months')::date,
        CURRENT_DATE;

    WHEN 'ultimos_6_meses' THEN
      RETURN QUERY SELECT
        (CURRENT_DATE - INTERVAL '6 months')::date,
        CURRENT_DATE;

    WHEN 'este_anio' THEN
      RETURN QUERY SELECT
        date_trunc('year', CURRENT_DATE)::date,
        CURRENT_DATE;

    WHEN 'anio_pasado' THEN
      RETURN QUERY SELECT
        date_trunc('year', CURRENT_DATE - INTERVAL '1 year')::date,
        (date_trunc('year', CURRENT_DATE) - INTERVAL '1 day')::date;

    WHEN 'personalizado' THEN
      RETURN QUERY SELECT
        COALESCE(p_fecha_inicio, CURRENT_DATE),
        COALESCE(p_fecha_fin, CURRENT_DATE);

    ELSE
      RETURN QUERY SELECT CURRENT_DATE, CURRENT_DATE;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Calcula fecha inicio y fin según preset de período seleccionado';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_saldo_cuenta_corriente"("p_cliente_id" "uuid", "p_fecha_hasta" "date" DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_calcular_saldo_cuenta_corriente"("p_cliente_id" "uuid", "p_fecha_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") RETURNS TABLE("total_pendiente" numeric, "total_cc" numeric, "total_sin_cc" numeric, "cantidad_ordenes_cc" bigint, "cantidad_ordenes_sin_cc" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden_trabajo AS (
    SELECT 
      orden_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos
    GROUP BY orden_id
  ),
  pagos_por_orden_copiado AS (
    SELECT 
      orden_copiado_id,
      COALESCE(SUM(monto), 0) as total_pagado
    FROM centro_copiado_ordenes_pagos
    GROUP BY orden_copiado_id
  ),
  ordenes_trabajo_pendientes AS (
    SELECT 
      ot.id,
      ot.total,
      COALESCE(p.total_pagado, 0) as pagado,
      (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM ordenes_trabajo ot
    LEFT JOIN pagos_por_orden_trabajo p ON ot.id = p.orden_id
    LEFT JOIN clients c ON ot.cliente_id = c.id
    WHERE ot.company_id = p_company_id
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
  ),
  ordenes_copiado_pendientes AS (
    SELECT 
      cc.id,
      cc.total,
      COALESCE(pcc.total_pagado, 0) as pagado,
      (cc.total - COALESCE(pcc.total_pagado, 0)) as saldo_pendiente,
      c.tiene_cuenta_corriente
    FROM centro_copiado_ordenes cc
    LEFT JOIN pagos_por_orden_copiado pcc ON cc.id = pcc.orden_copiado_id
    LEFT JOIN clients c ON cc.cliente_id = c.id
    WHERE cc.company_id = p_company_id
      AND cc.estado != 'cancelada'
      AND (cc.total - COALESCE(pcc.total_pagado, 0)) > 0
  ),
  todas_ordenes_pendientes AS (
    SELECT saldo_pendiente, tiene_cuenta_corriente FROM ordenes_trabajo_pendientes
    UNION ALL
    SELECT saldo_pendiente, tiene_cuenta_corriente FROM ordenes_copiado_pendientes
  )
  SELECT 
    COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
    COALESCE(SUM(CASE WHEN tiene_cuenta_corriente THEN saldo_pendiente ELSE 0 END), 0) as total_cc,
    COALESCE(SUM(CASE WHEN NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL THEN saldo_pendiente ELSE 0 END), 0) as total_sin_cc,
    COUNT(*) FILTER (WHERE tiene_cuenta_corriente) as cantidad_ordenes_cc,
    COUNT(*) FILTER (WHERE NOT tiene_cuenta_corriente OR tiene_cuenta_corriente IS NULL) as cantidad_ordenes_sin_cc
  FROM todas_ordenes_pendientes;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") IS 'Calcula saldos pendientes de cobro incluyendo órdenes de trabajo y centro de copiado';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") RETURNS TABLE("subtotal_items" numeric, "subtotal_ordenes_copiado" numeric, "subtotal_total" numeric, "descuentos" numeric, "subtotal_con_descuentos" numeric, "iva" numeric, "total_final" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos_ot numeric;
  v_subtotal_oc numeric;
  v_subtotal_combinado numeric;
  v_subtotal_con_desc numeric;
  v_iva_calculado numeric;
  v_total_calculado numeric;
BEGIN
  -- Obtener subtotal y descuentos de la orden de trabajo
  SELECT
    COALESCE(ot.subtotal, 0),
    COALESCE(ot.total_descuentos, 0)
  INTO v_subtotal_ot, v_descuentos_ot
  FROM ordenes_trabajo ot
  WHERE ot.id = p_orden_trabajo_id;

  -- Si no existe la orden, retornar ceros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Obtener total de la orden de copiado asociada (si existe)
  SELECT COALESCE(oc.total, 0)
  INTO v_subtotal_oc
  FROM centro_copiado_ordenes oc
  WHERE oc.orden_trabajo_id = p_orden_trabajo_id
  AND oc.estado != 'cancelada';

  -- Si no hay OC asociada, usar 0
  v_subtotal_oc := COALESCE(v_subtotal_oc, 0);

  -- Calcular subtotal combinado
  v_subtotal_combinado := v_subtotal_ot + v_subtotal_oc;

  -- Aplicar descuentos sobre el total combinado
  v_subtotal_con_desc := v_subtotal_combinado - v_descuentos_ot;

  -- Calcular IVA (21%) sobre el subtotal con descuentos
  -- Nota: El IVA se aplica según la configuración del cliente
  -- Por ahora calculamos el 21% pero se puede ajustar según necesidad
  v_iva_calculado := v_subtotal_con_desc * 0.21;

  -- Total final
  v_total_calculado := v_subtotal_con_desc + v_iva_calculado;

  -- Retornar todos los valores calculados
  RETURN QUERY SELECT
    v_subtotal_ot,
    v_subtotal_oc,
    v_subtotal_combinado,
    v_descuentos_ot,
    v_subtotal_con_desc,
    v_iva_calculado,
    v_total_calculado;
END;
$$;


ALTER FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") IS 'Calcula los totales consolidados de una orden de trabajo incluyendo su orden de copiado asociada. Los descuentos e IVA se aplican sobre el total consolidado.';



CREATE OR REPLACE FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_count
  FROM clients
  WHERE company_id = p_company_id
    AND status_aprobacion = 'pending';
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") IS 'Retorna la cantidad de clientes pendientes de aprobación para una empresa';



CREATE OR REPLACE FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_items_sin_precio integer;
BEGIN
  SELECT COUNT(*)
  INTO v_items_sin_precio
  FROM presupuestos_items
  WHERE presupuesto_id = p_presupuesto_id
    AND (precio_unitario_final IS NULL OR precio_total IS NULL);
  
  RETURN COALESCE(v_items_sin_precio, 0);
END;
$$;


ALTER FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") IS 'Retorna la cantidad de items sin precio en un presupuesto';



CREATE OR REPLACE FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notas_adicionales" "text" DEFAULT NULL::"text", "p_monto_pago" numeric DEFAULT NULL::numeric, "p_medio_cobro_id" "uuid" DEFAULT NULL::"uuid", "p_referencia_pago" "text" DEFAULT NULL::"text", "p_rutas_personalizadas" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  v_orden_id uuid;
  v_presupuesto record;
  v_item record;
  v_nuevo_item_id uuid;
  v_fecha_entrega timestamptz;
  v_rutas_generadas integer;
  v_tipo_item_orden text;
  v_rutas_item jsonb;
  v_ruta record;
  v_request_id bigint;
  v_edge_function_url text;
BEGIN
  -- Obtener presupuesto
  SELECT * INTO v_presupuesto FROM presupuestos WHERE id = p_presupuesto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  IF v_presupuesto.estado != 'aprobado' THEN
    RAISE EXCEPTION 'El presupuesto debe estar aprobado para convertirse';
  END IF;

  IF v_presupuesto.orden_trabajo_id IS NOT NULL THEN
    RAISE EXCEPTION 'El presupuesto ya fue convertido a orden de trabajo';
  END IF;

  -- Validar pago
  IF p_monto_pago IS NOT NULL THEN
    IF p_monto_pago <= 0 THEN
      RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
    END IF;
    IF p_monto_pago > v_presupuesto.total THEN
      RAISE EXCEPTION 'El monto del pago no puede ser mayor al total del presupuesto';
    END IF;
    IF p_medio_cobro_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar un medio de cobro al registrar un pago';
    END IF;
  END IF;

  v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, v_presupuesto.fecha_entrega_estimada);

  -- Crear orden
  INSERT INTO ordenes_trabajo (
    company_id, cliente_id, vendedor_id, canal_venta, numero_orden,
    fecha_estimada_entrega, notas_internas, subtotal, total_descuentos, total,
    estado, created_by
  )
  VALUES (
    v_presupuesto.company_id, v_presupuesto.cliente_id, v_presupuesto.vendedor_id,
    v_presupuesto.canal_venta, generate_numero_orden(v_presupuesto.company_id),
    v_fecha_entrega, COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
    v_presupuesto.subtotal, v_presupuesto.total_descuentos, v_presupuesto.total,
    'pendiente', auth.uid()
  )
  RETURNING id INTO v_orden_id;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET orden_trabajo_id = v_orden_id, estado = 'convertido', updated_at = now()
  WHERE id = p_presupuesto_id;

  -- Copiar items
  FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    INSERT INTO ordenes_trabajo_items (
      orden_id, tipo_item, producto_id, producto_nombre, producto_categoria,
      descripcion, cantidad, configuracion, precio_base, precio_servicios,
      precio_acabados, precio_unitario_final, precio_total, tiempo_produccion_dias
    )
    VALUES (
      v_orden_id, v_tipo_item_orden, v_item.producto_id, v_item.producto_nombre,
      v_item.producto_categoria, v_item.descripcion, v_item.cantidad,
      v_item.configuracion, v_item.precio_base, v_item.precio_servicios,
      v_item.precio_acabados, v_item.precio_unitario_final, v_item.precio_total,
      v_item.tiempo_produccion_dias
    )
    RETURNING id INTO v_nuevo_item_id;

    -- Generar rutas de producción para productos del catálogo
    IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
      BEGIN
        RAISE NOTICE '[Conversión] Generando ruta para item % (producto: %, categoría: %)',
          v_nuevo_item_id, v_item.producto_id, v_item.producto_categoria;

        SELECT fn_generar_ruta_produccion_item(
          v_nuevo_item_id,
          v_item.producto_id,
          v_item.producto_categoria,
          v_item.configuracion,
          v_presupuesto.company_id
        ) INTO v_rutas_generadas;

        RAISE NOTICE '[Conversión] ✅ Rutas generadas: %', v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Conversión] ❌ Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;
    ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
      -- Generar rutas personalizadas
      v_rutas_item := p_rutas_personalizadas->v_item.id::text;
      IF v_rutas_item IS NOT NULL THEN
        FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado
          )
          VALUES (
            v_nuevo_item_id, v_presupuesto.company_id,
            (v_ruta.value->>'etapa')::text, (v_ruta.value->>'paso_id')::uuid,
            (v_ruta.value->>'paso_nombre')::text, (v_ruta.value->>'orden')::integer,
            true
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- Registrar pago inicial
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 THEN
    INSERT INTO ordenes_trabajo_pagos (
      orden_id, medio_cobro_id, monto, referencia_pago,
      notas, fecha_pago, created_by
    )
    VALUES (
      v_orden_id, p_medio_cobro_id, p_monto_pago, p_referencia_pago,
      'Pago inicial al convertir presupuesto', CURRENT_DATE, auth.uid()
    );
  END IF;

  -- Enviar notificación WhatsApp vía Edge Function (asíncrono, no bloqueante)
  BEGIN
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';

    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdnFwYWZnZ3ZjYnpydmJrZWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAzNDczMDIsImV4cCI6MjA0NTkyMzMwMn0.1iy_TgFZTwYIvdDPZAJ2_B8pjp0QfhsXlXb0n20KO7M'
      ),
      body := jsonb_build_object(
        'orden_id', v_orden_id::text,
        'company_id', v_presupuesto.company_id::text,
        'tipo', 'nueva_orden_trabajo',
        'orden_tipo', 'trabajo'
      )
    ) INTO v_request_id;

    RAISE LOG '[Conversión Presupuesto] Notificación WhatsApp enviada con request ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Conversión Presupuesto] Error enviando notificación WhatsApp: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;


ALTER FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone, "p_notas_adicionales" "text", "p_monto_pago" numeric, "p_medio_cobro_id" "uuid", "p_referencia_pago" "text", "p_rutas_personalizadas" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone, "p_notas_adicionales" "text", "p_monto_pago" numeric, "p_medio_cobro_id" "uuid", "p_referencia_pago" "text", "p_rutas_personalizadas" "jsonb") IS 'Convierte presupuesto aprobado a orden de trabajo con rutas de producción.
Genera automáticamente rutas para productos del catálogo usando fn_generar_ruta_produccion_item.
Envía notificación WhatsApp automáticamente usando Edge Function centralizada.
Nota: Las órdenes de trabajo ya no manejan archivos adjuntos.';



CREATE OR REPLACE FUNCTION "public"."fn_crear_cajas_desde_medios_cobro"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_crear_cajas_desde_medios_cobro"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_crear_movimiento_egreso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_movimiento_id uuid;
BEGIN
  -- Only create a movement in cajas_movimientos if a caja is involved (caja_id is NOT NULL)
  IF NEW.caja_id IS NOT NULL THEN
      INSERT INTO cajas_movimientos (
        caja_id,
        tipo_movimiento,
        monto,
        concepto,
        fecha,
        referencia_tipo,
        referencia_id,
        created_by
      ) VALUES (
        NEW.caja_id,
        'egreso',
        NEW.monto,
        NEW.concepto,
        NEW.fecha,
        'egreso',
        NEW.id,
        NEW.created_by
      )
      RETURNING id INTO v_movimiento_id;

      NEW.movimiento_id := v_movimiento_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_crear_movimiento_egreso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_crear_movimiento_ingreso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_movimiento_id uuid;
  v_comision numeric := 0;
BEGIN
  -- Obtener comisión del medio de cobro si existe
  IF NEW.medio_cobro_id IS NOT NULL THEN
    SELECT COALESCE(porcentaje_comision, 0) INTO v_comision
    FROM medios_cobro
    WHERE id = NEW.medio_cobro_id;

    v_comision := (NEW.monto * v_comision / 100);
  END IF;

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
    NEW.caja_id,
    'ingreso',
    NEW.monto,
    NEW.concepto,
    NEW.fecha,
    'ingreso_manual',
    NEW.id,
    NEW.medio_cobro_id,
    v_comision,
    NEW.notas,
    NEW.created_by
  ) RETURNING id INTO v_movimiento_id;

  -- Actualizar movimiento_id en el ingreso
  UPDATE ingresos
  SET movimiento_id = v_movimiento_id
  WHERE id = NEW.id;

  -- Si hay comisión, crear movimiento de egreso
  IF v_comision > 0 THEN
    INSERT INTO cajas_movimientos (
      caja_id,
      tipo_movimiento,
      monto,
      concepto,
      fecha,
      referencia_tipo,
      referencia_id,
      notas,
      created_by
    ) VALUES (
      NEW.caja_id,
      'egreso',
      v_comision,
      'Comisión ' || NEW.concepto,
      NEW.fecha,
      'ingreso_manual',
      NEW.id,
      'Comisión aplicada por medio de cobro',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_crear_movimiento_ingreso"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_crear_movimiento_ingreso"() IS 'Crea automáticamente un movimiento en cajas_movimientos cuando se registra un ingreso manual.
Si el medio de cobro tiene comisión, crea también un movimiento de egreso por la comisión.';



CREATE OR REPLACE FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_pausa ordenes_items_rutas_pausas%ROWTYPE;
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_item ordenes_trabajo_items%ROWTYPE;
  v_orden ordenes_trabajo%ROWTYPE;
  v_motivo pasos_motivos_pausa%ROWTYPE;
  v_admin_id uuid;
  v_tiempo_pausado interval;
  v_horas_pausado numeric;
BEGIN
  -- Obtener información completa de la pausa
  SELECT * INTO v_pausa
  FROM ordenes_items_rutas_pausas
  WHERE id = p_pausa_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Obtener ruta, item y orden
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = v_pausa.ruta_id;

  SELECT * INTO v_item
  FROM ordenes_trabajo_items
  WHERE id = v_ruta.orden_item_id;

  SELECT * INTO v_orden
  FROM ordenes_trabajo
  WHERE id = v_item.orden_id;

  SELECT * INTO v_motivo
  FROM pasos_motivos_pausa
  WHERE id = v_pausa.motivo_pausa_id;

  -- Calcular tiempo pausado
  v_tiempo_pausado := now() - v_pausa.fecha_inicio_pausa;
  v_horas_pausado := EXTRACT(EPOCH FROM v_tiempo_pausado) / 3600;

  -- Crear notificación para todos los super_admin y admin de la empresa
  FOR v_admin_id IN
    SELECT id FROM profiles
    WHERE company_id = v_ruta.company_id
    AND role IN ('super_admin', 'admin')
  LOOP
    INSERT INTO notificaciones_internas (
      company_id,
      usuario_id,
      tipo,
      titulo,
      mensaje,
      referencia_tipo,
      referencia_id,
      metadata
    ) VALUES (
      v_ruta.company_id,
      v_admin_id,
      'pausa_prolongada',
      'Paso pausado por más de 24 horas',
      format(
        'El paso "%s" de la orden %s lleva pausado %.1f horas. Motivo: %s',
        v_ruta.paso_nombre,
        v_orden.numero_orden,
        v_horas_pausado,
        v_motivo.nombre
      ),
      'pausa',
      p_pausa_id,
      jsonb_build_object(
        'orden_id', v_orden.id,
        'orden_numero', v_orden.numero_orden,
        'item_id', v_item.id,
        'ruta_id', v_ruta.id,
        'paso_nombre', v_ruta.paso_nombre,
        'motivo_nombre', v_motivo.nombre,
        'categoria_motivo', v_motivo.categoria,
        'horas_pausado', v_horas_pausado,
        'descripcion_pausa', v_pausa.descripcion
      )
    );
  END LOOP;

END;
$$;


ALTER FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") IS 'Crea notificaciones para super_admin y admin cuando una pausa supera las 24 horas. Incluye toda la información contextual en metadata.';



CREATE OR REPLACE FUNCTION "public"."fn_crear_ruta_resuelta_pedido"("p_pedido_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_pedido RECORD;
  v_ruta_paso RECORD;
  v_count integer := 0;
BEGIN
  -- Obtener datos del pedido
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_pedido_id;
  END IF;
  
  -- Limpiar rutas existentes si las hay
  DELETE FROM pedidos_rutas_resueltas WHERE pedido_id = p_pedido_id;
  
  -- Resolver ruta y crear registros
  FOR v_ruta_paso IN 
    SELECT * FROM fn_resolver_ruta_produccion(
      v_pedido.producto_id,
      v_pedido.opciones_seleccionadas
    )
  LOOP
    INSERT INTO pedidos_rutas_resueltas (
      pedido_id,
      tipo_etapa,
      paso_id,
      grupo_paso_id,
      paso_nombre,
      orden,
      estado_paso,
      origen_condicion
    ) VALUES (
      p_pedido_id,
      v_ruta_paso.tipo_etapa,
      v_ruta_paso.paso_id,
      v_ruta_paso.grupo_paso_id,
      v_ruta_paso.paso_nombre,
      v_ruta_paso.orden,
      'pendiente',
      v_ruta_paso.origen_condicion
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."fn_crear_ruta_resuelta_pedido"("p_pedido_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("paso_nombre" "text", "tipo_etapa" "text", "total_ejecuciones" bigint, "minutos_promedio" numeric, "desviacion_estandar" numeric, "coeficiente_variacion" numeric, "es_cuello_botella" boolean, "razon" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH paso_metricas AS (
    SELECT 
      pm.paso_id,
      pm.paso_nombre as pm_paso_nombre,
      pm.tipo_etapa as pm_tipo_etapa,
      pm.total_ejecuciones as pm_total_ejecuciones,
      pm.minutos_promedio as pm_minutos_promedio,
      pm.minutos_minimo as pm_minutos_minimo,
      pm.minutos_maximo as pm_minutos_maximo,
      pm.desviacion_estandar as pm_desviacion_estandar,
      pm.total_minutos as pm_total_minutos
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta) pm
  ),
  paso_promedio_general AS (
    SELECT AVG(pm.pm_minutos_promedio) as promedio_global
    FROM paso_metricas pm
  )
  SELECT
    pm.pm_paso_nombre as paso_nombre,
    pm.pm_tipo_etapa as tipo_etapa,
    pm.pm_total_ejecuciones as total_ejecuciones,
    pm.pm_minutos_promedio as minutos_promedio,
    pm.pm_desviacion_estandar as desviacion_estandar,
    ROUND((pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0))::numeric, 2) as coeficiente_variacion,
    (
      pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)
      OR (pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0)) > 0.5
    ) as es_cuello_botella,
    CASE
      WHEN pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)
        THEN 'Tiempo promedio muy alto'
      WHEN (pm.pm_desviacion_estandar / NULLIF(pm.pm_minutos_promedio, 0)) > 0.5
        THEN 'Alta variabilidad en tiempos'
      ELSE 'Rendimiento normal'
    END as razon
  FROM paso_metricas pm
  WHERE pm.pm_total_ejecuciones >= 5
  ORDER BY
    (pm.pm_minutos_promedio > (SELECT ppg.promedio_global * 2 FROM paso_promedio_general ppg)) DESC,
    pm.pm_minutos_promedio DESC;
END;
$$;


ALTER FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Identifica pasos problemáticos que representan cuellos de botella (fixed: ambiguous columns)';



CREATE OR REPLACE FUNCTION "public"."fn_debug_cashflow_wip"("p_company_id" "uuid") RETURNS TABLE("origen" "text", "numero" "text", "estado" "text", "fecha" "date", "monto_total" numeric, "monto_pagado" numeric, "saldo_pendiente" numeric, "tiene_cuenta_corriente" boolean, "status_msg" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    -- Ordenes Trabajo
    SELECT 
        'OT'::text as origen,
        ot.numero_orden::text as numero,
        ot.estado::text,
        ot.fecha_estimada_entrega::date as fecha,
        ot.total as monto_total,
        COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0) as monto_pagado,
        (ot.total - COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0)) as saldo_pendiente,
        COALESCE((SELECT c.tiene_cuenta_corriente FROM clients c WHERE c.id = ot.cliente_id), false) as tiene_cuenta_corriente,
        CASE 
            WHEN ot.total <= COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0) THEN 'Pagado Totalmente'
            WHEN ot.estado IN ('borrador', 'cotizacion', 'cancelado') THEN 'Estado Excluido (' || ot.estado || ')'
            WHEN COALESCE((SELECT c.tiene_cuenta_corriente FROM clients c WHERE c.id = ot.cliente_id), false) THEN 'Cliente Cta Cte'
            ELSE 'INCLUIDO'
        END as status_msg
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND (ot.estado NOT IN ('borrador', 'cotizacion', 'cancelado') OR (ot.total - COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0)) > 0)
    
    UNION ALL
    
    -- Centro Copiado
    SELECT 
        'CC'::text as origen,
        cco.numero_orden::text as numero,
        cco.estado::text,
        cco.fecha_entrega_estimada::date as fecha,
        cco.total as monto_total,
        COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0) as monto_pagado,
        (cco.total - COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0)) as saldo_pendiente,
        COALESCE((SELECT c.tiene_cuenta_corriente FROM clients c WHERE c.id = cco.cliente_id), false) as tiene_cuenta_corriente,
        CASE 
            WHEN cco.total <= COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0) THEN 'Pagado Totalmente'
            WHEN cco.orden_trabajo_id IS NOT NULL THEN 'Vinculada a OT'
            WHEN cco.estado IN ('cancelada') THEN 'Estado Excluido (' || cco.estado || ')'
            WHEN COALESCE((SELECT c.tiene_cuenta_corriente FROM clients c WHERE c.id = cco.cliente_id), false) THEN 'Cliente Cta Cte'
            ELSE 'INCLUIDO'
        END as status_msg
    FROM centro_copiado_ordenes cco
    WHERE cco.company_id = p_company_id
      AND (cco.estado NOT IN ('cancelada') OR (cco.total - COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0)) > 0);
END;
$$;


ALTER FUNCTION "public"."fn_debug_cashflow_wip"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_detectar_pausas_prolongadas"() RETURNS TABLE("pausa_id" "uuid", "ruta_id" "uuid", "paso_nombre" "text", "orden_numero" "text", "motivo" "text", "horas_pausado" numeric, "ultima_notificacion" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH pausas_activas AS (
    SELECT
      p.id as pausa_id,
      p.ruta_id,
      r.paso_nombre,
      o.numero_orden as orden_numero,
      m.nombre as motivo,
      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 3600 as horas_pausado,
      (
        SELECT MAX(created_at)
        FROM notificaciones_internas
        WHERE referencia_tipo = 'pausa'
        AND referencia_id = p.id
        AND tipo = 'pausa_prolongada'
      ) as ultima_notificacion
    FROM ordenes_items_rutas_pausas p
    JOIN ordenes_trabajo_items_rutas r ON r.id = p.ruta_id
    JOIN ordenes_trabajo_items i ON i.id = r.orden_item_id
    JOIN ordenes_trabajo o ON o.id = i.orden_id
    JOIN pasos_motivos_pausa m ON m.id = p.motivo_pausa_id
    WHERE p.fecha_fin_pausa IS NULL  -- Solo pausas activas
    AND r.estado_paso = 'pausado'
  )
  SELECT
    pa.pausa_id,
    pa.ruta_id,
    pa.paso_nombre,
    pa.orden_numero,
    pa.motivo,
    pa.horas_pausado,
    pa.ultima_notificacion
  FROM pausas_activas pa
  WHERE pa.horas_pausado >= 24  -- Más de 24 horas
  AND (
    pa.ultima_notificacion IS NULL  -- Primera notificación
    OR pa.ultima_notificacion < now() - INTERVAL '24 hours'  -- Re-notificar cada 24h
  );
END;
$$;


ALTER FUNCTION "public"."fn_detectar_pausas_prolongadas"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_detectar_pausas_prolongadas"() IS 'Detecta pausas activas que superan 24 horas y no han sido notificadas recientemente. Usado por cron job para enviar alertas automáticas.';



CREATE OR REPLACE FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("precio_id" "uuid", "producto_id" "uuid", "producto_nombre" "text", "material_id" "uuid", "material_nombre" "text", "variante_nombre" "text", "espesor" numeric, "precio_placa" numeric, "ancho_placa" numeric, "alto_placa" numeric, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") IS 'Identifica precios de materiales rígidos que no tienen una combinación válida en la tabla de materiales';



CREATE OR REPLACE FUNCTION "public"."fn_duplicar_plantilla_ruta"("p_producto_origen_id" "uuid", "p_producto_destino_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Limpiar plantillas existentes del producto destino
  DELETE FROM productos_rutas_plantillas WHERE producto_id = p_producto_destino_id;
  
  -- Copiar plantillas
  INSERT INTO productos_rutas_plantillas (
    producto_id,
    tipo_etapa,
    orden,
    es_condicional,
    condicion_tipo,
    condicion_config,
    paso_id,
    grupo_paso_id,
    paso_plantilla,
    nombre_display
  )
  SELECT
    p_producto_destino_id,
    tipo_etapa,
    orden,
    es_condicional,
    condicion_tipo,
    condicion_config,
    paso_id,
    grupo_paso_id,
    paso_plantilla,
    nombre_display
  FROM productos_rutas_plantillas
  WHERE producto_id = p_producto_origen_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."fn_duplicar_plantilla_ruta"("p_producto_origen_id" "uuid", "p_producto_destino_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_eliminar_movimiento_ingreso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Eliminar movimiento(s) asociado(s)
  -- Esto incluye el movimiento de ingreso y el de comisión si existe
  DELETE FROM cajas_movimientos
  WHERE referencia_tipo = 'ingreso_manual'
  AND referencia_id = OLD.id;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."fn_eliminar_movimiento_ingreso"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_eliminar_movimiento_ingreso"() IS 'Elimina automáticamente los movimientos en cajas_movimientos cuando se elimina un ingreso manual.
Esto revierte el saldo de la caja correctamente.';



CREATE OR REPLACE FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") IS 'Elimina precios de materiales rígidos que no tienen una combinación válida en la tabla de materiales';



CREATE OR REPLACE FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date" DEFAULT NULL::"date", "p_fecha_hasta" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total_ordenes_requieren_factura', COUNT(*),
    'ordenes_pendientes', COUNT(*) FILTER (WHERE facturada = false),
    'ordenes_facturadas', COUNT(*) FILTER (WHERE facturada = true),
    'monto_total_pendiente', COALESCE(SUM(total) FILTER (WHERE facturada = false), 0),
    'monto_total_facturado', COALESCE(SUM(total) FILTER (WHERE facturada = true), 0),
    'monto_iva_pendiente', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = false), 0),
    'monto_iva_facturado', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = true), 0),
    'promedio_dias_facturacion', COALESCE(
      ROUND(
        AVG(EXTRACT(DAY FROM (fecha_facturacion - fecha_creacion)))
        FILTER (WHERE facturada = true AND fecha_facturacion IS NOT NULL),
        2
      ),
      0
    ),
    'tasa_facturacion', CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE facturada = true)::numeric / COUNT(*)::numeric) * 100,
          2
        )
      ELSE 0
    END
  ) INTO v_stats
  FROM ordenes_trabajo
  WHERE company_id = p_company_id
    AND requiere_factura = true
    AND (p_fecha_desde IS NULL OR DATE(fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(fecha_creacion) <= p_fecha_hasta);

  RETURN v_stats;
END;
$$;


ALTER FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") IS 'Obtiene estadísticas y KPIs del sistema de facturación. Incluye totales, montos y tasa de facturación.';



CREATE OR REPLACE FUNCTION "public"."fn_evaluar_condicion_simple"("p_condicion_config" "jsonb", "p_opciones_cliente" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_tipo_condicion text;
  v_servicio_id text;
  v_acabado_id text;
  v_tecnologia_id text;
  v_material_id text;
  v_requiere_nivel boolean;
  v_nivel_id text;
  v_opcion jsonb;
  v_tintas_requeridas jsonb;
  v_tintas_cliente jsonb;
  v_variante_requerida text;
BEGIN
  v_tipo_condicion := p_condicion_config->>'tipo';
  
  -- Evaluar según tipo de condición
  CASE v_tipo_condicion
    
    -- Condición: Servicio con nivel específico
    WHEN 'condicional_servicio_nivel' THEN
      v_servicio_id := p_condicion_config->>'servicio_id';
      v_nivel_id := p_condicion_config->>'nivel_id';
      
      FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'servicios')
      LOOP
        IF (v_opcion->>'servicio_id' = v_servicio_id) AND 
           (v_opcion->>'nivel_id' = v_nivel_id) THEN
          RETURN true;
        END IF;
      END LOOP;
      RETURN false;
    
    -- Condición: Servicio sin importar nivel
    WHEN 'condicional_servicio_simple' THEN
      v_servicio_id := p_condicion_config->>'servicio_id';
      
      FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'servicios')
      LOOP
        IF v_opcion->>'servicio_id' = v_servicio_id THEN
          RETURN true;
        END IF;
      END LOOP;
      RETURN false;
    
    -- Condición: Acabado con nivel específico
    WHEN 'condicional_acabado_nivel' THEN
      v_acabado_id := p_condicion_config->>'acabado_id';
      v_nivel_id := p_condicion_config->>'nivel_id';
      
      FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'acabados')
      LOOP
        IF (v_opcion->>'acabado_id' = v_acabado_id) AND 
           (v_opcion->>'nivel_id' = v_nivel_id) THEN
          RETURN true;
        END IF;
      END LOOP;
      RETURN false;
    
    -- Condición: Acabado sin importar nivel
    WHEN 'condicional_acabado_simple' THEN
      v_acabado_id := p_condicion_config->>'acabado_id';
      
      FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'acabados')
      LOOP
        IF v_opcion->>'acabado_id' = v_acabado_id THEN
          RETURN true;
        END IF;
      END LOOP;
      RETURN false;
    
    -- Condición: Tecnología específica
    WHEN 'condicional_tecnologia' THEN
      v_tecnologia_id := p_condicion_config->>'tecnologia_id';
      
      IF (p_opciones_cliente->'tecnologia'->>'tecnologia_id' = v_tecnologia_id) THEN
        RETURN true;
      END IF;
      RETURN false;
    
    -- Condición: Combinación de tintas
    WHEN 'condicional_tintas' THEN
      v_tintas_requeridas := p_condicion_config->'tintas';
      v_tintas_cliente := p_opciones_cliente->'tecnologia'->'tintas';
      
      IF v_tintas_cliente @> v_tintas_requeridas THEN
        RETURN true;
      END IF;
      RETURN false;
    
    -- Condición: Material con variante
    WHEN 'condicional_material_variante' THEN
      v_material_id := p_condicion_config->>'material_id';
      v_variante_requerida := p_condicion_config->>'variante_nombre';
      
      FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'materiales')
      LOOP
        IF (v_opcion->>'material_id' = v_material_id) AND 
           (v_variante_requerida IS NULL OR v_opcion->>'variante_nombre' = v_variante_requerida) THEN
          RETURN true;
        END IF;
      END LOOP;
      RETURN false;
    
    ELSE
      RETURN false;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."fn_evaluar_condicion_simple"("p_condicion_config" "jsonb", "p_opciones_cliente" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text" DEFAULT 'week'::"text") RETURNS TABLE("periodo" timestamp with time zone, "periodo_label" "text", "total_ordenes" bigint, "ordenes_a_tiempo" bigint, "ordenes_retrasadas" bigint, "tasa_cumplimiento" numeric, "tendencia" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH periodos_data AS (
    SELECT
      DATE_TRUNC(p_intervalo, ot.fecha_completado) AS periodo,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) <= DATE(ot.fecha_estimada_entrega)) AS a_tiempo,
      COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) > DATE(ot.fecha_estimada_entrega)) AS retrasadas,
      CASE
        WHEN COUNT(*) = 0 THEN 0::numeric
        ELSE ROUND((COUNT(*) FILTER (WHERE DATE(ot.fecha_completado) <= DATE(ot.fecha_estimada_entrega))::numeric 
               / COUNT(*)::numeric * 100), 2)
      END AS tasa
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.estado IN ('finalizada', 'entregada')
      AND ot.fecha_completado IS NOT NULL
      AND ot.fecha_estimada_entrega IS NOT NULL
      AND ot.fecha_completado >= p_fecha_desde
      AND ot.fecha_completado <= p_fecha_hasta
    GROUP BY DATE_TRUNC(p_intervalo, ot.fecha_completado)
    ORDER BY DATE_TRUNC(p_intervalo, ot.fecha_completado) ASC
  ),
  periodos_con_tendencia AS (
    SELECT
      pd.periodo,
      pd.total,
      pd.a_tiempo,
      pd.retrasadas,
      pd.tasa,
      LAG(pd.tasa) OVER (ORDER BY pd.periodo) AS tasa_anterior
    FROM periodos_data pd
  )
  SELECT
    pct.periodo,
    CASE 
      WHEN p_intervalo = 'day' THEN TO_CHAR(pct.periodo, 'DD/MM/YYYY')
      WHEN p_intervalo = 'week' THEN 'Semana ' || TO_CHAR(pct.periodo, 'IW, YYYY')
      WHEN p_intervalo = 'month' THEN TO_CHAR(pct.periodo, 'Month YYYY')
      ELSE TO_CHAR(pct.periodo, 'DD/MM/YYYY')
    END AS periodo_label,
    pct.total::bigint AS total_ordenes,
    pct.a_tiempo::bigint AS ordenes_a_tiempo,
    pct.retrasadas::bigint AS ordenes_retrasadas,
    pct.tasa AS tasa_cumplimiento,
    CASE
      WHEN pct.tasa_anterior IS NULL THEN 'neutral'
      WHEN pct.tasa > pct.tasa_anterior THEN 'up'
      WHEN pct.tasa < pct.tasa_anterior THEN 'down'
      ELSE 'neutral'
    END AS tendencia
  FROM periodos_con_tendencia pct;
END;
$$;


ALTER FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") IS 'Calcula la evolución de la tasa de cumplimiento en el tiempo, agrupada por día, semana o mes. Útil para detectar tendencias y periodos problemáticos. (Versión corregida sin ambigüedades)';



CREATE OR REPLACE FUNCTION "public"."fn_expandir_grupo_pasos"("p_grupo_paso_id" "uuid") RETURNS TABLE("paso_id" "uuid", "paso_nombre" "text", "orden" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gpi.paso_id,
    p.nombre as paso_nombre,
    gpi.orden
  FROM grupos_pasos_items gpi
  JOIN pasos p ON p.id = gpi.paso_id
  WHERE gpi.grupo_paso_id = p_grupo_paso_id
  ORDER BY gpi.orden;
END;
$$;


ALTER FUNCTION "public"."fn_expandir_grupo_pasos"("p_grupo_paso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_partes text[] := ARRAY[]::text[];
  v_resultado text;
  v_espesor text;
  v_unidad_espesor text;
  v_cara_impresa text;
  v_servicio jsonb;
  v_acabado jsonb;
BEGIN
  -- Si no hay configuración, retornar vacío
  IF p_configuracion IS NULL OR p_configuracion = '{}'::jsonb THEN
    RETURN '';
  END IF;

  -- Dimensiones usando medida_ancho y medida_alto
  IF p_configuracion->>'medida_ancho' IS NOT NULL AND p_configuracion->>'medida_alto' IS NOT NULL THEN
    v_partes := array_append(v_partes,
      (p_configuracion->>'medida_ancho') || 'x' || (p_configuracion->>'medida_alto') || ' cm'
    );
  ELSIF p_configuracion->>'medida_ancho' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'medida_ancho') || ' cm');
  ELSIF p_configuracion->>'medida_alto' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'medida_alto') || ' cm');
  END IF;

  -- Material con variante
  IF p_configuracion->>'material_nombre' IS NOT NULL THEN
    IF p_configuracion->>'variante_nombre' IS NOT NULL THEN
      v_partes := array_append(v_partes,
        (p_configuracion->>'material_nombre') || ' - ' || (p_configuracion->>'variante_nombre')
      );
    ELSE
      v_partes := array_append(v_partes, p_configuracion->>'material_nombre');
    END IF;
  END IF;

  -- Espesor/Gramaje con unidad correcta
  v_espesor := p_configuracion->>'espesor';
  v_unidad_espesor := p_configuracion->>'unidad_espesor';

  IF v_espesor IS NOT NULL THEN
    IF v_unidad_espesor IS NOT NULL THEN
      -- Para gramajes (gr o g), agregar espacio antes de la unidad
      IF v_unidad_espesor IN ('gr', 'g') THEN
        v_partes := array_append(v_partes, v_espesor || ' ' || v_unidad_espesor);
      ELSE
        -- Para otras unidades (mm, cm, etc), no agregar espacio
        v_partes := array_append(v_partes, v_espesor || v_unidad_espesor);
      END IF;
    ELSE
      -- Fallback: si solo tiene espesor sin unidad
      v_partes := array_append(v_partes, v_espesor || 'mm');
    END IF;
  ELSIF p_configuracion->>'gramaje' IS NOT NULL THEN
    -- Fallback legacy para compatibilidad
    v_partes := array_append(v_partes, (p_configuracion->>'gramaje') || ' g');
  END IF;

  -- Tecnología
  IF p_configuracion->>'tecnologia_nombre' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tecnologia_nombre');
  END IF;

  -- Tinta
  IF p_configuracion->>'tinta_nombre' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tinta_nombre');
  END IF;

  -- Cara impresa (formatear correctamente)
  v_cara_impresa := p_configuracion->>'cara_impresa';
  IF v_cara_impresa IS NOT NULL THEN
    CASE v_cara_impresa
      WHEN '1/0' THEN v_partes := array_append(v_partes, 'Frente');
      WHEN '1/1' THEN v_partes := array_append(v_partes, 'Frente y Dorso');
      WHEN 'frente_y_dorso' THEN v_partes := array_append(v_partes, 'Frente y Dorso');
      WHEN 'solo_frente' THEN v_partes := array_append(v_partes, 'Frente');
      ELSE v_partes := array_append(v_partes, v_cara_impresa);
    END CASE;
  END IF;

  -- Color (para algunos productos)
  IF p_configuracion->>'color' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'color');
  END IF;

  -- Marca (para algunos productos)
  IF p_configuracion->>'marca' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'marca');
  END IF;

  -- Servicios seleccionados (objetos con nombre y nivel)
  IF jsonb_typeof(p_configuracion->'servicios_seleccionados') = 'array'
     AND jsonb_array_length(p_configuracion->'servicios_seleccionados') > 0 THEN
    FOR v_servicio IN SELECT * FROM jsonb_array_elements(p_configuracion->'servicios_seleccionados')
    LOOP
      IF v_servicio->>'nivel' IS NOT NULL THEN
        v_partes := array_append(v_partes,
          'Servicio: ' || (v_servicio->>'nombre') || ' (' || (v_servicio->>'nivel') || ')'
        );
      ELSE
        v_partes := array_append(v_partes, 'Servicio: ' || (v_servicio->>'nombre'));
      END IF;
    END LOOP;
  END IF;

  -- Acabados seleccionados (objetos con nombre y nivel)
  IF jsonb_typeof(p_configuracion->'acabados_seleccionados') = 'array'
     AND jsonb_array_length(p_configuracion->'acabados_seleccionados') > 0 THEN
    FOR v_acabado IN SELECT * FROM jsonb_array_elements(p_configuracion->'acabados_seleccionados')
    LOOP
      IF v_acabado->>'nivel' IS NOT NULL THEN
        v_partes := array_append(v_partes,
          'Acabado: ' || (v_acabado->>'nombre') || ' (' || (v_acabado->>'nivel') || ')'
        );
      ELSE
        v_partes := array_append(v_partes, 'Acabado: ' || (v_acabado->>'nombre'));
      END IF;
    END LOOP;
  END IF;

  -- Cantidad de páginas (talonarios)
  IF p_configuracion->>'cantidad_paginas' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'cantidad_paginas') || ' hojas');
  END IF;

  -- Tipo de copia (talonarios)
  IF p_configuracion->>'tipo_copia' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tipo_copia');
  END IF;

  -- Centro Copiado: Campos específicos
  IF p_categoria ILIKE '%copiado%' THEN
    -- Tamaño de papel
    IF p_configuracion->>'tamanio_papel' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tamanio_papel');
    END IF;

    -- Tipo de papel
    IF p_configuracion->>'tipo_papel' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tipo_papel');
    END IF;

    -- Tinta (conversión CMYK = Color, BN = B/N)
    IF p_configuracion->>'tipo_tinta' = 'CMYK' THEN
      v_partes := array_append(v_partes, 'Color');
    ELSIF p_configuracion->>'tipo_tinta' = 'BN' THEN
      v_partes := array_append(v_partes, 'B/N');
    ELSIF p_configuracion->>'tinta' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tinta');
    END IF;

    -- Cantidad de hojas
    IF p_configuracion->>'cantidad_hojas' IS NOT NULL THEN
      v_partes := array_append(v_partes, (p_configuracion->>'cantidad_hojas') || ' hojas');
    END IF;

    -- Anillado
    IF p_configuracion->'anillado'->>'tipo' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Anillado: ' || (p_configuracion->'anillado'->>'tipo'));
    ELSIF p_configuracion->>'tipo_anillado' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Anillado: ' || (p_configuracion->>'tipo_anillado'));
    END IF;

    -- Plastificado
    IF p_configuracion->'plastificado'->>'tipo' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Plastificado: ' || (p_configuracion->'plastificado'->>'tipo'));
    ELSIF p_configuracion->>'tipo_plastificado' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Plastificado: ' || (p_configuracion->>'tipo_plastificado'));
    END IF;
  END IF;

  -- Sellos: Dimensiones en mm
  IF p_categoria ILIKE '%sello%' THEN
    IF p_configuracion->>'tipo_sello' IS NOT NULL THEN
      v_partes := array_prepend(p_configuracion->>'tipo_sello', v_partes);
    END IF;

    -- Redefinir dimensiones para sellos (en mm)
    v_partes := array_remove(v_partes, NULL);
    IF array_length(v_partes, 1) > 0 AND v_partes[1] LIKE '% cm' THEN
      -- Reemplazar primera parte si es dimensión en cm
      IF p_configuracion->>'medida_ancho' IS NOT NULL AND p_configuracion->>'medida_alto' IS NOT NULL THEN
        v_partes[1] := (p_configuracion->>'medida_ancho') || 'x' || (p_configuracion->>'medida_alto') || ' mm';
      END IF;
    END IF;

    IF p_configuracion->>'tipo_tinta' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tipo_tinta');
    END IF;
  END IF;

  -- Unir todas las partes con ' | ' (en lugar de ' • ')
  IF array_length(v_partes, 1) > 0 THEN
    v_resultado := array_to_string(v_partes, ' | ');
  ELSE
    v_resultado := '';
  END IF;

  RETURN v_resultado;
END;
$$;


ALTER FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") IS 'Formatea un objeto de configuración JSONB en texto legible. Usa los mismos campos que OrdenItemsTab.tsx para consistencia.';



CREATE OR REPLACE FUNCTION "public"."fn_generar_numero_liquidacion"("p_company_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."fn_generar_numero_liquidacion"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generar_numero_presupuesto"("p_company_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_year text;
  v_counter integer;
  v_numero text;
BEGIN
  -- Obtener año actual
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Obtener el contador de presupuestos del año actual para esta company
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero_presupuesto ~ '^PRES-[0-9]{4}-[0-9]+$' 
      THEN CAST(SPLIT_PART(numero_presupuesto, '-', 3) AS integer)
      ELSE 0 
    END
  ), 0) + 1
  INTO v_counter
  FROM presupuestos
  WHERE company_id = p_company_id
    AND numero_presupuesto LIKE 'PRES-' || v_year || '-%';
  
  -- Generar número con formato: PRES-YYYY-NNNN
  v_numero := 'PRES-' || v_year || '-' || LPAD(v_counter::text, 4, '0');
  
  RETURN v_numero;
END;
$_$;


ALTER FUNCTION "public"."fn_generar_numero_presupuesto"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_ruta_id uuid;
  v_paso_record record;
  v_count integer := 0;
  v_paso_nombre text;
  v_incluir_paso boolean;
  v_servicios jsonb;
  v_acabados jsonb;
  v_tecnologia_id uuid;
  v_tinta_codigo text;
  v_paso_id_especifico uuid;
  v_servicio_id uuid;
  v_nivel_nombre text;
  v_acabado_id uuid;
BEGIN
  -- Extraer datos de configuración
  v_servicios := COALESCE(
    p_configuracion->'servicios_seleccionados',
    p_configuracion->'servicios',
    '[]'::jsonb
  );

  v_acabados := COALESCE(
    p_configuracion->'acabados_seleccionados',
    p_configuracion->'acabados',
    '[]'::jsonb
  );

  v_tecnologia_id := (p_configuracion->>'tecnologia_id')::uuid;
  v_tinta_codigo := COALESCE(p_configuracion->>'tipo_tinta', p_configuracion->>'tinta');

  RAISE NOTICE '[Generar Ruta] Item: %, Categoria: %', p_orden_item_id, p_categoria;

  -- Obtener ruta_produccion_id según la categoría del producto
  CASE p_categoria
    WHEN 'Impresion Laser' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_impresion_laser 
      WHERE id = p_producto_id;

    WHEN 'Gran Formato', 'Impresion Gran Formato' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_gran_formato 
      WHERE id = p_producto_id;

    WHEN 'Materiales Rigidos' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_materiales_rigidos 
      WHERE id = p_producto_id;

    WHEN 'Plotter de Corte' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_plotter_corte 
      WHERE id = p_producto_id;

    WHEN 'Portabanners' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_portabanners 
      WHERE id = p_producto_id;

    WHEN 'Sellos' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_sellos 
      WHERE id = p_producto_id;

    WHEN 'Talonarios' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_talonarios 
      WHERE id = p_producto_id;

    ELSE
      RAISE NOTICE '[Generar Ruta] ⚠️ Categoría no reconocida: %', p_categoria;
      RETURN 0;
  END CASE;

  IF v_ruta_id IS NULL THEN
    RAISE NOTICE '[Generar Ruta] ⚠️ Producto sin ruta de producción asignada';
    RETURN 0;
  END IF;

  RAISE NOTICE '[Generar Ruta] Ruta encontrada: %', v_ruta_id;

  -- Iterar sobre los pasos de la ruta
  FOR v_paso_record IN
    SELECT 
      rpp.id,
      rpp.etapa,
      rpp.paso_id,
      rpp.orden,
      rpp.es_obligatorio,
      rpp.tipo_condicion,
      rpp.configuracion_condicion,
      p.nombre as paso_nombre
    FROM rutas_produccion_pasos rpp
    LEFT JOIN pasos p ON p.id = rpp.paso_id
    WHERE rpp.ruta_id = v_ruta_id
    ORDER BY rpp.etapa, rpp.orden
  LOOP
    v_incluir_paso := false;
    v_paso_id_especifico := v_paso_record.paso_id;

    -- Evaluar si incluir el paso según tipo_condicion
    CASE v_paso_record.tipo_condicion

      WHEN 'sin_condicion' THEN
        v_incluir_paso := true;

      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_servicios) as s
          WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        );

      WHEN 'servicio_con_nivel' THEN
        SELECT s->>'servicio_id', COALESCE(s->>'nivel', s->>'nivel_nombre')
        INTO v_servicio_id, v_nivel_nombre
        FROM jsonb_array_elements(v_servicios) as s
        WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        LIMIT 1;

        IF v_servicio_id IS NOT NULL THEN
          v_incluir_paso := true;

          IF v_paso_record.configuracion_condicion->'mapeo_niveles' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_niveles' != '{}'::jsonb 
             AND v_nivel_nombre IS NOT NULL THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_niveles'->>v_nivel_nombre)::uuid;
          END IF;

          IF v_paso_id_especifico IS NULL AND v_nivel_nombre IS NOT NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM servicios_niveles_precio
            WHERE servicio_id = v_servicio_id
              AND nombre = v_nivel_nombre
            LIMIT 1;
          END IF;
        END IF;

      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        );

      WHEN 'acabado_con_nivel' THEN
        SELECT a->>'acabado_id', COALESCE(a->>'nivel', a->>'nivel_nombre')
        INTO v_acabado_id, v_nivel_nombre
        FROM jsonb_array_elements(v_acabados) as a
        WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        LIMIT 1;

        IF v_acabado_id IS NOT NULL THEN
          v_incluir_paso := true;

          IF v_paso_record.configuracion_condicion->'mapeo_niveles' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_niveles' != '{}'::jsonb 
             AND v_nivel_nombre IS NOT NULL THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_niveles'->>v_nivel_nombre)::uuid;
          END IF;

          IF v_paso_id_especifico IS NULL AND v_nivel_nombre IS NOT NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM acabados_niveles_precio
            WHERE acabado_id = v_acabado_id
              AND nombre = v_nivel_nombre
            LIMIT 1;
          END IF;
        END IF;

      WHEN 'tecnologia_tinta' THEN
        IF v_tecnologia_id IS NOT NULL AND v_tinta_codigo IS NOT NULL THEN
          v_incluir_paso := true;

          IF v_paso_record.configuracion_condicion->'mapeo_tintas' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_tintas' != '{}'::jsonb THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_tintas'->>v_tinta_codigo)::uuid;
          END IF;

          IF v_paso_id_especifico IS NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM tecnologias_tintas_pasos
            WHERE tecnologia_id = v_tecnologia_id
              AND tinta = v_tinta_codigo
            LIMIT 1;
          END IF;
        END IF;

      ELSE
        v_incluir_paso := v_paso_record.es_obligatorio;
    END CASE;

    IF v_paso_record.es_obligatorio THEN
      v_incluir_paso := true;
    END IF;

    -- Solo insertar si debe incluirse Y tiene paso_id válido
    IF v_incluir_paso AND v_paso_id_especifico IS NOT NULL THEN
      -- ✅ OBTENER NOMBRE REAL JUSTO ANTES DE INSERTAR
      SELECT nombre INTO v_paso_nombre
      FROM pasos
      WHERE id = v_paso_id_especifico;
      
      v_paso_nombre := COALESCE(v_paso_nombre, 'Paso sin nombre');

      INSERT INTO ordenes_trabajo_items_rutas (
        company_id,
        orden_item_id,
        tipo_etapa,
        paso_id,
        paso_nombre,
        orden,
        es_modificado,
        origen_plantilla_id
      )
      VALUES (
        p_company_id,
        p_orden_item_id,
        v_paso_record.etapa,
        v_paso_id_especifico,
        v_paso_nombre,
        v_paso_record.orden,
        false,
        v_paso_record.id
      );

      v_count := v_count + 1;
      RAISE NOTICE '[Generar Ruta] ✅ Paso insertado: % (id: %)', v_paso_nombre, v_paso_id_especifico;
    ELSE
      RAISE NOTICE '[Generar Ruta] ⏭️ Paso NO insertado: condición=%, paso_id=%', 
        v_incluir_paso, v_paso_id_especifico;
    END IF;
  END LOOP;

  RAISE NOTICE '[Generar Ruta] ✅ Total pasos generados: %', v_count;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") IS 'Genera rutas de producción con consultas dinámicas a tablas de niveles.
Obtiene el nombre real del paso justo antes de insertar para asegurar consistencia.';



CREATE OR REPLACE FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer DEFAULT 30) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token text;
  v_existe boolean;
  v_intentos integer := 0;
  v_max_intentos integer := 10;
  v_expires_at timestamptz;
BEGIN
  -- Calcular fecha de expiración
  v_expires_at := now() + (p_dias_validez || ' days')::interval;

  -- Generar token único
  LOOP
    -- Generar token de 8 caracteres alfanuméricos (mayúsculas y números)
    v_token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Verificar si ya existe para esta empresa
    SELECT EXISTS(
      SELECT 1
      FROM facturas_urls_cortas
      WHERE company_id = p_company_id
        AND token_corto = v_token
    ) INTO v_existe;

    -- Si no existe, salir del loop
    EXIT WHEN NOT v_existe;

    -- Incrementar intentos
    v_intentos := v_intentos + 1;

    -- Si supera máximo de intentos, error
    IF v_intentos >= v_max_intentos THEN
      RAISE EXCEPTION 'No se pudo generar token único después de % intentos', v_max_intentos;
    END IF;
  END LOOP;

  -- Insertar registro
  INSERT INTO facturas_urls_cortas (
    company_id,
    orden_trabajo_id,
    token_corto,
    factura_storage_path,
    numero_factura,
    expires_at
  ) VALUES (
    p_company_id,
    p_orden_trabajo_id,
    v_token,
    p_factura_storage_path,
    p_numero_factura,
    v_expires_at
  );

  -- Retornar token generado
  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer) IS 'Genera un token único de 8 caracteres para acceso rápido a una factura.';



CREATE OR REPLACE FUNCTION "public"."fn_get_cajas_dashboard"("p_company_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("id" "uuid", "nombre" "text", "tipo" "text", "moneda" "text", "saldo_actual" numeric, "es_principal" boolean, "is_active" boolean, "ingresos_hoy" numeric, "egresos_hoy" numeric, "movimientos_hoy" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_role text;
BEGIN
    SELECT p.role INTO v_user_role FROM profiles p WHERE p.id = auth.uid();

    RETURN QUERY
    SELECT 
        c.id,
        c.nombre,
        c.tipo,
        c.moneda,
        c.saldo_actual,
        c.es_principal,
        c.is_active,
        COALESCE(sums.ingresos, 0) as ingresos_hoy,
        COALESCE(sums.egresos, 0) as egresos_hoy,
        COALESCE(sums.movimientos, 0)::integer as movimientos_hoy
    FROM cajas c
    LEFT JOIN (
        SELECT 
            caja_id_grouped,
            SUM(ingreso) as ingresos,
            SUM(egreso) as egresos,
            SUM(count_mov) as movimientos
        FROM (
            -- Movimientos donde la caja es la principal (caja_id)
            SELECT 
                cm.caja_id as caja_id_grouped,
                SUM(CASE WHEN cm.tipo_movimiento = 'ingreso' THEN cm.monto ELSE 0 END) as ingreso,
                SUM(CASE 
                    WHEN cm.tipo_movimiento = 'egreso' THEN cm.monto 
                    WHEN cm.tipo_movimiento = 'transferencia' THEN cm.monto -- Egreso por transferencia
                    ELSE 0 
                END) as egreso,
                COUNT(*) as count_mov
            FROM cajas_movimientos cm
            WHERE cm.fecha = p_date
            GROUP BY cm.caja_id

            UNION ALL

            -- Movimientos donde la caja es DESTINO de una transferencia
            SELECT 
                cm.caja_destino_id as caja_id_grouped,
                SUM(cm.monto) as ingreso, -- Entra dinero
                0 as egreso,
                COUNT(*) as count_mov
            FROM cajas_movimientos cm
            WHERE cm.fecha = p_date 
              AND cm.tipo_movimiento = 'transferencia'
              AND cm.caja_destino_id IS NOT NULL
            GROUP BY cm.caja_destino_id
        ) combined
        GROUP BY caja_id_grouped
    ) sums ON sums.caja_id_grouped = c.id
    WHERE c.company_id = p_company_id
      AND c.is_active = true
      AND (
        v_user_role IN ('super_admin', 'admin', 'manager')
        OR
        (
            v_user_role = 'operador_diseno' 
            AND c.tipo = 'efectivo' 
            AND c.es_principal = false
        )
      )
    ORDER BY c.es_principal DESC, c.tipo, c.nombre;
END;
$$;


ALTER FUNCTION "public"."fn_get_cajas_dashboard"("p_company_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_cajas_options"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "nombre" "text", "tipo" "text", "es_principal" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Fix: usar alias 'p' para evitar ambigüedad
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.company_id = p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.nombre, c.tipo, c.es_principal
  FROM cajas c
  WHERE c.company_id = p_company_id AND c.is_active = true
  ORDER BY c.es_principal DESC, c.nombre ASC;
END;
$$;


ALTER FUNCTION "public"."fn_get_cajas_options"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_cashflow_projection"("p_company_id" "uuid", "p_days_to_project" integer DEFAULT 90) RETURNS TABLE("fecha" "date", "ingreso_cheques" numeric, "ingreso_liquidaciones" numeric, "ingreso_wip" numeric, "egreso_cheques" numeric, "egreso_tarjetas" numeric, "egreso_recurrentes" numeric, "egreso_compras" numeric, "total_ingresos" numeric, "total_egresos" numeric, "saldo_diario" numeric, "saldo_acumulado" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_saldo_inicial NUMERIC;
    v_end_date DATE;
BEGIN
    -- 1. Get Initial Balance
    SELECT COALESCE(SUM(saldo_actual), 0)
    INTO v_saldo_inicial
    FROM cajas
    WHERE company_id = p_company_id;

    v_end_date := CURRENT_DATE + p_days_to_project;

    RETURN QUERY
    WITH calendar AS (
        SELECT i::date as fecha, 
               EXTRACT(DOW FROM i::date) as dow,
               EXTRACT(DAY FROM i::date) as dom
        FROM generate_series(CURRENT_DATE, v_end_date, '1 day'::interval) i
    ),
    movements AS (
        -- [INGRESO] Cheques Recibidos
        SELECT 
            fecha_pago::date as fecha,
            monto as monto,
            'cheque_in' as type
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'recibido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL
        
        -- [EGRESO] Cheques Emitidos
        SELECT 
            fecha_pago::date as fecha,
            monto as monto,
            'cheque_out' as type
        FROM cheques_cartera
        WHERE company_id = p_company_id
          AND direction = 'emitido'
          AND estado IN ('pendiente') 
          AND fecha_pago >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Tarjetas Resumenes
        SELECT 
            fecha_vencimiento::date as fecha,
            (total_consumos - total_pagado) as monto,
            'tarjeta_out' as type
        FROM tarjetas_resumenes
        WHERE company_id = p_company_id
          AND estado != 'pagado'
          AND fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [EGRESO] Facturas de Compra (Proveedores) -- [NEW SECTION]
        SELECT 
            cp.fecha_vencimiento::date as fecha,
            (cp.monto_total - COALESCE((SELECT SUM(e.monto) FROM egresos e WHERE e.compra_id = cp.id), 0)) as monto,
            'compra_out' as type
        FROM compras_proveedores cp
        WHERE cp.company_id = p_company_id
          AND cp.estado != 'pagado'
          AND cp.fecha_vencimiento >= CURRENT_DATE
        
        UNION ALL

        -- [EGRESO] Gastos Recurrentes
        SELECT 
            c.fecha,
            re.amount as monto,
            'recurring_out' as type
        FROM recurring_expenses re
        CROSS JOIN calendar c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          AND c.fecha >= re.start_date
          AND (re.end_date IS NULL OR c.fecha <= re.end_date)
          AND (
            (re.frequency = 'weekly' AND EXTRACT(DOW FROM c.fecha) = re.day_of_week) OR
            (re.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM c.fecha)::int, 2) = 0 AND EXTRACT(DOW FROM c.fecha) = re.day_of_week) OR
            (re.frequency = 'monthly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month) OR
            (re.frequency = 'quarterly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month AND MOD(EXTRACT(MONTH FROM c.fecha)::int - 1, 3) = 0) OR
            (re.frequency = 'yearly' AND EXTRACT(DAY FROM c.fecha) = re.day_of_month AND EXTRACT(MONTH FROM c.fecha) = EXTRACT(MONTH FROM re.start_date))
          )
          -- [OPTIONAL BUT GOOD] Exclude recurrentes manually closed in this period? 
          -- For simplicity in cashflow projection, we usually assume it happens unless explicitly closed.
          -- Ideally we should check recurring_executions, but querying it for every date in calendar might be heavy. 
          -- Leaving as is for now (Projected Ideal Scenario).

        UNION ALL

        -- [INGRESO] Liquidaciones (Cuentas Corrientes)
        SELECT 
            fecha_vencimiento::date as fecha,
            saldo_pendiente as monto,
            'liquidacion_in' as type
        FROM liquidaciones
        WHERE company_id = p_company_id
          AND estado IN ('pendiente', 'pagada_parcial', 'vencida')
          AND fecha_vencimiento >= CURRENT_DATE

        UNION ALL

        -- [INGRESO] WIP Orders (Ordenes Trabajo)
        SELECT 
            GREATEST(COALESCE(fecha_estimada_entrega, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM ordenes_trabajo_pagos WHERE orden_id = ot.id), 0))) as monto,
            'wip_in' as type
        FROM ordenes_trabajo ot
        WHERE company_id = p_company_id
          AND estado NOT IN ('borrador', 'cotizacion', 'cancelado')
          AND NOT EXISTS (
              SELECT 1 FROM clients c 
              WHERE c.id = ot.cliente_id 
              AND c.tiene_cuenta_corriente = true
          )
        
        UNION ALL

        -- [INGRESO] WIP Orders (Centro Copiado)
        SELECT 
            GREATEST(COALESCE(fecha_entrega_estimada, CURRENT_DATE)::date, CURRENT_DATE) as fecha,
            GREATEST(0, (total - COALESCE((SELECT SUM(monto) FROM centro_copiado_ordenes_pagos WHERE orden_copiado_id = cco.id), 0))) as monto,
            'wip_in' as type
        FROM centro_copiado_ordenes cco
        WHERE company_id = p_company_id
          AND estado NOT IN ('cancelada')
          AND orden_trabajo_id IS NULL 
          AND NOT EXISTS (
              SELECT 1 FROM clients c 
              WHERE c.id = cco.cliente_id 
              AND c.tiene_cuenta_corriente = true
          )
    ),
    daily_agg AS (
        SELECT 
            c.fecha,
            COALESCE(SUM(CASE WHEN m.type = 'cheque_in' THEN m.monto ELSE 0 END), 0) as ingreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'liquidacion_in' THEN m.monto ELSE 0 END), 0) as ingreso_liquidaciones,
            COALESCE(SUM(CASE WHEN m.type = 'wip_in' THEN m.monto ELSE 0 END), 0) as ingreso_wip,
            COALESCE(SUM(CASE WHEN m.type = 'cheque_out' THEN m.monto ELSE 0 END), 0) as egreso_cheques,
            COALESCE(SUM(CASE WHEN m.type = 'tarjeta_out' THEN m.monto ELSE 0 END), 0) as egreso_tarjetas,
            COALESCE(SUM(CASE WHEN m.type = 'recurring_out' THEN m.monto ELSE 0 END), 0) as egreso_recurrentes,
            COALESCE(SUM(CASE WHEN m.type = 'compra_out' THEN m.monto ELSE 0 END), 0) as egreso_compras -- [NEW COL AGG]
        FROM calendar c
        LEFT JOIN movements m ON m.fecha = c.fecha
        GROUP BY c.fecha
    ),
    running_balance AS (
        SELECT 
            da.fecha,
            da.ingreso_cheques,
            da.ingreso_liquidaciones,
            da.ingreso_wip,
            da.egreso_cheques,
            da.egreso_tarjetas,
            da.egreso_recurrentes,
            da.egreso_compras,
            (da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) as total_ingresos,
            (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras) as total_egresos,
            ((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) - (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras)) as saldo_diario,
            SUM((da.ingreso_cheques + da.ingreso_liquidaciones + da.ingreso_wip) - (da.egreso_cheques + da.egreso_tarjetas + da.egreso_recurrentes + da.egreso_compras)) OVER (ORDER BY da.fecha) + v_saldo_inicial as saldo_acumulado
        FROM daily_agg da
    )
    SELECT * FROM running_balance rb ORDER BY rb.fecha;
END;
$$;


ALTER FUNCTION "public"."fn_get_cashflow_projection"("p_company_id" "uuid", "p_days_to_project" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_clientes_con_saldo"("p_company_id" "uuid", "p_search_term" "text" DEFAULT ''::"text", "p_estado_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "nombre_fantasia" "text", "razon_social" "text", "numero_documento" "text", "acuerdo_pago" "text", "dia_cierre_semanal" integer, "dia_cierre_mensual" integer, "usa_ultimo_dia_mes" boolean, "dias_vencimiento_config" integer, "tiene_cuenta_corriente" boolean, "saldo_actual" numeric, "estado_cc" "text", "dias_vencimiento" integer, "fecha_ultima_liquidacion" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH saldos AS (
        -- Calculate balance for all clients in company
        SELECT 
            m.cliente_id,
            SUM(m.saldo_acumulado) as ultimo_saldo -- This logic is wrong for getting current balance, we need the last movement's balance or sum of debe/haber
        FROM cuentas_corrientes_movimientos m
        WHERE m.company_id = p_company_id
        -- We actually need the LATEST row per client to get the running balance
        -- Or simply SUM(debe - haber) if we trust the ledger
        GROUP BY m.cliente_id
    ),
    client_balances AS (
        SELECT 
            c.id,
            c.nombre_fantasia,
            c.razon_social,
            c.numero_documento,
            c.acuerdo_pago,
            c.dia_cierre_semanal,
            c.dia_cierre_mensual,
            c.usa_ultimo_dia_mes,
            c.dias_vencimiento as dias_vencimiento_config,
            c.tiene_cuenta_corriente,
            -- Calculate precise balance: Total Debe - Total Haber is safer than relying on last row order if not strictly enforced
            COALESCE((
                SELECT SUM(ccm.monto_debe - ccm.monto_haber)
                FROM cuentas_corrientes_movimientos ccm
                WHERE ccm.cliente_id = c.id AND ccm.company_id = p_company_id
            ), 0) as saldo_calc
        FROM clients c
        WHERE c.company_id = p_company_id
          AND c.is_active = true
          AND c.tiene_cuenta_corriente = true
    ),
    liquidaciones_info AS (
        SELECT 
            l.cliente_id,
            MIN(l.fecha_vencimiento) as fecha_vencimiento_mas_antigua,
            MAX(l.fecha_vencimiento) as ultima_fecha_liquidacion
        FROM liquidaciones l
        WHERE l.company_id = p_company_id
          AND l.estado != 'cancelada'
          AND l.saldo_pendiente > 0
        GROUP BY l.cliente_id
    )
    SELECT 
        c.id,
        c.nombre_fantasia,
        c.razon_social,
        c.numero_documento,
        c.acuerdo_pago::TEXT,
        c.dia_cierre_semanal,
        c.dia_cierre_mensual,
        c.usa_ultimo_dia_mes,
        c.dias_vencimiento_config,
        c.tiene_cuenta_corriente,
        c.saldo_calc as saldo_actual,
        CASE 
            WHEN li.fecha_vencimiento_mas_antigua < CURRENT_DATE THEN 'vencido'
            WHEN li.fecha_vencimiento_mas_antigua <= (CURRENT_DATE + interval '3 days') THEN 'proximo_vencer'
            ELSE 'al_dia'
        END as estado_cc,
        CASE 
            WHEN li.fecha_vencimiento_mas_antigua IS NOT NULL THEN 
                (li.fecha_vencimiento_mas_antigua - CURRENT_DATE)::INTEGER
            ELSE NULL 
        END as dias_vencimiento,
        li.ultima_fecha_liquidacion
    FROM client_balances c
    LEFT JOIN liquidaciones_info li ON c.id = li.cliente_id
    WHERE 
        (p_search_term = '' OR 
         c.nombre_fantasia ILIKE '%' || p_search_term || '%' OR
         c.razon_social ILIKE '%' || p_search_term || '%' OR
         c.numero_documento ILIKE '%' || p_search_term || '%')
    AND
        (p_estado_filter IS NULL OR 
         (CASE 
            WHEN li.fecha_vencimiento_mas_antigua < CURRENT_DATE THEN 'vencido'
            WHEN li.fecha_vencimiento_mas_antigua <= (CURRENT_DATE + interval '3 days') THEN 'proximo_vencer'
            ELSE 'al_dia'
          END) = p_estado_filter
        );
END;
$$;


ALTER FUNCTION "public"."fn_get_clientes_con_saldo"("p_company_id" "uuid", "p_search_term" "text", "p_estado_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_movimientos_caja"("p_caja_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "fecha" "date", "tipo_movimiento" "text", "monto" numeric, "concepto" "text", "notas" "text", "referencia_tipo" "text", "usuario_nombre" "text", "otro_caja_nombre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
BEGIN
    -- 1. Verificar acceso
    SELECT c.company_id INTO v_company_id
    FROM cajas c
    WHERE c.id = p_caja_id;

    -- 2. Verificar perfil
    IF NOT EXISTS (
        SELECT 1 FROM profiles prof
        WHERE prof.id = v_user_id AND prof.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Access Denied: User not in company';
    END IF;

    -- 3. Query principal
    RETURN QUERY
    SELECT 
        cm.id,
        cm.fecha,
        CASE 
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = p_caja_id THEN 'transferencia_saliente'
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = p_caja_id THEN 'transferencia_entrante'
            ELSE cm.tipo_movimiento
        END as tipo_movimiento,
        cm.monto,
        cm.concepto,
        cm.notas,
        cm.referencia_tipo,
        COALESCE(p.full_name, p.email) as usuario_nombre, -- CORREGIDO: usar full_name
        CASE
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = p_caja_id THEN c_dest.nombre
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = p_caja_id THEN c_orig.nombre
            ELSE NULL
        END as otro_caja_nombre
    FROM cajas_movimientos cm
    LEFT JOIN profiles p ON p.id = cm.created_by
    LEFT JOIN cajas c_dest ON c_dest.id = cm.caja_destino_id
    LEFT JOIN cajas c_orig ON c_orig.id = cm.caja_id
    WHERE 
        (cm.caja_id = p_caja_id OR cm.caja_destino_id = p_caja_id)
    ORDER BY cm.fecha DESC, cm.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."fn_get_movimientos_caja"("p_caja_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ot.id,
    'numero_orden', ot.numero_orden,
    'estado', ot.estado,
    'fecha_creacion', ot.fecha_creacion,
    'fecha_estimada_entrega', ot.fecha_estimada_entrega,
    'cliente_nombre', COALESCE(c.nombre_fantasia, c.razon_social),
    'company_id', ot.company_id,
    'company_name', comp.name,
    'company_address', comp.address,
    'company_phone', comp.contact_phone,
    'company_business_hours', COALESCE((
      SELECT json_agg(json_build_object(
        'day_of_week', cbh.day_of_week,
        'day_name', CASE cbh.day_of_week
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Lunes'
          WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles'
          WHEN 4 THEN 'Jueves'
          WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
          ELSE 'Desconocido'
        END,
        'is_open', cbh.is_open,
        'opening_time_1', cbh.opening_time_1,
        'closing_time_1', cbh.closing_time_1,
        'opening_time_2', cbh.opening_time_2,
        'closing_time_2', cbh.closing_time_2
      ) ORDER BY cbh.day_of_week)
      FROM company_business_hours cbh
      WHERE cbh.company_id = ot.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', oti.id,
        'producto_nombre', oti.producto_nombre,
        'producto_categoria', oti.producto_categoria,
        'cantidad', oti.cantidad,
        'estado', oti.estado,
        'pasos', COALESCE((
          SELECT json_agg(json_build_object(
            'id', otir.id,
            'paso_nombre', otir.paso_nombre,
            'tipo_etapa', otir.tipo_etapa,
            'orden', otir.orden,
            'estado_paso', otir.estado_paso,
            'fecha_inicio', otir.fecha_inicio,
            'fecha_fin', otir.fecha_fin,
            'cantidad_pausas', otir.cantidad_pausas,
            'pausa_info', CASE
              WHEN otir.estado_paso = 'pausado' THEN
                (
                  SELECT json_build_object(
                    'esta_pausado', true,
                    'categoria_motivo', p.categoria_motivo,
                    'fecha_inicio_pausa', p.fecha_inicio_pausa,
                    'tiempo_pausado_horas', ROUND(
                      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 3600, 1
                    )
                  )
                  FROM ordenes_items_rutas_pausas p
                  WHERE p.ruta_id = otir.id
                  AND p.fecha_fin_pausa IS NULL
                  LIMIT 1
                )
              ELSE
                json_build_object('esta_pausado', false)
            END
          ) ORDER BY
            -- CRÍTICO: Ordenar primero por tipo_etapa, luego por orden
            -- Esto asegura que los pasos aparezcan en la secuencia correcta de producción
            CASE otir.tipo_etapa
              WHEN 'pre_prensa' THEN 1
              WHEN 'principal' THEN 2
              WHEN 'post_prensa' THEN 3
              WHEN 'instalacion' THEN 4
              ELSE 5
            END,
            otir.orden
          )
          FROM ordenes_trabajo_items_rutas otir
          WHERE otir.orden_item_id = oti.id
        ), '[]'::json)
      ) ORDER BY oti.created_at)
      FROM ordenes_trabajo_items oti
      WHERE oti.orden_id = ot.id
    ), '[]'::json)
  ) INTO v_result
  FROM ordenes_trabajo ot
  LEFT JOIN clients c ON c.id = ot.cliente_id
  LEFT JOIN companies comp ON comp.id = ot.company_id
  WHERE ot.tracking_token = p_tracking_token
  AND ot.tracking_token IS NOT NULL;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") IS 'Obtiene información de seguimiento público de una orden usando tracking_token.
V4.0: Mantiene company_business_hours, información de pausas, y AGREGA ordenamiento correcto por tipo_etapa (pre_prensa → principal → post_prensa → instalacion) seguido de orden.

IMPORTANTE: Al actualizar esta función en el futuro, SIEMPRE mantener el ORDER BY con CASE por tipo_etapa.
El orden correcto es crítico para la UX del cliente en el tracking público.';



CREATE OR REPLACE FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Buscar presupuesto por tracking token
  SELECT jsonb_build_object(
    'id', p.id,
    'numero_presupuesto', p.numero_presupuesto,
    'estado', p.estado,
    'fecha_creacion', p.fecha_creacion,
    'fecha_validez', p.fecha_validez,
    'fecha_enviado', p.fecha_enviado,
    'fecha_respuesta', p.fecha_respuesta,
    'total', p.total,
    'subtotal', p.subtotal,
    'condiciones_comerciales', p.condiciones_comerciales,
    'observaciones_cliente', p.observaciones_cliente,
    'company', jsonb_build_object(
      'name', c.name,
      'razon_social', c.legal_name,
      'logo_url', c.logo_url,
      'telefono', c.contact_phone,
      'email', c.contact_email,
      'direccion', c.address,
      'sitio_web', c.website
    ),
    'cliente', jsonb_build_object(
      'razon_social', cl.razon_social,
      'email', cl.email,
      'whatsapp', cl.whatsapp
    ),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'producto_nombre', pi.producto_nombre,
          'producto_categoria', pi.producto_categoria,
          'descripcion', pi.descripcion,
          'configuracion', pi.configuracion,
          'cantidad', pi.cantidad,
          'precio_unitario_final', pi.precio_unitario_final,
          'precio_total', pi.precio_total,
          'tiempo_produccion_dias', pi.tiempo_produccion_dias
        ) ORDER BY pi.created_at
      )
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
    ),
    'orden_trabajo', CASE
      WHEN p.orden_trabajo_id IS NOT NULL THEN
        jsonb_build_object(
          'id', ot.id,
          'numero_orden', ot.numero_orden,
          'estado', ot.estado,
          'fecha_estimada_entrega', ot.fecha_estimada_entrega,
          'tracking_token', ot.tracking_token
        )
      ELSE NULL
    END
  ) INTO v_result
  FROM presupuestos p
  INNER JOIN companies c ON c.id = p.company_id
  LEFT JOIN clients cl ON cl.id = p.cliente_id
  LEFT JOIN ordenes_trabajo ot ON ot.id = p.orden_trabajo_id
  WHERE p.tracking_token = p_tracking_token;

  -- Si no se encontró el presupuesto
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Presupuesto no encontrado',
      'message', 'El token de tracking no es válido o el presupuesto no existe'
    );
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) IS 'Obtiene información pública de un presupuesto mediante su tracking token. Incluye configuración de productos y nombre de empresa.';



CREATE OR REPLACE FUNCTION "public"."fn_get_vencimientos_pendientes"("p_company_id" "uuid") RETURNS TABLE("origen" "text", "id_origen" "uuid", "descripcion" "text", "proveedor" "text", "monto_total" numeric, "monto_pagado" numeric, "monto_pendiente" numeric, "fecha_vencimiento" "date", "periodo_ref" "date", "estado" "text", "dias_atraso" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_window_start DATE := CURRENT_DATE - INTERVAL '6 months';
    v_window_end DATE := CURRENT_DATE + INTERVAL '60 days';
BEGIN
    RETURN QUERY
    WITH pending_debts AS (
        -- 1. [RECURRENTE] Gastos Flexibles (Proyectado - Pagado)
        SELECT 
            'recurrente'::text as origen,
            re.id as id_origen,
            re.description as descripcion,
            COALESCE(p.nombre_fantasia, 'Sin Proveedor') as proveedor,
            re.amount as monto_total,
            -- Calcular pagado para este período específico
            COALESCE((
                SELECT SUM(e.monto)
                FROM egresos e
                WHERE e.recurrente_id = re.id
                -- Coincidencia flexible de fecha (mismo mes/año para mensuales)
                AND (
                    (re.frequency::text IN ('monthly', 'quarterly', 'yearly') AND 
                     date_trunc('month', e.fecha) = date_trunc('month', c.fecha))
                    OR
                    (re.frequency::text NOT IN ('monthly', 'quarterly', 'yearly') AND 
                     e.fecha = c.fecha)
                )
            ), 0) as monto_pagado,
            c.fecha as fecha_vencimiento,
            c.fecha as periodo_ref
        FROM recurring_expenses re
        LEFT JOIN providers p ON p.id = re.provider_id
        CROSS JOIN LATERAL (
            -- Generación de fechas de vencimiento teóricas
            SELECT d::date as fecha
            FROM generate_series(GREATEST(re.start_date, v_window_start), LEAST(COALESCE(re.end_date, v_window_end), v_window_end), '1 day'::interval) d
            WHERE 
                (re.frequency::text = 'weekly' AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency::text = 'biweekly' AND MOD(EXTRACT(WEEK FROM d)::int, 2) = 0 AND EXTRACT(DOW FROM d) = re.day_of_week) OR
                (re.frequency::text = 'monthly' AND EXTRACT(DAY FROM d) = re.day_of_month) OR
                (re.frequency::text = 'quarterly' AND EXTRACT(DAY FROM d) = re.day_of_month AND MOD(EXTRACT(MONTH FROM d)::int - 1, 3) = 0) OR
                (re.frequency::text = 'yearly' AND EXTRACT(DAY FROM d) = re.day_of_month AND EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM re.start_date))
        ) c
        WHERE re.company_id = p_company_id
          AND re.is_active = true
          -- FILTRO CLAVE: Excluir si está marcado como "Cerrado Manualmente" en recurring_executions
          AND NOT EXISTS (
              SELECT 1 FROM recurring_executions rx
              WHERE rx.recurring_id = re.id
              AND (
                  -- Coincidencia de período
                  (re.frequency::text IN ('monthly', 'quarterly', 'yearly') AND 
                   date_trunc('month', rx.periodo) = date_trunc('month', c.fecha))
                  OR
                  (re.frequency::text NOT IN ('monthly', 'quarterly', 'yearly') AND 
                   rx.periodo = c.fecha)
              )
              AND rx.estado = 'cerrado'
          )

        UNION ALL

        -- 2. [COMPRA] Facturas Manuales Pendientes
        SELECT 
            'compra'::text as origen,
            cp.id as id_origen,
            cp.descripcion || COALESCE(' - ' || cp.numero_factura, '') as descripcion,
            COALESCE(p.nombre_fantasia, 'Sin Proveedor') as proveedor,
            cp.monto_total,
            COALESCE((SELECT SUM(e.monto) FROM egresos e WHERE e.compra_id = cp.id), 0) as monto_pagado,
            cp.fecha_vencimiento,
            NULL::date as periodo_ref
        FROM compras_proveedores cp
        LEFT JOIN providers p ON p.id = cp.provider_id
        WHERE cp.company_id = p_company_id
          AND cp.estado != 'pagado'
        
        UNION ALL

        -- 3. [TARJETA] Resúmenes
        SELECT 
            'tarjeta'::text as origen,
            tr.id as id_origen,
            'Resumen ' || tc.nombre || ' ****' || COALESCE(tc.ultimos_4_digitos, '') as descripcion,
            'Banco Emisor' as proveedor,
            tr.total_consumos as monto_total,
            tr.total_pagado as monto_pagado,
            tr.fecha_vencimiento,
            NULL::date as periodo_ref
        FROM tarjetas_resumenes tr
        JOIN tarjetas_credito tc ON tc.id = tr.tarjeta_id
        WHERE tr.company_id = p_company_id
          AND tr.estado != 'pagado'
          AND tr.fecha_vencimiento <= v_window_end

        UNION ALL

        -- 4. [CHEQUE] Cheques Emitidos Pendientes
        SELECT 
            'cheque'::text as origen,
            cc.id as id_origen,
            'Cheque #' || cc.numero_cheque as descripcion,
            COALESCE(cc.destinatario, 'Portador') as proveedor,
            cc.monto as monto_total,
            0::numeric as monto_pagado,
            cc.fecha_pago as fecha_vencimiento,
            NULL::date as periodo_ref
        FROM cheques_cartera cc
        WHERE cc.company_id = p_company_id
          AND cc.direction = 'emitido'
          AND cc.estado = 'pendiente'
          AND cc.fecha_pago <= v_window_end
    )
    SELECT 
        pd.origen,
        pd.id_origen,
        pd.descripcion,
        pd.proveedor,
        pd.monto_total,
        pd.monto_pagado,
        (pd.monto_total - pd.monto_pagado) as monto_pendiente,
        pd.fecha_vencimiento,
        pd.periodo_ref,
        CASE 
            WHEN pd.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
            WHEN pd.fecha_vencimiento = CURRENT_DATE THEN 'hoy'
            ELSE 'proximo'
        END as estado,
        (CURRENT_DATE - pd.fecha_vencimiento)::integer as dias_atraso
    FROM pending_debts pd
    WHERE (pd.monto_total - pd.monto_pagado) > 0
    ORDER BY pd.fecha_vencimiento ASC;
END;
$$;


ALTER FUNCTION "public"."fn_get_vencimientos_pendientes"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("total_ordenes_completadas" bigint, "total_items_completados" bigint, "total_pasos_completados" bigint, "horas_promedio_por_orden" numeric, "minutos_promedio_por_item" numeric, "minutos_promedio_por_paso" numeric, "total_horas_produccion" numeric, "paso_mas_lento" "text", "paso_mas_lento_minutos" numeric, "operario_mas_productivo" "text", "operario_pasos_completados" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_result record;
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT oti.orden_id)::bigint as stats_total_ordenes,
      COUNT(DISTINCT r.orden_item_id)::bigint as stats_total_items,
      COUNT(*)::bigint as stats_total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as stats_total_minutos
    FROM ordenes_trabajo_items_rutas r
    JOIN ordenes_trabajo_items oti ON oti.id = r.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  ),
  paso_lento AS (
    SELECT 
      pm.paso_nombre as pl_paso_nombre, 
      pm.minutos_promedio as pl_minutos_promedio
    FROM fn_metricas_por_paso(p_company_id, p_fecha_desde, p_fecha_hasta) pm
    ORDER BY pm.minutos_promedio DESC
    LIMIT 1
  ),
  operario_top AS (
    SELECT 
      op.operario_nombre as ot_operario_nombre, 
      op.total_pasos_completados as ot_total_pasos
    FROM fn_metricas_por_operario(p_company_id, p_fecha_desde, p_fecha_hasta) op
    ORDER BY op.total_pasos_completados DESC
    LIMIT 1
  )
  SELECT
    s.stats_total_ordenes as total_ordenes_completadas,
    s.stats_total_items as total_items_completados,
    s.stats_total_pasos as total_pasos_completados,
    ROUND((s.stats_total_minutos / 60.0 / NULLIF(s.stats_total_ordenes, 0))::numeric, 2) as horas_promedio_por_orden,
    ROUND((s.stats_total_minutos / NULLIF(s.stats_total_items, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((s.stats_total_minutos / NULLIF(s.stats_total_pasos, 0))::numeric, 2) as minutos_promedio_por_paso,
    ROUND((s.stats_total_minutos / 60.0)::numeric, 2) as total_horas_produccion,
    COALESCE(pl.pl_paso_nombre, 'N/A') as paso_mas_lento,
    COALESCE(pl.pl_minutos_promedio, 0) as paso_mas_lento_minutos,
    COALESCE(ot.ot_operario_nombre, 'N/A') as operario_mas_productivo,
    COALESCE(ot.ot_total_pasos, 0) as operario_pasos_completados
  FROM stats s
  LEFT JOIN paso_lento pl ON true
  LEFT JOIN operario_top ot ON true;
END;
$$;


ALTER FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna KPIs principales para el dashboard de productividad (fixed: all ambiguous columns)';



CREATE OR REPLACE FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") RETURNS TABLE("archivos_eliminados" integer, "archivos_produccion_eliminados" integer, "links_eliminados" integer, "storage_paths" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_archivos_count integer;
  v_archivos_prod_count integer;
  v_links_count integer;
  v_storage_paths text[];
BEGIN
  -- Recopilar paths de storage para eliminación
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths
  FROM (
    SELECT storage_path FROM ordenes_trabajo_archivos
    WHERE orden_temporal_id = p_orden_temporal_id
      AND company_id = p_company_id
    UNION ALL
    SELECT storage_path FROM ordenes_trabajo_archivos_produccion
    WHERE orden_temporal_id = p_orden_temporal_id
      AND company_id = p_company_id
  ) paths;

  -- Eliminar archivos de cliente
  DELETE FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_count = ROW_COUNT;

  -- Eliminar archivos de producción
  DELETE FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_archivos_prod_count = ROW_COUNT;

  -- Eliminar links
  DELETE FROM ordenes_trabajo_links
  WHERE orden_temporal_id = p_orden_temporal_id
    AND company_id = p_company_id;
  
  GET DIAGNOSTICS v_links_count = ROW_COUNT;

  -- Retornar estadísticas
  RETURN QUERY SELECT v_archivos_count, v_archivos_prod_count, v_links_count, v_storage_paths;
END;
$$;


ALTER FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") IS 'Elimina adjuntos temporales específicos de una sesión de creación cancelada.';



CREATE OR REPLACE FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() RETURNS TABLE("archivos_eliminados" integer, "archivos_produccion_eliminados" integer, "links_eliminados" integer, "storage_paths_cliente" "text"[], "storage_paths_produccion" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_archivos_count integer;
  v_archivos_prod_count integer;
  v_links_count integer;
  v_storage_paths_cliente text[];
  v_storage_paths_produccion text[];
  v_fecha_limite timestamptz;
BEGIN
  v_fecha_limite := NOW() - interval '24 hours';

  -- Recopilar paths de archivos de cliente
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths_cliente
  FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;

  -- Recopilar paths de archivos de producción
  SELECT ARRAY_AGG(storage_path)
  INTO v_storage_paths_produccion
  FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;

  -- Eliminar archivos de cliente antiguos
  DELETE FROM ordenes_trabajo_archivos
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_archivos_count = ROW_COUNT;

  -- Eliminar archivos de producción antiguos
  DELETE FROM ordenes_trabajo_archivos_produccion
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_archivos_prod_count = ROW_COUNT;

  -- Eliminar links antiguos
  DELETE FROM ordenes_trabajo_links
  WHERE orden_temporal_id IS NOT NULL
    AND temporal_creado_en < v_fecha_limite;
  
  GET DIAGNOSTICS v_links_count = ROW_COUNT;

  -- Retornar estadísticas
  RETURN QUERY SELECT 
    v_archivos_count, 
    v_archivos_prod_count, 
    v_links_count,
    v_storage_paths_cliente,
    v_storage_paths_produccion;
END;
$$;


ALTER FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() IS 'Limpieza automática de adjuntos temporales con más de 24 horas. Se ejecuta periódicamente.';



CREATE OR REPLACE FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer DEFAULT 24) RETURNS TABLE("archivos_eliminados" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count int;
BEGIN
  -- Eliminar archivos temporales más antiguos que X horas
  DELETE FROM centro_copiado_ordenes_archivos
  WHERE
    orden_temporal_id IS NOT NULL
    AND temporal_creado_en < NOW() - (p_horas_antiguedad || ' hours')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;


ALTER FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer) IS 'Limpia archivos temporales no asociados después de X horas. Default: 24h.';



CREATE OR REPLACE FUNCTION "public"."fn_limpiar_tokens_expirados"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Eliminar tokens expirados hace más de 30 días
  DELETE FROM facturas_urls_cortas
  WHERE expires_at < (now() - interval '30 days');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."fn_limpiar_tokens_expirados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("categoria_id" "uuid", "categoria_nombre" "text", "total_ordenes" bigint, "total_items" bigint, "minutos_promedio_por_item" numeric, "minutos_minimo" numeric, "minutos_maximo" numeric, "desviacion_estandar" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH item_duraciones AS (
    SELECT
      oti.id as item_id,
      oti.producto_categoria,
      c.id as cat_id,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as minutos_totales
    FROM ordenes_trabajo_items oti
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    JOIN ordenes_trabajo_items_rutas r ON r.orden_item_id = oti.id
    LEFT JOIN categorias c ON c.nombre = oti.producto_categoria
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
      AND oti.producto_categoria IS NOT NULL
    GROUP BY oti.id, oti.producto_categoria, c.id
  )
  SELECT
    id.cat_id as categoria_id,
    COALESCE(c.nombre, id.producto_categoria) as categoria_nombre,
    COUNT(DISTINCT oti.orden_id)::bigint as total_ordenes,
    COUNT(DISTINCT id.item_id)::bigint as total_items,
    ROUND(AVG(id.minutos_totales)::numeric, 2) as minutos_promedio_por_item,
    ROUND(MIN(id.minutos_totales)::numeric, 2) as minutos_minimo,
    ROUND(MAX(id.minutos_totales)::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(id.minutos_totales)::numeric, 2) as desviacion_estandar
  FROM item_duraciones id
  LEFT JOIN categorias c ON c.id = id.cat_id
  JOIN ordenes_trabajo_items oti ON oti.id = id.item_id
  GROUP BY id.cat_id, c.nombre, id.producto_categoria
  ORDER BY minutos_promedio_por_item DESC;
END;
$$;


ALTER FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna métricas agregadas por categoría de producto (fixed: no JOIN productos)';



CREATE OR REPLACE FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("tipo_etapa" "text", "total_pasos" bigint, "minutos_promedio" numeric, "minutos_totales" numeric, "porcentaje_tiempo" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH etapa_stats AS (
    SELECT
      r.tipo_etapa as etapa_tipo,
      COUNT(*)::bigint as etapa_total_pasos,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as etapa_minutos_totales
    FROM ordenes_trabajo_items_rutas r
    WHERE r.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
    GROUP BY r.tipo_etapa
  ),
  total_general AS (
    SELECT SUM(es.etapa_minutos_totales) as suma_total 
    FROM etapa_stats es
  )
  SELECT
    es.etapa_tipo as tipo_etapa,
    es.etapa_total_pasos as total_pasos,
    ROUND((es.etapa_minutos_totales / NULLIF(es.etapa_total_pasos, 0))::numeric, 2) as minutos_promedio,
    ROUND(es.etapa_minutos_totales::numeric, 2) as minutos_totales,
    ROUND((es.etapa_minutos_totales / NULLIF(tg.suma_total, 0) * 100)::numeric, 2) as porcentaje_tiempo
  FROM etapa_stats es
  CROSS JOIN total_general tg
  ORDER BY es.etapa_minutos_totales DESC;
END;
$$;


ALTER FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna métricas agregadas por tipo de etapa (fixed: ambiguous columns)';



CREATE OR REPLACE FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("operario_id" "uuid", "operario_nombre" "text", "operario_email" "text", "total_pasos_completados" bigint, "minutos_promedio_por_paso" numeric, "desviacion_estandar" numeric, "total_horas" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.responsable_id as operario_id,
    COALESCE(pr.full_name, 'Sin asignar') as operario_nombre,
    pr.email as operario_email,
    COUNT(*)::bigint as total_pasos_completados,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_promedio_por_paso,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as desviacion_estandar,
    ROUND((SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) / 60.0)::numeric, 2) as total_horas
  FROM ordenes_trabajo_items_rutas r
  LEFT JOIN profiles pr ON pr.id = r.responsable_id
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.responsable_id, pr.full_name, pr.email
  HAVING COUNT(*) >= 3
  ORDER BY total_pasos_completados DESC;
END;
$$;


ALTER FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna métricas de eficiencia por operario/responsable';



CREATE OR REPLACE FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("paso_id" "uuid", "paso_nombre" "text", "tipo_etapa" "text", "total_ejecuciones" bigint, "minutos_promedio" numeric, "minutos_minimo" numeric, "minutos_maximo" numeric, "desviacion_estandar" numeric, "total_minutos" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.paso_id,
    r.paso_nombre,
    r.tipo_etapa,
    COUNT(*)::bigint as total_ejecuciones,
    ROUND(AVG(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_promedio,
    ROUND(MIN(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_minimo,
    ROUND(MAX(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as minutos_maximo,
    ROUND(STDDEV(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as desviacion_estandar,
    ROUND(SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin))::numeric, 2) as total_minutos
  FROM ordenes_trabajo_items_rutas r
  WHERE r.company_id = p_company_id
    AND r.estado_paso = 'completado'
    AND r.fecha_inicio IS NOT NULL
    AND r.fecha_fin IS NOT NULL
    AND (p_fecha_desde IS NULL OR r.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_fin <= p_fecha_hasta)
  GROUP BY r.paso_id, r.paso_nombre, r.tipo_etapa
  ORDER BY minutos_promedio DESC;
END;
$$;


ALTER FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna métricas agregadas por paso de producción';



CREATE OR REPLACE FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("responsable_id" "uuid", "responsable_nombre" "text", "responsable_email" "text", "responsable_avatar" "text", "total_pasos_completados" bigint, "total_pasos_omitidos" bigint, "total_pasos" bigint, "tasa_completitud" numeric, "tiempo_total_minutos" numeric, "tiempo_total_horas" numeric, "tiempo_promedio_minutos" numeric, "pasos_prensa" bigint, "pasos_post_prensa" bigint, "pasos_terminacion" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.responsable_id,
    v.responsable_nombre,
    v.responsable_email,
    v.responsable_avatar,
    COUNT(*) FILTER (WHERE v.estado_paso = 'completado') as total_pasos_completados,
    COUNT(*) FILTER (WHERE v.estado_paso = 'omitido') as total_pasos_omitidos,
    COUNT(*) as total_pasos,
    ROUND(
      (COUNT(*) FILTER (WHERE v.estado_paso = 'completado')::NUMERIC /
       NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
      2
    ) as tasa_completitud,
    ROUND(SUM(v.duracion_minutos), 2) as tiempo_total_minutos,
    ROUND(SUM(v.duracion_minutos) / 60.0, 2) as tiempo_total_horas,
    ROUND(AVG(v.duracion_minutos), 2) as tiempo_promedio_minutos,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'prensa') as pasos_prensa,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'post-prensa') as pasos_post_prensa,
    COUNT(*) FILTER (WHERE v.tipo_etapa = 'terminacion') as pasos_terminacion
  FROM v_actividad_usuarios v
  WHERE
    v.company_id = p_company_id
    AND (p_fecha_desde IS NULL OR v.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_fin <= p_fecha_hasta)
  GROUP BY
    v.responsable_id,
    v.responsable_nombre,
    v.responsable_email,
    v.responsable_avatar
  ORDER BY total_pasos_completados DESC, tiempo_total_horas DESC;
END;
$$;


ALTER FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Calcula métricas de rendimiento detalladas por operador';



CREATE OR REPLACE FUNCTION "public"."fn_migrar_pagos_historicos_a_cajas"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_migrar_pagos_historicos_a_cajas"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_nombre text;
  v_usuarios_notificar uuid[];
BEGIN
  -- Solo proceder si el estado cambió a 'aprobado'
  IF NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado') THEN

    -- Obtener nombre del cliente
    SELECT razon_social INTO v_cliente_nombre
    FROM clients
    WHERE id = NEW.cliente_id;

    -- Obtener usuarios a notificar (vendedor y admin/super_admin de la empresa)
    SELECT ARRAY_AGG(DISTINCT p.id)
    INTO v_usuarios_notificar
    FROM profiles p
    WHERE p.company_id = NEW.company_id
      AND (
        p.id = NEW.vendedor_id OR
        p.role IN ('admin', 'super_admin')
      );

    -- Crear notificación para cada usuario
    IF v_usuarios_notificar IS NOT NULL THEN
      INSERT INTO notificaciones_internas (
        company_id,
        usuario_id,
        tipo,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id,
        metadata,
        leida
      )
      SELECT
        NEW.company_id,
        unnest(v_usuarios_notificar),
        'presupuesto_aprobado',
        'Presupuesto Aprobado',
        COALESCE(v_cliente_nombre, 'Cliente') || ' aprobó el presupuesto #' || NEW.numero_presupuesto,
        'presupuesto',
        NEW.id,
        jsonb_build_object(
          'presupuesto_id', NEW.id,
          'numero_presupuesto', NEW.numero_presupuesto,
          'cliente_id', NEW.cliente_id,
          'cliente_nombre', v_cliente_nombre,
          'total', NEW.total
        ),
        false;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() IS 'Crea notificaciones internas cuando un presupuesto es aprobado';



CREATE OR REPLACE FUNCTION "public"."fn_notificar_rechazo_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_nombre text;
  v_usuarios_notificar uuid[];
  v_motivo text;
BEGIN
  -- Solo proceder si el estado cambió a 'rechazado'
  IF NEW.estado = 'rechazado' AND (OLD.estado IS NULL OR OLD.estado != 'rechazado') THEN

    -- Obtener nombre del cliente
    SELECT razon_social INTO v_cliente_nombre
    FROM clients
    WHERE id = NEW.cliente_id;

    -- Extraer motivo del rechazo (primeras líneas de observaciones)
    v_motivo := COALESCE(
      SUBSTRING(NEW.observaciones_cliente FROM 'MOTIVO: ([^\n]+)'),
      'Sin especificar'
    );

    -- Obtener usuarios a notificar (vendedor y admin/super_admin de la empresa)
    SELECT ARRAY_AGG(DISTINCT p.id)
    INTO v_usuarios_notificar
    FROM profiles p
    WHERE p.company_id = NEW.company_id
      AND (
        p.id = NEW.vendedor_id OR
        p.role IN ('admin', 'super_admin')
      );

    -- Crear notificación para cada usuario
    IF v_usuarios_notificar IS NOT NULL THEN
      INSERT INTO notificaciones_internas (
        company_id,
        usuario_id,
        tipo,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id,
        metadata,
        leida
      )
      SELECT
        NEW.company_id,
        unnest(v_usuarios_notificar),
        'presupuesto_rechazado',
        'Presupuesto Rechazado',
        COALESCE(v_cliente_nombre, 'Cliente') || ' rechazó el presupuesto #' || NEW.numero_presupuesto,
        'presupuesto',
        NEW.id,
        jsonb_build_object(
          'presupuesto_id', NEW.id,
          'numero_presupuesto', NEW.numero_presupuesto,
          'cliente_id', NEW.cliente_id,
          'cliente_nombre', v_cliente_nombre,
          'motivo_rechazo', v_motivo,
          'observaciones', NEW.observaciones_cliente
        ),
        false;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notificar_rechazo_presupuesto"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_notificar_rechazo_presupuesto"() IS 'Crea notificaciones internas cuando un presupuesto es rechazado';



CREATE OR REPLACE FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "nombre_fantasia" "text", "tipo_documento" "text", "numero_documento" "text", "whatsapp" "text", "email" "text", "fecha_registro" timestamp with time zone, "ip_registro" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nombre_fantasia,
    c.tipo_documento,
    c.numero_documento,
    c.whatsapp,
    c.email,
    c.fecha_registro,
    c.ip_registro
  FROM clients c
  WHERE c.company_id = p_company_id
    AND c.status_aprobacion = 'pending'
  ORDER BY c.fecha_registro DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) IS 'Obtiene la lista de clientes pendientes de aprobación con paginación';



CREATE OR REPLACE FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text" DEFAULT NULL::"text") RETURNS TABLE("orden_id" "uuid", "numero_orden" "text", "fecha_creacion" timestamp with time zone, "cliente_id" "uuid", "cliente_nombre" "text", "cliente_documento" "text", "tiene_cuenta_corriente" boolean, "total" numeric, "pagado" numeric, "saldo_pendiente" numeric, "dias_transcurridos" integer, "estado" "text", "tipo_orden" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden_trabajo AS (
    SELECT 
      otp.orden_id,
      COALESCE(SUM(otp.monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos otp
    GROUP BY otp.orden_id
  ),
  pagos_por_orden_copiado AS (
    SELECT 
      ccop.orden_copiado_id,
      COALESCE(SUM(ccop.monto), 0) as total_pagado
    FROM centro_copiado_ordenes_pagos ccop
    GROUP BY ccop.orden_copiado_id
  )
  -- Órdenes de trabajo
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
    (CURRENT_DATE - ot.fecha_creacion::date)::integer as dias_transcurridos,
    ot.estado,
    'trabajo'::text as tipo_orden
  FROM ordenes_trabajo ot
  LEFT JOIN pagos_por_orden_trabajo p ON ot.id = p.orden_id
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelado', 'borrador')
    AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )

  UNION ALL

  -- Órdenes de centro de copiado
  SELECT 
    cc.id as orden_id,
    cc.numero_orden,
    cc.fecha_solicitud as fecha_creacion,
    cc.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    c.numero_documento as cliente_documento,
    COALESCE(c.tiene_cuenta_corriente, false) as tiene_cuenta_corriente,
    cc.total,
    COALESCE(pcc.total_pagado, 0) as pagado,
    (cc.total - COALESCE(pcc.total_pagado, 0)) as saldo_pendiente,
    (CURRENT_DATE - cc.fecha_solicitud::date)::integer as dias_transcurridos,
    cc.estado,
    'copiado'::text as tipo_orden
  FROM centro_copiado_ordenes cc
  LEFT JOIN pagos_por_orden_copiado pcc ON cc.id = pcc.orden_copiado_id
  LEFT JOIN clients c ON cc.cliente_id = c.id
  WHERE cc.company_id = p_company_id
    AND cc.estado != 'cancelada'
    AND (cc.total - COALESCE(pcc.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )

  ORDER BY fecha_creacion DESC;
END;
$$;


ALTER FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text") IS 'Obtiene detalle de órdenes por cobrar incluyendo órdenes de trabajo y centro de copiado';



CREATE OR REPLACE FUNCTION "public"."fn_obtener_estado_cuenta"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date" DEFAULT NULL::"date", "p_fecha_hasta" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("id" "uuid", "fecha" "date", "tipo_movimiento" "text", "descripcion" "text", "orden_id" "uuid", "numero_orden" "text", "monto_debe" numeric, "monto_haber" numeric, "saldo_acumulado" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_obtener_estado_cuenta"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") RETURNS TABLE("factura_storage_path" "text", "numero_factura" "text", "orden_numero" "text", "expires_at" timestamp with time zone, "is_valid" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    fuc.factura_storage_path,
    fuc.numero_factura,
    ot.numero_orden,
    fuc.expires_at,
    (fuc.expires_at > now()) as is_valid
  FROM facturas_urls_cortas fuc
  INNER JOIN ordenes_trabajo ot ON ot.id = fuc.orden_trabajo_id
  WHERE fuc.company_id = p_company_id
    AND fuc.token_corto = p_token;
END;
$$;


ALTER FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") IS 'Obtiene información de factura mediante token corto y company_id. Incluye validación de expiración.';



CREATE OR REPLACE FUNCTION "public"."fn_obtener_ordenes_pendientes_liquidar"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date" DEFAULT NULL::"date", "p_fecha_hasta" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("orden_id" "uuid", "numero_orden" "text", "fecha_creacion" timestamp with time zone, "total" numeric, "estado" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_obtener_ordenes_pendientes_liquidar"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_obtener_paso_de_nivel"("p_tipo" "text", "p_item_id" "uuid", "p_nivel_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_paso_id uuid;
BEGIN
  IF p_tipo = 'servicio' THEN
    SELECT paso_id INTO v_paso_id
    FROM servicios_niveles_precio
    WHERE servicio_id = p_item_id AND id = p_nivel_id;
  ELSIF p_tipo = 'acabado' THEN
    SELECT paso_id INTO v_paso_id
    FROM acabados_niveles_precio
    WHERE acabado_id = p_item_id AND id = p_nivel_id;
  END IF;
  
  RETURN v_paso_id;
END;
$$;


ALTER FUNCTION "public"."fn_obtener_paso_de_nivel"("p_tipo" "text", "p_item_id" "uuid", "p_nivel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_obtener_resumen_cajas"("p_company_id" "uuid") RETURNS TABLE("tipo" "text", "total_saldo" numeric, "cantidad_cajas" bigint, "cajas" json)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_obtener_resumen_cajas"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 50) RETURNS TABLE("orden_id" "uuid", "orden_numero" "text", "cliente_nombre" "text", "categoria_nombre" "text", "fecha_inicio" timestamp with time zone, "fecha_fin" timestamp with time zone, "duracion_horas" numeric, "total_items" bigint, "total_pasos_completados" bigint, "estado" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH orden_stats AS (
    SELECT
      ot.id as orden_id,
      MIN(r.fecha_inicio) as fecha_inicio,
      MAX(r.fecha_fin) as fecha_fin,
      COUNT(DISTINCT oti.id)::bigint as total_items,
      COUNT(DISTINCT r.id)::bigint as total_pasos_completados
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON oti.orden_id = ot.id
    JOIN ordenes_trabajo_items_rutas r ON r.orden_item_id = oti.id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
    GROUP BY ot.id
  )
  SELECT
    ot.id as orden_id,
    ot.numero_orden as orden_numero,
    cl.nombre_fantasia as cliente_nombre,
    COALESCE(
      (SELECT oti.producto_categoria 
       FROM ordenes_trabajo_items oti 
       WHERE oti.orden_id = ot.id 
       LIMIT 1),
      'Sin categoría'
    ) as categoria_nombre,
    os.fecha_inicio,
    os.fecha_fin,
    ROUND((EXTRACT(EPOCH FROM (os.fecha_fin - os.fecha_inicio)) / 3600.0)::numeric, 2) as duracion_horas,
    os.total_items,
    os.total_pasos_completados,
    ot.estado
  FROM orden_stats os
  JOIN ordenes_trabajo ot ON ot.id = os.orden_id
  LEFT JOIN clients cl ON cl.id = ot.cliente_id
  WHERE (p_fecha_desde IS NULL OR os.fecha_fin >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR os.fecha_fin <= p_fecha_hasta)
  ORDER BY os.fecha_fin DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) IS 'Retorna detalle de órdenes completadas (fixed: numero_orden, nombre_fantasia)';



CREATE OR REPLACE FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date" DEFAULT NULL::"date", "p_fecha_hasta" "date" DEFAULT NULL::"date", "p_cliente_id" "uuid" DEFAULT NULL::"uuid", "p_estado" "text" DEFAULT NULL::"text", "p_estado_facturacion" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "numero_orden" "text", "cliente_id" "uuid", "cliente_nombre" "text", "cliente_email" "text", "cliente_whatsapp" "text", "vendedor_id" "uuid", "vendedor_nombre" "text", "estado" "text", "fecha_creacion" timestamp with time zone, "fecha_estimada_entrega" timestamp with time zone, "subtotal" numeric, "subtotal_iva" numeric, "total" numeric, "dias_pendiente" integer, "facturada" boolean, "numero_factura" "text", "factura_storage_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.cliente_id,
    c.razon_social as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    ot.vendedor_id,
    p.full_name as vendedor_nombre,
    ot.estado,
    ot.fecha_creacion,
    ot.fecha_estimada_entrega,
    ot.subtotal,
    ot.subtotal_iva,
    ot.total,
    EXTRACT(DAY FROM (now() - ot.fecha_creacion))::integer as dias_pendiente,
    ot.facturada,
    ot.numero_factura,
    ot.factura_storage_path
  FROM ordenes_trabajo ot
  INNER JOIN clients c ON c.id = ot.cliente_id
  INNER JOIN profiles p ON p.id = ot.vendedor_id
  WHERE ot.company_id = p_company_id
    AND ot.requiere_factura = true
    -- Filtro condicional por estado de facturación
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND ot.facturada = false)
      OR (p_estado_facturacion = 'facturada' AND ot.facturada = true)
    )
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)
  ORDER BY ot.fecha_creacion DESC;
END;
$$;


ALTER FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date", "p_cliente_id" "uuid", "p_estado" "text", "p_estado_facturacion" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date", "p_cliente_id" "uuid", "p_estado" "text", "p_estado_facturacion" "text") IS 'Obtiene órdenes que requieren factura con información completa de facturación. Incluye datos del cliente, vendedor, y PDF de factura cuando está disponible. Soporta múltiples filtros opcionales.';



CREATE OR REPLACE FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), "p_fecha_hasta" timestamp with time zone DEFAULT (CURRENT_DATE + '1 day'::interval), "p_limit" integer DEFAULT 10) RETURNS TABLE("paso_nombre" "text", "tipo_etapa" "text", "cantidad_pausas" bigint, "tiempo_total_horas" numeric, "tiempo_promedio_horas" numeric, "categoria_principal" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH paso_stats AS (
    SELECT
      oir.paso_nombre,
      oir.tipo_etapa,
      COUNT(*)::bigint as cant_pausas,
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60 as tiempo_total,
      MODE() WITHIN GROUP (ORDER BY p.categoria_motivo) as categoria_mas_comun
    FROM ordenes_items_rutas_pausas p
    INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
    WHERE p.fecha_inicio_pausa >= p_fecha_desde
    AND p.fecha_inicio_pausa < p_fecha_hasta
    GROUP BY oir.paso_nombre, oir.tipo_etapa
  )
  SELECT
    ps.paso_nombre,
    ps.tipo_etapa,
    ps.cant_pausas as cantidad_pausas,
    ROUND(ps.tiempo_total, 1) as tiempo_total_horas,
    ROUND(ps.tiempo_total / ps.cant_pausas, 1) as tiempo_promedio_horas,
    ps.categoria_mas_comun as categoria_principal
  FROM paso_stats ps
  ORDER BY ps.cant_pausas DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) IS 'Retorna los pasos que más se pausan con estadísticas agregadas.';



CREATE OR REPLACE FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text" DEFAULT NULL::"text", "p_pausado_por" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_motivo pasos_motivos_pausa%ROWTYPE;
  v_pausa_id uuid;
  v_resultado jsonb;
BEGIN
  -- Validar que la ruta existe y pertenece a la empresa del usuario
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id
  AND company_id IN (SELECT company_id FROM profiles WHERE id = COALESCE(p_pausado_por, auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ruta no encontrada o sin permisos'
    );
  END IF;

  -- Validar estado actual (solo se puede pausar si está en_proceso)
  IF v_ruta.estado_paso != 'en_proceso' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solo se pueden pausar pasos en proceso',
      'estado_actual', v_ruta.estado_paso
    );
  END IF;

  -- Validar que no hay una pausa activa
  IF EXISTS (
    SELECT 1 FROM ordenes_items_rutas_pausas
    WHERE ruta_id = p_ruta_id
    AND fecha_fin_pausa IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe una pausa activa para este paso'
    );
  END IF;

  -- Obtener información del motivo
  SELECT * INTO v_motivo
  FROM pasos_motivos_pausa
  WHERE id = p_motivo_pausa_id
  AND company_id = v_ruta.company_id
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Motivo de pausa no válido'
    );
  END IF;

  -- Validar descripción si es requerida
  IF v_motivo.requiere_descripcion AND (p_descripcion IS NULL OR p_descripcion = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este motivo requiere una descripción'
    );
  END IF;

  -- Crear registro de pausa
  INSERT INTO ordenes_items_rutas_pausas (
    ruta_id,
    motivo_pausa_id,
    categoria_motivo,
    descripcion,
    fecha_inicio_pausa,
    pausado_por
  ) VALUES (
    p_ruta_id,
    p_motivo_pausa_id,
    v_motivo.categoria,
    p_descripcion,
    now(),
    COALESCE(p_pausado_por, auth.uid())
  )
  RETURNING id INTO v_pausa_id;

  -- Actualizar estado del paso a 'pausado'
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = 'pausado',
    cantidad_pausas = cantidad_pausas + 1,
    updated_at = now()
  WHERE id = p_ruta_id;

  -- Construir resultado
  v_resultado := jsonb_build_object(
    'success', true,
    'pausa_id', v_pausa_id,
    'ruta_id', p_ruta_id,
    'estado_nuevo', 'pausado',
    'motivo', v_motivo.nombre,
    'categoria', v_motivo.categoria,
    'fecha_pausa', now()
  );

  RETURN v_resultado;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text", "p_pausado_por" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text", "p_pausado_por" "uuid") IS 'Pausa un paso de producción que esté en proceso, registrando el motivo y cambiando estado a pausado. Valida permisos, estado actual, y requisitos del motivo.';



CREATE OR REPLACE FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), "p_fecha_hasta" timestamp with time zone DEFAULT (CURRENT_DATE + '1 day'::interval), "p_agrupacion" "text" DEFAULT 'dia'::"text") RETURNS TABLE("periodo" "text", "fecha" "date", "cantidad_pausas" bigint, "tiempo_total_horas" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN p_agrupacion = 'dia' THEN TO_CHAR(DATE(p.fecha_inicio_pausa), 'DD/MM/YYYY')
      WHEN p_agrupacion = 'semana' THEN TO_CHAR(DATE_TRUNC('week', p.fecha_inicio_pausa), 'DD/MM/YYYY')
      WHEN p_agrupacion = 'mes' THEN TO_CHAR(DATE_TRUNC('month', p.fecha_inicio_pausa), 'MM/YYYY')
      ELSE TO_CHAR(DATE(p.fecha_inicio_pausa), 'DD/MM/YYYY')
    END as periodo,
    CASE
      WHEN p_agrupacion = 'dia' THEN DATE(p.fecha_inicio_pausa)
      WHEN p_agrupacion = 'semana' THEN DATE(DATE_TRUNC('week', p.fecha_inicio_pausa))
      WHEN p_agrupacion = 'mes' THEN DATE(DATE_TRUNC('month', p.fecha_inicio_pausa))
      ELSE DATE(p.fecha_inicio_pausa)
    END as fecha,
    COUNT(*)::bigint as cantidad_pausas,
    ROUND(
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_total_horas
  FROM ordenes_items_rutas_pausas p
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta
  GROUP BY fecha, periodo
  ORDER BY fecha;
END;
$$;


ALTER FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_agrupacion" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_agrupacion" "text") IS 'Retorna evolución temporal de pausas agrupadas por día, semana o mes.';



CREATE OR REPLACE FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), "p_fecha_hasta" timestamp with time zone DEFAULT (CURRENT_DATE + '1 day'::interval)) RETURNS TABLE("total_pausas" bigint, "pausas_activas" bigint, "pausas_cerradas" bigint, "tiempo_total_pausado_horas" numeric, "tiempo_promedio_pausa_horas" numeric, "pausa_mas_larga_horas" numeric, "ordenes_afectadas" bigint, "pasos_pausados_unicos" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_pausas,
    COUNT(*) FILTER (WHERE p.fecha_fin_pausa IS NULL)::bigint as pausas_activas,
    COUNT(*) FILTER (WHERE p.fecha_fin_pausa IS NOT NULL)::bigint as pausas_cerradas,
    ROUND(
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_total_pausado_horas,
    ROUND(
      AVG(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as tiempo_promedio_pausa_horas,
    ROUND(
      MAX(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60,
      1
    ) as pausa_mas_larga_horas,
    COUNT(DISTINCT oir.orden_item_id)::bigint as ordenes_afectadas,
    COUNT(DISTINCT p.ruta_id)::bigint as pasos_pausados_unicos
  FROM ordenes_items_rutas_pausas p
  INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta;
END;
$$;


ALTER FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna KPIs generales del sistema de pausas: total, activas, cerradas, tiempo promedio, etc.';



CREATE OR REPLACE FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), "p_fecha_hasta" timestamp with time zone DEFAULT (CURRENT_DATE + '1 day'::interval), "p_limit" integer DEFAULT 10) RETURNS TABLE("pausa_id" "uuid", "orden_numero" "text", "paso_nombre" "text", "categoria" "text", "motivo_nombre" "text", "descripcion" "text", "duracion_horas" numeric, "fecha_inicio" timestamp with time zone, "fecha_fin" timestamp with time zone, "esta_activa" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as pausa_id,
    ot.numero_orden as orden_numero,
    oir.paso_nombre as paso_nombre,
    p.categoria_motivo as categoria,
    m.nombre as motivo_nombre,
    p.descripcion,
    ROUND(
      COALESCE(
        p.duracion_minutos,
        EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
      ) / 60,
      1
    ) as duracion_horas,
    p.fecha_inicio_pausa as fecha_inicio,
    p.fecha_fin_pausa as fecha_fin,
    (p.fecha_fin_pausa IS NULL) as esta_activa
  FROM ordenes_items_rutas_pausas p
  INNER JOIN ordenes_trabajo_items_rutas oir ON oir.id = p.ruta_id
  INNER JOIN ordenes_trabajo_items oti ON oti.id = oir.orden_item_id
  INNER JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
  LEFT JOIN pasos_motivos_pausa m ON m.id = p.motivo_pausa_id
  WHERE p.fecha_inicio_pausa >= p_fecha_desde
  AND p.fecha_inicio_pausa < p_fecha_hasta
  ORDER BY
    COALESCE(
      p.duracion_minutos,
      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
    ) DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) IS 'Retorna las pausas más prolongadas del período con información detallada.';



CREATE OR REPLACE FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), "p_fecha_hasta" timestamp with time zone DEFAULT (CURRENT_DATE + '1 day'::interval)) RETURNS TABLE("categoria" "text", "cantidad" bigint, "porcentaje" numeric, "tiempo_total_horas" numeric, "tiempo_promedio_horas" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH pausas_stats AS (
    SELECT
      p.categoria_motivo,
      COUNT(*)::bigint as cant,
      SUM(
        COALESCE(
          p.duracion_minutos,
          EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 60
        )
      ) / 60 as tiempo_total,
      COUNT(*) OVER() as total_pausas
    FROM ordenes_items_rutas_pausas p
    WHERE p.fecha_inicio_pausa >= p_fecha_desde
    AND p.fecha_inicio_pausa < p_fecha_hasta
    GROUP BY p.categoria_motivo
  )
  SELECT
    ps.categoria_motivo as categoria,
    ps.cant as cantidad,
    ROUND((ps.cant::numeric / ps.total_pausas::numeric) * 100, 1) as porcentaje,
    ROUND(ps.tiempo_total, 1) as tiempo_total_horas,
    ROUND(ps.tiempo_total / ps.cant, 1) as tiempo_promedio_horas
  FROM pausas_stats ps
  ORDER BY ps.cant DESC;
END;
$$;


ALTER FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Retorna distribución de pausas agrupadas por categoría con cantidades y tiempos.';



CREATE OR REPLACE FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_items_sin_precio integer;
BEGIN
  -- Contar items sin precio usando el índice
  SELECT COUNT(*)
  INTO v_items_sin_precio
  FROM presupuestos_items
  WHERE presupuesto_id = p_presupuesto_id
    AND (precio_unitario_final IS NULL OR precio_total IS NULL);
  
  RETURN v_items_sin_precio > 0;
END;
$$;


ALTER FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") IS 'Retorna true si el presupuesto tiene al menos un item sin precio asignado (pendiente de cotización)';



CREATE OR REPLACE FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  -- Contar presupuestos en borrador que tienen items sin precio
  SELECT COUNT(*)
  INTO v_count
  FROM presupuestos p
  WHERE p.company_id = p_company_id
    AND p.estado = 'borrador'
    AND EXISTS (
      SELECT 1
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") IS 'Retorna la cantidad de presupuestos en estado borrador que tienen items sin precio asignado';



CREATE OR REPLACE FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") RETURNS TABLE("presupuesto_id" "uuid", "numero_presupuesto" "text", "cliente_nombre" "text", "items_pendientes" integer, "items_totales" integer, "fecha_creacion" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.numero_presupuesto,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    (
      SELECT COUNT(*)::integer
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    ) as items_pendientes,
    (
      SELECT COUNT(*)::integer
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
    ) as items_totales,
    p.fecha_creacion
  FROM presupuestos p
  INNER JOIN clients c ON c.id = p.cliente_id
  WHERE p.company_id = p_company_id
    AND p.estado = 'borrador'
    AND EXISTS (
      SELECT 1
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    )
  ORDER BY p.fecha_creacion DESC;
END;
$$;


ALTER FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") IS 'Retorna detalles de presupuestos pendientes de cotizar para dashboard';



CREATE OR REPLACE FUNCTION "public"."fn_presupuestos_registro_historial"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_accion text;
  v_usuario_id uuid;
  v_detalles jsonb;
BEGIN
  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'creado';
    v_usuario_id := NEW.created_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', NEW.numero_presupuesto,
      'cliente_id', NEW.cliente_id,
      'estado_inicial', NEW.estado
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar tipo de cambio
    IF OLD.estado != NEW.estado THEN
      v_accion := 'cambio_estado';
    ELSE
      v_accion := 'modificado';
    END IF;
    v_usuario_id := NEW.updated_by;
    v_detalles := jsonb_build_object(
      'cambios', jsonb_build_object(
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado,
        'total_anterior', OLD.total,
        'total_nuevo', NEW.total
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'eliminado';
    v_usuario_id := OLD.updated_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', OLD.numero_presupuesto,
      'estado_final', OLD.estado
    );
  END IF;

  -- Insertar en historial
  INSERT INTO presupuestos_historial (
    presupuesto_id,
    accion,
    estado_anterior,
    estado_nuevo,
    usuario_id,
    detalles
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_accion,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.estado ELSE NULL END,
    v_usuario_id,
    v_detalles
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."fn_presupuestos_registro_historial"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_realizar_arqueo_caja"("p_caja_id" "uuid", "p_saldo_real" numeric, "p_observaciones" "text" DEFAULT NULL::"text", "p_billetes_detalle" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_saldo_sistema NUMERIC;
    v_diferencia NUMERIC;
    v_arqueo_id UUID;
BEGIN
    -- Get Context
    v_user_id := auth.uid();
    
    SELECT company_id INTO v_company_id
    FROM profiles WHERE id = v_user_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to a company';
    END IF;

    -- Get System Balance
    SELECT saldo_actual INTO v_saldo_sistema
    FROM cajas
    WHERE id = p_caja_id AND company_id = v_company_id;

    IF v_saldo_sistema IS NULL THEN
        RAISE EXCEPTION 'Caja not found or access denied';
    END IF;

    -- Calculate Difference
    v_diferencia := p_saldo_real - v_saldo_sistema;

    -- Create Arqueo Record
    INSERT INTO arqueos_cajas (
        company_id,
        caja_id,
        saldo_sistema,
        saldo_real,
        diferencia,
        billetes_detalle,
        observaciones,
        created_by
    ) VALUES (
        v_company_id,
        p_caja_id,
        v_saldo_sistema,
        p_saldo_real,
        v_diferencia,
        p_billetes_detalle,
        p_observaciones,
        v_user_id
    ) RETURNING id INTO v_arqueo_id;

    -- Automatic Adjustment Logic
    IF v_diferencia != 0 THEN
        -- Create adjustment movement in cajas_movimientos
        INSERT INTO cajas_movimientos (
            caja_id,
            tipo_movimiento,
            monto,
            concepto,
            fecha,
            referencia_tipo,
            referencia_id,
            notas,
            created_by
        ) VALUES (
            p_caja_id,
            CASE WHEN v_diferencia > 0 THEN 'ingreso' ELSE 'egreso' END,
            ABS(v_diferencia),
            'Ajuste automático por Arqueo de Caja',
            CURRENT_DATE,
            'ajuste',
            v_arqueo_id,
            CASE 
                WHEN v_diferencia > 0 THEN 'Sobrante de Caja ajustado automáticamente'
                ELSE 'Faltante de Caja ajustado automáticamente'
            END,
            v_user_id
        );
    END IF;

    RETURN jsonb_build_object(
        'id', v_arqueo_id,
        'saldo_sistema', v_saldo_sistema,
        'saldo_real', p_saldo_real,
        'diferencia', v_diferencia
    );
END;
$$;


ALTER FUNCTION "public"."fn_realizar_arqueo_caja"("p_caja_id" "uuid", "p_saldo_real" numeric, "p_observaciones" "text", "p_billetes_detalle" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_realizar_transferencia_caja"("p_caja_origen_id" "uuid", "p_caja_destino_id" "uuid", "p_monto" numeric, "p_concepto" "text", "p_notas" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_saldo_origen numeric;
BEGIN
  -- 1. Verificar acceso a CAJA ORIGEN y obtener company_id
  SELECT c.company_id, c.saldo_actual INTO v_company_id, v_saldo_origen
  FROM cajas c
  WHERE c.id = p_caja_origen_id
  AND (
    c.company_id IN (SELECT p.company_id FROM profiles p WHERE p.id = v_user_id)
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso sobre la caja de origen o no existe.';
  END IF;

  -- 2. Validaciones básicas
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0.';
  END IF;

  IF v_saldo_origen < p_monto THEN
    RAISE EXCEPTION 'Saldo insuficiente en la caja de origen.';
  END IF;

  -- 3. Registrar Transacción (Única fila)
  -- El trigger 'actualizar_saldo_caja' detectará 'transferencia' y:
  --   - Restará a caja_id (Origen)
  --   - Sumará a caja_destino_id (Destino)
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    caja_destino_id,
    notas,
    created_by
  ) VALUES (
    p_caja_origen_id,
    'transferencia',
    p_monto,
    p_concepto,
    CURRENT_DATE,
    'transferencia',
    p_caja_destino_id,
    p_notas,
    v_user_id
  );

  -- NO ACTUALIZAR SALDOS MANUALMENTE (El trigger lo hace)

END;
$$;


ALTER FUNCTION "public"."fn_realizar_transferencia_caja"("p_caja_origen_id" "uuid", "p_caja_destino_id" "uuid", "p_monto" numeric, "p_concepto" "text", "p_notas" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_pausa_activa ordenes_items_rutas_pausas%ROWTYPE;
  v_duracion_minutos integer;
  v_resultado jsonb;
BEGIN
  -- Validar que la ruta existe y pertenece a la empresa del usuario
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id
  AND company_id IN (SELECT company_id FROM profiles WHERE id = COALESCE(p_reanudado_por, auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ruta no encontrada o sin permisos'
    );
  END IF;

  -- Validar estado actual (debe estar pausado)
  IF v_ruta.estado_paso != 'pausado' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El paso no está pausado',
      'estado_actual', v_ruta.estado_paso
    );
  END IF;

  -- Buscar pausa activa
  SELECT * INTO v_pausa_activa
  FROM ordenes_items_rutas_pausas
  WHERE ruta_id = p_ruta_id
  AND fecha_fin_pausa IS NULL
  ORDER BY fecha_inicio_pausa DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró una pausa activa para este paso'
    );
  END IF;

  -- Cerrar la pausa activa
  UPDATE ordenes_items_rutas_pausas
  SET
    fecha_fin_pausa = now(),
    reanudado_por = COALESCE(p_reanudado_por, auth.uid())
  WHERE id = v_pausa_activa.id
  RETURNING duracion_minutos INTO v_duracion_minutos;

  -- Cambiar estado del paso a 'en_proceso'
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = 'en_proceso',
    updated_at = now()
  WHERE id = p_ruta_id;

  -- Recalcular tiempo pausado total (se hace con trigger)
  PERFORM fn_recalcular_tiempos_paso(p_ruta_id);

  -- Construir resultado
  v_resultado := jsonb_build_object(
    'success', true,
    'ruta_id', p_ruta_id,
    'pausa_id', v_pausa_activa.id,
    'estado_nuevo', 'en_proceso',
    'duracion_pausa_minutos', v_duracion_minutos,
    'fecha_reanudacion', now()
  );

  RETURN v_resultado;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid") IS 'Reanuda un paso pausado, cierra la pausa activa y vuelve el estado a en_proceso. Recalcula automáticamente los tiempos.';



CREATE OR REPLACE FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_nuevo_saldo numeric;
BEGIN
  -- Calcular saldo sumando todos los movimientos
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tipo_movimiento = 'ingreso' THEN monto
        WHEN tipo_movimiento = 'egreso' THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_id = p_caja_id THEN -monto
        WHEN tipo_movimiento = 'transferencia' AND caja_destino_id = p_caja_id THEN monto
        WHEN tipo_movimiento = 'ajuste' THEN monto
        ELSE 0
      END
    ), 0
  ) INTO v_nuevo_saldo
  FROM cajas_movimientos
  WHERE caja_id = p_caja_id OR caja_destino_id = p_caja_id;

  -- Actualizar el saldo en la tabla
  UPDATE cajas
  SET saldo_actual = v_nuevo_saldo,
      updated_at = NOW()
  WHERE id = p_caja_id;

  RETURN v_nuevo_saldo;
END;
$$;


ALTER FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") IS 'Recalcula el saldo de una caja específica basándose en todos sus movimientos. Retorna el nuevo saldo.';



CREATE OR REPLACE FUNCTION "public"."fn_recalcular_saldos_cajas"() RETURNS TABLE("caja_id" "uuid", "caja_nombre" "text", "saldo_anterior" numeric, "saldo_nuevo" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH saldos_calculados AS (
    SELECT 
      c.id,
      c.nombre,
      c.saldo_actual as saldo_anterior,
      COALESCE(
        SUM(
          CASE
            WHEN cm.tipo_movimiento = 'ingreso' THEN cm.monto
            WHEN cm.tipo_movimiento = 'egreso' THEN -cm.monto
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_id = c.id THEN -cm.monto
            WHEN cm.tipo_movimiento = 'transferencia' AND cm.caja_destino_id = c.id THEN cm.monto
            WHEN cm.tipo_movimiento = 'ajuste' THEN cm.monto
            ELSE 0
          END
        ), 0
      ) as saldo_nuevo
    FROM cajas c
    LEFT JOIN cajas_movimientos cm ON (cm.caja_id = c.id OR cm.caja_destino_id = c.id)
    GROUP BY c.id, c.nombre, c.saldo_actual
  )
  UPDATE cajas c
  SET saldo_actual = sc.saldo_nuevo,
      updated_at = NOW()
  FROM saldos_calculados sc
  WHERE c.id = sc.id
  RETURNING c.id, sc.nombre, sc.saldo_anterior, sc.saldo_nuevo;
END;
$$;


ALTER FUNCTION "public"."fn_recalcular_saldos_cajas"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recalcular_saldos_cajas"() IS 'Recalcula los saldos de TODAS las cajas. Retorna tabla con saldos anteriores y nuevos para auditoría.';



CREATE OR REPLACE FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tiempo_pausado interval;
  v_fecha_inicio timestamptz;
  v_fecha_fin timestamptz;
  v_tiempo_trabajo_efectivo interval;
BEGIN
  -- Obtener fechas del paso
  SELECT fecha_inicio, fecha_fin
  INTO v_fecha_inicio, v_fecha_fin
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id;

  -- Calcular tiempo pausado total (suma de todas las pausas cerradas)
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (fecha_fin_pausa - fecha_inicio_pausa)) * INTERVAL '1 second'
  ), INTERVAL '0')
  INTO v_tiempo_pausado
  FROM ordenes_items_rutas_pausas
  WHERE ruta_id = p_ruta_id
  AND fecha_fin_pausa IS NOT NULL;

  -- Calcular tiempo trabajo efectivo si el paso está completado
  IF v_fecha_fin IS NOT NULL AND v_fecha_inicio IS NOT NULL THEN
    v_tiempo_trabajo_efectivo := (v_fecha_fin - v_fecha_inicio) - v_tiempo_pausado;
  ELSE
    v_tiempo_trabajo_efectivo := NULL;
  END IF;

  -- Actualizar la ruta
  UPDATE ordenes_trabajo_items_rutas
  SET
    tiempo_pausado_total = v_tiempo_pausado,
    tiempo_trabajo_efectivo = v_tiempo_trabajo_efectivo,
    updated_at = now()
  WHERE id = p_ruta_id;

END;
$$;


ALTER FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") IS 'Recalcula tiempo_pausado_total y tiempo_trabajo_efectivo basado en todas las pausas registradas. Se ejecuta automáticamente al cerrar pausas.';



CREATE OR REPLACE FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos numeric;
  v_total_oc numeric;
  v_total_servicios numeric;
  v_nuevo_total numeric;
BEGIN
  -- Obtener subtotal (items) y descuentos de la orden de trabajo
  SELECT COALESCE(subtotal, 0), COALESCE(total_descuentos, 0)
  INTO v_subtotal_ot, v_descuentos
  FROM ordenes_trabajo
  WHERE id = p_orden_trabajo_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Orden de trabajo % no encontrada', p_orden_trabajo_id;
    RETURN 0;
  END IF;

  -- Obtener total servicios adicionales
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_total_servicios
  FROM ordenes_trabajo_servicios
  WHERE orden_id = p_orden_trabajo_id;

  -- Obtener total ordenes de copiado asociadas
  SELECT COALESCE(SUM(total), 0)
  INTO v_total_oc
  FROM centro_copiado_ordenes
  WHERE orden_trabajo_id = p_orden_trabajo_id;

  -- Calcular nuevo total: (subtotal_items + servicios) - descuentos + total_ordenes_copiado
  -- Nota: Asumimos que 'subtotal' en ordenes_trabajo SOLO contiene la suma de items de inventario.
  v_nuevo_total := v_subtotal_ot + v_total_servicios - v_descuentos + v_total_oc;

  -- Actualizar orden de trabajo
  UPDATE ordenes_trabajo
  SET total = v_nuevo_total,
      updated_at = NOW()
  WHERE id = p_orden_trabajo_id;

  RETURN v_nuevo_total;
END;
$$;


ALTER FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") IS 'Recalcula el total de una orden de trabajo incluyendo items propios + órdenes de copiado asociadas - descuentos. Retorna el nuevo total.';



CREATE OR REPLACE FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() RETURNS TABLE("orden_id" "uuid", "numero_orden" "text", "total_anterior" numeric, "total_nuevo" numeric, "diferencia" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH totales_calculados AS (
    SELECT 
      ot.id,
      ot.numero_orden,
      ot.total as total_actual,
      (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0)) as total_correcto
    FROM ordenes_trabajo ot
    LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
    GROUP BY ot.id, ot.numero_orden, ot.total, ot.subtotal, ot.total_descuentos
  )
  UPDATE ordenes_trabajo ot
  SET total = tc.total_correcto,
      updated_at = NOW()
  FROM totales_calculados tc
  WHERE ot.id = tc.id
    AND ABS(ot.total - tc.total_correcto) > 0.01
  RETURNING 
    ot.id,
    tc.numero_orden,
    tc.total_actual,
    tc.total_correcto,
    (tc.total_correcto - tc.total_actual) as diferencia;
END;
$$;


ALTER FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() IS 'Recalcula los totales de TODAS las órdenes de trabajo. Útil para corrección masiva. Retorna órdenes corregidas con diferencias.';



CREATE OR REPLACE FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente clients;
  v_result json;
BEGIN
  -- Verificar que el cliente existe y está pendiente
  SELECT * INTO v_cliente 
  FROM clients 
  WHERE id = p_cliente_id AND status_aprobacion = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cliente no encontrado o ya fue procesado'
    );
  END IF;

  -- Rechazar cliente
  UPDATE clients SET
    status_aprobacion = 'rejected',
    is_active = false,
    aprobado_por = p_rechazado_por,
    fecha_aprobacion = now(),
    notas_rechazo = p_notas,
    updated_by = p_rechazado_por,
    updated_at = now()
  WHERE id = p_cliente_id;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'nombre', v_cliente.nombre_fantasia
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text") IS 'Rechaza un cliente pendiente con notas explicativas';



CREATE OR REPLACE FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") IS 'Crea las combinaciones de material-variante-espesor faltantes en la tabla de materiales para precios huérfanos';



CREATE OR REPLACE FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_orden ordenes_trabajo%ROWTYPE;
  v_cliente clients%ROWTYPE;
  v_company companies%ROWTYPE;
  v_result json;
BEGIN
  -- Obtener datos de la orden
  SELECT * INTO v_orden
  FROM ordenes_trabajo
  WHERE id = p_orden_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada con ID: %', p_orden_id;
  END IF;

  IF NOT v_orden.requiere_factura THEN
    RAISE EXCEPTION 'Esta orden no requiere factura. Número de orden: %', v_orden.numero_orden;
  END IF;

  IF v_orden.facturada THEN
    RAISE EXCEPTION 'Esta orden ya tiene factura registrada. Número de factura: %', v_orden.numero_factura;
  END IF;

  -- Obtener datos del cliente
  SELECT * INTO v_cliente
  FROM clients
  WHERE id = v_orden.cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado con ID: %', v_orden.cliente_id;
  END IF;

  -- Obtener datos de la empresa
  SELECT * INTO v_company
  FROM companies
  WHERE id = v_orden.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa no encontrada con ID: %', v_orden.company_id;
  END IF;

  -- Actualizar orden con datos de facturación
  UPDATE ordenes_trabajo
  SET
    facturada = true,
    fecha_facturacion = now(),
    numero_factura = p_numero_factura,
    factura_storage_path = p_factura_storage_path,
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_orden_id;

  -- Registrar en historial para auditoría
  INSERT INTO facturas_historial (
    orden_id,
    company_id,
    numero_factura,
    monto_subtotal,
    monto_iva,
    monto_total,
    factura_storage_path,
    tipo_operacion,
    observaciones,
    created_by
  ) VALUES (
    p_orden_id,
    v_orden.company_id,
    p_numero_factura,
    v_orden.subtotal - COALESCE(v_orden.total_descuentos, 0),
    v_orden.subtotal_iva,
    v_orden.total,
    p_factura_storage_path,
    'creacion',
    p_observaciones,
    p_user_id
  );

  -- Preparar datos para notificación WhatsApp
  v_result := json_build_object(
    'orden_id', p_orden_id,
    'numero_orden', v_orden.numero_orden,
    'numero_factura', p_numero_factura,
    'cliente_nombre', v_cliente.razon_social,
    'cliente_whatsapp', v_cliente.whatsapp,
    'cliente_email', v_cliente.email,
    'company_id', v_orden.company_id,
    'company_name', v_company.name,
    'factura_storage_path', p_factura_storage_path,
    'total', v_orden.total,
    'subtotal_iva', v_orden.subtotal_iva,
    'fecha_facturacion', now()
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text", "p_user_id" "uuid") IS 'Registra que una orden ha sido facturada. Actualiza la orden, crea registro en historial y retorna datos para notificación WhatsApp.';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text" DEFAULT 'dia'::"text") RETURNS TABLE("fecha" "date", "periodo_label" "text", "ingresos" numeric, "egresos" numeric, "balance" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Validar granularidad
  IF p_granularidad NOT IN ('dia', 'semana', 'mes') THEN
    p_granularidad := 'dia';
  END IF;

  -- Generar períodos y calcular movimientos según granularidad
  IF p_granularidad = 'dia' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval)::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        m.fecha::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY m.fecha::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      to_char(p.periodo_fecha, 'DD/MM') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;

  ELSIF p_granularidad = 'semana' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('week', p_fecha_inicio::timestamp),
        date_trunc('week', p_fecha_fin::timestamp),
        '1 week'::interval
      )::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        date_trunc('week', m.fecha::timestamp)::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY date_trunc('week', m.fecha::timestamp)::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      'Sem ' || to_char(p.periodo_fecha, 'WW') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;

  ELSE -- mes
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('month', p_fecha_inicio::timestamp),
        date_trunc('month', p_fecha_fin::timestamp),
        '1 month'::interval
      )::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        date_trunc('month', m.fecha::timestamp)::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY date_trunc('month', m.fecha::timestamp)::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      to_char(p.periodo_fecha, 'Mon YYYY') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;
  END IF;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") IS 'Genera un reporte de ingresos y egresos agrupados por día, semana o mes';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("total_ventas" numeric, "total_cobrado" numeric, "saldo_pendiente" numeric, "total_ordenes" bigint, "ordenes_con_sena" bigint, "ordenes_sin_sena" bigint, "tasa_sena_promedio" numeric, "porcentaje_ordenes_con_sena" numeric, "monto_sena_promedio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_con_pagos AS (
    SELECT
      ot.id AS orden_id,
      ot.total AS total_orden,
      COALESCE(SUM(otp.monto), 0) AS pagado
    FROM ordenes_trabajo ot
    LEFT JOIN ordenes_trabajo_pagos otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.cliente_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = ot.cliente_id 
        AND cl.tiene_cuenta_corriente = true
      ))
    GROUP BY ot.id, ot.total
  ),
  ordenes_copiado_con_pagos AS (
    SELECT
      cc.id AS orden_id,
      cc.total AS total_orden,
      COALESCE(SUM(ccp.monto), 0) AS pagado
    FROM centro_copiado_ordenes cc
    LEFT JOIN centro_copiado_ordenes_pagos ccp ON cc.id = ccp.orden_copiado_id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
      AND (cc.cliente_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = cc.cliente_id 
        AND cl.tiene_cuenta_corriente = true
      ))
    GROUP BY cc.id, cc.total
  ),
  todas_ordenes AS (
    SELECT orden_id, total_orden, pagado FROM ordenes_con_pagos
    UNION ALL
    SELECT orden_id, total_orden, pagado FROM ordenes_copiado_con_pagos
  ),
  analisis_ordenes AS (
    SELECT
      total_orden,
      pagado,
      CASE
        WHEN total_orden > 0 THEN (pagado / total_orden * 100)
        ELSE 0
      END AS tasa_orden,
      CASE WHEN pagado > 0 THEN 1 ELSE 0 END AS tiene_sena
    FROM todas_ordenes
  )
  SELECT
    COALESCE(SUM(total_orden), 0) AS total_ventas,
    COALESCE(SUM(pagado), 0) AS total_cobrado,
    COALESCE(SUM(total_orden - pagado), 0) AS saldo_pendiente,
    COUNT(*)::bigint AS total_ordenes,
    COALESCE(SUM(tiene_sena), 0)::bigint AS ordenes_con_sena,
    (COUNT(*) - COALESCE(SUM(tiene_sena), 0))::bigint AS ordenes_sin_sena,
    COALESCE(AVG(tasa_orden), 0) AS tasa_sena_promedio,
    CASE
      WHEN COUNT(*) > 0 THEN (COALESCE(SUM(tiene_sena), 0)::numeric / COUNT(*) * 100)
      ELSE 0
    END AS porcentaje_ordenes_con_sena,
    CASE
      WHEN COALESCE(SUM(tiene_sena), 0) > 0 
      THEN (SUM(CASE WHEN tiene_sena = 1 THEN pagado ELSE 0 END) / SUM(tiene_sena))
      ELSE 0
    END AS monto_sena_promedio
  FROM analisis_ordenes;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Retorna análisis completo de tasa de seña vs meta del 50%, excluyendo órdenes de cuenta corriente';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer DEFAULT 10) RETURNS TABLE("producto_nombre" "text", "categoria_nombre" "text", "total_vendido" numeric, "unidades_vendidas" numeric, "porcentaje" numeric, "ticket_promedio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ventas_totales AS (
    SELECT COALESCE(SUM(oti.precio_total), 0) AS total
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado != 'cancelado'
  )
  SELECT
    oti.producto_nombre AS producto_nombre,
    oti.producto_categoria AS categoria_nombre,
    COALESCE(SUM(oti.precio_total), 0) AS total_vendido,
    COALESCE(SUM(oti.cantidad), 0) AS unidades_vendidas,
    CASE
      WHEN vt.total > 0
      THEN (COALESCE(SUM(oti.precio_total), 0) / vt.total * 100)
      ELSE 0
    END AS porcentaje,
    COALESCE(AVG(oti.precio_unitario_final), 0) AS ticket_promedio
  FROM ordenes_trabajo ot
  JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id, ventas_totales vt
  WHERE ot.company_id = p_company_id
    AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
    AND ot.estado != 'cancelado'
  GROUP BY oti.producto_nombre, oti.producto_categoria, vt.total
  ORDER BY total_vendido DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) IS 'Ranking de productos más vendidos por facturación';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("total_ventas" numeric, "total_ordenes" bigint, "ticket_promedio" numeric, "total_cobrado" numeric, "saldo_pendiente" numeric, "tasa_cobro" numeric, "total_ventas_anterior" numeric, "total_ordenes_anterior" bigint, "variacion_ventas" numeric, "variacion_ordenes" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_dias_periodo integer;
  v_fecha_inicio_anterior date;
  v_fecha_fin_anterior date;
BEGIN
  -- Calcular período anterior
  v_dias_periodo := p_fecha_fin - p_fecha_inicio;
  v_fecha_fin_anterior := p_fecha_inicio - 1;
  v_fecha_inicio_anterior := v_fecha_fin_anterior - v_dias_periodo;

  RETURN QUERY
  WITH periodo_actual AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes,
      COALESCE(AVG(ot.total), 0) AS ticket_promedio
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  pagos_periodo_actual AS (
    SELECT
      COALESCE(SUM(otp.monto), 0) AS total_cobrado_ot
    FROM ordenes_trabajo_pagos otp
    JOIN ordenes_trabajo ot ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  periodo_anterior AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS total_ventas,
      COUNT(DISTINCT ot.id) AS total_ordenes
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  centro_copiado_actual AS (
    SELECT
      COALESCE(SUM(cc.total), 0) AS total_ventas,
      COUNT(DISTINCT cc.id) AS total_ordenes
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  pagos_copiado_actual AS (
    SELECT
      COALESCE(SUM(ccp.monto), 0) AS total_cobrado_cc
    FROM centro_copiado_ordenes_pagos ccp
    JOIN centro_copiado_ordenes cc ON cc.id = ccp.orden_copiado_id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  centro_copiado_anterior AS (
    SELECT
      COALESCE(SUM(cc.total), 0) AS total_ventas,
      COUNT(DISTINCT cc.id) AS total_ordenes
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN v_fecha_inicio_anterior AND v_fecha_fin_anterior
      AND cc.estado != 'cancelada'
  ),
  tasa_cobro_calc AS (
    SELECT
      COALESCE(SUM(ot.total), 0) AS ventas_sin_cc,
      COALESCE(SUM(otp.monto), 0) AS cobrado_sin_cc
    FROM ordenes_trabajo ot
    LEFT JOIN ordenes_trabajo_pagos otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.cliente_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = ot.cliente_id 
        AND cl.tiene_cuenta_corriente = true
      ))
  )
  SELECT
    pa.total_ventas + cca.total_ventas AS total_ventas,
    pa.total_ordenes + cca.total_ordenes AS total_ordenes,
    CASE
      WHEN (pa.total_ordenes + cca.total_ordenes) > 0
      THEN (pa.total_ventas + cca.total_ventas) / (pa.total_ordenes + cca.total_ordenes)
      ELSE 0
    END AS ticket_promedio,
    ppa.total_cobrado_ot + pca.total_cobrado_cc AS total_cobrado,
    (pa.total_ventas + cca.total_ventas) - (ppa.total_cobrado_ot + pca.total_cobrado_cc) AS saldo_pendiente,
    CASE
      WHEN tc.ventas_sin_cc > 0 THEN (tc.cobrado_sin_cc / tc.ventas_sin_cc * 100)
      ELSE 0
    END AS tasa_cobro,
    pant.total_ventas + ccant.total_ventas AS total_ventas_anterior,
    pant.total_ordenes + ccant.total_ordenes AS total_ordenes_anterior,
    CASE
      WHEN (pant.total_ventas + ccant.total_ventas) > 0
      THEN ((pa.total_ventas + cca.total_ventas - pant.total_ventas - ccant.total_ventas)
            / (pant.total_ventas + ccant.total_ventas) * 100)
      ELSE 0
    END AS variacion_ventas,
    CASE
      WHEN (pant.total_ordenes + ccant.total_ordenes) > 0
      THEN ((pa.total_ordenes + cca.total_ordenes - pant.total_ordenes - ccant.total_ordenes)::numeric
            / (pant.total_ordenes + ccant.total_ordenes) * 100)
      ELSE 0
    END AS variacion_ordenes
  FROM periodo_actual pa
  CROSS JOIN pagos_periodo_actual ppa
  CROSS JOIN periodo_anterior pant
  CROSS JOIN centro_copiado_actual cca
  CROSS JOIN pagos_copiado_actual pca
  CROSS JOIN centro_copiado_anterior ccant
  CROSS JOIN tasa_cobro_calc tc;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'KPIs generales de ventas con cálculo correcto y simplificado de Total Cobrado';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("canal" "text", "total_ventas" numeric, "total_ordenes" bigint, "ordenes_trabajo" bigint, "ordenes_copiado" bigint, "porcentaje_ventas" numeric, "porcentaje_ordenes" numeric, "ticket_promedio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_canal AS (
    -- Órdenes de trabajo con su canal
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')

    UNION ALL

    -- Órdenes de centro copiado vinculadas: priorizar canal de orden trabajo, luego origen de copiado
    SELECT
      COALESCE(ot.canal_venta, cc.origen, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    LEFT JOIN ordenes_trabajo ot ON cc.orden_trabajo_id = ot.id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NOT NULL

    UNION ALL

    -- Órdenes de centro copiado independientes: USAR CAMPO ORIGEN DIRECTAMENTE
    SELECT
      COALESCE(cc.origen, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
  ),
  resumen_canales AS (
    SELECT
      opc.canal,
      SUM(opc.monto) AS ventas,
      COUNT(*) AS ordenes,
      COUNT(CASE WHEN opc.tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
      COUNT(CASE WHEN opc.tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
    FROM ordenes_por_canal opc
    GROUP BY opc.canal
  ),
  totales AS (
    SELECT
      SUM(rc.ventas) AS total_ventas,
      SUM(rc.ordenes) AS total_ordenes
    FROM resumen_canales rc
  )
  SELECT
    rc.canal,
    rc.ventas,
    rc.ordenes,
    rc.ordenes_trabajo,
    rc.ordenes_copiado,
    CASE
      WHEN t.total_ventas > 0 THEN (rc.ventas / t.total_ventas * 100)
      ELSE 0
    END AS porcentaje_ventas,
    CASE
      WHEN t.total_ordenes > 0 THEN (rc.ordenes::numeric / t.total_ordenes * 100)
      ELSE 0
    END AS porcentaje_ordenes,
    CASE
      WHEN rc.ordenes > 0 THEN rc.ventas / rc.ordenes
      ELSE 0
    END AS ticket_promedio
  FROM resumen_canales rc
  CROSS JOIN totales t
  ORDER BY rc.ventas DESC;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Distribución de ventas por canal real (Web/WhatsApp/Mostrador/App Mobile) - Usa campo origen de órdenes de copiado';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("categoria_nombre" "text", "total_ventas" numeric, "total_ordenes" bigint, "porcentaje" numeric, "ticket_promedio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_trabajo_items_categorias AS (
    SELECT
      COALESCE(oti.producto_categoria, 'Sin Categoría') AS categoria,
      oti.precio_total AS total_item
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  centro_copiado_categoria AS (
    SELECT
      'Centro de Copiado' AS categoria,
      cc.total AS total_item
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  todas_categorias AS (
    SELECT categoria, total_item FROM ordenes_trabajo_items_categorias
    UNION ALL
    SELECT categoria, total_item FROM centro_copiado_categoria
  ),
  resumen_categorias AS (
    SELECT
      tc.categoria,
      SUM(tc.total_item) AS ventas_categoria,
      COUNT(*) AS ordenes_categoria
    FROM todas_categorias tc
    GROUP BY tc.categoria
  ),
  total_general AS (
    SELECT SUM(ventas_categoria) AS total_ventas_general FROM resumen_categorias
  )
  SELECT
    rc.categoria AS categoria_nombre,
    rc.ventas_categoria AS total_ventas,
    rc.ordenes_categoria AS total_ordenes,
    CASE
      WHEN tg.total_ventas_general > 0 THEN (rc.ventas_categoria / tg.total_ventas_general * 100)
      ELSE 0
    END AS porcentaje,
    CASE
      WHEN rc.ordenes_categoria > 0 THEN rc.ventas_categoria / rc.ordenes_categoria
      ELSE 0
    END AS ticket_promedio
  FROM resumen_categorias rc
  CROSS JOIN total_general tg
  ORDER BY rc.ventas_categoria DESC;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Retorna facturación agrupada por categorías de productos incluyendo centro de copiado';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("dia_semana" integer, "dia_nombre" "text", "total_ventas" numeric, "total_ordenes" bigint, "ticket_promedio" numeric, "porcentaje_ordenes" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_dia AS (
    SELECT
      EXTRACT(DOW FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS dia,
      ot.total AS monto
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(DOW FROM (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS dia,
      cc.total AS monto
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_dias AS (
    SELECT
      dia::integer,
      CASE dia::integer
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
      END AS nombre_dia,
      SUM(monto) AS ventas,
      COUNT(*) AS ordenes
    FROM ordenes_por_dia
    GROUP BY dia
  ),
  total_ordenes AS (
    SELECT SUM(ordenes) AS total FROM resumen_dias
  )
  SELECT
    rd.dia,
    rd.nombre_dia,
    rd.ventas,
    rd.ordenes,
    CASE
      WHEN rd.ordenes > 0 THEN rd.ventas / rd.ordenes
      ELSE 0
    END AS ticket_promedio,
    CASE
      WHEN t.total > 0 THEN (rd.ordenes::numeric / t.total * 100)
      ELSE 0
    END AS porcentaje_ordenes
  FROM resumen_dias rd
  CROSS JOIN total_ordenes t
  ORDER BY rd.dia;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Retorna análisis de ventas por día de la semana corregido para zona horaria Argentina (UTC-3)';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS TABLE("hora" integer, "rango_horario" "text", "total_ordenes" bigint, "porcentaje" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_hora AS (
    SELECT
      EXTRACT(HOUR FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_extract
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(HOUR FROM (cc.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_extract
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_horas AS (
    SELECT
      hora_extract,
      COUNT(*) AS ordenes
    FROM ordenes_por_hora
    GROUP BY hora_extract
  ),
  total_ordenes AS (
    SELECT SUM(ordenes) AS total FROM resumen_horas
  )
  SELECT
    rh.hora_extract AS hora,
    LPAD(rh.hora_extract::text, 2, '0') || ':00 - ' || LPAD((rh.hora_extract + 1)::text, 2, '0') || ':00' AS rango_horario,
    rh.ordenes,
    CASE
      WHEN t.total > 0 THEN (rh.ordenes::numeric / t.total * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_horas rh
  CROSS JOIN total_ordenes t
  ORDER BY rh.hora_extract;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") IS 'Retorna análisis de órdenes por hora del día en zona horaria Argentina (UTC-3) corregida';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer DEFAULT 10) RETURNS TABLE("usuario_id" "uuid", "usuario_nombre" "text", "usuario_email" "text", "total_ventas" numeric, "total_ordenes" bigint, "ticket_promedio" numeric, "porcentaje" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_usuario AS (
    SELECT
      ot.created_by AS usuario,
      ot.total AS monto
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND ot.created_by IS NOT NULL
    UNION ALL
    SELECT
      cc.created_by AS usuario,
      cc.total AS monto
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.created_by IS NOT NULL
  ),
  resumen_usuarios AS (
    SELECT
      ou.usuario,
      SUM(ou.monto) AS ventas,
      COUNT(*) AS ordenes
    FROM ordenes_por_usuario ou
    GROUP BY ou.usuario
  ),
  total_ventas AS (
    SELECT SUM(ventas) AS total FROM resumen_usuarios
  )
  SELECT
    ru.usuario,
    COALESCE(p.full_name, p.email, 'Usuario Desconocido') AS nombre,
    COALESCE(p.email, '') AS email,
    ru.ventas,
    ru.ordenes,
    CASE
      WHEN ru.ordenes > 0 THEN ru.ventas / ru.ordenes
      ELSE 0
    END AS ticket_promedio,
    CASE
      WHEN tv.total > 0 THEN (ru.ventas / tv.total * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_usuarios ru
  LEFT JOIN profiles p ON ru.usuario = p.id
  CROSS JOIN total_ventas tv
  ORDER BY ru.ventas DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) IS 'Retorna ranking de usuarios por facturación generada en el período';



CREATE OR REPLACE FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text" DEFAULT 'dia'::"text") RETURNS TABLE("fecha" "text", "total_ventas" numeric, "total_ordenes" bigint, "ordenes_trabajo" bigint, "ordenes_copiado" bigint, "ticket_promedio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_formato_fecha text;
  v_trunc_periodo text;
BEGIN
  CASE p_granularidad
    WHEN 'hora' THEN
      v_formato_fecha := 'YYYY-MM-DD HH24:00';
      v_trunc_periodo := 'hour';
    WHEN 'dia' THEN
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
    WHEN 'semana' THEN
      v_formato_fecha := 'YYYY-WW';
      v_trunc_periodo := 'week';
    WHEN 'mes' THEN
      v_formato_fecha := 'YYYY-MM';
      v_trunc_periodo := 'month';
    ELSE
      v_formato_fecha := 'YYYY-MM-DD';
      v_trunc_periodo := 'day';
  END CASE;

  RETURN QUERY
  EXECUTE format($query$
    WITH ordenes_timeline AS (
      SELECT
        date_trunc(%L, ot.fecha_creacion)::date AS periodo,
        ot.total AS monto,
        'trabajo' AS tipo_orden
      FROM ordenes_trabajo ot
      WHERE ot.company_id = %L
        AND ot.fecha_creacion::date BETWEEN %L AND %L
        AND ot.estado NOT IN ('cancelado', 'borrador')
      UNION ALL
      SELECT
        date_trunc(%L, cc.fecha_solicitud)::date AS periodo,
        cc.total AS monto,
        'copiado' AS tipo_orden
      FROM centro_copiado_ordenes cc
      WHERE cc.company_id = %L
        AND cc.fecha_solicitud::date BETWEEN %L AND %L
        AND cc.estado != 'cancelada'
    ),
    resumen_timeline AS (
      SELECT
        to_char(periodo, %L) AS fecha,
        SUM(monto) AS ventas,
        COUNT(*) AS ordenes,
        COUNT(CASE WHEN tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
        COUNT(CASE WHEN tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
      FROM ordenes_timeline
      GROUP BY periodo
    )
    SELECT
      fecha,
      ventas,
      ordenes,
      ordenes_trabajo,
      ordenes_copiado,
      CASE
        WHEN ordenes > 0 THEN ventas / ordenes
        ELSE 0
      END AS ticket_promedio
    FROM resumen_timeline
    ORDER BY fecha
  $query$,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_trunc_periodo,
  p_company_id,
  p_fecha_inicio,
  p_fecha_fin,
  v_formato_fecha
  );
END;
$_$;


ALTER FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") IS 'Retorna evolución temporal de ventas con granularidad configurable';



CREATE OR REPLACE FUNCTION "public"."fn_resolver_ruta_produccion"("p_producto_id" "uuid", "p_opciones_cliente" "jsonb") RETURNS TABLE("tipo_etapa" "text", "paso_id" "uuid", "grupo_paso_id" "uuid", "paso_nombre" "text", "orden" integer, "origen_condicion" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_plantilla RECORD;
  v_cumple_condicion boolean;
  v_paso_resuelto_id uuid;
  v_paso_resuelto_nombre text;
  v_orden_global integer := 0;
  v_opcion jsonb;
BEGIN
  -- Iterar sobre todas las plantillas del producto
  FOR v_plantilla IN 
    SELECT * FROM productos_rutas_plantillas
    WHERE producto_id = p_producto_id
    ORDER BY 
      CASE tipo_etapa
        WHEN 'pre_prensa' THEN 1
        WHEN 'principal' THEN 2
        WHEN 'post_prensa' THEN 3
      END,
      orden
  LOOP
    -- Si es paso fijo, agregarlo directamente
    IF NOT v_plantilla.es_condicional THEN
      tipo_etapa := v_plantilla.tipo_etapa;
      paso_id := v_plantilla.paso_id;
      grupo_paso_id := v_plantilla.grupo_paso_id;
      paso_nombre := v_plantilla.nombre_display;
      orden := v_orden_global;
      origen_condicion := jsonb_build_object(
        'tipo', 'fijo',
        'plantilla_id', v_plantilla.id
      );
      v_orden_global := v_orden_global + 1;
      RETURN NEXT;
      
    -- Si es paso condicional, evaluar condición
    ELSE
      v_cumple_condicion := fn_evaluar_condicion_simple(
        v_plantilla.condicion_config,
        p_opciones_cliente
      );
      
      IF v_cumple_condicion THEN
        -- Para servicios/acabados con niveles, obtener el paso específico
        IF v_plantilla.condicion_tipo IN ('condicional_servicio_nivel', 'condicional_acabado_nivel') THEN
          -- Buscar en opciones del cliente cuál nivel eligió
          IF v_plantilla.condicion_tipo = 'condicional_servicio_nivel' THEN
            FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'servicios')
            LOOP
              IF v_opcion->>'servicio_id' = (v_plantilla.condicion_config->>'servicio_id') THEN
                v_paso_resuelto_id := fn_obtener_paso_de_nivel(
                  'servicio',
                  (v_plantilla.condicion_config->>'servicio_id')::uuid,
                  (v_opcion->>'nivel_id')::uuid
                );
                SELECT nombre INTO v_paso_resuelto_nombre FROM pasos WHERE id = v_paso_resuelto_id;
                EXIT;
              END IF;
            END LOOP;
          ELSIF v_plantilla.condicion_tipo = 'condicional_acabado_nivel' THEN
            FOR v_opcion IN SELECT * FROM jsonb_array_elements(p_opciones_cliente->'acabados')
            LOOP
              IF v_opcion->>'acabado_id' = (v_plantilla.condicion_config->>'acabado_id') THEN
                v_paso_resuelto_id := fn_obtener_paso_de_nivel(
                  'acabado',
                  (v_plantilla.condicion_config->>'acabado_id')::uuid,
                  (v_opcion->>'nivel_id')::uuid
                );
                SELECT nombre INTO v_paso_resuelto_nombre FROM pasos WHERE id = v_paso_resuelto_id;
                EXIT;
              END IF;
            END LOOP;
          END IF;
          
          IF v_paso_resuelto_id IS NOT NULL THEN
            tipo_etapa := v_plantilla.tipo_etapa;
            paso_id := v_paso_resuelto_id;
            grupo_paso_id := NULL;
            paso_nombre := v_paso_resuelto_nombre;
            orden := v_orden_global;
            origen_condicion := jsonb_build_object(
              'tipo', v_plantilla.condicion_tipo,
              'plantilla_id', v_plantilla.id,
              'condicion_config', v_plantilla.condicion_config
            );
            v_orden_global := v_orden_global + 1;
            RETURN NEXT;
          END IF;
          
        ELSE
          -- Para otros tipos de condiciones, usar el paso/grupo configurado
          tipo_etapa := v_plantilla.tipo_etapa;
          paso_id := v_plantilla.paso_id;
          grupo_paso_id := v_plantilla.grupo_paso_id;
          paso_nombre := v_plantilla.nombre_display;
          orden := v_orden_global;
          origen_condicion := jsonb_build_object(
            'tipo', v_plantilla.condicion_tipo,
            'plantilla_id', v_plantilla.id,
            'condicion_config', v_plantilla.condicion_config
          );
          v_orden_global := v_orden_global + 1;
          RETURN NEXT;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."fn_resolver_ruta_produccion"("p_producto_id" "uuid", "p_opciones_cliente" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("total_pasos_ejecutados" bigint, "total_operadores_activos" bigint, "promedio_pasos_por_operador" numeric, "tiempo_promedio_por_paso" numeric, "tasa_completitud_equipo" numeric, "total_horas_trabajadas" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_pasos,
      COUNT(DISTINCT v.responsable_id) as operadores_activos,
      COUNT(*) FILTER (WHERE v.estado_paso = 'completado') as pasos_completados,
      ROUND(AVG(v.duracion_minutos), 2) as tiempo_promedio,
      ROUND(SUM(v.duracion_minutos) / 60.0, 2) as total_horas
    FROM v_actividad_usuarios v
    WHERE
      v.company_id = p_company_id
      AND (p_fecha_desde IS NULL OR v.fecha_fin >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR v.fecha_fin <= p_fecha_hasta)
  )
  SELECT
    s.total_pasos,
    s.operadores_activos,
    ROUND(s.total_pasos::NUMERIC / NULLIF(s.operadores_activos::NUMERIC, 0), 1) as promedio_pasos,
    s.tiempo_promedio,
    ROUND((s.pasos_completados::NUMERIC / NULLIF(s.total_pasos::NUMERIC, 0)) * 100, 2) as tasa_completitud,
    s.total_horas
  FROM stats s;
END;
$$;


ALTER FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Calcula KPIs generales del equipo de producción';



CREATE OR REPLACE FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Solo insertar si no existen motivos para esta empresa
  IF NOT EXISTS (SELECT 1 FROM pasos_motivos_pausa WHERE company_id = p_company_id) THEN

    INSERT INTO pasos_motivos_pausa (company_id, nombre, categoria, requiere_descripcion, color, icono, orden) VALUES
    -- ========================================
    -- Categoría: CLIENTE (PRIORIDAD MÁXIMA)
    -- ========================================
    (p_company_id, 'Esperando aprobación de diseño', 'cliente', false, '#3B82F6', 'Palette', 1),
    (p_company_id, 'Esperando confirmación de colores', 'cliente', false, '#3B82F6', 'Pipette', 2),
    (p_company_id, 'Cliente solicitó cambios', 'cliente', true, '#3B82F6', 'Edit', 3),
    (p_company_id, 'Esperando archivos del cliente', 'cliente', false, '#3B82F6', 'FileUp', 4),

    -- ========================================
    -- Categoría: MATERIALES
    -- ========================================
    (p_company_id, 'Falta papel/sustrato', 'materiales', false, '#F59E0B', 'Package', 10),
    (p_company_id, 'Falta tinta/consumibles', 'materiales', false, '#F59E0B', 'Droplet', 11),
    (p_company_id, 'Material en pedido a proveedor', 'materiales', true, '#F59E0B', 'Truck', 12),

    -- ========================================
    -- Categoría: MAQUINARIA
    -- ========================================
    (p_company_id, 'Máquina averiada', 'maquinaria', true, '#EF4444', 'AlertTriangle', 20),
    (p_company_id, 'Mantenimiento preventivo', 'maquinaria', false, '#EF4444', 'Wrench', 21),
    (p_company_id, 'Calibración necesaria', 'maquinaria', false, '#EF4444', 'Settings', 22),

    -- ========================================
    -- Categoría: PERSONAL
    -- ========================================
    (p_company_id, 'Falta operador capacitado', 'personal', false, '#8B5CF6', 'UserX', 30),
    (p_company_id, 'Operador ausente', 'personal', true, '#8B5CF6', 'UserMinus', 31),
    (p_company_id, 'Esperando asignación de responsable', 'personal', false, '#8B5CF6', 'UserCog', 32),

    -- ========================================
    -- Categoría: EXTERNO
    -- ========================================
    (p_company_id, 'Corte de energía', 'externo', false, '#6B7280', 'Zap', 40),
    (p_company_id, 'Condiciones climáticas adversas', 'externo', false, '#6B7280', 'Cloud', 41),

    -- ========================================
    -- Categoría: OTRO
    -- ========================================
    (p_company_id, 'Otro motivo', 'otro', true, '#6B7280', 'MoreHorizontal', 99);

  END IF;
END;
$$;


ALTER FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") IS 'Crea 16 motivos de pausa predeterminados para una empresa si no existen. Prioriza motivos relacionados con cliente';



CREATE OR REPLACE FUNCTION "public"."fn_seed_tipos_egreso_default"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO tipos_egreso (company_id, nombre, descripcion, codigo, color, icono)
  VALUES
    (p_company_id, 'Servicios', 'Servicios públicos y básicos', 'SVC', '#3b82f6', 'Zap'),
    (p_company_id, 'Sueldos', 'Sueldos y salarios del personal', 'SAL', '#10b981', 'Users'),
    (p_company_id, 'Impuestos', 'Impuestos y cargas fiscales', 'IMP', '#ef4444', 'FileText'),
    (p_company_id, 'Alquiler', 'Alquiler de oficina/local/equipos', 'ALQ', '#f59e0b', 'Home'),
    (p_company_id, 'Compras', 'Compra de insumos y materiales', 'COM', '#8b5cf6', 'ShoppingCart'),
    (p_company_id, 'Mantenimiento', 'Mantenimiento y reparaciones', 'MNT', '#06b6d4', 'Wrench'),
    (p_company_id, 'Marketing', 'Publicidad y marketing', 'MKT', '#ec4899', 'TrendingUp'),
    (p_company_id, 'Honorarios', 'Honorarios profesionales', 'HON', '#6366f1', 'Briefcase'),
    (p_company_id, 'Transporte', 'Gastos de transporte y logística', 'TRA', '#14b8a6', 'Truck'),
    (p_company_id, 'Otros', 'Otros gastos diversos', 'OTR', '#64748b', 'MoreHorizontal')
  ON CONFLICT (company_id, codigo) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."fn_seed_tipos_egreso_default"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") IS 'Crea tipos de ingreso predefinidos para una empresa. Solo se ejecuta si la empresa no tiene ningún tipo de ingreso configurado.';



CREATE OR REPLACE FUNCTION "public"."fn_set_fecha_completado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- CASO 1: Estado cambia a 'finalizada' desde otro estado
  -- Establecer fecha_completado si no está ya establecida
  IF NEW.estado = 'finalizada' 
     AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN
    
    -- Solo establecer si no tiene fecha_completado ya
    -- (respeta valores establecidos manualmente)
    IF NEW.fecha_completado IS NULL THEN
      NEW.fecha_completado := NOW();
    END IF;
  END IF;
  
  -- CASO 2: Estado deja de ser 'finalizada' o 'entregada'
  -- PERO: Si cambia de 'finalizada' a 'entregada' o viceversa, NO limpiar
  IF OLD.estado IN ('finalizada', 'entregada') 
     AND NEW.estado NOT IN ('finalizada', 'entregada') THEN
    
    -- Limpiar fecha porque se está revirtiendo el trabajo
    NEW.fecha_completado := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_set_fecha_completado"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_set_fecha_completado"() IS 'Establece fecha_completado cuando una orden cambia a estado finalizada. Mantiene la fecha cuando pasa a entregada. Limpia la fecha si se revierte a estados anteriores.';



CREATE OR REPLACE FUNCTION "public"."fn_set_numero_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.numero_presupuesto IS NULL OR NEW.numero_presupuesto = '' THEN
    NEW.numero_presupuesto := fn_generar_numero_presupuesto(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_set_numero_presupuesto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sincronizar_pago_con_caja"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
  -- FIX: Ahora guarda la comisión aplicada correctamente
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
    NEW.comision_aplicada,  -- ← FIX: Era 0, ahora usa NEW.comision_aplicada
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
$$;


ALTER FUNCTION "public"."fn_sincronizar_pago_con_caja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") RETURNS TABLE("orden_id" "uuid", "numero_orden" "text", "fecha_completado" "date", "total" numeric, "descripcion" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id AS orden_id,
    ot.numero_orden,
    ot.fecha_completado::DATE AS fecha_completado,
    ot.total,
    ('Orden ' || ot.numero_orden || COALESCE(' - ' || ot.notas_internas, '')) AS descripcion
  FROM ordenes_trabajo ot
  WHERE ot.cliente_id = p_cliente_id
    -- Incluir órdenes finalizadas O entregadas
    AND ot.estado IN ('finalizada', 'entregada')
    -- Debe tener fecha_completado establecida
    AND ot.fecha_completado IS NOT NULL
    -- Dentro del rango de fechas especificado
    AND ot.fecha_completado::DATE >= p_fecha_desde
    AND ot.fecha_completado::DATE <= p_fecha_hasta
    -- No debe estar ya incluida en una liquidación
    AND NOT EXISTS (
      SELECT 1
      FROM liquidaciones_items li
      WHERE li.orden_id = ot.id
    )
  ORDER BY ot.fecha_completado;
END;
$$;


ALTER FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") IS 'Sugiere órdenes finalizadas o entregadas dentro de un rango de fechas para un cliente específico, excluyendo órdenes ya incluidas en liquidaciones. Usa fecha_completado para el filtro de fechas.';



CREATE OR REPLACE FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fecha_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("total_ordenes_evaluadas" bigint, "ordenes_a_tiempo" bigint, "ordenes_retrasadas" bigint, "tasa_cumplimiento" numeric, "promedio_dias_adelanto" numeric, "promedio_dias_retraso" numeric, "ordenes_sin_fecha_estimada" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_evaluadas AS (
    SELECT
      id,
      fecha_completado,
      fecha_estimada_entrega,
      DATE(fecha_completado) - DATE(fecha_estimada_entrega) AS dias_diferencia
    FROM ordenes_trabajo
    WHERE company_id = p_company_id
      AND estado IN ('finalizada', 'entregada')
      AND fecha_completado IS NOT NULL
      AND fecha_estimada_entrega IS NOT NULL
      AND (p_fecha_desde IS NULL OR fecha_completado >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR fecha_completado <= p_fecha_hasta)
  ),
  ordenes_sin_fecha AS (
    SELECT COUNT(*) AS total_sin_fecha
    FROM ordenes_trabajo
    WHERE company_id = p_company_id
      AND estado IN ('finalizada', 'entregada')
      AND fecha_completado IS NOT NULL
      AND fecha_estimada_entrega IS NULL
      AND (p_fecha_desde IS NULL OR fecha_completado >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR fecha_completado <= p_fecha_hasta)
  )
  SELECT
    COUNT(*)::bigint AS total_ordenes_evaluadas,
    COUNT(*) FILTER (WHERE dias_diferencia <= 0)::bigint AS ordenes_a_tiempo,
    COUNT(*) FILTER (WHERE dias_diferencia > 0)::bigint AS ordenes_retrasadas,
    CASE
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE ROUND((COUNT(*) FILTER (WHERE dias_diferencia <= 0)::numeric / COUNT(*)::numeric * 100), 2)
    END AS tasa_cumplimiento,
    COALESCE(ROUND(AVG(ABS(dias_diferencia)) FILTER (WHERE dias_diferencia < 0)::numeric, 2), 0) AS promedio_dias_adelanto,
    COALESCE(ROUND(AVG(dias_diferencia) FILTER (WHERE dias_diferencia > 0)::numeric, 2), 0) AS promedio_dias_retraso,
    (SELECT total_sin_fecha FROM ordenes_sin_fecha)::bigint AS ordenes_sin_fecha_estimada
  FROM ordenes_evaluadas;
END;
$$;


ALTER FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) IS 'Calcula la tasa de cumplimiento de entregas: porcentaje de órdenes completadas antes o en la fecha estimada de entrega. Meta: >= 95%';



CREATE OR REPLACE FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text" DEFAULT 'day'::"text") RETURNS TABLE("periodo" "date", "ordenes_completadas" bigint, "items_completados" bigint, "pasos_completados" bigint, "minutos_promedio_por_item" numeric, "total_horas" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH periodos AS (
    SELECT
      DATE_TRUNC(p_intervalo, r.fecha_fin)::date as periodo,
      COUNT(DISTINCT oti.orden_id)::bigint as ordenes_completadas,
      COUNT(DISTINCT r.orden_item_id)::bigint as items_completados,
      COUNT(*)::bigint as pasos_completados,
      SUM(fn_calcular_duracion_paso(r.fecha_inicio, r.fecha_fin)) as total_minutos
    FROM ordenes_trabajo_items_rutas r
    JOIN ordenes_trabajo_items oti ON oti.id = r.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND r.estado_paso = 'completado'
      AND r.fecha_inicio IS NOT NULL
      AND r.fecha_fin IS NOT NULL
      AND r.fecha_fin >= p_fecha_desde
      AND r.fecha_fin <= p_fecha_hasta
    GROUP BY DATE_TRUNC(p_intervalo, r.fecha_fin)
  )
  SELECT
    p.periodo,
    p.ordenes_completadas,
    p.items_completados,
    p.pasos_completados,
    ROUND((p.total_minutos / NULLIF(p.items_completados, 0))::numeric, 2) as minutos_promedio_por_item,
    ROUND((p.total_minutos / 60.0)::numeric, 2) as total_horas
  FROM periodos p
  ORDER BY p.periodo ASC;
END;
$$;


ALTER FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") IS 'Retorna evolución de métricas en el tiempo (día, semana, mes)';



CREATE OR REPLACE FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_tipo_orden text;
  v_request_id bigint;
BEGIN
  -- Solo procesar si el estado cambió a "finalizada"
  IF NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN

    -- Determinar tipo de orden basándose en la tabla
    IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
      v_tipo_orden := 'trabajo';
    ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
      v_tipo_orden := 'copiado';
    ELSE
      -- Tabla no reconocida, salir
      RETURN NEW;
    END IF;

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Log del intento
    RAISE LOG '[Notify Trigger] Orden finalizada detectada: % (company: %, tipo: %)',
      NEW.id, NEW.company_id, v_tipo_orden;

    -- Hacer petición HTTP asíncrona a la Edge Function
    -- Usamos pg_net para no bloquear la transacción
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'orden_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_orden', v_tipo_orden
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Trigger] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Trigger] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() IS 'Dispara notificación de WhatsApp cuando una orden cambia a estado finalizada. Usa valores hardcodeados para URL y token.';



CREATE OR REPLACE FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_egresos_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_egresos_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_estado_presupuesto_completo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tiene_items_sin_precio boolean;
  v_cantidad_sin_precio integer;
BEGIN
  -- Solo validar si se intenta cambiar a estado diferente de 'borrador'
  IF NEW.estado != 'borrador' AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    -- Verificar si hay items sin precio
    v_tiene_items_sin_precio := fn_presupuesto_tiene_items_sin_precio(NEW.id);
    
    IF v_tiene_items_sin_precio THEN
      v_cantidad_sin_precio := fn_contar_items_sin_precio(NEW.id);
      
      RAISE EXCEPTION 'No se puede cambiar el estado del presupuesto. Hay % item(s) pendiente(s) de cotización. Completa todos los precios primero.', 
        v_cantidad_sin_precio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_estado_presupuesto_completo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_validar_estado_presupuesto_completo"() IS 'Trigger function que valida que un presupuesto tenga todos los precios asignados antes de cambiar de estado borrador';



CREATE OR REPLACE FUNCTION "public"."fn_validar_limite_total_archivos_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 1073741824;
BEGIN
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_actual
  FROM ordenes_trabajo_archivos
  WHERE orden_id = NEW.orden_id
    AND company_id = NEW.company_id;

  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'La orden ha alcanzado el límite de almacenamiento de 1GB para archivos de cliente. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_limite_total_archivos_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_limite_total_archivos_copiado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 209715200; -- 200 MB
BEGIN
  -- Calcular total según si es temporal o real
  IF NEW.orden_temporal_id IS NOT NULL THEN
    -- Para archivos temporales, validar contra el ID temporal
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_actual
    FROM centro_copiado_ordenes_archivos
    WHERE orden_temporal_id = NEW.orden_temporal_id
      AND company_id = NEW.company_id;
  ELSIF NEW.orden_copiado_id IS NOT NULL THEN
    -- Para archivos de orden real
    SELECT COALESCE(SUM(tamano_bytes), 0)
    INTO v_total_actual
    FROM centro_copiado_ordenes_archivos
    WHERE orden_copiado_id = NEW.orden_copiado_id
      AND company_id = NEW.company_id;
  ELSE
    RAISE EXCEPTION 'Debe especificar orden_copiado_id o orden_temporal_id';
  END IF;

  -- Validar que no exceda el límite
  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'Ha alcanzado el límite de almacenamiento de 200 MB. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_limite_total_archivos_copiado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_limite_total_archivos_produccion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 1073741824;
BEGIN
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_actual
  FROM ordenes_trabajo_archivos_produccion
  WHERE orden_id = NEW.orden_id
    AND company_id = NEW.company_id;

  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'La orden ha alcanzado el límite de almacenamiento de 1GB para archivos de producción. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_limite_total_archivos_produccion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_plantilla_ruta"("p_producto_id" "uuid") RETURNS TABLE("tipo" "text", "mensaje" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_count_principal integer;
  v_plantilla RECORD;
  v_servicio_existe boolean;
  v_acabado_existe boolean;
BEGIN
  -- Validar que hay al menos un paso en etapa principal
  SELECT COUNT(*) INTO v_count_principal
  FROM productos_rutas_plantillas
  WHERE producto_id = p_producto_id AND tipo_etapa = 'principal';
  
  IF v_count_principal = 0 THEN
    tipo := 'error';
    mensaje := 'La ruta debe tener al menos un paso en la etapa principal';
    RETURN NEXT;
  END IF;
  
  -- Validar coherencia de condiciones
  FOR v_plantilla IN 
    SELECT * FROM productos_rutas_plantillas
    WHERE producto_id = p_producto_id AND es_condicional = true
  LOOP
    -- Validar que el servicio/acabado referenciado existe
    IF v_plantilla.condicion_tipo LIKE 'condicional_servicio%' THEN
      SELECT EXISTS(
        SELECT 1 FROM servicios WHERE id = (v_plantilla.condicion_config->>'servicio_id')::uuid
      ) INTO v_servicio_existe;
      
      IF NOT v_servicio_existe THEN
        tipo := 'error';
        mensaje := 'La plantilla ' || v_plantilla.id || ' referencia un servicio que no existe';
        RETURN NEXT;
      END IF;
    ELSIF v_plantilla.condicion_tipo LIKE 'condicional_acabado%' THEN
      SELECT EXISTS(
        SELECT 1 FROM acabados WHERE id = (v_plantilla.condicion_config->>'acabado_id')::uuid
      ) INTO v_acabado_existe;
      
      IF NOT v_acabado_existe THEN
        tipo := 'error';
        mensaje := 'La plantilla ' || v_plantilla.id || ' referencia un acabado que no existe';
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
  
  -- Si no hay errores, retornar éxito
  IF NOT FOUND THEN
    tipo := 'success';
    mensaje := 'La configuración de ruta es válida';
    RETURN NEXT;
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."fn_validar_plantilla_ruta"("p_producto_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_vencer_presupuestos_expirados"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  -- Actualizar presupuestos que:
  -- 1. Están en estado 'enviado'
  -- 2. Su fecha_validez ya pasó
  UPDATE presupuestos
  SET
    estado = 'vencido',
    updated_at = now()
  WHERE estado = 'enviado'
    AND fecha_validez IS NOT NULL
    AND fecha_validez < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Presupuestos vencidos: %', v_count;
END;
$$;


ALTER FUNCTION "public"."fn_vencer_presupuestos_expirados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_verificar_totales_ordenes"() RETURNS TABLE("orden_id" "uuid", "numero_orden" "text", "subtotal_items" numeric, "total_descuentos" numeric, "total_ordenes_copiado" numeric, "total_en_bd" numeric, "total_calculado" numeric, "diferencia" numeric, "esta_correcto" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ot.id,
    ot.numero_orden,
    ot.subtotal,
    ot.total_descuentos,
    COALESCE(SUM(oc.total), 0) as total_oc,
    ot.total as total_bd,
    (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0)) as total_calc,
    (ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0))) as diff,
    ABS(ot.total - (ot.subtotal - ot.total_descuentos + COALESCE(SUM(oc.total), 0))) < 0.01 as correcto
  FROM ordenes_trabajo ot
  LEFT JOIN centro_copiado_ordenes oc ON oc.orden_trabajo_id = ot.id
  GROUP BY ot.id, ot.numero_orden, ot.subtotal, ot.total_descuentos, ot.total
  ORDER BY ot.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."fn_verificar_totales_ordenes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_verificar_totales_ordenes"() IS 'Verifica los totales de todas las órdenes comparando BD vs calculado. Útil para auditoría y detección de problemas.';



CREATE OR REPLACE FUNCTION "public"."generar_numero_pedido"("p_company_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_year text;
  v_counter integer;
  v_numero text;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(numero_pedido FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_counter
  FROM pedidos
  WHERE company_id = p_company_id
    AND numero_pedido LIKE 'PED-' || v_year || '-%';
  
  v_numero := 'PED-' || v_year || '-' || LPAD(v_counter::text, 6, '0');
  
  RETURN v_numero;
END;
$_$;


ALTER FUNCTION "public"."generar_numero_pedido"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_numero_orden"("p_company_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_max_numero integer;
  v_nuevo_numero text;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN numero_orden ~ '^GI-[0-9]+$'
      THEN CAST(SUBSTRING(numero_orden FROM 4) AS integer)
      ELSE 0
    END
  ), 0) INTO v_max_numero
  FROM ordenes_trabajo
  WHERE company_id = p_company_id;

  v_nuevo_numero := 'GI-' || LPAD((v_max_numero + 1)::text, 6, '0');

  RETURN v_nuevo_numero;
END;
$_$;


ALTER FUNCTION "public"."generate_numero_orden"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_tracking_token"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(32) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_tracking_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_tracking_token"() IS 'Genera un token aleatorio de 32 caracteres alfanuméricos seguros (sin caracteres ambiguos)';



CREATE OR REPLACE FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") RETURNS TABLE("tipo_producto" "text", "producto_id" "uuid", "nombre_producto" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 'impresion_laser'::text, id, nombre
  FROM productos_impresion_laser
  WHERE ruta_produccion_id = p_ruta_id

  UNION ALL

  SELECT 'gran_formato'::text, id, nombre
  FROM productos_gran_formato
  WHERE ruta_produccion_id = p_ruta_id

  UNION ALL

  SELECT 'materiales_rigidos'::text, id, nombre
  FROM productos_materiales_rigidos
  WHERE ruta_produccion_id = p_ruta_id;
$$;


ALTER FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") IS 'Retorna todos los productos (de cualquier tipo) que están usando una ruta de producción específica.';



CREATE OR REPLACE FUNCTION "public"."get_role_company_id"("target_role_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_id FROM public.custom_roles WHERE id = target_role_id LIMIT 1;
$$;


ALTER FUNCTION "public"."get_role_company_id"("target_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_target_user_company_id"("target_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_id FROM public.profiles WHERE id = target_user_id LIMIT 1;
$$;


ALTER FUNCTION "public"."get_target_user_company_id"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_pasos_ruta"("p_ruta_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COUNT(*)::integer
  FROM rutas_produccion_pasos
  WHERE ruta_id = p_ruta_id;
$$;


ALTER FUNCTION "public"."get_total_pasos_ruta"("p_ruta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_company_id"("user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_company_id"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_company_id"("user_id" "uuid") IS 'Helper function to get user company_id bypassing RLS to prevent infinite recursion';



CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_free_plan_id uuid;
  v_profile_exists boolean;
  v_user_role text;
  v_custom_role_id uuid;
  v_created_by_admin boolean;
BEGIN
  -- Verificar si el perfil ya existe
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO v_profile_exists;
  
  -- Si el perfil ya existe, no hacer nada y retornar
  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %. Skipping creation.', NEW.id;
    RETURN NEW;
  END IF;

  -- Detectar si fue creado por un administrador
  v_created_by_admin := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);
  
  -- Si fue creado por admin, usar los datos del metadata
  IF v_created_by_admin THEN
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
    v_user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'viewer');
    v_custom_role_id := (NEW.raw_user_meta_data->>'custom_role_id')::uuid;
    
    -- Crear perfil con los datos proporcionados por el administrador
    INSERT INTO profiles (id, email, full_name, company_id, role, custom_role_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_company_id,
      v_user_role,
      v_custom_role_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Profile created by admin for user % with company_id % and role %', NEW.id, v_company_id, v_user_role;
    RETURN NEW;
  END IF;

  -- Flujo de auto-registro (usuario se registra por su cuenta)
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_slug := NEW.raw_user_meta_data->>'company_slug';
  
  -- Si no hay company_slug, generarlo del company_name
  IF v_company_slug IS NULL AND v_company_name IS NOT NULL THEN
    v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_company_slug := regexp_replace(v_company_slug, '^-+|-+$', '', 'g');
    
    -- Asegurar que el slug sea único agregando un sufijo si es necesario
    IF EXISTS (SELECT 1 FROM companies WHERE slug = v_company_slug) THEN
      v_company_slug := v_company_slug || '-' || substr(NEW.id::text, 1, 8);
    END IF;
  END IF;
  
  -- Crear la empresa si se proporcionó el nombre
  IF v_company_name IS NOT NULL THEN
    INSERT INTO companies (name, slug, status)
    VALUES (v_company_name, v_company_slug, 'active')
    RETURNING id INTO v_company_id;
    
    -- Obtener el plan Free
    SELECT id INTO v_free_plan_id FROM subscription_plans WHERE slug = 'free' LIMIT 1;
    
    -- Crear suscripción Free para la nueva empresa
    IF v_free_plan_id IS NOT NULL THEN
      INSERT INTO company_subscriptions (company_id, plan_id, status, started_at)
      VALUES (v_company_id, v_free_plan_id, 'active', now());
    END IF;
    
    -- Crear perfil con rol de super_admin
    INSERT INTO profiles (id, email, full_name, company_id, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_company_id,
      'super_admin'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'New company and super_admin profile created for user %', NEW.id;
  ELSE
    -- Si no hay empresa, crear perfil sin company_id
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'viewer'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Basic profile created for user % without company', NEW.id;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Trigger que se ejecuta al crear un nuevo usuario. Lee metadata enriquecido para crear perfiles correctamente tanto para auto-registro como para usuarios creados por administradores.';



CREATE OR REPLACE FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_password_valid boolean;
  v_user_ip text;
  v_has_restrictions boolean;
  v_ip_allowed boolean;
BEGIN
  -- Extraer datos del evento
  v_user_id := (event->'user_id')::uuid;
  v_password_valid := (event->'valid')::boolean;

  -- Extraer IP del request header (primera IP de x-forwarded-for)
  BEGIN
    v_user_ip := split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',',
      1
    );

    -- Limpiar espacios en blanco
    v_user_ip := trim(v_user_ip);
  EXCEPTION
    WHEN OTHERS THEN
      -- Si no se puede obtener la IP, permitir acceso (fail-open)
      v_user_ip := NULL;
  END;

  -- Si la password no es válida, dejar que Supabase maneje el error normalmente
  IF NOT v_password_valid THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Si no se pudo obtener la IP, permitir acceso (fail-open para evitar bloqueos)
  IF v_user_ip IS NULL OR v_user_ip = '' THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Verificar si el usuario tiene restricciones de IP activas
  SELECT EXISTS (
    SELECT 1
    FROM public.user_ip_restrictions
    WHERE user_id = v_user_id
    AND is_active = true
  ) INTO v_has_restrictions;

  -- Si NO tiene restricciones, permitir acceso
  IF NOT v_has_restrictions THEN
    RETURN jsonb_build_object(
      'decision', 'continue'
    );
  END IF;

  -- Si TIENE restricciones, validar que la IP esté en la lista permitida
  SELECT EXISTS (
    SELECT 1
    FROM public.user_ip_restrictions
    WHERE user_id = v_user_id
    AND ip_address = v_user_ip
    AND is_active = true
  ) INTO v_ip_allowed;

  -- Si la IP NO está permitida, BLOQUEAR el acceso
  IF NOT v_ip_allowed THEN
    -- Registrar intento bloqueado en audit_log
    BEGIN
      INSERT INTO public.audit_log (
        company_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        created_at
      )
      SELECT
        p.company_id,
        v_user_id,
        'login_blocked_ip',
        'auth',
        v_user_id,
        jsonb_build_object(
          'blocked_ip', v_user_ip,
          'reason', 'IP no autorizada',
          'timestamp', now(),
          'hook_version', 'v1'
        ),
        v_user_ip,
        now()
      FROM public.profiles p
      WHERE p.id = v_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla el registro, continuar bloqueando (no es crítico)
        NULL;
    END;

    -- RECHAZAR LOGIN con mensaje personalizado
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Acceso denegado. Tu ubicación no está autorizada para acceder a esta cuenta. Contacta al administrador.',
      'should_logout_user', false
    );
  END IF;

  -- IP permitida, continuar con el login normalmente
  RETURN jsonb_build_object(
    'decision', 'continue'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de cualquier error inesperado, permitir acceso (fail-open)
    -- Esto evita bloquear usuarios legítimos si hay un bug en la función
    RAISE WARNING 'Error en hook de validación IP para usuario %: %', v_user_id, SQLERRM;

    RETURN jsonb_build_object(
      'decision', 'continue'
    );
END;
$$;


ALTER FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") IS 'Auth Hook que valida restricciones de IP antes de permitir el login.
Se ejecuta automáticamente durante password sign-in.
Responde con {"decision": "continue"} para permitir o {"decision": "reject"} para bloquear.';



CREATE OR REPLACE FUNCTION "public"."is_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    LIMIT 1
  );
$$;


ALTER FUNCTION "public"."is_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'super_admin'
    LIMIT 1
  );
$$;


ALTER FUNCTION "public"."is_user_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_login_attempt"("p_email" "text", "p_ip_address" "text", "p_success" boolean, "p_failure_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO login_attempts (email, ip_address, success, failure_reason)
  VALUES (p_email, p_ip_address, p_success, p_failure_reason);
END;
$$;


ALTER FUNCTION "public"."log_login_attempt"("p_email" "text", "p_ip_address" "text", "p_success" boolean, "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_grupo_paso_deactivation_with_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."prevent_grupo_paso_deactivation_with_dependencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_paso_deactivation_with_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."prevent_paso_deactivation_with_dependencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_team_member_password"("p_user_id" "uuid", "p_new_password" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
  v_encrypted_password text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  v_encrypted_password := crypt(p_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET
    encrypted_password = v_encrypted_password,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'password_reset',
    'user',
    p_user_id,
    jsonb_build_object('target_user', v_target_profile.email)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."reset_team_member_password"("p_user_id" "uuid", "p_new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_client_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- En INSERT, establecer created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  END IF;
  
  -- En UPDATE, establecer updated_by
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    -- Preservar created_by original
    NEW.created_by := OLD.created_by;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_client_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_provider_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    NEW.created_by := OLD.created_by; -- Preserve original creator
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_provider_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tracking_token"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  new_token VARCHAR(32);
BEGIN
  IF NEW.tracking_token IS NULL THEN
    LOOP
      attempt := attempt + 1;
      new_token := generate_tracking_token();

      PERFORM 1 FROM ordenes_trabajo WHERE tracking_token = new_token;

      IF NOT FOUND THEN
        NEW.tracking_token := new_token;
        EXIT;
      END IF;

      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'No se pudo generar un token único después de % intentos', max_attempts;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tracking_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_tracking_token"() IS 'Trigger function que genera automáticamente un tracking_token único al crear una orden';



CREATE OR REPLACE FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean DEFAULT true, "p_test_ip" "text" DEFAULT '192.168.1.1'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event jsonb;
  v_result jsonb;
  v_original_headers text;
BEGIN
  -- Guardar headers originales (si existen)
  BEGIN
    v_original_headers := current_setting('request.headers', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_original_headers := NULL;
  END;

  -- Simular evento del hook
  v_event := jsonb_build_object(
    'user_id', p_user_id,
    'valid', p_password_valid,
    'metadata', jsonb_build_object(
      'timestamp', now(),
      'test_mode', true
    )
  );

  -- Configurar IP de prueba en el request header
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-forwarded-for', p_test_ip)::text,
    true
  );

  -- Ejecutar el hook
  v_result := public.hook_password_verification_with_ip(v_event);

  -- Restaurar headers originales (si existían)
  IF v_original_headers IS NOT NULL THEN
    PERFORM set_config('request.headers', v_original_headers, true);
  END IF;

  -- Agregar metadata de testing
  v_result := v_result || jsonb_build_object(
    'test_metadata', jsonb_build_object(
      'user_id', p_user_id,
      'test_ip', p_test_ip,
      'password_valid', p_password_valid,
      'executed_at', now()
    )
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean, "p_test_ip" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean, "p_test_ip" "text") IS 'Función de testing para probar el password verification hook manualmente.
Simula el evento del hook con parámetros controlados.

Ejemplos de uso:

SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''1.2.3.4'');

SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''190.123.45.67'');

SELECT test_password_verification_hook(''user-id-aqui''::uuid, true, ''8.8.8.8'');

SELECT test_password_verification_hook(''user-id-aqui''::uuid, false, ''1.2.3.4'');
';



CREATE OR REPLACE FUNCTION "public"."trigger_actualizar_estado_liquidacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_actualizar_estado_liquidacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM fn_crear_cajas_desde_medios_cobro(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_crear_medios_cobro_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM crear_medios_cobro_default(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_crear_medios_cobro_default"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_generate_numero_orden"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.numero_orden IS NULL OR NEW.numero_orden = '' THEN
    NEW.numero_orden := generate_numero_orden(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_generate_numero_orden"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
  v_frontend_url text;
BEGIN
  -- Solo proceder si se creó directamente con estado 'enviado'
  IF NEW.estado = 'enviado' THEN

    -- Obtener URL del frontend desde configuración
    -- Por defecto usar producción
    v_frontend_url := coalesce(
      current_setting('app.frontend_url', true),
      'https://www.graficainteligente.com'
    );

    -- VALORES CONFIGURADOS
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'presupuesto_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_notificacion', 'presupuesto_listo',
          'frontend_origin', v_frontend_url
        )
      ) INTO v_request_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto INSERT] Error enviando notificación HTTP: %', SQLERRM;
    END;

    -- Actualizar fecha_enviado si es NULL
    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() IS 'Envía notificación WhatsApp cuando un presupuesto se crea directamente con estado enviado';



CREATE OR REPLACE FUNCTION "public"."trigger_notify_presupuesto_enviado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
  v_debe_enviar boolean := false;
BEGIN
  -- Debug
  RAISE NOTICE '[DEBUG Presupuesto] UPDATE detectado';
  RAISE NOTICE '[DEBUG Presupuesto] OLD: estado=%, total=%, fecha_enviado=%', 
    OLD.estado, OLD.total, OLD.fecha_enviado;
  RAISE NOTICE '[DEBUG Presupuesto] NEW: estado=%, total=%, fecha_enviado=%', 
    NEW.estado, NEW.total, NEW.fecha_enviado;

  -- Determinar si debe enviar notificación
  -- CASO 1: Cambió de borrador a enviado Y tiene total > 0
  IF OLD.estado != 'enviado' AND NEW.estado = 'enviado' AND NEW.total > 0 THEN
    v_debe_enviar := true;
    RAISE NOTICE '[Notify Presupuesto] CASO 1: Cambió a enviado con total';
  END IF;

  -- CASO 2: Ya estaba en enviado, el total cambió de 0 a > 0 (se agregaron items)
  IF OLD.estado = 'enviado' AND NEW.estado = 'enviado' AND 
     OLD.total = 0 AND NEW.total > 0 AND NEW.fecha_enviado IS NULL THEN
    v_debe_enviar := true;
    RAISE NOTICE '[Notify Presupuesto] CASO 2: Total calculado en presupuesto enviado';
  END IF;

  -- Si debe enviar notificación
  IF v_debe_enviar THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto] ✅ ENVIANDO NOTIFICACIÓN';
    RAISE NOTICE '[Notify Presupuesto] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto] Total: %', NEW.total;
    RAISE NOTICE '[Notify Presupuesto] Estado: %', NEW.estado;
    RAISE NOTICE '===========================================';

    -- Configuración
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona
    BEGIN
      RAISE NOTICE '[Notify Presupuesto] 🚀 Enviando petición HTTP...';
      
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'presupuesto_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_notificacion', 'presupuesto_listo'
        )
      ) INTO v_request_id;

      RAISE NOTICE '[Notify Presupuesto] ✅ HTTP request enviado con ID: %', v_request_id;
      RAISE NOTICE '===========================================';
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Notify Presupuesto] ❌ Error enviando notificación HTTP: %', SQLERRM;
      RAISE NOTICE '===========================================';
    END;

    -- Actualizar fecha_enviado si es NULL
    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
      
      RAISE NOTICE '[Notify Presupuesto] ✅ fecha_enviado actualizada';
    END IF;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto] ⏭️ No se envía notificación';
    RAISE NOTICE '[DEBUG Presupuesto] debe_enviar = false';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_notify_presupuesto_enviado"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_notify_presupuesto_enviado"() IS 'Envía notificación WhatsApp cuando:
1. Presupuesto cambia a estado enviado con total > 0, O
2. Presupuesto ya enviado recibe su total calculado (items agregados)';



CREATE OR REPLACE FUNCTION "public"."trigger_recalcular_tiempos_pausa"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Cuando se cierra una pausa (UPDATE) o se elimina (DELETE)
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    PERFORM fn_recalcular_tiempos_paso(OLD.ruta_id);
  END IF;

  -- Cuando se inserta una nueva pausa (INSERT)
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_recalcular_tiempos_paso(NEW.ruta_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_recalcular_tiempos_pausa"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_recalcular_tiempos_pausa"() IS 'Trigger que recalcula automáticamente los tiempos al insertar, actualizar o eliminar pausas';



CREATE OR REPLACE FUNCTION "public"."trigger_recalcular_total_ot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_orden_trabajo_id uuid;
BEGIN
  -- Determinar qué orden de trabajo afectar
  IF TG_OP = 'DELETE' THEN
    v_orden_trabajo_id := OLD.orden_trabajo_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió la orden de trabajo asociada, recalcular ambas
    IF OLD.orden_trabajo_id IS DISTINCT FROM NEW.orden_trabajo_id THEN
      IF OLD.orden_trabajo_id IS NOT NULL THEN
        PERFORM fn_recalcular_total_orden_trabajo(OLD.orden_trabajo_id);
      END IF;
      IF NEW.orden_trabajo_id IS NOT NULL THEN
        PERFORM fn_recalcular_total_orden_trabajo(NEW.orden_trabajo_id);
      END IF;
      RETURN NEW;
    END IF;
    v_orden_trabajo_id := NEW.orden_trabajo_id;
  ELSE -- INSERT
    v_orden_trabajo_id := NEW.orden_trabajo_id;
  END IF;

  -- Recalcular total si hay orden de trabajo asociada
  IF v_orden_trabajo_id IS NOT NULL THEN
    PERFORM fn_recalcular_total_orden_trabajo(v_orden_trabajo_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_recalcular_total_ot"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_recalcular_total_ot"() IS 'Trigger function que recalcula automáticamente el total de la OT cuando se crea/modifica/elimina una orden de copiado asociada.';



CREATE OR REPLACE FUNCTION "public"."trigger_recalcular_total_ot_servicios"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_orden_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_orden_id := OLD.orden_id;
  ELSE
    v_orden_id := NEW.orden_id;
  END IF;
  
  -- Llamamos a la función existente (que actualizaremos abajo)
  PERFORM fn_recalcular_total_orden_trabajo(v_orden_id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_recalcular_total_ot_servicios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_registrar_pago_cc"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_registrar_pago_cc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Llamar a la función de seed para la nueva empresa
  PERFORM fn_seed_motivos_pausa_default(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() IS 'Trigger que ejecuta fn_seed_motivos_pausa_default automáticamente cuando se crea una nueva empresa';



CREATE OR REPLACE FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Solo proceder si el estado cambió a 'aprobado'
  IF NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado') THEN

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Log del intento
    RAISE LOG '[Notify Presupuesto Aprobado] Presupuesto aprobado detectado: % (company: %)',
      NEW.numero_presupuesto, NEW.company_id;

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'presupuesto_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_notificacion', 'presupuesto_aprobado'
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Presupuesto Aprobado] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto Aprobado] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() IS 'Envía notificación WhatsApp al cliente cuando aprueba un presupuesto';



CREATE OR REPLACE FUNCTION "public"."update_global_task_status"("p_global_task_id" "uuid", "p_new_status" "text", "p_user_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Validar inputs
  IF p_new_status NOT IN ('pendiente', 'en_proceso', 'completado', 'omitido') THEN
    RAISE EXCEPTION 'Estado inválido: %. Los estados permitidos son: pendiente, en_proceso, completado, omitido', p_new_status;
  END IF;

  IF p_global_task_id IS NULL THEN
    RAISE EXCEPTION 'El global_task_id no puede ser nulo';
  END IF;

  -- 2. Actualizar registros
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = p_new_status,
    responsable_id = p_user_id,
    updated_at = now(),
    -- Lógica de tiempos
    fecha_inicio = CASE
      WHEN p_new_status = 'en_proceso' AND fecha_inicio IS NULL THEN now()
      WHEN p_new_status = 'pendiente' THEN NULL -- Reset si vuelve a pendiente
      ELSE fecha_inicio
    END,
    fecha_fin = CASE
      WHEN p_new_status IN ('completado', 'omitido') THEN now()
      WHEN p_new_status IN ('pendiente', 'en_proceso') THEN NULL -- Reset si se reabre
      ELSE fecha_fin
    END,
    -- Concatenar notas si existen, o reemplazarlas? 
    -- Para operaciones masivas, mejor reemplazar o agregar con timestamp. 
    -- Aquí reemplazamos si se provee nueva nota.
    notas = COALESCE(p_notes, notas)
  WHERE
    global_task_id = p_global_task_id;

  -- 3. Feedback (opcional en logs)
  RAISE NOTICE 'Actualizadas tareas con global_task_id % al estado % por usuario %', p_global_task_id, p_new_status, p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_global_task_status"("p_global_task_id" "uuid", "p_new_status" "text", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ordenes_items_rutas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ordenes_items_rutas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ordenes_trabajo_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ordenes_trabajo_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pedidos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pedidos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pl_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pl_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pmr_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pmr_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_presupuestos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_presupuestos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_gran_formato_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_gran_formato_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_gran_formato_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_gran_formato_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_impresion_laser_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_impresion_laser_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_materiales_rigidos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_materiales_rigidos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_plotter_corte_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_plotter_corte_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_portabanners_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_portabanners_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_portabanners_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_portabanners_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_rutas_plantillas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_rutas_plantillas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_sellos_precios_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_sellos_precios_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_productos_sellos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_productos_sellos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_rutas_produccion_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_rutas_produccion_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_member_role"("p_user_id" "uuid", "p_new_role" "text", "p_custom_role_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_profile profiles;
  v_target_profile profiles;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
  END IF;

  -- Obtener perfil del llamador
  SELECT * INTO v_caller_profile FROM profiles WHERE id = auth.uid();

  -- Verificar permisos
  IF v_caller_profile.role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos');
  END IF;

  -- Obtener perfil del usuario objetivo
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_user_id;

  IF v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado');
  END IF;

  -- Verificar que pertenecen a la misma empresa
  IF v_target_profile.company_id != v_caller_profile.company_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar usuarios de otra empresa');
  END IF;

  -- No permitir modificar super_admins (a menos que seas super_admin)
  IF v_target_profile.role = 'super_admin' AND v_caller_profile.role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes modificar un super admin');
  END IF;

  -- Actualizar el rol
  UPDATE profiles
  SET
    role = p_new_role,
    custom_role_id = p_custom_role_id,
    updated_at = now()
  WHERE id = p_user_id;

  -- Audit log
  INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_caller_profile.company_id,
    auth.uid(),
    'user_role_updated',
    'user',
    p_user_id,
    jsonb_build_object(
      'target_user', v_target_profile.email,
      'old_role', v_target_profile.role,
      'new_role', p_new_role
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Rol actualizado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."update_team_member_role"("p_user_id" "uuid", "p_new_role" "text", "p_custom_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Función trigger genérica para actualizar automáticamente el campo updated_at';



CREATE OR REPLACE FUNCTION "public"."user_belongs_to_company"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND company_id = target_company_id
    LIMIT 1
  );
$$;


ALTER FUNCTION "public"."user_belongs_to_company"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_etapa_paso"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Normalizar etapa a snake_case en INSERT/UPDATE
  IF NEW.etapa IS NOT NULL THEN

    -- 1. Si ya está en snake_case correcto, mantener
    IF NEW.etapa IN ('pre_prensa', 'principal', 'post_prensa', 'instalacion') THEN
      RETURN NEW;
    END IF;

    -- 2. Convertir variaciones a valores correctos
    -- Pre-prensa
    IF LOWER(NEW.etapa) IN ('pre_prensa', 'pre-prensa', 'preprensa', 'pre prensa') THEN
      NEW.etapa := 'pre_prensa';
      RETURN NEW;
    END IF;

    -- Principal/Producción
    IF LOWER(NEW.etapa) IN ('principal', 'produccion', 'producción') THEN
      NEW.etapa := 'principal';
      RETURN NEW;
    END IF;

    -- Post-prensa/Terminación
    IF LOWER(NEW.etapa) IN ('post_prensa', 'post-prensa', 'postprensa', 'post prensa', 'terminacion', 'terminación') THEN
      NEW.etapa := 'post_prensa';
      RETURN NEW;
    END IF;

    -- ✅ NUEVO: Instalación (CRÍTICO)
    IF LOWER(NEW.etapa) IN ('instalacion', 'instalación') THEN
      NEW.etapa := 'instalacion';
      RETURN NEW;
    END IF;

    -- 3. Pattern matching para variaciones (orden crítico)
    
    -- Instalacion primero (antes de otros patterns)
    IF LOWER(NEW.etapa) LIKE '%instalac%' THEN
      NEW.etapa := 'instalacion';
      RETURN NEW;
    END IF;

    -- Post antes de Pre (evitar captura incorrecta)
    IF LOWER(NEW.etapa) LIKE '%post%' OR LOWER(NEW.etapa) LIKE '%terminac%' THEN
      NEW.etapa := 'post_prensa';
      RETURN NEW;
    END IF;

    -- Pre solo si empieza con pre
    IF LOWER(NEW.etapa) LIKE 'pre%' THEN
      NEW.etapa := 'pre_prensa';
      RETURN NEW;
    END IF;

    -- Principal/Producción
    IF LOWER(NEW.etapa) LIKE '%producc%' OR LOWER(NEW.etapa) LIKE '%principal%' THEN
      NEW.etapa := 'principal';
      RETURN NEW;
    END IF;

    -- 4. Si no coincide con nada, lanzar error descriptivo
    RAISE EXCEPTION 'Etapa no válida: %. Las etapas válidas son: pre_prensa, principal, post_prensa, instalacion', NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_etapa_paso"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validar_etapa_paso"() IS 'Normaliza el valor de etapa a snake_case antes de INSERT/UPDATE.
   Acepta variaciones (capitalizado, con espacios, con guiones) y las convierte al formato correcto.
   Valores válidos: pre_prensa, principal, post_prensa, instalacion';



CREATE OR REPLACE FUNCTION "public"."validar_rango_precio_laser"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rango_unidad_medida text;
BEGIN
  -- Validación 1: Si tipo_venta = 'unidades' → rango_precio_id OBLIGATORIO
  IF NEW.tipo_venta = 'unidades' AND NEW.rango_precio_id IS NULL THEN
    RAISE EXCEPTION 'Productos con tipo de venta "Por Unidades" deben tener un rango de precio asociado';
  END IF;

  -- Validación 2: Si tipo_venta = 'cantidades_fijas' → rango_precio_id debe ser NULL
  IF NEW.tipo_venta = 'cantidades_fijas' AND NEW.rango_precio_id IS NOT NULL THEN
    RAISE EXCEPTION 'Productos con tipo de venta "Cantidades Fijas" no deben tener rango de precio asociado';
  END IF;

  -- Validación 3: Si hay rango asociado, debe ser de unidad 'unidades'
  IF NEW.rango_precio_id IS NOT NULL THEN
    SELECT unidad_medida INTO v_rango_unidad_medida
    FROM rangos_precio
    WHERE id = NEW.rango_precio_id;

    IF v_rango_unidad_medida != 'unidades' THEN
      RAISE EXCEPTION 'El rango de precio asociado debe tener unidad_medida = "unidades". Actualmente tiene: %', v_rango_unidad_medida;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_rango_precio_laser"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_material_variantes"("variantes_param" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."validate_material_variantes"("variantes_param" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_material_variantes_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.aplica_espesor = true AND NEW.variantes IS NOT NULL THEN
    PERFORM validate_material_variantes(NEW.variantes);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_material_variantes_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_precio_mr_combination"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Verificar que existe una entrada en productos_materiales_rigidos_materiales
  -- con la misma combinación de producto, material, variante y espesor (incluyendo NULL)
  IF NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales
    WHERE producto_materiales_rigidos_id = NEW.producto_materiales_rigidos_id
    AND material_id = NEW.material_id
    AND variante_nombre = NEW.variante_nombre
    AND (
      (NEW.espesor IS NULL AND espesor IS NULL) OR
      (NEW.espesor IS NOT NULL AND espesor = NEW.espesor)
    )
  ) THEN
    IF NEW.espesor IS NULL THEN
      RAISE EXCEPTION 'No existe una combinación de material-variante válida (sin espesor) para este precio. Producto: %, Material: %, Variante: %',
        NEW.producto_materiales_rigidos_id, NEW.material_id, NEW.variante_nombre;
    ELSE
      RAISE EXCEPTION 'No existe una combinación de material-variante-espesor válida para este precio. Producto: %, Material: %, Variante: %, Espesor: %mm',
        NEW.producto_materiales_rigidos_id, NEW.material_id, NEW.variante_nombre, NEW.espesor;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_precio_mr_combination"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_precio_mr_combination"() IS 'Valida que existe una combinación válida de material-variante-espesor (o sin espesor) antes de crear/actualizar un precio';



CREATE OR REPLACE FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_etapas text[] := ARRAY['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion', 'Entrega'];
  v_etapa text;
  v_count integer;
BEGIN
  FOREACH v_etapa IN ARRAY v_etapas
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM rutas_produccion_pasos
    WHERE ruta_id = p_ruta_id AND etapa = v_etapa;

    IF v_count = 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") IS 'Verifica si una ruta tiene al menos un paso definido en cada una de las 5 etapas de producción.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "estacion_id" "uuid" NOT NULL,
    "disponible_independiente" boolean DEFAULT false NOT NULL,
    "tiene_niveles_precio" boolean DEFAULT false NOT NULL,
    "tipo_impacto" "text",
    "valor_impacto" numeric,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valor_impacto_secundario" numeric,
    "alcance" "text" DEFAULT 'por_item'::"text" NOT NULL,
    CONSTRAINT "check_acabados_alcance_valido" CHECK (("alcance" = ANY (ARRAY['por_item'::"text", 'grupo'::"text"]))),
    CONSTRAINT "check_acabados_tipo_impacto" CHECK ((("tipo_impacto" IS NULL) OR ("tipo_impacto" = ANY (ARRAY['sin_impacto'::"text", 'precio_fijo'::"text", 'por_unidad'::"text", 'por_minuto'::"text", 'porcentual'::"text", 'por_mt2'::"text", 'por_mt_lineal'::"text", 'fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]))))
);


ALTER TABLE "public"."acabados" OWNER TO "postgres";


COMMENT ON COLUMN "public"."acabados"."valor_impacto" IS 'Valor principal del impacto. Para tipos combinados, este es el valor fijo.';



COMMENT ON COLUMN "public"."acabados"."valor_impacto_secundario" IS 'Valor secundario para tipos de impacto combinados (porcentaje, valor por mt2, valor por metro lineal, o valor por minuto). NULL para tipos simples.';



COMMENT ON COLUMN "public"."acabados"."alcance" IS 'Alcance del acabado: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';



CREATE TABLE IF NOT EXISTS "public"."acabados_categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."acabados_categorias" OWNER TO "postgres";


COMMENT ON TABLE "public"."acabados_categorias" IS 'Tabla relacional muchos-a-muchos entre acabados y categorías. Un acabado puede tener múltiples categorías.';



COMMENT ON COLUMN "public"."acabados_categorias"."acabado_id" IS 'ID del acabado. Elimina en cascada cuando se elimina el acabado.';



COMMENT ON COLUMN "public"."acabados_categorias"."categoria_id" IS 'ID de la categoría. Restricción para prevenir eliminación de categorías en uso.';



CREATE TABLE IF NOT EXISTS "public"."acabados_niveles_precio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_impacto" "text" NOT NULL,
    "valor_impacto" numeric NOT NULL,
    "paso_id" "uuid",
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valor_impacto_secundario" numeric,
    CONSTRAINT "check_acabados_nivel_tipo_impacto" CHECK (("tipo_impacto" = ANY (ARRAY['sin_impacto'::"text", 'precio_fijo'::"text", 'por_unidad'::"text", 'por_minuto'::"text", 'porcentual'::"text", 'por_mt2'::"text", 'por_mt_lineal'::"text", 'fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]))),
    CONSTRAINT "check_acabados_paso_required" CHECK (("paso_id" IS NOT NULL))
);


ALTER TABLE "public"."acabados_niveles_precio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."acabados_niveles_precio"."valor_impacto" IS 'Valor principal del impacto del nivel. Para tipos combinados, este es el valor fijo.';



COMMENT ON COLUMN "public"."acabados_niveles_precio"."valor_impacto_secundario" IS 'Valor secundario para tipos de impacto combinados en el nivel de precio. NULL para tipos simples.';



CREATE TABLE IF NOT EXISTS "public"."acabados_pasos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "paso_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_acabados_pasos_paso_required" CHECK (("paso_id" IS NOT NULL))
);


ALTER TABLE "public"."acabados_pasos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arqueos_cajas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "caja_id" "uuid" NOT NULL,
    "fecha_cierre" timestamp with time zone DEFAULT "now"() NOT NULL,
    "saldo_sistema" numeric NOT NULL,
    "saldo_real" numeric NOT NULL,
    "diferencia" numeric NOT NULL,
    "billetes_detalle" "jsonb" DEFAULT '{}'::"jsonb",
    "observaciones" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."arqueos_cajas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "module_id" "text",
    "resource_type" "text",
    "resource_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."banks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cajas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "identificador" "text",
    "saldo_actual" numeric DEFAULT 0 NOT NULL,
    "moneda" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "color" "text",
    "icono" "text",
    "es_principal" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notas" "text",
    CONSTRAINT "cajas_saldo_no_negativo" CHECK (("saldo_actual" >= (0)::numeric)),
    CONSTRAINT "cajas_tipo_check" CHECK (("tipo" = ANY (ARRAY['efectivo'::"text", 'banco'::"text", 'pasarela'::"text"])))
);


ALTER TABLE "public"."cajas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cajas"."notas" IS 'Notas adicionales sobre la caja';



CREATE TABLE IF NOT EXISTS "public"."cajas_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caja_id" "uuid" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "monto" numeric NOT NULL,
    "concepto" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "referencia_tipo" "text",
    "referencia_id" "uuid",
    "medio_cobro_id" "uuid",
    "caja_destino_id" "uuid",
    "comision_aplicada" numeric DEFAULT 0 NOT NULL,
    "notas" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "caja_origen_id" "uuid",
    CONSTRAINT "cajas_movimientos_comision_aplicada_check" CHECK (("comision_aplicada" >= (0)::numeric)),
    CONSTRAINT "cajas_movimientos_monto_check" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "cajas_movimientos_referencia_tipo_check" CHECK (("referencia_tipo" = ANY (ARRAY['pago_orden'::"text", 'pago_copiado'::"text", 'gasto'::"text", 'egreso'::"text", 'transferencia'::"text", 'ajuste'::"text", 'ingreso_manual'::"text"]))),
    CONSTRAINT "cajas_movimientos_tipo_movimiento_check" CHECK (("tipo_movimiento" = ANY (ARRAY['ingreso'::"text", 'egreso'::"text", 'transferencia'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."cajas_movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "is_system_category" boolean DEFAULT false NOT NULL,
    CONSTRAINT "categorias_color_format" CHECK (("color" ~* '^#[0-9A-F]{6}$'::"text")),
    CONSTRAINT "check_only_system_categories" CHECK ((("company_id" IS NULL) AND ("is_system_category" = true)))
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


COMMENT ON TABLE "public"."categorias" IS 'Categorías del sistema - Incluye Impresión UV sobre Rígidos para productos que combinan material + impresión UV';



COMMENT ON COLUMN "public"."categorias"."company_id" IS 'Siempre NULL - Las categorías son globales del sistema, no específicas de empresas.';



COMMENT ON COLUMN "public"."categorias"."is_system_category" IS 'Siempre TRUE - Todas las categorías son del sistema. Este campo se mantiene por compatibilidad pero siempre debe ser true.';



COMMENT ON CONSTRAINT "check_only_system_categories" ON "public"."categorias" IS 'Asegura que solo puedan existir categorías del sistema (company_id NULL y is_system_category true).';



CREATE TABLE IF NOT EXISTS "public"."centro_copiado_ordenes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "numero_orden" "text" NOT NULL,
    "orden_trabajo_id" "uuid",
    "cliente_id" "uuid",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "fecha_solicitud" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_entrega_estimada" timestamp with time zone,
    "fecha_entrega_real" timestamp with time zone,
    "total" numeric(10,2) DEFAULT 0 NOT NULL,
    "observaciones" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "origen" "text" DEFAULT 'Mostrador'::"text" NOT NULL,
    CONSTRAINT "centro_copiado_ordenes_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'finalizada'::"text", 'entregada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "centro_copiado_ordenes_origen_check" CHECK (("origen" = ANY (ARRAY['Web'::"text", 'WhatsApp'::"text", 'Mostrador'::"text", 'App Mobile'::"text"]))),
    CONSTRAINT "centro_copiado_ordenes_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."centro_copiado_ordenes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."centro_copiado_ordenes"."origen" IS 'Canal de venta por el cual se originó la orden (Web, WhatsApp, Mostrador, App Mobile)';



CREATE TABLE IF NOT EXISTS "public"."centro_copiado_ordenes_archivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_copiado_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "nombre_archivo" "text" NOT NULL,
    "nombre_storage" "text" NOT NULL,
    "tipo_mime" "text" NOT NULL,
    "tamano_bytes" bigint NOT NULL,
    "storage_path" "text" NOT NULL,
    "paginas_detectadas" integer,
    "item_generado_id" "uuid",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "orden_temporal_id" "text",
    "temporal_creado_en" timestamp with time zone,
    CONSTRAINT "check_orden_o_temporal" CHECK (((("orden_copiado_id" IS NOT NULL) AND ("orden_temporal_id" IS NULL)) OR (("orden_copiado_id" IS NULL) AND ("orden_temporal_id" IS NOT NULL)))),
    CONSTRAINT "check_paginas_positivas" CHECK ((("paginas_detectadas" IS NULL) OR ("paginas_detectadas" > 0))),
    CONSTRAINT "check_tamano_archivo_copiado_valido" CHECK ((("tamano_bytes" > 0) AND ("tamano_bytes" <= 209715200)))
);


ALTER TABLE "public"."centro_copiado_ordenes_archivos" OWNER TO "postgres";


COMMENT ON TABLE "public"."centro_copiado_ordenes_archivos" IS 'Archivos adjuntos a órdenes de copiado. Límite: 200MB total por orden.';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_archivos"."paginas_detectadas" IS 'Número de páginas detectadas automáticamente en PDFs. NULL para otros formatos.';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_archivos"."item_generado_id" IS 'Referencia al item de la orden generado automáticamente desde este archivo.';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_archivos"."orden_temporal_id" IS 'ID temporal generado en frontend para archivos pre-orden. Se usa antes de crear la orden real.';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_archivos"."temporal_creado_en" IS 'Timestamp de cuándo se creó el archivo temporal. Se limpia al asociar con orden real.';



CREATE TABLE IF NOT EXISTS "public"."centro_copiado_ordenes_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_copiado_id" "uuid" NOT NULL,
    "tipo_item" "text" NOT NULL,
    "tamanio_papel_id" "uuid",
    "papel_id" "uuid",
    "tipo_tinta" "text",
    "cara_impresa" "text",
    "cantidad_hojas" integer,
    "tipo_anillado" "text",
    "tipo_plastificado" "text",
    "cantidad_unidades" integer NOT NULL,
    "precio_unitario" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_ordenes_items_cantidad_hojas_check" CHECK ((("cantidad_hojas" IS NULL) OR ("cantidad_hojas" > 0))),
    CONSTRAINT "centro_copiado_ordenes_items_cantidad_unidades_check" CHECK (("cantidad_unidades" > 0)),
    CONSTRAINT "centro_copiado_ordenes_items_cara_impresa_check" CHECK ((("cara_impresa" IS NULL) OR ("cara_impresa" = ANY (ARRAY['frente'::"text", 'frente_y_dorso'::"text"])))),
    CONSTRAINT "centro_copiado_ordenes_items_precio_unitario_check" CHECK (("precio_unitario" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_ordenes_items_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_ordenes_items_tipo_anillado_check" CHECK ((("tipo_anillado" IS NULL) OR ("tipo_anillado" = ANY (ARRAY['ring_wire'::"text", 'plastico'::"text"])))),
    CONSTRAINT "centro_copiado_ordenes_items_tipo_item_check" CHECK (("tipo_item" = ANY (ARRAY['impresion'::"text", 'anillado'::"text", 'plastificado'::"text"]))),
    CONSTRAINT "centro_copiado_ordenes_items_tipo_plastificado_check" CHECK ((("tipo_plastificado" IS NULL) OR ("tipo_plastificado" = ANY (ARRAY['A4'::"text", 'SRA3'::"text", 'Carnet'::"text"])))),
    CONSTRAINT "centro_copiado_ordenes_items_tipo_tinta_check" CHECK ((("tipo_tinta" IS NULL) OR ("tipo_tinta" = ANY (ARRAY['CMYK'::"text", 'K'::"text"]))))
);


ALTER TABLE "public"."centro_copiado_ordenes_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centro_copiado_ordenes_pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_copiado_id" "uuid" NOT NULL,
    "fecha_pago" "date" NOT NULL,
    "monto" numeric(10,2) NOT NULL,
    "medio_cobro_id" "uuid" NOT NULL,
    "referencia_pago" "text",
    "comision_aplicada" numeric(10,2) DEFAULT 0,
    "fecha_liberacion_estimada" "date",
    "notas" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_ordenes_pagos_comision_aplicada_check" CHECK (("comision_aplicada" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_ordenes_pagos_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."centro_copiado_ordenes_pagos" OWNER TO "postgres";


COMMENT ON TABLE "public"."centro_copiado_ordenes_pagos" IS 'Registro de pagos para órdenes de copiado independientes. Las órdenes asociadas a órdenes de trabajo gestionan sus pagos desde ordenes_trabajo_pagos.';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_pagos"."orden_copiado_id" IS 'Referencia a la orden de copiado';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_pagos"."medio_cobro_id" IS 'Medio de cobro utilizado (efectivo, transferencia, etc.)';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_pagos"."comision_aplicada" IS 'Comisión aplicada según el medio de cobro seleccionado';



COMMENT ON COLUMN "public"."centro_copiado_ordenes_pagos"."fecha_liberacion_estimada" IS 'Fecha estimada en que el dinero estará disponible según el medio de cobro';



CREATE TABLE IF NOT EXISTS "public"."centro_copiado_papeles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesor" numeric(10,2),
    "unidad_espesor" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "orden" integer DEFAULT 999 NOT NULL
);


ALTER TABLE "public"."centro_copiado_papeles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."centro_copiado_papeles"."orden" IS 'Orden de visualización del papel en tablas de precios. Menor valor = primera posición.';



CREATE TABLE IF NOT EXISTS "public"."centro_copiado_plastificados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "precio" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unidades_desde" integer DEFAULT 1 NOT NULL,
    "unidades_hasta" integer,
    CONSTRAINT "centro_copiado_plastificados_check" CHECK ((("unidades_hasta" IS NULL) OR ("unidades_hasta" >= "unidades_desde"))),
    CONSTRAINT "centro_copiado_plastificados_precio_check" CHECK (("precio" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_plastificados_tipo_check" CHECK (("tipo" = ANY (ARRAY['A4'::"text", 'SRA3'::"text", 'Carnet'::"text"]))),
    CONSTRAINT "centro_copiado_plastificados_unidades_desde_check" CHECK (("unidades_desde" > 0))
);


ALTER TABLE "public"."centro_copiado_plastificados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centro_copiado_precios_impresion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "tamanio_papel_id" "uuid" NOT NULL,
    "papel_id" "uuid" NOT NULL,
    "tipo_tinta" "text" NOT NULL,
    "rango_precio_id" "uuid" NOT NULL,
    "cara_impresa" "text" NOT NULL,
    "precio" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_precios_impresion_cara_impresa_check" CHECK (("cara_impresa" = ANY (ARRAY['frente'::"text", 'frente_y_dorso'::"text"]))),
    CONSTRAINT "centro_copiado_precios_impresion_precio_check" CHECK (("precio" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_precios_impresion_tipo_tinta_check" CHECK (("tipo_tinta" = ANY (ARRAY['CMYK'::"text", 'K'::"text"])))
);


ALTER TABLE "public"."centro_copiado_precios_impresion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centro_copiado_rangos_anillado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "hojas_desde" integer NOT NULL,
    "hojas_hasta" integer,
    "precio_ring_wire" numeric(10,2) NOT NULL,
    "precio_plastico" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_rangos_anillado_check" CHECK ((("hojas_hasta" IS NULL) OR ("hojas_hasta" >= "hojas_desde"))),
    CONSTRAINT "centro_copiado_rangos_anillado_hojas_desde_check" CHECK (("hojas_desde" > 0)),
    CONSTRAINT "centro_copiado_rangos_anillado_precio_plastico_check" CHECK (("precio_plastico" >= (0)::numeric)),
    CONSTRAINT "centro_copiado_rangos_anillado_precio_ring_wire_check" CHECK (("precio_ring_wire" >= (0)::numeric))
);


ALTER TABLE "public"."centro_copiado_rangos_anillado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centro_copiado_rangos_precio_impresion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "hojas_desde" integer NOT NULL,
    "hojas_hasta" integer,
    "orden" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_rangos_precio_impresion_check" CHECK ((("hojas_hasta" IS NULL) OR ("hojas_hasta" >= "hojas_desde"))),
    CONSTRAINT "centro_copiado_rangos_precio_impresion_hojas_desde_check" CHECK (("hojas_desde" > 0))
);


ALTER TABLE "public"."centro_copiado_rangos_precio_impresion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centro_copiado_tamanios_papel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "ancho_mm" numeric(10,2) NOT NULL,
    "alto_mm" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "centro_copiado_tamanios_papel_alto_mm_check" CHECK (("alto_mm" > (0)::numeric)),
    CONSTRAINT "centro_copiado_tamanios_papel_ancho_mm_check" CHECK (("ancho_mm" > (0)::numeric))
);


ALTER TABLE "public"."centro_copiado_tamanios_papel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheques" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "tipo" "public"."cheque_type" NOT NULL,
    "direction" "public"."cheque_direction" DEFAULT 'emitido'::"public"."cheque_direction" NOT NULL,
    "numero_cheque" "text" NOT NULL,
    "banco" "text" NOT NULL,
    "fecha_emision" "date" NOT NULL,
    "fecha_pago" "date" NOT NULL,
    "monto" numeric NOT NULL,
    "destinatario" "text",
    "proveedor_id" "uuid",
    "client_id" "uuid",
    "orden_id" "uuid",
    "estado" "public"."cheque_status" DEFAULT 'pendiente'::"public"."cheque_status",
    "descripcion" "text",
    "comprobante_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cheques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheques_cartera" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "tipo" "public"."cheque_type" DEFAULT 'fisico'::"public"."cheque_type" NOT NULL,
    "numero_cheque" "text" NOT NULL,
    "banco" "text" NOT NULL,
    "fecha_emision" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_pago" "date" NOT NULL,
    "monto" numeric NOT NULL,
    "destinatario" "text",
    "proveedor_id" "uuid",
    "estado" "public"."cheque_status" DEFAULT 'pendiente'::"public"."cheque_status" NOT NULL,
    "descripcion" "text",
    "comprobante_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "direction" "public"."cheque_direction" DEFAULT 'emitido'::"public"."cheque_direction" NOT NULL,
    "client_id" "uuid",
    "orden_id" "uuid",
    CONSTRAINT "cheques_cartera_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."cheques_cartera" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "province_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "postal_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "is_global" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cliente_registro_intentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "text" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "intentos" integer DEFAULT 1 NOT NULL,
    "ultima_fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bloqueado_hasta" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cliente_registro_intentos" OWNER TO "postgres";


COMMENT ON TABLE "public"."cliente_registro_intentos" IS 'Tabla para rate limiting y prevención de registros maliciosos. Tracking de intentos por IP.';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre_fantasia" "text" NOT NULL,
    "razon_social" "text" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "numero_documento" "text" NOT NULL,
    "whatsapp" "text",
    "email" "text",
    "domicilio" "text",
    "country_id" "uuid",
    "province_id" "uuid",
    "city_id" "uuid",
    "codigo_postal" "text",
    "tiene_cuenta_corriente" boolean DEFAULT false NOT NULL,
    "acuerdo_pago" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dia_cierre_semanal" integer,
    "dia_cierre_mensual" integer,
    "usa_ultimo_dia_mes" boolean DEFAULT false,
    "dias_vencimiento" integer DEFAULT 7,
    "status_aprobacion" "text" DEFAULT 'approved'::"text" NOT NULL,
    "fecha_registro" timestamp with time zone DEFAULT "now"(),
    "notas_rechazo" "text",
    "aprobado_por" "uuid",
    "fecha_aprobacion" timestamp with time zone,
    "ip_registro" "text",
    CONSTRAINT "check_mensual_config" CHECK ((("acuerdo_pago" <> 'Mensual'::"text") OR (("acuerdo_pago" = 'Mensual'::"text") AND (("dia_cierre_mensual" IS NOT NULL) OR ("usa_ultimo_dia_mes" = true))))),
    CONSTRAINT "check_semanal_config" CHECK ((("acuerdo_pago" <> 'Semanal'::"text") OR (("acuerdo_pago" = 'Semanal'::"text") AND ("dia_cierre_semanal" IS NOT NULL)))),
    CONSTRAINT "check_ultimo_dia_exclusivo" CHECK ((("usa_ultimo_dia_mes" = false) OR (("usa_ultimo_dia_mes" = true) AND ("dia_cierre_mensual" IS NULL)))),
    CONSTRAINT "clients_acuerdo_pago_check" CHECK ((("acuerdo_pago" IS NULL) OR ("acuerdo_pago" = ANY (ARRAY['Semanal'::"text", 'Quincenal'::"text", 'Mensual'::"text"])))),
    CONSTRAINT "clients_dia_cierre_mensual_check" CHECK ((("dia_cierre_mensual" IS NULL) OR (("dia_cierre_mensual" >= 1) AND ("dia_cierre_mensual" <= 28)))),
    CONSTRAINT "clients_dia_cierre_semanal_check" CHECK ((("dia_cierre_semanal" IS NULL) OR (("dia_cierre_semanal" >= 1) AND ("dia_cierre_semanal" <= 7)))),
    CONSTRAINT "clients_dias_vencimiento_check" CHECK ((("dias_vencimiento" >= 0) AND ("dias_vencimiento" <= 90))),
    CONSTRAINT "clients_status_aprobacion_check" CHECK (("status_aprobacion" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "clients_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['DNI'::"text", 'CUIT'::"text", 'CUIL'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."dia_cierre_semanal" IS 'Día de la semana para cierre semanal: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo';



COMMENT ON COLUMN "public"."clients"."dia_cierre_mensual" IS 'Día del mes para cierre mensual (1-28). Se usa rango 1-28 para evitar problemas con febrero.';



COMMENT ON COLUMN "public"."clients"."usa_ultimo_dia_mes" IS 'Si es TRUE, el cierre mensual se realiza el último día del mes (28, 29, 30 o 31 según corresponda)';



COMMENT ON COLUMN "public"."clients"."dias_vencimiento" IS 'Cantidad de días después del cierre en que vence la liquidación. Por defecto 7 días.';



COMMENT ON COLUMN "public"."clients"."status_aprobacion" IS 'Estado de aprobación del cliente: pending (esperando aprobación), approved (aprobado y activo), rejected (rechazado)';



COMMENT ON COLUMN "public"."clients"."fecha_registro" IS 'Fecha y hora en que el cliente se registró en el sistema';



COMMENT ON COLUMN "public"."clients"."notas_rechazo" IS 'Notas del operador explicando por qué se rechazó el cliente';



COMMENT ON COLUMN "public"."clients"."aprobado_por" IS 'ID del usuario que aprobó o rechazó el cliente';



COMMENT ON COLUMN "public"."clients"."fecha_aprobacion" IS 'Fecha y hora en que el cliente fue aprobado o rechazado';



COMMENT ON COLUMN "public"."clients"."ip_registro" IS 'Dirección IP desde donde se realizó el registro (para auditoría y seguridad)';



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "contact_phone" "text",
    "contact_email" "text",
    "website" "text",
    "address" "text",
    "country_id" "uuid",
    "province_id" "uuid",
    "city_id" "uuid",
    "postal_code" "text",
    "legal_name" "text",
    "tax_id_type" "text",
    "tax_id_number" "text",
    "tax_condition" "text",
    "timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text",
    "currency" "text" DEFAULT 'ARS'::"text",
    "language" "text" DEFAULT 'es'::"text",
    "description" "text",
    "industry" "text",
    "business_hours" "text",
    "google_review_url" "text",
    "whatsapp_notifications_enabled" boolean DEFAULT true,
    "whatsapp_instance_id" "text",
    CONSTRAINT "check_google_review_url_format" CHECK ((("google_review_url" IS NULL) OR ("google_review_url" ~ '^https?://'::"text"))),
    CONSTRAINT "companies_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "companies_tax_id_type_check" CHECK (("tax_id_type" = ANY (ARRAY['DNI'::"text", 'CUIT'::"text", 'CUIL'::"text"])))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."logo_url" IS 'URL del logo de la empresa almacenado en Supabase Storage';



COMMENT ON COLUMN "public"."companies"."contact_phone" IS 'Teléfono de contacto de la empresa';



COMMENT ON COLUMN "public"."companies"."contact_email" IS 'Email de contacto de la empresa';



COMMENT ON COLUMN "public"."companies"."website" IS 'Sitio web de la empresa';



COMMENT ON COLUMN "public"."companies"."address" IS 'Dirección completa de la empresa';



COMMENT ON COLUMN "public"."companies"."legal_name" IS 'Razón social de la empresa';



COMMENT ON COLUMN "public"."companies"."tax_id_type" IS 'Tipo de identificación fiscal (DNI, CUIT, CUIL)';



COMMENT ON COLUMN "public"."companies"."tax_id_number" IS 'Número de identificación fiscal';



COMMENT ON COLUMN "public"."companies"."tax_condition" IS 'Condición ante IVA';



COMMENT ON COLUMN "public"."companies"."timezone" IS 'Zona horaria preferida de la empresa';



COMMENT ON COLUMN "public"."companies"."currency" IS 'Moneda preferida de la empresa';



COMMENT ON COLUMN "public"."companies"."language" IS 'Idioma preferido de la empresa';



COMMENT ON COLUMN "public"."companies"."description" IS 'Descripción de la empresa';



COMMENT ON COLUMN "public"."companies"."industry" IS 'Sector o industria de la empresa';



COMMENT ON COLUMN "public"."companies"."business_hours" IS 'Horarios de atención de la empresa, se incluyen en notificaciones de WhatsApp de órdenes finalizadas';



COMMENT ON COLUMN "public"."companies"."google_review_url" IS 'Link personalizado de Google Reviews para solicitar opiniones en notificaciones de WhatsApp';



CREATE TABLE IF NOT EXISTS "public"."company_business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_open" boolean DEFAULT false,
    "opening_time_1" time without time zone,
    "closing_time_1" time without time zone,
    "opening_time_2" time without time zone,
    "closing_time_2" time without time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "company_business_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."company_business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."company_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compras_proveedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "descripcion" "text" NOT NULL,
    "numero_factura" "text",
    "monto_total" numeric NOT NULL,
    "fecha_emision" "date" DEFAULT CURRENT_DATE,
    "fecha_vencimiento" "date" NOT NULL,
    "archivo_url" "text",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "notas" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "compras_proveedores_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'pagado'::"text"]))),
    CONSTRAINT "compras_proveedores_monto_total_check" CHECK (("monto_total" > (0)::numeric))
);


ALTER TABLE "public"."compras_proveedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "iso_code" "text" NOT NULL,
    "phone_code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "is_global" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_corrientes_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "orden_id" "uuid",
    "pago_id" "uuid",
    "liquidacion_id" "uuid",
    "descripcion" "text" NOT NULL,
    "monto_debe" numeric DEFAULT 0 NOT NULL,
    "monto_haber" numeric DEFAULT 0 NOT NULL,
    "saldo_acumulado" numeric DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_debe_o_haber" CHECK (((("monto_debe" > (0)::numeric) AND ("monto_haber" = (0)::numeric)) OR (("monto_haber" > (0)::numeric) AND ("monto_debe" = (0)::numeric)) OR (("tipo_movimiento" = 'ajuste'::"text") AND (("monto_debe" > (0)::numeric) OR ("monto_haber" > (0)::numeric))))),
    CONSTRAINT "cuentas_corrientes_movimientos_monto_debe_check" CHECK (("monto_debe" >= (0)::numeric)),
    CONSTRAINT "cuentas_corrientes_movimientos_monto_haber_check" CHECK (("monto_haber" >= (0)::numeric)),
    CONSTRAINT "cuentas_corrientes_movimientos_tipo_movimiento_check" CHECK (("tipo_movimiento" = ANY (ARRAY['cargo'::"text", 'pago'::"text", 'ajuste'::"text", 'nota_credito'::"text", 'nota_debito'::"text"])))
);


ALTER TABLE "public"."cuentas_corrientes_movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."egresos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "caja_id" "uuid",
    "tipo_egreso_id" "uuid" NOT NULL,
    "monto" numeric NOT NULL,
    "concepto" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "numero_comprobante" "text",
    "proveedor_nombre" "text",
    "medio_pago" "text",
    "notas" "text",
    "movimiento_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "proveedor_id" "uuid",
    "tarjeta_id" "uuid",
    "recurrente_id" "uuid",
    "periodo_devengado" "date",
    "compra_id" "uuid",
    CONSTRAINT "egresos_medio_pago_check" CHECK ((("medio_pago" IS NULL) OR ("medio_pago" = ANY (ARRAY['efectivo'::"text", 'transferencia'::"text", 'cheque'::"text", 'tarjeta'::"text", 'debito'::"text", 'otro'::"text"])))),
    CONSTRAINT "egresos_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."egresos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."egresos"."proveedor_nombre" IS 'Nombre de proveedor (legacy, usar proveedor_id)';



COMMENT ON COLUMN "public"."egresos"."proveedor_id" IS 'FK al proveedor registrado en el sistema';



CREATE TABLE IF NOT EXISTS "public"."estaciones_trabajo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."estaciones_trabajo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facturas_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "numero_factura" "text" NOT NULL,
    "monto_subtotal" numeric NOT NULL,
    "monto_iva" numeric NOT NULL,
    "monto_total" numeric NOT NULL,
    "factura_storage_path" "text" NOT NULL,
    "tipo_operacion" "text" NOT NULL,
    "observaciones" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facturas_historial_monto_iva_check" CHECK (("monto_iva" >= (0)::numeric)),
    CONSTRAINT "facturas_historial_monto_subtotal_check" CHECK (("monto_subtotal" >= (0)::numeric)),
    CONSTRAINT "facturas_historial_monto_total_check" CHECK (("monto_total" >= (0)::numeric)),
    CONSTRAINT "facturas_historial_tipo_operacion_check" CHECK (("tipo_operacion" = ANY (ARRAY['creacion'::"text", 'reemplazo'::"text", 'anulacion'::"text"])))
);


ALTER TABLE "public"."facturas_historial" OWNER TO "postgres";


COMMENT ON TABLE "public"."facturas_historial" IS 'Registro de auditoría de todas las operaciones sobre facturas (creación, reemplazo, anulación)';



COMMENT ON COLUMN "public"."facturas_historial"."monto_subtotal" IS 'Subtotal de la orden con descuentos aplicados (sin IVA)';



COMMENT ON COLUMN "public"."facturas_historial"."monto_iva" IS 'Monto del IVA aplicado';



COMMENT ON COLUMN "public"."facturas_historial"."monto_total" IS 'Total facturado (subtotal + IVA)';



COMMENT ON COLUMN "public"."facturas_historial"."tipo_operacion" IS 'Tipo de operación: creacion (primera vez), reemplazo (cambio de factura), anulacion (factura anulada)';



CREATE TABLE IF NOT EXISTS "public"."facturas_urls_cortas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "orden_trabajo_id" "uuid" NOT NULL,
    "token_corto" "text" NOT NULL,
    "factura_storage_path" "text" NOT NULL,
    "numero_factura" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."facturas_urls_cortas" OWNER TO "postgres";


COMMENT ON TABLE "public"."facturas_urls_cortas" IS 'Almacena tokens cortos para acceso rápido a facturas. Multi-tenant por company_id.';



CREATE TABLE IF NOT EXISTS "public"."ingresos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "caja_id" "uuid" NOT NULL,
    "tipo_ingreso_id" "uuid" NOT NULL,
    "monto" numeric NOT NULL,
    "concepto" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "numero_comprobante" "text",
    "origen" "text",
    "medio_cobro_id" "uuid",
    "notas" "text",
    "movimiento_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ingresos_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."ingresos" OWNER TO "postgres";


COMMENT ON TABLE "public"."ingresos" IS 'Registro de ingresos manuales (no provenientes de ventas)';



COMMENT ON COLUMN "public"."ingresos"."numero_comprobante" IS 'Número de factura, recibo o comprobante asociado';



COMMENT ON COLUMN "public"."ingresos"."origen" IS 'Describe de quién o dónde proviene el ingreso (ej: nombre del prestamista, comprador del activo, etc.)';



COMMENT ON COLUMN "public"."ingresos"."movimiento_id" IS 'Referencia al movimiento automático creado en cajas_movimientos';



CREATE TABLE IF NOT EXISTS "public"."liquidaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_liquidacion" "text" NOT NULL,
    "fecha_emision" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_vencimiento" "date",
    "periodo_desde" "date",
    "periodo_hasta" "date",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "subtotal_ordenes" numeric DEFAULT 0 NOT NULL,
    "total_ajustes" numeric DEFAULT 0 NOT NULL,
    "total_general" numeric DEFAULT 0 NOT NULL,
    "total_pagado" numeric DEFAULT 0 NOT NULL,
    "saldo_pendiente" numeric DEFAULT 0 NOT NULL,
    "notas" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "liquidaciones_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'pagada_parcial'::"text", 'pagada_total'::"text", 'vencida'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "liquidaciones_subtotal_ordenes_check" CHECK (("subtotal_ordenes" >= (0)::numeric)),
    CONSTRAINT "liquidaciones_total_general_check" CHECK (("total_general" >= (0)::numeric)),
    CONSTRAINT "liquidaciones_total_pagado_check" CHECK (("total_pagado" >= (0)::numeric))
);


ALTER TABLE "public"."liquidaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."liquidaciones_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "liquidacion_id" "uuid" NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "descripcion" "text" NOT NULL,
    "fecha_orden" "date" NOT NULL,
    "numero_orden" "text" NOT NULL,
    "monto" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "liquidaciones_items_monto_check" CHECK (("monto" >= (0)::numeric))
);


ALTER TABLE "public"."liquidaciones_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."liquidaciones_pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "liquidacion_id" "uuid" NOT NULL,
    "pago_id" "uuid" NOT NULL,
    "monto_aplicado" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "liquidaciones_pagos_monto_aplicado_check" CHECK (("monto_aplicado" > (0)::numeric))
);


ALTER TABLE "public"."liquidaciones_pagos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "ip_address" "text",
    "success" boolean DEFAULT false,
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "aplica_espesor" boolean DEFAULT false NOT NULL,
    "unidad_espesor" "text",
    "variantes" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_unidad_espesor" CHECK ((("unidad_espesor" IS NULL) OR ("unidad_espesor" = ANY (ARRAY['gr'::"text", 'mm'::"text"]))))
);


ALTER TABLE "public"."materiales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medios_cobro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "categoria" "text",
    "forma_cobro" "text",
    "comision_porcentaje" numeric DEFAULT 0,
    "dias_liberacion" integer DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "caja_id" "uuid",
    CONSTRAINT "check_comision_valida" CHECK ((("comision_porcentaje" >= (0)::numeric) AND ("comision_porcentaje" <= (100)::numeric))),
    CONSTRAINT "check_dias_liberacion_valido" CHECK (("dias_liberacion" >= 0)),
    CONSTRAINT "check_tipo_medio_cobro" CHECK (("tipo" = ANY (ARRAY['pasarela'::"text", 'bancario'::"text", 'efectivo'::"text"])))
);


ALTER TABLE "public"."medios_cobro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones_internas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensaje" "text" NOT NULL,
    "referencia_tipo" "text",
    "referencia_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "leida" boolean DEFAULT false NOT NULL,
    "leida_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_leida_at_requires_leida" CHECK (((("leida" = false) AND ("leida_at" IS NULL)) OR (("leida" = true) AND ("leida_at" IS NOT NULL)))),
    CONSTRAINT "notificaciones_internas_referencia_tipo_check" CHECK (("referencia_tipo" = ANY (ARRAY['orden_trabajo'::"text", 'orden_item'::"text", 'ruta_paso'::"text", 'pausa'::"text", 'presupuesto'::"text", 'cliente'::"text"]))),
    CONSTRAINT "notificaciones_internas_tipo_check" CHECK (("tipo" = ANY (ARRAY['pausa_prolongada'::"text", 'paso_completado'::"text", 'orden_finalizada'::"text", 'alerta_produccion'::"text", 'sistema'::"text", 'presupuesto_aprobado'::"text", 'presupuesto_rechazado'::"text", 'presupuesto_por_vencer'::"text", 'presupuesto_vencido'::"text", 'nuevo_cliente_registro'::"text"])))
);

ALTER TABLE ONLY "public"."notificaciones_internas" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notificaciones_internas" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificaciones_internas" IS 'Sistema de notificaciones internas para usuarios (NO WhatsApp). Incluye alertas de pausas prolongadas >24h para super_admin y admin';



COMMENT ON COLUMN "public"."notificaciones_internas"."tipo" IS 'Tipo de notificación: pausa_prolongada (>24h), paso_completado, orden_finalizada, alerta_produccion, sistema';



COMMENT ON COLUMN "public"."notificaciones_internas"."referencia_tipo" IS 'Tipo de entidad referenciada para navegación: orden_trabajo, orden_item, ruta_paso, pausa';



COMMENT ON COLUMN "public"."notificaciones_internas"."metadata" IS 'Datos adicionales en JSON: {orden_numero, paso_nombre, tiempo_pausado, horas_pausado, categoria_motivo, etc}';



CREATE TABLE IF NOT EXISTS "public"."ordenes_items_rutas_pausas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ruta_id" "uuid" NOT NULL,
    "motivo_pausa_id" "uuid" NOT NULL,
    "categoria_motivo" "text" NOT NULL,
    "descripcion" "text",
    "fecha_inicio_pausa" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_fin_pausa" timestamp with time zone,
    "pausado_por" "uuid",
    "reanudado_por" "uuid",
    "duracion_minutos" integer GENERATED ALWAYS AS (
CASE
    WHEN ("fecha_fin_pausa" IS NOT NULL) THEN ((EXTRACT(epoch FROM ("fecha_fin_pausa" - "fecha_inicio_pausa")))::integer / 60)
    ELSE NULL::integer
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_fecha_fin_posterior" CHECK ((("fecha_fin_pausa" IS NULL) OR ("fecha_fin_pausa" >= "fecha_inicio_pausa"))),
    CONSTRAINT "ordenes_items_rutas_pausas_categoria_motivo_check" CHECK (("categoria_motivo" = ANY (ARRAY['cliente'::"text", 'materiales'::"text", 'maquinaria'::"text", 'personal'::"text", 'externo'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."ordenes_items_rutas_pausas" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_items_rutas_pausas" IS 'Registro histórico de pausas en pasos de producción con motivos y duraciones. Soporta múltiples ciclos de pausa/reanudación';



COMMENT ON COLUMN "public"."ordenes_items_rutas_pausas"."descripcion" IS 'Descripción opcional o requerida según configuración del motivo';



COMMENT ON COLUMN "public"."ordenes_items_rutas_pausas"."fecha_fin_pausa" IS 'NULL indica pausa activa. Se establece automáticamente al reanudar';



COMMENT ON COLUMN "public"."ordenes_items_rutas_pausas"."duracion_minutos" IS 'Duración calculada automáticamente en minutos cuando se cierra la pausa (fecha_fin_pausa)';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_orden" "text" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "canal_venta" "text" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_estimada_entrega" timestamp with time zone,
    "notas_internas" "text",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "total_descuentos" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_entrega_real" timestamp with time zone,
    "tracking_token" character varying(32),
    "fecha_completado" timestamp with time zone,
    "presupuesto_id" "uuid",
    "requiere_factura" boolean DEFAULT false NOT NULL,
    "subtotal_iva" numeric DEFAULT 0 NOT NULL,
    "facturada" boolean DEFAULT false NOT NULL,
    "fecha_facturacion" timestamp with time zone,
    "numero_factura" "text",
    "factura_storage_path" "text",
    "requiere_despacho" boolean DEFAULT false,
    "fecha_despacho" timestamp with time zone,
    "transporte" "text",
    "numero_guia" "text",
    "estado_envio" "text" DEFAULT 'pendiente'::"text",
    CONSTRAINT "check_canal_venta" CHECK (("canal_venta" = ANY (ARRAY['Web'::"text", 'WhatsApp'::"text", 'Mostrador'::"text", 'App Mobile'::"text"]))),
    CONSTRAINT "check_estado" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'finalizada'::"text", 'entregada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "check_subtotal_positivo" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "check_total_positivo" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "check_tracking_token_format" CHECK ((("tracking_token" IS NULL) OR (("length"(("tracking_token")::"text") = 32) AND (("tracking_token")::"text" ~ '^[A-Z0-9]{32}$'::"text")))),
    CONSTRAINT "ordenes_trabajo_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'finalizada'::"text", 'entregada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "ordenes_trabajo_estado_envio_check" CHECK (("estado_envio" = ANY (ARRAY['pendiente'::"text", 'enviado'::"text", 'entregado'::"text"]))),
    CONSTRAINT "ordenes_trabajo_subtotal_iva_check" CHECK (("subtotal_iva" >= (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo" IS 'Órdenes de trabajo. Realtime habilitado para tracking público de cambios de estado.';



COMMENT ON COLUMN "public"."ordenes_trabajo"."numero_orden" IS 'Número de orden formato GI-XXXXXX generado automáticamente';



COMMENT ON COLUMN "public"."ordenes_trabajo"."canal_venta" IS 'Canal de venta: Web, WhatsApp, Mostrador, App Mobile';



COMMENT ON COLUMN "public"."ordenes_trabajo"."estado" IS 'Estado de la orden: pendiente (inicial), en_proceso, finalizada, entregada, cancelada';



COMMENT ON COLUMN "public"."ordenes_trabajo"."fecha_entrega_real" IS 'Fecha real cuando la orden fue marcada como entregada';



COMMENT ON COLUMN "public"."ordenes_trabajo"."tracking_token" IS 'Token único de 32 caracteres para seguimiento público de la orden sin autenticación';



COMMENT ON COLUMN "public"."ordenes_trabajo"."fecha_completado" IS 'Fecha y hora en que la orden cambió a estado completado. Se establece automáticamente mediante trigger cuando el estado cambia a completado.';



COMMENT ON COLUMN "public"."ordenes_trabajo"."requiere_factura" IS 'Indica si el cliente solicitó factura para esta orden';



COMMENT ON COLUMN "public"."ordenes_trabajo"."subtotal_iva" IS 'Monto del IVA calculado (21% del subtotal con descuento)';



COMMENT ON COLUMN "public"."ordenes_trabajo"."facturada" IS 'Indica si ya se cargó el archivo de factura';



COMMENT ON COLUMN "public"."ordenes_trabajo"."fecha_facturacion" IS 'Fecha y hora en que se cargó la factura';



COMMENT ON COLUMN "public"."ordenes_trabajo"."numero_factura" IS 'Número de factura fiscal asignado';



COMMENT ON COLUMN "public"."ordenes_trabajo"."factura_storage_path" IS 'Ruta del archivo PDF en Supabase Storage';



COMMENT ON COLUMN "public"."ordenes_trabajo"."requiere_despacho" IS 'Indica si la orden requiere envío/despacho a otra localidad';



COMMENT ON CONSTRAINT "check_estado" ON "public"."ordenes_trabajo" IS 'Estados válidos: pendiente (inicial), en_proceso (producción), finalizada (completada), entregada (al cliente), cancelada';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_acabados_compartidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_trabajo_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb",
    "metodo_prorrateo" "public"."metodo_prorrateo_type" DEFAULT 'proporcional'::"public"."metodo_prorrateo_type" NOT NULL,
    "prorrateos" "jsonb" DEFAULT '{}'::"jsonb",
    "precio_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ordenes_trabajo_acabados_compartidos_precio_total_positive" CHECK (("precio_total" >= (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo_acabados_compartidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_acabados_compartidos" IS 'Acabados aplicados a nivel de orden completa con prorrateo entre items';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_acabados_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_item_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "nivel_precio_id" "uuid",
    "precio_aplicado" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_precio_acabado_positivo" CHECK (("precio_aplicado" >= (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo_acabados_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_acabados_items" IS 'Acabados aplicados a cada item';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "usuario_id" "uuid",
    "tipo_evento" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_tipo_evento" CHECK (("tipo_evento" = ANY (ARRAY['creacion'::"text", 'modificacion'::"text", 'cambio_estado'::"text", 'pago_registrado'::"text", 'nota_agregada'::"text", 'item_agregado'::"text", 'item_modificado'::"text", 'item_eliminado'::"text", 'cotizacion_enviada'::"text", 'orden_confirmada'::"text", 'orden_cancelada'::"text"])))
);


ALTER TABLE "public"."ordenes_trabajo_historial" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_historial" IS 'Registro de eventos de cada orden';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "producto_id" "uuid",
    "cantidad" numeric NOT NULL,
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "precio_base" numeric DEFAULT 0 NOT NULL,
    "precio_servicios" numeric DEFAULT 0 NOT NULL,
    "precio_acabados" numeric DEFAULT 0 NOT NULL,
    "precio_unitario_final" numeric DEFAULT 0 NOT NULL,
    "precio_total" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "producto_nombre" "text",
    "producto_categoria" "text",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "tipo_item" "text" DEFAULT 'catalogo'::"text" NOT NULL,
    "descripcion" "text",
    "tiempo_produccion_dias" integer,
    "item_grupo_id" "uuid",
    "precio_servicios_globales" numeric DEFAULT 0,
    "precio_acabados_globales" numeric DEFAULT 0,
    "servicios_globales_grupo" "jsonb",
    "acabados_globales_grupo" "jsonb",
    CONSTRAINT "check_cantidad_positiva" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "check_catalogo_requiere_producto_id" CHECK (((("tipo_item" = 'catalogo'::"text") AND ("producto_id" IS NOT NULL)) OR ("tipo_item" = 'personalizado'::"text"))),
    CONSTRAINT "check_estado_item" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'finalizado'::"text"]))),
    CONSTRAINT "check_personalizado_requiere_descripcion" CHECK ((("tipo_item" = 'catalogo'::"text") OR (("tipo_item" = 'personalizado'::"text") AND ("descripcion" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "descripcion")) > 0)))),
    CONSTRAINT "check_precio_acabados_globales_positivo" CHECK (("precio_acabados_globales" >= (0)::numeric)),
    CONSTRAINT "check_precio_acabados_positivo" CHECK (("precio_acabados" >= (0)::numeric)),
    CONSTRAINT "check_precio_base_positivo" CHECK (("precio_base" >= (0)::numeric)),
    CONSTRAINT "check_precio_servicios_globales_positivo" CHECK (("precio_servicios_globales" >= (0)::numeric)),
    CONSTRAINT "check_precio_servicios_positivo" CHECK (("precio_servicios" >= (0)::numeric)),
    CONSTRAINT "check_precio_total_positivo" CHECK (("precio_total" >= (0)::numeric)),
    CONSTRAINT "check_precio_unitario_positivo" CHECK (("precio_unitario_final" >= (0)::numeric)),
    CONSTRAINT "check_tipo_item_valido" CHECK (("tipo_item" = ANY (ARRAY['catalogo'::"text", 'personalizado'::"text"])))
);


ALTER TABLE "public"."ordenes_trabajo_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_items" IS 'Items de órdenes de trabajo. Realtime habilitado para tracking público de progreso.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."configuracion" IS 'JSON con toda la configuración del item: tecnología, tintas, material, medidas, etc.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."producto_nombre" IS 'Nombre del producto al momento de crear la orden (snapshot histórico)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."producto_categoria" IS 'Categoría del producto al momento de crear la orden (snapshot histórico)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."estado" IS 'Estado del item: pendiente (inicial), en_proceso, finalizado. Se actualiza automáticamente según el estado de los pasos de producción.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."tipo_item" IS 'Tipo de item: catalogo (producto del sistema) o personalizado (sin producto_id)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."descripcion" IS 'Descripción detallada del item. Obligatoria para items personalizados.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."tiempo_produccion_dias" IS 'Tiempo estimado de producción en días. Útil para items personalizados.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."item_grupo_id" IS 'UUID que agrupa items relacionados creados desde el mismo wizard. NULL para items individuales.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."precio_servicios_globales" IS 'Porción del precio de servicios globales asignada a este item (distribuida proporcionalmente)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."precio_acabados_globales" IS 'Porción del precio de acabados globales asignada a este item (distribuida proporcionalmente)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."servicios_globales_grupo" IS 'Array JSONB con información completa de servicios globales del grupo. Solo en el primer item del grupo.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items"."acabados_globales_grupo" IS 'Array JSONB con información completa de acabados globales del grupo. Solo en el primer item del grupo.';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_items_rutas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "orden_item_id" "uuid" NOT NULL,
    "tipo_etapa" "text" NOT NULL,
    "paso_id" "uuid",
    "paso_nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "es_modificado" boolean DEFAULT false NOT NULL,
    "origen_plantilla_id" "uuid",
    "comentario_vendedor" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estado_paso" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "fecha_inicio" timestamp with time zone,
    "fecha_fin" timestamp with time zone,
    "responsable_id" "uuid",
    "notas" "text",
    "tiempo_trabajo_efectivo" interval,
    "tiempo_pausado_total" interval,
    "cantidad_pausas" integer DEFAULT 0 NOT NULL,
    "global_task_id" "uuid",
    CONSTRAINT "check_estado_paso_item_ruta" CHECK (("estado_paso" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'completado'::"text", 'omitido'::"text", 'pausado'::"text"]))),
    CONSTRAINT "check_orden_positivo" CHECK (("orden" >= 0)),
    CONSTRAINT "check_tipo_etapa_item_ruta" CHECK (("tipo_etapa" = ANY (ARRAY['pre_prensa'::"text", 'principal'::"text", 'post_prensa'::"text", 'instalacion'::"text"])))
);


ALTER TABLE "public"."ordenes_trabajo_items_rutas" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_items_rutas" IS 'Rutas de producción por item. Realtime habilitado para tracking público en tiempo real.';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."tipo_etapa" IS 'Etapa de producción del paso: pre_prensa, principal, post_prensa, instalacion';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."es_modificado" IS 'Indica si la ruta fue modificada manualmente por el vendedor';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."origen_plantilla_id" IS 'Referencia a la plantilla original de donde se copió este paso';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."comentario_vendedor" IS 'Comentarios del vendedor para el operador de producción';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."estado_paso" IS 'Estado del paso: pendiente (inicial), en_proceso, completado, omitido';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."fecha_inicio" IS 'Fecha y hora de inicio del paso (se establece al pasar a en_proceso)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."fecha_fin" IS 'Fecha y hora de finalización del paso (se establece al completar u omitir)';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."responsable_id" IS 'Usuario responsable de ejecutar este paso';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."notas" IS 'Notas del operador sobre la ejecución del paso, justificación si fue omitido';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."tiempo_trabajo_efectivo" IS 'Tiempo real de trabajo excluyendo pausas. Calculado: (fecha_fin - fecha_inicio) - tiempo_pausado_total';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."tiempo_pausado_total" IS 'Suma de todas las duraciones de pausas registradas para este paso';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."cantidad_pausas" IS 'Contador de cuántas veces se pausó este paso. Soporta múltiples ciclos de revisión con cliente';



COMMENT ON COLUMN "public"."ordenes_trabajo_items_rutas"."global_task_id" IS 'ID para agrupar pasos de múltiples items que deben gestionarse como una tarea única (ej: Diseño compartido)';



COMMENT ON CONSTRAINT "check_tipo_etapa_item_ruta" ON "public"."ordenes_trabajo_items_rutas" IS 'Valida que tipo_etapa sea uno de los 4 valores válidos en snake_case:
   pre_prensa, principal, post_prensa, instalacion';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "url" "text" NOT NULL,
    "descripcion" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_url_valida" CHECK (("url" ~* '^https?://'::"text"))
);


ALTER TABLE "public"."ordenes_trabajo_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_links" IS 'Links externos compartidos por clientes (WeTransfer, Google Drive, etc.)';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "fecha_pago" "date" NOT NULL,
    "monto" numeric NOT NULL,
    "metodo_pago" "text",
    "referencia_pago" "text",
    "comprobante_url" "text",
    "notas" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "medio_cobro_id" "uuid",
    "comision_aplicada" numeric DEFAULT 0 NOT NULL,
    "fecha_liberacion_estimada" "date",
    CONSTRAINT "check_comision_aplicada_positiva" CHECK (("comision_aplicada" >= (0)::numeric)),
    CONSTRAINT "check_metodo_pago_o_medio_cobro" CHECK ((("medio_cobro_id" IS NOT NULL) OR ("metodo_pago" IS NOT NULL))),
    CONSTRAINT "check_monto_positivo" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo_pagos" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_pagos" IS 'Pagos realizados a cada orden';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "servicio_id" "uuid",
    "descripcion" "text" NOT NULL,
    "cantidad" integer DEFAULT 1 NOT NULL,
    "precio_unitario" numeric DEFAULT 0 NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."ordenes_trabajo_servicios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_servicios_compartidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_trabajo_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb",
    "metodo_prorrateo" "public"."metodo_prorrateo_type" DEFAULT 'proporcional'::"public"."metodo_prorrateo_type" NOT NULL,
    "prorrateos" "jsonb" DEFAULT '{}'::"jsonb",
    "precio_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ordenes_trabajo_servicios_compartidos_precio_total_positive" CHECK (("precio_total" >= (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo_servicios_compartidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_servicios_compartidos" IS 'Servicios aplicados a nivel de orden completa con prorrateo entre items';



COMMENT ON COLUMN "public"."ordenes_trabajo_servicios_compartidos"."configuracion" IS 'Almacena la configuración del servicio (ej: niveles seleccionados, valores adicionales)';



COMMENT ON COLUMN "public"."ordenes_trabajo_servicios_compartidos"."metodo_prorrateo" IS 'Método de distribución del costo: proporcional (por precio), uniforme (partes iguales), manual (personalizado)';



COMMENT ON COLUMN "public"."ordenes_trabajo_servicios_compartidos"."prorrateos" IS 'JSON con la distribución calculada: { "item_id": monto_prorrateado, ... }';



CREATE TABLE IF NOT EXISTS "public"."ordenes_trabajo_servicios_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_item_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "nivel_precio_id" "uuid",
    "precio_aplicado" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_precio_servicio_positivo" CHECK (("precio_aplicado" >= (0)::numeric))
);


ALTER TABLE "public"."ordenes_trabajo_servicios_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."ordenes_trabajo_servicios_items" IS 'Servicios aplicados a cada item';



CREATE TABLE IF NOT EXISTS "public"."pasos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "etapa" "text" NOT NULL,
    "estacion_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_etapa" CHECK (("etapa" = ANY (ARRAY['Pre-prensa'::"text", 'Produccion'::"text", 'Terminacion'::"text", 'Instalacion'::"text"])))
);


ALTER TABLE "public"."pasos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pasos_motivos_pausa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "requiere_descripcion" boolean DEFAULT false NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text",
    "icono" "text",
    "orden" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pasos_motivos_pausa_categoria_check" CHECK (("categoria" = ANY (ARRAY['cliente'::"text", 'materiales'::"text", 'maquinaria'::"text", 'personal'::"text", 'externo'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."pasos_motivos_pausa" OWNER TO "postgres";


COMMENT ON TABLE "public"."pasos_motivos_pausa" IS 'Catálogo de motivos de pausa configurables por empresa para pasos de producción';



COMMENT ON COLUMN "public"."pasos_motivos_pausa"."categoria" IS 'Categoría del motivo: cliente, materiales, maquinaria, personal, externo, otro';



COMMENT ON COLUMN "public"."pasos_motivos_pausa"."requiere_descripcion" IS 'Si TRUE, el operador debe proporcionar una descripción al pausar';



COMMENT ON COLUMN "public"."pasos_motivos_pausa"."color" IS 'Color hex para UI (#RRGGBB)';



COMMENT ON COLUMN "public"."pasos_motivos_pausa"."orden" IS 'Orden de visualización en listas y selectores';



CREATE TABLE IF NOT EXISTS "public"."pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_pedido" "text" NOT NULL,
    "cantidad" integer DEFAULT 1 NOT NULL,
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "fecha_pedido" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_entrega_estimada" "date",
    "fecha_entrega_real" "date",
    "opciones_seleccionadas" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notas" "text",
    "precio_total" numeric(12,2),
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_cantidad_positiva" CHECK (("cantidad" > 0)),
    CONSTRAINT "check_estado_pedido" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'confirmado'::"text", 'en_produccion'::"text", 'completado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "check_fechas_coherentes" CHECK ((("fecha_entrega_estimada" IS NULL) OR ("fecha_entrega_estimada" >= "fecha_pedido")))
);


ALTER TABLE "public"."pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos_opciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "tipo_opcion" "text" NOT NULL,
    "opcion_id" "uuid" NOT NULL,
    "opcion_nombre" "text" NOT NULL,
    "tiene_nivel" boolean DEFAULT false NOT NULL,
    "nivel_id" "uuid",
    "nivel_nombre" "text",
    "valores_adicionales" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_nivel_coherencia" CHECK ((("tiene_nivel" = false) OR (("tiene_nivel" = true) AND ("nivel_id" IS NOT NULL) AND ("nivel_nombre" IS NOT NULL)))),
    CONSTRAINT "check_tipo_opcion" CHECK (("tipo_opcion" = ANY (ARRAY['servicio'::"text", 'acabado'::"text", 'tecnologia'::"text", 'material'::"text"])))
);


ALTER TABLE "public"."pedidos_opciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos_rutas_resueltas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "tipo_etapa" "text" NOT NULL,
    "paso_id" "uuid",
    "paso_nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "estado_paso" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "origen_condicion" "jsonb" DEFAULT '{}'::"jsonb",
    "fecha_inicio" timestamp with time zone,
    "fecha_fin" timestamp with time zone,
    "responsable_id" "uuid",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_estado_paso" CHECK (("estado_paso" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'completado'::"text", 'omitido'::"text"]))),
    CONSTRAINT "check_fechas_paso_coherentes" CHECK ((("fecha_inicio" IS NULL) OR ("fecha_fin" IS NULL) OR ("fecha_fin" >= "fecha_inicio"))),
    CONSTRAINT "check_tipo_etapa_rutas_resueltas" CHECK (("tipo_etapa" = ANY (ARRAY['pre_prensa'::"text", 'principal'::"text", 'post_prensa'::"text"])))
);


ALTER TABLE "public"."pedidos_rutas_resueltas" OWNER TO "postgres";


COMMENT ON TABLE "public"."pedidos_rutas_resueltas" IS 'Rutas de producción resueltas para cada pedido. Almacena la secuencia de pasos específica que se ejecutará para producir cada pedido.';



CREATE TABLE IF NOT EXISTS "public"."presupuestos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_presupuesto" "text" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "canal_venta" "text" NOT NULL,
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_validez" timestamp with time zone,
    "fecha_enviado" timestamp with time zone,
    "fecha_respuesta" timestamp with time zone,
    "fecha_vencimiento_auto" timestamp with time zone,
    "tracking_token" character varying(32),
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "total_descuentos" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "condiciones_comerciales" "text",
    "notas_internas" "text",
    "observaciones_cliente" "text",
    "orden_trabajo_id" "uuid",
    "pdf_path" "text",
    "pdf_url" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_entrega_estimada" timestamp with time zone,
    CONSTRAINT "check_fecha_validez" CHECK ((("fecha_validez" IS NULL) OR ("fecha_validez" > "fecha_creacion"))),
    CONSTRAINT "check_subtotal_positivo" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "check_total_positivo" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "check_tracking_token_format" CHECK ((("tracking_token" IS NULL) OR (("length"(("tracking_token")::"text") = 32) AND (("tracking_token")::"text" ~ '^[A-Z0-9]{32}$'::"text")))),
    CONSTRAINT "presupuestos_canal_venta_check" CHECK (("canal_venta" = ANY (ARRAY['Web'::"text", 'WhatsApp'::"text", 'Mostrador'::"text", 'App Mobile'::"text"]))),
    CONSTRAINT "presupuestos_estado_check" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'pendiente'::"text", 'enviado'::"text", 'aprobado'::"text", 'rechazado'::"text", 'convertido'::"text", 'vencido'::"text"])))
);


ALTER TABLE "public"."presupuestos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."presupuestos"."canal_venta" IS 'Canal de venta: Web, WhatsApp, Mostrador, App Mobile';



COMMENT ON COLUMN "public"."presupuestos"."fecha_entrega_estimada" IS 'Fecha estimada de entrega si se convierte en orden de trabajo';



CREATE TABLE IF NOT EXISTS "public"."presupuestos_acabados_compartidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb",
    "metodo_prorrateo" "public"."metodo_prorrateo_type" DEFAULT 'proporcional'::"public"."metodo_prorrateo_type" NOT NULL,
    "prorrateos" "jsonb" DEFAULT '{}'::"jsonb",
    "precio_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "presupuestos_acabados_compartidos_precio_total_positive" CHECK (("precio_total" >= (0)::numeric))
);


ALTER TABLE "public"."presupuestos_acabados_compartidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."presupuestos_acabados_compartidos" IS 'Acabados aplicados a nivel de presupuesto completo con prorrateo entre items';



CREATE TABLE IF NOT EXISTS "public"."presupuestos_archivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "nombre_archivo" "text" NOT NULL,
    "nombre_storage" "text" NOT NULL,
    "tipo_mime" "text" NOT NULL,
    "tamano_bytes" bigint NOT NULL,
    "storage_path" "text" NOT NULL,
    "descripcion" "text",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "presupuesto_temporal_id" "uuid",
    "temporal_creado_en" timestamp with time zone,
    CONSTRAINT "check_presupuesto_o_temporal" CHECK ((("presupuesto_id" IS NOT NULL) OR ("presupuesto_temporal_id" IS NOT NULL)))
);


ALTER TABLE "public"."presupuestos_archivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presupuestos_condiciones_comerciales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "contenido" "text" NOT NULL,
    "es_default" boolean DEFAULT false,
    "orden" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."presupuestos_condiciones_comerciales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presupuestos_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid" NOT NULL,
    "accion" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_nuevo" "text",
    "usuario_id" "uuid",
    "detalles" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."presupuestos_historial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presupuestos_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid" NOT NULL,
    "tipo_item" "text" DEFAULT 'producto_sistema'::"text" NOT NULL,
    "producto_id" "uuid",
    "producto_nombre" "text" NOT NULL,
    "producto_categoria" "text",
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cantidad" numeric NOT NULL,
    "precio_base" numeric DEFAULT 0 NOT NULL,
    "precio_servicios" numeric DEFAULT 0 NOT NULL,
    "precio_acabados" numeric DEFAULT 0 NOT NULL,
    "precio_unitario_final" numeric,
    "precio_total" numeric,
    "descripcion" "text",
    "tiempo_produccion_dias" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_cantidad_positiva" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "check_precios_positivos" CHECK ((("precio_base" >= (0)::numeric) AND ("precio_servicios" >= (0)::numeric) AND ("precio_acabados" >= (0)::numeric) AND (("precio_unitario_final" IS NULL) OR ("precio_unitario_final" >= (0)::numeric)) AND (("precio_total" IS NULL) OR ("precio_total" >= (0)::numeric)))),
    CONSTRAINT "check_producto_sistema" CHECK (((("tipo_item" = 'producto_sistema'::"text") AND ("producto_id" IS NOT NULL)) OR (("tipo_item" = 'item_personalizado'::"text") AND ("producto_id" IS NULL)))),
    CONSTRAINT "presupuestos_items_tipo_item_check" CHECK (("tipo_item" = ANY (ARRAY['producto_sistema'::"text", 'item_personalizado'::"text"])))
);


ALTER TABLE "public"."presupuestos_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."presupuestos_items"."precio_unitario_final" IS 'Precio unitario final. NULL indica que el item está pendiente de cotización';



COMMENT ON COLUMN "public"."presupuestos_items"."precio_total" IS 'Precio total del item (cantidad * precio_unitario_final). NULL indica pendiente de cotización';



CREATE TABLE IF NOT EXISTS "public"."presupuestos_servicios_compartidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "configuracion" "jsonb" DEFAULT '{}'::"jsonb",
    "metodo_prorrateo" "public"."metodo_prorrateo_type" DEFAULT 'proporcional'::"public"."metodo_prorrateo_type" NOT NULL,
    "prorrateos" "jsonb" DEFAULT '{}'::"jsonb",
    "precio_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "presupuestos_servicios_compartidos_precio_total_positive" CHECK (("precio_total" >= (0)::numeric))
);


ALTER TABLE "public"."presupuestos_servicios_compartidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."presupuestos_servicios_compartidos" IS 'Servicios aplicados a nivel de presupuesto completo con prorrateo entre items';



CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "medidas_ancho" numeric NOT NULL,
    "medidas_alto" numeric NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_medida" "text" DEFAULT 'medida_unica'::"text" NOT NULL,
    "medidas_disponibles" "jsonb",
    "caras_impresas" "text"[] DEFAULT ARRAY['solo_frente'::"text"] NOT NULL,
    "producto_impreso" boolean DEFAULT false NOT NULL,
    "ancho_maximo" numeric,
    CONSTRAINT "check_caras_impresas_not_empty" CHECK (("array_length"("caras_impresas", 1) > 0)),
    CONSTRAINT "check_caras_impresas_valid_values" CHECK (("caras_impresas" <@ ARRAY['solo_frente'::"text", 'frente_y_dorso'::"text"])),
    CONSTRAINT "check_medida_unica_positivas" CHECK ((("tipo_medida" <> 'medida_unica'::"text") OR (("medidas_ancho" > (0)::numeric) AND ("medidas_alto" > (0)::numeric)))),
    CONSTRAINT "check_medidas_multiples_not_empty" CHECK ((("tipo_medida" <> 'medidas_multiples'::"text") OR (("medidas_disponibles" IS NOT NULL) AND ("jsonb_array_length"("medidas_disponibles") > 0)))),
    CONSTRAINT "check_tipo_medida" CHECK (("tipo_medida" = ANY (ARRAY['medida_unica'::"text", 'medidas_multiples'::"text"])))
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."productos"."medidas_ancho" IS 'Ancho en mm. Para Gran Formato: ancho máximo de trabajo. Para Materiales Rígidos: ancho de placa';



COMMENT ON COLUMN "public"."productos"."medidas_alto" IS 'Alto en mm. Para Gran Formato: alto de trabajo. Para Materiales Rígidos: alto de placa';



COMMENT ON COLUMN "public"."productos"."tipo_medida" IS 'Tipo de configuración de medidas: medida_unica (default y Gran Formato), medidas_multiples (Impresión Laser)';



COMMENT ON COLUMN "public"."productos"."medidas_disponibles" IS 'Array de combinaciones {ancho, alto} para tipo_medida = medidas_multiples (Impresión Laser)';



COMMENT ON COLUMN "public"."productos"."caras_impresas" IS 'Opciones de impresión disponibles para el producto: solo_frente, frente_y_dorso, o ambas';



COMMENT ON COLUMN "public"."productos"."producto_impreso" IS 'Indica si el producto se vende ya impreso (true) o solo es apto para impresión (false)';



COMMENT ON COLUMN "public"."productos"."ancho_maximo" IS 'Ancho máximo en cm para productos con pricing por MT Lineal';



CREATE TABLE IF NOT EXISTS "public"."productos_acabados_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_tipo" "text" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_producto_tipo_acabados" CHECK (("producto_tipo" = ANY (ARRAY['laser'::"text", 'gran_formato'::"text", 'materiales_rigidos'::"text"])))
);


ALTER TABLE "public"."productos_acabados_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_acabados_v2" IS 'Relación polimórfica entre productos (cualquier tipo) y acabados disponibles';



COMMENT ON COLUMN "public"."productos_acabados_v2"."producto_tipo" IS 'Tipo de producto: laser, gran_formato, materiales_rigidos';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_venta" "text" NOT NULL,
    "anchos_disponibles" integer[] DEFAULT ARRAY[]::integer[],
    "impuesto_iva" numeric(5,2) NOT NULL,
    "rango_precio_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ruta_produccion_id" "uuid",
    "cantidad_minima" numeric(10,2),
    CONSTRAINT "check_anchos_disponibles_valid" CHECK (((("tipo_venta" = 'mt2'::"text") AND ("anchos_disponibles" = ARRAY[]::integer[])) OR (("tipo_venta" = 'mt_lineal'::"text") AND ("array_length"("anchos_disponibles", 1) = 1)))),
    CONSTRAINT "check_cantidad_minima_positiva_gran_formato" CHECK ((("cantidad_minima" IS NULL) OR ("cantidad_minima" > (0)::numeric))),
    CONSTRAINT "check_impuesto_iva_gran_formato" CHECK ((("impuesto_iva" >= (0)::numeric) AND ("impuesto_iva" <= (100)::numeric))),
    CONSTRAINT "productos_gran_formato_tipo_venta_check" CHECK (("tipo_venta" = ANY (ARRAY['mt2'::"text", 'mt_lineal'::"text"])))
);


ALTER TABLE "public"."productos_gran_formato" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato" IS 'Productos de impresión gran formato con configuraciones específicas para venta por m2 o metro lineal';



COMMENT ON COLUMN "public"."productos_gran_formato"."tipo_venta" IS 'Tipo de venta: mt2 (metros cuadrados) o mt_lineal (metros lineales)';



COMMENT ON COLUMN "public"."productos_gran_formato"."anchos_disponibles" IS 'Ancho disponible en cm (solo para tipo_venta mt_lineal). Debe contener exactamente un valor. Valores típicos: 30, 60, 120, 160';



COMMENT ON COLUMN "public"."productos_gran_formato"."rango_precio_id" IS 'Rango de precios asociado (opcional). Debe coincidir con la unidad_medida del tipo_venta';



COMMENT ON COLUMN "public"."productos_gran_formato"."cantidad_minima" IS 'Cantidad mínima a cobrar en mt2 (si tipo_venta=mt2) o metros lineales (si tipo_venta=mt_lineal). Si el cliente solicita menos, se factura esta cantidad mínima.';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_gran_formato_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_gran_formato_acabados" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato_acabados" IS 'Relación entre productos de gran formato y acabados disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato_materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_gran_formato_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesor" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_gran_formato_materiales" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato_materiales" IS 'Relación entre productos de gran formato y materiales con variantes y espesores';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_gran_formato_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "tinta" "text" NOT NULL,
    "rango_precio_min" numeric(10,2) NOT NULL,
    "rango_precio_max" numeric(10,2) NOT NULL,
    "precio" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_precio_positivo" CHECK (("precio" >= (0)::numeric)),
    CONSTRAINT "check_rango_valido" CHECK (("rango_precio_min" <= "rango_precio_max"))
);


ALTER TABLE "public"."productos_gran_formato_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato_precios" IS 'Almacena los precios base para productos de gran formato por combinación de producto, tecnología, tinta y rango';



COMMENT ON COLUMN "public"."productos_gran_formato_precios"."tinta" IS 'Tipo de tinta utilizada (ej: K, CMYK, CMYK+W, CMYK+W+V)';



COMMENT ON COLUMN "public"."productos_gran_formato_precios"."rango_precio_min" IS 'Valor mínimo del rango en la unidad de medida correspondiente (m², metro lineal)';



COMMENT ON COLUMN "public"."productos_gran_formato_precios"."rango_precio_max" IS 'Valor máximo del rango en la unidad de medida correspondiente (m², metro lineal)';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_gran_formato_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_gran_formato_servicios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato_servicios" IS 'Relación entre productos de gran formato y servicios adicionales disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_gran_formato_tecnologias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_gran_formato_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "tintas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_gran_formato_tecnologias" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_gran_formato_tecnologias" IS 'Relación entre productos de gran formato y tecnologías con sus tintas seleccionadas';



COMMENT ON COLUMN "public"."productos_gran_formato_tecnologias"."tintas" IS 'Array de tintas disponibles para esta tecnología (ej: K, CMYK, CMYK+W)';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "medidas_disponibles" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "caras_impresas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "producto_impreso" boolean DEFAULT true NOT NULL,
    "tipo_venta" "text" NOT NULL,
    "cantidades_fijas" integer[] DEFAULT ARRAY[]::integer[],
    "impuesto_iva" numeric(5,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ruta_produccion_id" "uuid",
    "rango_precio_id" "uuid",
    CONSTRAINT "check_caras_impresas" CHECK (("caras_impresas" <@ ARRAY['solo_frente'::"text", 'frente_y_dorso'::"text"])),
    CONSTRAINT "check_impuesto_iva" CHECK ((("impuesto_iva" >= (0)::numeric) AND ("impuesto_iva" <= (100)::numeric))),
    CONSTRAINT "productos_impresion_laser_tipo_venta_check" CHECK (("tipo_venta" = ANY (ARRAY['unidades'::"text", 'cantidades_fijas'::"text"])))
);


ALTER TABLE "public"."productos_impresion_laser" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser" IS 'Productos de impresión láser con todas sus configuraciones específicas';



COMMENT ON COLUMN "public"."productos_impresion_laser"."rango_precio_id" IS 'ID del rango de precios asociado. Obligatorio si tipo_venta = unidades, debe ser NULL si tipo_venta = cantidades_fijas';



COMMENT ON CONSTRAINT "productos_impresion_laser_tipo_venta_check" ON "public"."productos_impresion_laser" IS 'Tipo de venta para productos láser: unidades o cantidades_fijas (medidas no aplica para esta categoría)';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_laser_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_impresion_laser_acabados" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser_acabados" IS 'Relación entre productos de impresión láser y acabados disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser_materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_laser_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesor" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_impresion_laser_materiales" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser_materiales" IS 'Relación entre productos de impresión láser y materiales con variantes y espesores';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_laser_id" "uuid" NOT NULL,
    "medida_ancho" numeric(10,2) NOT NULL,
    "medida_alto" numeric(10,2) NOT NULL,
    "cantidad" integer,
    "cara_impresa" "text" NOT NULL,
    "precio" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tinta" "text" NOT NULL,
    "rango_precio_min" numeric(10,2),
    "rango_precio_max" numeric(10,2),
    CONSTRAINT "check_cantidad_positiva" CHECK (("cantidad" > 0)),
    CONSTRAINT "check_medida_alto_positivo" CHECK (("medida_alto" > (0)::numeric)),
    CONSTRAINT "check_medida_ancho_positivo" CHECK (("medida_ancho" > (0)::numeric)),
    CONSTRAINT "check_precio_positivo" CHECK (("precio" > (0)::numeric)),
    CONSTRAINT "check_precio_usa_cantidad_o_rango" CHECK (((("cantidad" IS NOT NULL) AND ("rango_precio_min" IS NULL) AND ("rango_precio_max" IS NULL)) OR (("cantidad" IS NULL) AND ("rango_precio_min" IS NOT NULL)))),
    CONSTRAINT "check_tinta_valida_precios" CHECK (("tinta" = ANY (ARRAY['K'::"text", 'CMYK'::"text", 'CMYK+W'::"text", 'CMYK+V'::"text", 'CMYK+W+V'::"text"]))),
    CONSTRAINT "productos_impresion_laser_precios_cara_impresa_check" CHECK (("cara_impresa" = ANY (ARRAY['solo_frente'::"text", 'frente_y_dorso'::"text"])))
);


ALTER TABLE "public"."productos_impresion_laser_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser_precios" IS 'Precios base para productos de impresión láser por configuración específica (medida, tinta, cantidad, cara)';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."medida_ancho" IS 'Ancho de la medida en milímetros';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."medida_alto" IS 'Alto de la medida en milímetros';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."cantidad" IS 'Cantidad específica para tipo_venta cantidades_fijas. NULL cuando se usan rangos';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."cara_impresa" IS 'Opción de impresión: solo_frente o frente_y_dorso';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."precio" IS 'Precio unitario base para esta configuración específica';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."tinta" IS 'Código de tinta (K, CMYK, CMYK+W, CMYK+V, CMYK+W+V)';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."rango_precio_min" IS 'Mínimo del rango de cantidades para tipo_venta unidades. NULL cuando se usan cantidades fijas';



COMMENT ON COLUMN "public"."productos_impresion_laser_precios"."rango_precio_max" IS 'Máximo del rango de cantidades (NULL = infinito) para tipo_venta unidades';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_laser_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_impresion_laser_servicios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser_servicios" IS 'Relación entre productos de impresión láser y servicios adicionales disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_impresion_laser_tecnologias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_laser_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tintas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL
);


ALTER TABLE "public"."productos_impresion_laser_tecnologias" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_impresion_laser_tecnologias" IS 'Relación entre productos de impresión láser y tecnologías con sus tintas seleccionadas';



COMMENT ON COLUMN "public"."productos_impresion_laser_tecnologias"."tintas" IS 'Array de códigos de tintas seleccionadas para este producto (K, CMYK, etc)';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesores" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_materiales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_materiales_rigidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "medidas_ancho" numeric(10,2) NOT NULL,
    "medidas_alto" numeric(10,2) NOT NULL,
    "tipo_venta" "text" DEFAULT 'mt2'::"text" NOT NULL,
    "rango_precio_id" "uuid",
    "impuesto_iva" numeric(5,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ruta_produccion_id" "uuid",
    "cantidad_minima" numeric(10,2),
    CONSTRAINT "check_cantidad_minima_positiva_materiales_rigidos" CHECK ((("cantidad_minima" IS NULL) OR ("cantidad_minima" > (0)::numeric))),
    CONSTRAINT "check_materiales_rigidos_impuesto_iva" CHECK ((("impuesto_iva" >= (0)::numeric) AND ("impuesto_iva" <= (100)::numeric))),
    CONSTRAINT "check_materiales_rigidos_medidas_positivas" CHECK ((("medidas_ancho" > (0)::numeric) AND ("medidas_alto" > (0)::numeric))),
    CONSTRAINT "check_materiales_rigidos_tipo_venta" CHECK (("tipo_venta" = 'mt2'::"text"))
);


ALTER TABLE "public"."productos_materiales_rigidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_rigidos" IS 'Productos de Materiales Rígidos con dimensiones de materia prima y venta por metros cuadrados';



COMMENT ON COLUMN "public"."productos_materiales_rigidos"."cantidad_minima" IS 'Cantidad mínima a cobrar en metros cuadrados (mt2). Si el cliente solicita menos, se factura esta cantidad mínima.';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales_rigidos_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_materiales_rigidos_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_materiales_rigidos_acabados" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_rigidos_acabados" IS 'Relación entre productos de materiales rígidos y acabados disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales_rigidos_materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_materiales_rigidos_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesores" numeric[] DEFAULT ARRAY[]::numeric[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "espesor" numeric(10,2),
    CONSTRAINT "check_pmr_materiales_espesor_positivo" CHECK ((("espesor" IS NULL) OR ("espesor" > (0)::numeric)))
);


ALTER TABLE "public"."productos_materiales_rigidos_materiales" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_rigidos_materiales" IS 'Relación entre productos de materiales rígidos y materiales. Cada registro representa una combinación única de variante y espesor (o sin espesor si el material no lo requiere).';



COMMENT ON COLUMN "public"."productos_materiales_rigidos_materiales"."espesores" IS 'DEPRECATED: Array de espesores. Usar columna espesor (singular) en su lugar. Se mantiene por compatibilidad.';



COMMENT ON COLUMN "public"."productos_materiales_rigidos_materiales"."espesor" IS 'Espesor individual en mm para esta combinación. NULL cuando el material no aplica espesor.';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales_rigidos_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_materiales_rigidos_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesores" numeric[] DEFAULT ARRAY[]::numeric[] NOT NULL,
    "medida_placa_ancho" numeric(10,2) NOT NULL,
    "medida_placa_alto" numeric(10,2) NOT NULL,
    "precio_placa" numeric(10,2) NOT NULL,
    "precio_mt2" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "espesor" numeric(10,2),
    CONSTRAINT "check_pmr_precios_espesor_positivo" CHECK ((("espesor" IS NULL) OR ("espesor" > (0)::numeric))),
    CONSTRAINT "check_pmr_precios_medidas_positivas" CHECK ((("medida_placa_ancho" > (0)::numeric) AND ("medida_placa_alto" > (0)::numeric))),
    CONSTRAINT "check_pmr_precios_precio_mt2_positivo" CHECK (("precio_mt2" > (0)::numeric)),
    CONSTRAINT "check_pmr_precios_precio_placa_positivo" CHECK (("precio_placa" > (0)::numeric))
);


ALTER TABLE "public"."productos_materiales_rigidos_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_rigidos_precios" IS 'Precios de productos de materiales rígidos. Cada registro representa el precio para una combinación específica de producto, material, variante y espesor (o sin espesor según el material).';



COMMENT ON COLUMN "public"."productos_materiales_rigidos_precios"."espesores" IS 'DEPRECATED: Array de espesores. Usar columna espesor (singular) en su lugar. Se mantiene por compatibilidad.';



COMMENT ON COLUMN "public"."productos_materiales_rigidos_precios"."espesor" IS 'Espesor específico en mm para este precio. NULL cuando el material no aplica espesor.';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales_rigidos_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_materiales_rigidos_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_materiales_rigidos_servicios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_rigidos_servicios" IS 'Relación entre productos de materiales rígidos y servicios adicionales disponibles';



CREATE TABLE IF NOT EXISTS "public"."productos_materiales_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_tipo" "text" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesores" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_producto_tipo_materiales" CHECK (("producto_tipo" = ANY (ARRAY['laser'::"text", 'gran_formato'::"text", 'materiales_rigidos'::"text"])))
);


ALTER TABLE "public"."productos_materiales_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_materiales_v2" IS 'Relación polimórfica entre productos (cualquier tipo) y materiales con variantes';



COMMENT ON COLUMN "public"."productos_materiales_v2"."producto_tipo" IS 'Tipo de producto: laser, gran_formato, materiales_rigidos';



CREATE TABLE IF NOT EXISTS "public"."productos_plotter_corte" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "unidad_venta" "text" DEFAULT 'mt_lineal'::"text" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesor" numeric,
    "anchos_disponibles" numeric[] DEFAULT '{}'::numeric[] NOT NULL,
    "cantidad_minima" numeric,
    "color" "text" NOT NULL,
    "marca" "text",
    "impuesto_iva" numeric DEFAULT 21 NOT NULL,
    "rango_precio_id" "uuid",
    "ruta_produccion_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_plotter_corte_anchos_disponibles" CHECK (("array_length"("anchos_disponibles", 1) > 0)),
    CONSTRAINT "check_plotter_corte_cantidad_minima_positiva" CHECK ((("cantidad_minima" IS NULL) OR ("cantidad_minima" > (0)::numeric))),
    CONSTRAINT "check_plotter_corte_color" CHECK (("color" = ANY (ARRAY['Blanco'::"text", 'Negro'::"text", 'Color'::"text", 'Esmerilado Gris'::"text", 'Esmerilado Blanco'::"text", 'Otro'::"text"]))),
    CONSTRAINT "check_plotter_corte_espesor_positivo" CHECK ((("espesor" IS NULL) OR ("espesor" > (0)::numeric))),
    CONSTRAINT "check_plotter_corte_impuesto_positivo" CHECK (("impuesto_iva" > (0)::numeric)),
    CONSTRAINT "check_plotter_corte_marca" CHECK ((("marca" IS NULL) OR ("marca" = ANY (ARRAY['Avery'::"text", 'Oracal'::"text", 'Ritrama'::"text", 'McCal'::"text", 'Orajet'::"text", 'Importado'::"text"])))),
    CONSTRAINT "check_plotter_corte_unidad_venta" CHECK (("unidad_venta" = 'mt_lineal'::"text"))
);


ALTER TABLE "public"."productos_plotter_corte" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_plotter_corte" IS 'Productos para plotter de corte. Unidad de venta fija en metros lineales.';



COMMENT ON COLUMN "public"."productos_plotter_corte"."unidad_venta" IS 'Unidad de venta fija: mt_lineal (metros lineales)';



COMMENT ON COLUMN "public"."productos_plotter_corte"."espesor" IS 'Espesor del material en milímetros (opcional, solo si aplica)';



COMMENT ON COLUMN "public"."productos_plotter_corte"."anchos_disponibles" IS 'Array de anchos disponibles en centímetros. Valores posibles: 30, 50, 60, 120';



COMMENT ON COLUMN "public"."productos_plotter_corte"."cantidad_minima" IS 'Cantidad mínima a cobrar en metros lineales';



COMMENT ON COLUMN "public"."productos_plotter_corte"."color" IS 'Color del producto: "Blanco o Negro" o "Color"';



COMMENT ON COLUMN "public"."productos_plotter_corte"."marca" IS 'Marca opcional del producto: Avery, Oracal, Ritrama, McCal, Orajet, Importado';



CREATE TABLE IF NOT EXISTS "public"."productos_plotter_corte_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_plotter_corte_acabados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_plotter_corte_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "ancho" numeric NOT NULL,
    "cantidad_desde" numeric NOT NULL,
    "cantidad_hasta" numeric,
    "precio" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_plotter_corte_ancho_valido" CHECK (("ancho" = ANY (ARRAY[(30)::numeric, (50)::numeric, (60)::numeric, (120)::numeric]))),
    CONSTRAINT "check_plotter_corte_cantidad_desde_positiva" CHECK (("cantidad_desde" > (0)::numeric)),
    CONSTRAINT "check_plotter_corte_cantidad_hasta_mayor" CHECK ((("cantidad_hasta" IS NULL) OR ("cantidad_hasta" > "cantidad_desde"))),
    CONSTRAINT "check_plotter_corte_precio_positivo" CHECK (("precio" > (0)::numeric))
);


ALTER TABLE "public"."productos_plotter_corte_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_plotter_corte_precios" IS 'Precios para productos de plotter de corte organizados por ancho y rangos de cantidad en metros lineales.';



COMMENT ON COLUMN "public"."productos_plotter_corte_precios"."ancho" IS 'Ancho en centímetros. Debe coincidir con uno de los anchos disponibles del producto.';



COMMENT ON COLUMN "public"."productos_plotter_corte_precios"."cantidad_desde" IS 'Cantidad mínima en metros lineales para aplicar este precio.';



COMMENT ON COLUMN "public"."productos_plotter_corte_precios"."cantidad_hasta" IS 'Cantidad máxima en metros lineales para aplicar este precio. NULL indica sin límite superior.';



COMMENT ON COLUMN "public"."productos_plotter_corte_precios"."precio" IS 'Precio por metro lineal para este ancho y rango de cantidad.';



CREATE TABLE IF NOT EXISTS "public"."productos_plotter_corte_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_plotter_corte_servicios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_portabanners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "ancho_cm" numeric NOT NULL,
    "alto_cm" numeric NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "tintas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "impuesto_iva" numeric DEFAULT 21 NOT NULL,
    "rango_precio_id" "uuid",
    "ruta_produccion_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_portabanner_alto_positivo" CHECK (("alto_cm" > (0)::numeric)),
    CONSTRAINT "check_portabanner_ancho_positivo" CHECK (("ancho_cm" > (0)::numeric)),
    CONSTRAINT "check_portabanner_impuesto_positivo" CHECK ((("impuesto_iva" >= (0)::numeric) AND ("impuesto_iva" <= (100)::numeric))),
    CONSTRAINT "check_portabanner_tintas_no_vacio" CHECK (("array_length"("tintas", 1) > 0))
);


ALTER TABLE "public"."productos_portabanners" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_portabanners" IS 'Productos de portabanners con medidas personalizadas (ancho x alto) y tecnología de impresión';



COMMENT ON COLUMN "public"."productos_portabanners"."ancho_cm" IS 'Ancho del portabanner en centímetros';



COMMENT ON COLUMN "public"."productos_portabanners"."alto_cm" IS 'Alto del portabanner en centímetros';



COMMENT ON COLUMN "public"."productos_portabanners"."tintas" IS 'Array de tintas seleccionadas para la tecnología de impresión (ej: CMYK, K, CMYK+W)';



CREATE TABLE IF NOT EXISTS "public"."productos_portabanners_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_portabanners_acabados" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_portabanners_acabados" IS 'Relación entre productos portabanners y acabados adicionales';



CREATE TABLE IF NOT EXISTS "public"."productos_portabanners_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "ancho_cm" numeric NOT NULL,
    "alto_cm" numeric NOT NULL,
    "cantidad_desde" numeric NOT NULL,
    "cantidad_hasta" numeric,
    "precio" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tecnologia_id" "uuid",
    CONSTRAINT "check_portabanners_alto_positivo" CHECK (("alto_cm" > (0)::numeric)),
    CONSTRAINT "check_portabanners_ancho_positivo" CHECK (("ancho_cm" > (0)::numeric)),
    CONSTRAINT "check_portabanners_cantidad_desde_positiva" CHECK (("cantidad_desde" > (0)::numeric)),
    CONSTRAINT "check_portabanners_cantidad_hasta_valida" CHECK ((("cantidad_hasta" IS NULL) OR ("cantidad_hasta" >= "cantidad_desde"))),
    CONSTRAINT "check_portabanners_precio_positivo" CHECK (("precio" >= (0)::numeric))
);


ALTER TABLE "public"."productos_portabanners_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_portabanners_precios" IS 'Almacena los precios para productos portabanners por combinación de producto, medidas y rango de cantidad';



COMMENT ON COLUMN "public"."productos_portabanners_precios"."ancho_cm" IS 'Ancho del portabanner en centímetros';



COMMENT ON COLUMN "public"."productos_portabanners_precios"."alto_cm" IS 'Alto del portabanner en centímetros';



COMMENT ON COLUMN "public"."productos_portabanners_precios"."cantidad_desde" IS 'Cantidad mínima del rango (unidades)';



COMMENT ON COLUMN "public"."productos_portabanners_precios"."cantidad_hasta" IS 'Cantidad máxima del rango (unidades). NULL indica infinito';



COMMENT ON COLUMN "public"."productos_portabanners_precios"."tecnologia_id" IS 'Tecnología específica para este precio. Permite precios diferenciados por tecnología.';



CREATE TABLE IF NOT EXISTS "public"."productos_portabanners_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_portabanners_servicios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_portabanners_servicios" IS 'Relación entre productos portabanners y servicios adicionales';



CREATE TABLE IF NOT EXISTS "public"."productos_portabanners_tecnologias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_portabanners_tecnologias" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_portabanners_tecnologias" IS 'Relación muchos-a-muchos entre productos portabanners y tecnologías de impresión';



CREATE TABLE IF NOT EXISTS "public"."productos_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "unidad_pricing" "text" NOT NULL,
    "tiene_descuento" boolean DEFAULT false NOT NULL,
    "cantidades_fijas" "jsonb" DEFAULT '[]'::"jsonb",
    "rango_precio_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_unidad_pricing" CHECK (("unidad_pricing" = ANY (ARRAY['por_unidad'::"text", 'cantidades_fijas'::"text", 'mt2'::"text", 'mt_lineal'::"text"])))
);


ALTER TABLE "public"."productos_pricing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_rutas_produccion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "tipo_etapa" "text" NOT NULL,
    "paso_id" "uuid",
    "grupo_paso_id" "uuid",
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_paso_o_grupo_ruta" CHECK (((("paso_id" IS NOT NULL) AND ("grupo_paso_id" IS NULL)) OR (("paso_id" IS NULL) AND ("grupo_paso_id" IS NOT NULL)))),
    CONSTRAINT "check_tipo_etapa" CHECK (("tipo_etapa" = ANY (ARRAY['pre_prensa'::"text", 'principal'::"text", 'post_prensa'::"text"])))
);


ALTER TABLE "public"."productos_rutas_produccion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_rutas_produccion_backup" (
    "id" "uuid",
    "producto_id" "uuid",
    "tipo_etapa" "text",
    "paso_id" "uuid",
    "grupo_paso_id" "uuid",
    "orden" integer,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."productos_rutas_produccion_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_sellos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_producto" "text" NOT NULL,
    "tipo_sello" "text",
    "marca" "text",
    "medida_ancho" numeric,
    "medida_alto" numeric,
    "tipo_tinta" "text",
    "impuesto_iva" numeric DEFAULT 21 NOT NULL,
    "ruta_produccion_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_sellos_impuesto_valido" CHECK (("impuesto_iva" = ANY (ARRAY[10.5, (21)::numeric]))),
    CONSTRAINT "check_sellos_marca_condicional" CHECK (((("tipo_producto" = 'sello'::"text") AND ("marca" IS NOT NULL)) OR (("tipo_producto" <> 'sello'::"text") AND ("marca" IS NULL)))),
    CONSTRAINT "check_sellos_marca_valida" CHECK ((("marca" IS NULL) OR ("marca" = ANY (ARRAY['Trodat'::"text", 'ColoP'::"text", 'Shiny'::"text"])))),
    CONSTRAINT "check_sellos_medidas_alto_positivas" CHECK ((("medida_alto" IS NULL) OR ("medida_alto" > (0)::numeric))),
    CONSTRAINT "check_sellos_medidas_positivas" CHECK ((("medida_ancho" IS NULL) OR ("medida_ancho" > (0)::numeric))),
    CONSTRAINT "check_sellos_tipo_producto_valido" CHECK (("tipo_producto" = ANY (ARRAY['sello'::"text", 'repuesto'::"text", 'polimero'::"text", 'tinta'::"text", 'accesorios'::"text"]))),
    CONSTRAINT "check_sellos_tipo_sello_condicional" CHECK (((("tipo_producto" = 'sello'::"text") AND ("tipo_sello" IS NOT NULL)) OR (("tipo_producto" <> 'sello'::"text") AND ("tipo_sello" IS NULL)))),
    CONSTRAINT "check_sellos_tipo_sello_valido" CHECK ((("tipo_sello" IS NULL) OR ("tipo_sello" = ANY (ARRAY['manual'::"text", 'automatico'::"text"])))),
    CONSTRAINT "check_sellos_tipo_tinta_condicional" CHECK (((("tipo_producto" = 'tinta'::"text") AND ("tipo_tinta" IS NOT NULL)) OR (("tipo_producto" <> 'tinta'::"text") AND ("tipo_tinta" IS NULL)))),
    CONSTRAINT "check_sellos_tipo_tinta_valido" CHECK ((("tipo_tinta" IS NULL) OR ("tipo_tinta" = ANY (ARRAY['textil'::"text", 'papel'::"text"]))))
);


ALTER TABLE "public"."productos_sellos" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_sellos" IS 'Productos de sellos, repuestos, polímeros, tintas y accesorios relacionados.';



COMMENT ON COLUMN "public"."productos_sellos"."tipo_producto" IS 'Tipo de producto: sello, repuesto, polimero, tinta, accesorios';



COMMENT ON COLUMN "public"."productos_sellos"."tipo_sello" IS 'Tipo de sello: manual o automatico (solo para tipo_producto=sello)';



COMMENT ON COLUMN "public"."productos_sellos"."marca" IS 'Marca del sello: Trodat, ColoP, Shiny (solo para tipo_producto=sello)';



COMMENT ON COLUMN "public"."productos_sellos"."medida_ancho" IS 'Ancho del producto en milímetros';



COMMENT ON COLUMN "public"."productos_sellos"."medida_alto" IS 'Alto del producto en milímetros';



COMMENT ON COLUMN "public"."productos_sellos"."tipo_tinta" IS 'Tipo de tinta: textil o papel (solo para tipo_producto=tinta)';



CREATE TABLE IF NOT EXISTS "public"."productos_sellos_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "precio_unitario" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_sellos_precio_positivo" CHECK (("precio_unitario" > (0)::numeric))
);


ALTER TABLE "public"."productos_sellos_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_sellos_precios" IS 'Precios unitarios para productos de sellos.';



COMMENT ON COLUMN "public"."productos_sellos_precios"."precio_unitario" IS 'Precio por unidad del producto';



CREATE TABLE IF NOT EXISTS "public"."productos_servicios_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_tipo" "text" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_producto_tipo_servicios" CHECK (("producto_tipo" = ANY (ARRAY['laser'::"text", 'gran_formato'::"text", 'materiales_rigidos'::"text"])))
);


ALTER TABLE "public"."productos_servicios_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_servicios_v2" IS 'Relación polimórfica entre productos (cualquier tipo) y servicios disponibles';



COMMENT ON COLUMN "public"."productos_servicios_v2"."producto_tipo" IS 'Tipo de producto: laser, gran_formato, materiales_rigidos';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "medidas_disponibles" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tipo_copia" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "producto_impreso" boolean DEFAULT true NOT NULL,
    "tipo_venta" "text" NOT NULL,
    "cantidades_fijas" integer[] DEFAULT ARRAY[]::integer[],
    "impuesto_iva" numeric(5,2) NOT NULL,
    "ruta_produccion_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_impuesto_iva_talonario" CHECK ((("impuesto_iva" >= (0)::numeric) AND ("impuesto_iva" <= (100)::numeric))),
    CONSTRAINT "check_tipo_copia" CHECK (("tipo_copia" <@ ARRAY['duplicado'::"text", 'triplicado'::"text", 'cuadruplicado'::"text"])),
    CONSTRAINT "productos_talonarios_tipo_venta_check" CHECK (("tipo_venta" = ANY (ARRAY['unidades'::"text", 'cantidades_fijas'::"text"])))
);


ALTER TABLE "public"."productos_talonarios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios" IS 'Productos de talonarios con todas sus configuraciones específicas';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios_acabados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_talonario_id" "uuid" NOT NULL,
    "acabado_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_talonarios_acabados" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios_acabados" IS 'Relación entre productos de talonarios y acabados';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios_materiales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_talonario_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "variante_nombre" "text" NOT NULL,
    "espesor" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_talonarios_materiales" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios_materiales" IS 'Relación entre productos de talonarios y materiales con variantes y espesores';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios_precios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "producto_talonario_id" "uuid" NOT NULL,
    "medida_ancho" numeric(10,2) NOT NULL,
    "medida_alto" numeric(10,2) NOT NULL,
    "cantidad" integer NOT NULL,
    "tipo_copia" "text" NOT NULL,
    "precio" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tinta" "text" NOT NULL,
    CONSTRAINT "check_cantidad_talonario_positiva" CHECK (("cantidad" > 0)),
    CONSTRAINT "check_medida_alto_talonario_positivo" CHECK (("medida_alto" > (0)::numeric)),
    CONSTRAINT "check_medida_ancho_talonario_positivo" CHECK (("medida_ancho" > (0)::numeric)),
    CONSTRAINT "check_precio_talonario_positivo" CHECK (("precio" > (0)::numeric)),
    CONSTRAINT "check_tinta_valida_talonarios" CHECK (("tinta" = ANY (ARRAY['K'::"text", 'CMYK'::"text", 'CMYK+W'::"text", 'CMYK+V'::"text", 'CMYK+W+V'::"text"]))),
    CONSTRAINT "productos_talonarios_precios_tipo_copia_check" CHECK (("tipo_copia" = ANY (ARRAY['duplicado'::"text", 'triplicado'::"text", 'cuadruplicado'::"text"])))
);


ALTER TABLE "public"."productos_talonarios_precios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios_precios" IS 'Precios base para productos de talonarios por configuración específica (medida, tinta, cantidad, tipo de copia)';



COMMENT ON COLUMN "public"."productos_talonarios_precios"."tinta" IS 'Código de tinta utilizada (K, CMYK, CMYK+W, CMYK+V, CMYK+W+V) - consistente con arquitectura post-reversión';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_talonario_id" "uuid" NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_talonarios_servicios" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios_servicios" IS 'Relación entre productos de talonarios y servicios adicionales';



CREATE TABLE IF NOT EXISTS "public"."productos_talonarios_tecnologias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_talonario_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "tintas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."productos_talonarios_tecnologias" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_talonarios_tecnologias" IS 'Relación entre productos de talonarios y tecnologías con sus tintas seleccionadas';



CREATE TABLE IF NOT EXISTS "public"."productos_tecnologias_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_tipo" "text" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "tintas" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_producto_tipo_tecnologias" CHECK (("producto_tipo" = ANY (ARRAY['laser'::"text", 'gran_formato'::"text", 'materiales_rigidos'::"text"])))
);


ALTER TABLE "public"."productos_tecnologias_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos_tecnologias_v2" IS 'Relación polimórfica entre productos (cualquier tipo) y tecnologías de impresión';



COMMENT ON COLUMN "public"."productos_tecnologias_v2"."producto_tipo" IS 'Tipo de producto: laser, gran_formato, materiales_rigidos';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "company_id" "uuid",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "custom_role_id" "uuid",
    "last_login" timestamp with time zone,
    "last_ip" "text",
    "is_active" boolean DEFAULT true,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'operador_diseno'::"text", 'operador_taller'::"text", 'viewer'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."role" IS 'Rol del usuario en el sistema:
- super_admin: Acceso completo a todo el sistema
- admin: Acceso completo excepto Equipo y Configuración
- manager: Acceso a operaciones del día a día
- operador_diseno: Acceso a diseño, órdenes y visualización de productos
- operador_taller: Acceso limitado solo a producción
- viewer: Solo lectura en la mayoría de módulos';



CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre_fantasia" "text" NOT NULL,
    "razon_social" "text" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "numero_documento" "text" NOT NULL,
    "whatsapp" "text",
    "email" "text",
    "domicilio" "text",
    "country_id" "uuid",
    "province_id" "uuid",
    "city_id" "uuid",
    "codigo_postal" "text",
    "banco" "text",
    "tipo_cuenta" "text",
    "tipo_identificador_bancario" "text",
    "identificador_bancario" "text",
    "acepta_transferencias" boolean DEFAULT false NOT NULL,
    "acepta_cheques" boolean DEFAULT false NOT NULL,
    "acepta_tarjetas_credito" boolean DEFAULT false NOT NULL,
    "acepta_otros" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_egreso_id" "uuid",
    CONSTRAINT "providers_tipo_cuenta_check" CHECK ((("tipo_cuenta" = ANY (ARRAY['Caja de Ahorro'::"text", 'Cuenta Corriente'::"text"])) OR ("tipo_cuenta" IS NULL))),
    CONSTRAINT "providers_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['DNI'::"text", 'CUIT'::"text", 'CUIL'::"text"]))),
    CONSTRAINT "providers_tipo_identificador_bancario_check" CHECK ((("tipo_identificador_bancario" = ANY (ARRAY['CBU'::"text", 'CVU'::"text", 'Alias'::"text"])) OR ("tipo_identificador_bancario" IS NULL)))
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provinces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "is_global" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."provinces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rangos_precio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rangos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unidad_medida" "text" DEFAULT 'unidades'::"text" NOT NULL,
    CONSTRAINT "check_unidad_medida" CHECK (("unidad_medida" = ANY (ARRAY['mt2'::"text", 'mt_lineal'::"text", 'unidades'::"text"])))
);


ALTER TABLE "public"."rangos_precio" OWNER TO "postgres";


COMMENT ON TABLE "public"."rangos_precio" IS 'Rangos de precio para productos. RLS habilitado para multi-tenancy por company_id';



COMMENT ON COLUMN "public"."rangos_precio"."company_id" IS 'ID de la compañía propietaria. Usado para RLS y aislamiento de datos';



COMMENT ON COLUMN "public"."rangos_precio"."rangos" IS 'Array JSON de rangos con estructura: [{"min": number, "max": number | null}]';



COMMENT ON COLUMN "public"."rangos_precio"."unidad_medida" IS 'Unidad de medida para los rangos: mt2 (metros cuadrados), mt_lineal (metros lineales), o unidades';



CREATE TABLE IF NOT EXISTS "public"."recurring_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recurring_id" "uuid" NOT NULL,
    "periodo" "date" NOT NULL,
    "estado" "text" DEFAULT 'cerrado'::"text",
    "cerrado_manualmente" boolean DEFAULT false,
    "diferencia_saldo" numeric DEFAULT 0,
    "observaciones" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recurring_executions_estado_check" CHECK (("estado" = ANY (ARRAY['cerrado'::"text", 'omitido'::"text"])))
);


ALTER TABLE "public"."recurring_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'ARS'::"text",
    "provider_id" "uuid",
    "tipo_egreso_id" "uuid" NOT NULL,
    "frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "day_of_month" integer,
    "day_of_week" integer,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recurring_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "recurring_expenses_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "recurring_expenses_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."recurring_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "module_id" "text" NOT NULL,
    "can_view" boolean DEFAULT false,
    "can_create" boolean DEFAULT false,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rutas_produccion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rutas_produccion" OWNER TO "postgres";


COMMENT ON TABLE "public"."rutas_produccion" IS 'Plantillas maestras de rutas de producción reutilizables que definen flujos de trabajo completos.';



COMMENT ON COLUMN "public"."rutas_produccion"."nombre" IS 'Nombre descriptivo de la ruta (ej: "Ruta Gran Formato Estándar", "Ruta Impresión Láser Premium")';



CREATE TABLE IF NOT EXISTS "public"."rutas_produccion_pasos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ruta_id" "uuid" NOT NULL,
    "etapa" "text" NOT NULL,
    "paso_id" "uuid",
    "orden" integer DEFAULT 0 NOT NULL,
    "es_obligatorio" boolean DEFAULT true NOT NULL,
    "tipo_condicion" "text",
    "configuracion_condicion" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_etapa" CHECK (("etapa" = ANY (ARRAY['pre_prensa'::"text", 'principal'::"text", 'post_prensa'::"text", 'instalacion'::"text"]))),
    CONSTRAINT "check_obligatorio_condicion" CHECK (((("es_obligatorio" = true) AND (("tipo_condicion" IS NULL) OR ("tipo_condicion" = 'sin_condicion'::"text"))) OR (("es_obligatorio" = false) AND ("tipo_condicion" IS NOT NULL) AND ("tipo_condicion" <> 'sin_condicion'::"text")))),
    CONSTRAINT "check_paso_id_for_simple_conditions" CHECK (((("tipo_condicion" = ANY (ARRAY['sin_condicion'::"text", 'servicio_sin_nivel'::"text", 'acabado_sin_nivel'::"text"])) AND ("paso_id" IS NOT NULL)) OR (("tipo_condicion" = ANY (ARRAY['servicio_con_nivel'::"text", 'acabado_con_nivel'::"text", 'tecnologia_tinta'::"text"])) AND ("paso_id" IS NULL)) OR ("tipo_condicion" IS NULL))),
    CONSTRAINT "check_paso_id_required_when_obligatorio" CHECK (((("es_obligatorio" = true) AND ("paso_id" IS NOT NULL)) OR ("es_obligatorio" = false))),
    CONSTRAINT "check_tipo_condicion" CHECK ((("tipo_condicion" IS NULL) OR ("tipo_condicion" = ANY (ARRAY['sin_condicion'::"text", 'servicio_sin_nivel'::"text", 'servicio_con_nivel'::"text", 'acabado_sin_nivel'::"text", 'acabado_con_nivel'::"text", 'tecnologia_tinta'::"text"]))))
);


ALTER TABLE "public"."rutas_produccion_pasos" OWNER TO "postgres";


COMMENT ON TABLE "public"."rutas_produccion_pasos" IS 'Define los pasos específicos de cada ruta organizados por las 5 etapas de producción, con soporte para pasos obligatorios y condicionales.';



COMMENT ON COLUMN "public"."rutas_produccion_pasos"."etapa" IS 'Etapa de producción. Valores válidos: Pre-prensa, Produccion, Terminacion, Instalacion, Entrega. Estos valores están normalizados y son case-sensitive.';



COMMENT ON COLUMN "public"."rutas_produccion_pasos"."paso_id" IS 'UUID del paso específico a ejecutar. NULL para pasos con mapeo múltiple (servicio_con_nivel, acabado_con_nivel, tecnologia_tinta)';



COMMENT ON COLUMN "public"."rutas_produccion_pasos"."es_obligatorio" IS 'Si true, el paso siempre se ejecuta. Si false, el paso es condicional y depende de tipo_condicion.';



COMMENT ON COLUMN "public"."rutas_produccion_pasos"."tipo_condicion" IS 'Tipo de condición: sin_condicion, servicio_sin_nivel, servicio_con_nivel, acabado_sin_nivel, acabado_con_nivel, tecnologia_tinta';



COMMENT ON COLUMN "public"."rutas_produccion_pasos"."configuracion_condicion" IS 'Configuración JSON específica para cada tipo de condición que determina cuándo se ejecuta el paso.';



COMMENT ON CONSTRAINT "check_etapa" ON "public"."rutas_produccion_pasos" IS 'Valida que etapa sea uno de los 4 valores válidos en snake_case: pre_prensa, principal, post_prensa, instalacion';



CREATE TABLE IF NOT EXISTS "public"."servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "estacion_id" "uuid" NOT NULL,
    "disponible_independiente" boolean DEFAULT false NOT NULL,
    "tiene_niveles_precio" boolean DEFAULT false NOT NULL,
    "tipo_impacto" "text",
    "valor_impacto" numeric,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valor_impacto_secundario" numeric,
    "alcance" "text" DEFAULT 'por_item'::"text" NOT NULL,
    CONSTRAINT "check_servicios_alcance_valido" CHECK (("alcance" = ANY (ARRAY['por_item'::"text", 'grupo'::"text"]))),
    CONSTRAINT "check_tipo_impacto" CHECK ((("tipo_impacto" IS NULL) OR ("tipo_impacto" = ANY (ARRAY['sin_impacto'::"text", 'precio_fijo'::"text", 'por_unidad'::"text", 'por_minuto'::"text", 'porcentual'::"text", 'por_mt2'::"text", 'por_mt_lineal'::"text", 'fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]))))
);


ALTER TABLE "public"."servicios" OWNER TO "postgres";


COMMENT ON COLUMN "public"."servicios"."valor_impacto" IS 'Valor principal del impacto. Para tipos combinados, este es el valor fijo.';



COMMENT ON COLUMN "public"."servicios"."valor_impacto_secundario" IS 'Valor secundario para tipos de impacto combinados (porcentaje, valor por mt2, valor por metro lineal, o valor por minuto). NULL para tipos simples.';



COMMENT ON COLUMN "public"."servicios"."alcance" IS 'Alcance del servicio: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';



CREATE TABLE IF NOT EXISTS "public"."servicios_categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."servicios_categorias" OWNER TO "postgres";


COMMENT ON TABLE "public"."servicios_categorias" IS 'Tabla relacional muchos-a-muchos entre servicios y categorías. Un servicio puede tener múltiples categorías.';



COMMENT ON COLUMN "public"."servicios_categorias"."servicio_id" IS 'ID del servicio. Elimina en cascada cuando se elimina el servicio.';



COMMENT ON COLUMN "public"."servicios_categorias"."categoria_id" IS 'ID de la categoría. Restricción para prevenir eliminación de categorías en uso.';



CREATE TABLE IF NOT EXISTS "public"."servicios_niveles_precio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_impacto" "text" NOT NULL,
    "valor_impacto" numeric NOT NULL,
    "paso_id" "uuid",
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valor_impacto_secundario" numeric,
    CONSTRAINT "check_nivel_tipo_impacto" CHECK (("tipo_impacto" = ANY (ARRAY['sin_impacto'::"text", 'precio_fijo'::"text", 'por_unidad'::"text", 'por_minuto'::"text", 'porcentual'::"text", 'por_mt2'::"text", 'por_mt_lineal'::"text", 'fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]))),
    CONSTRAINT "check_paso_required" CHECK (("paso_id" IS NOT NULL))
);


ALTER TABLE "public"."servicios_niveles_precio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."servicios_niveles_precio"."valor_impacto" IS 'Valor principal del impacto del nivel. Para tipos combinados, este es el valor fijo.';



COMMENT ON COLUMN "public"."servicios_niveles_precio"."valor_impacto_secundario" IS 'Valor secundario para tipos de impacto combinados en el nivel de precio. NULL para tipos simples.';



CREATE TABLE IF NOT EXISTS "public"."servicios_pasos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "servicio_id" "uuid" NOT NULL,
    "paso_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_servicios_pasos_paso_required" CHECK (("paso_id" IS NOT NULL))
);


ALTER TABLE "public"."servicios_pasos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarjetas_consumos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "resumen_id" "uuid" NOT NULL,
    "tarjeta_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "fecha_compra" "date" NOT NULL,
    "descripcion" "text" NOT NULL,
    "monto_original" numeric(12,2) NOT NULL,
    "monto_cuota" numeric(12,2) NOT NULL,
    "cuotas_total" integer DEFAULT 1 NOT NULL,
    "nro_cuota" integer DEFAULT 1 NOT NULL,
    "comprobante_url" "text",
    "categoria_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tarjetas_consumos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarjetas_credito" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "banco" character varying(255) NOT NULL,
    "ultimos_4_digitos" character varying(4),
    "dia_cierre" integer NOT NULL,
    "dia_vencimiento" integer NOT NULL,
    "color" character varying(20) DEFAULT 'blue'::character varying,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tarjetas_credito_dia_cierre_check" CHECK ((("dia_cierre" >= 1) AND ("dia_cierre" <= 31))),
    CONSTRAINT "tarjetas_credito_dia_vencimiento_check" CHECK ((("dia_vencimiento" >= 1) AND ("dia_vencimiento" <= 31)))
);


ALTER TABLE "public"."tarjetas_credito" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarjetas_resumenes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tarjeta_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "periodo" character varying(7) NOT NULL,
    "fecha_cierre" "date" NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "estado" character varying(20) DEFAULT 'abierto'::character varying NOT NULL,
    "total_consumos" numeric(12,2) DEFAULT 0,
    "total_pagado" numeric(12,2) DEFAULT 0,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tarjetas_resumenes_estado_check" CHECK ((("estado")::"text" = ANY ((ARRAY['abierto'::character varying, 'cerrado'::character varying, 'pagado'::character varying])::"text"[])))
);


ALTER TABLE "public"."tarjetas_resumenes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tecnologias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tintas" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL
);


ALTER TABLE "public"."tecnologias" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tecnologias"."tintas" IS 'Array de códigos de tintas disponibles para esta tecnología (K, CMYK, CMYK+W, etc)';



CREATE TABLE IF NOT EXISTS "public"."tecnologias_tintas_pasos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tecnologia_id" "uuid" NOT NULL,
    "paso_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tinta" "text" NOT NULL,
    CONSTRAINT "check_paso_id_required" CHECK (("paso_id" IS NOT NULL)),
    CONSTRAINT "check_tinta_valida" CHECK (("tinta" = ANY (ARRAY['K'::"text", 'CMYK'::"text", 'CMYK+W'::"text", 'CMYK+V'::"text", 'CMYK+W+V'::"text"])))
);


ALTER TABLE "public"."tecnologias_tintas_pasos" OWNER TO "postgres";


COMMENT ON TABLE "public"."tecnologias_tintas_pasos" IS 'Almacena la configuración de qué paso de producción se ejecuta para cada combinación de tecnología + tipo de tinta. Esta configuración es utilizada en las rutas de producción condicionales de productos. Cada configuración debe tener un paso_id obligatorio.';



COMMENT ON COLUMN "public"."tecnologias_tintas_pasos"."tecnologia_id" IS 'Referencia a la tecnología (ej: UV, Offset, Digital)';



COMMENT ON COLUMN "public"."tecnologias_tintas_pasos"."paso_id" IS 'Paso individual de producción a ejecutar cuando se use esta combinación tecnología + tinta. Este campo es obligatorio.';



COMMENT ON COLUMN "public"."tecnologias_tintas_pasos"."tinta" IS 'Tipo de tinta: K, CMYK, CMYK+W, CMYK+V, o CMYK+W+V';



CREATE TABLE IF NOT EXISTS "public"."tipos_egreso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "codigo" "text" NOT NULL,
    "color" "text" DEFAULT '#ef4444'::"text",
    "icono" "text" DEFAULT 'ArrowDownCircle'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tipos_egreso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_ingreso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "codigo" "text" NOT NULL,
    "color" "text" DEFAULT '#10b981'::"text",
    "icono" "text" DEFAULT 'ArrowUpCircle'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tipos_ingreso" OWNER TO "postgres";


COMMENT ON TABLE "public"."tipos_ingreso" IS 'Categorías configurables de ingresos manuales por empresa';



CREATE TABLE IF NOT EXISTS "public"."user_ip_restrictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ip_address" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_ip_restrictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_actividad_usuarios" WITH ("security_invoker"='true') AS
 SELECT "oir"."id" AS "ruta_id",
    "oir"."orden_item_id",
    "oir"."estado_paso",
    "oir"."fecha_inicio",
    "oir"."fecha_fin",
    "oir"."responsable_id",
    "oir"."notas",
    COALESCE("oir"."paso_nombre", "p"."nombre") AS "paso_nombre",
    COALESCE("oir"."tipo_etapa", "p"."etapa") AS "tipo_etapa",
    "oir"."orden" AS "orden_paso",
    (EXTRACT(epoch FROM ("oir"."fecha_fin" - "oir"."fecha_inicio")) / 60.0) AS "duracion_minutos",
    "prof"."full_name" AS "responsable_nombre",
    "prof"."email" AS "responsable_email",
    "prof"."role" AS "responsable_role",
    "prof"."avatar_url" AS "responsable_avatar",
    "oi"."producto_nombre",
    "oi"."producto_categoria",
    "oi"."cantidad" AS "producto_cantidad",
    "oi"."estado" AS "item_estado",
    "ot"."id" AS "orden_id",
    "ot"."numero_orden",
    "ot"."fecha_creacion" AS "orden_fecha_creacion",
    "ot"."company_id",
    "c"."nombre_fantasia" AS "cliente_nombre",
    "p"."estacion_id",
    "e"."nombre" AS "estacion_nombre"
   FROM (((((("public"."ordenes_trabajo_items_rutas" "oir"
     JOIN "public"."ordenes_trabajo_items" "oi" ON (("oir"."orden_item_id" = "oi"."id")))
     JOIN "public"."ordenes_trabajo" "ot" ON (("oi"."orden_id" = "ot"."id")))
     LEFT JOIN "public"."pasos" "p" ON (("oir"."paso_id" = "p"."id")))
     LEFT JOIN "public"."profiles" "prof" ON (("oir"."responsable_id" = "prof"."id")))
     LEFT JOIN "public"."clients" "c" ON (("ot"."cliente_id" = "c"."id")))
     LEFT JOIN "public"."estaciones_trabajo" "e" ON (("p"."estacion_id" = "e"."id")))
  WHERE (("oir"."estado_paso" = ANY (ARRAY['completado'::"text", 'omitido'::"text"])) AND ("oir"."fecha_fin" IS NOT NULL) AND ("oir"."responsable_id" IS NOT NULL));


ALTER VIEW "public"."v_actividad_usuarios" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_actividad_usuarios" IS 'Vista del historial de actividad de operadores';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "orden_trabajo_id" "uuid",
    "orden_copiado_id" "uuid",
    "tipo_notificacion" "text" NOT NULL,
    "telefono_destino" "text" NOT NULL,
    "mensaje_enviado" "text" NOT NULL,
    "estado_envio" "text" NOT NULL,
    "error_mensaje" "text",
    "respuesta_backend" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "presupuesto_id" "uuid",
    "cliente_id" "uuid",
    CONSTRAINT "check_referencia_notificacion" CHECK ((("orden_trabajo_id" IS NOT NULL) OR ("orden_copiado_id" IS NOT NULL) OR ("presupuesto_id" IS NOT NULL))),
    CONSTRAINT "whatsapp_notificaciones_check_referencia" CHECK (((("orden_trabajo_id" IS NOT NULL) AND ("orden_copiado_id" IS NULL) AND ("presupuesto_id" IS NULL) AND ("cliente_id" IS NULL)) OR (("orden_trabajo_id" IS NULL) AND ("orden_copiado_id" IS NOT NULL) AND ("presupuesto_id" IS NULL) AND ("cliente_id" IS NULL)) OR (("orden_trabajo_id" IS NULL) AND ("orden_copiado_id" IS NULL) AND ("presupuesto_id" IS NOT NULL) AND ("cliente_id" IS NULL)) OR (("orden_trabajo_id" IS NULL) AND ("orden_copiado_id" IS NULL) AND ("presupuesto_id" IS NULL) AND ("cliente_id" IS NOT NULL)))),
    CONSTRAINT "whatsapp_notificaciones_estado_envio_check" CHECK (("estado_envio" = ANY (ARRAY['enviado'::"text", 'fallido'::"text"]))),
    CONSTRAINT "whatsapp_notificaciones_tipo_notificacion_check" CHECK (("tipo_notificacion" = ANY (ARRAY['nueva_orden_trabajo'::"text", 'nueva_orden_copiado'::"text", 'orden_finalizada'::"text", 'presupuesto_enviado'::"text", 'presupuesto_aprobado'::"text", 'auto_registro_cliente'::"text", 'cliente_aprobado'::"text", 'cliente_rechazado'::"text", 'factura_disponible'::"text"])))
);


ALTER TABLE "public"."whatsapp_notificaciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_notificaciones" IS 'Registro de todas las notificaciones enviadas por WhatsApp: órdenes, presupuestos, clientes y facturas';



COMMENT ON COLUMN "public"."whatsapp_notificaciones"."tipo_notificacion" IS 'Tipo de notificación: nueva_orden_trabajo, nueva_orden_copiado, orden_finalizada';



COMMENT ON COLUMN "public"."whatsapp_notificaciones"."estado_envio" IS 'Estado del envío: enviado (exitoso), fallido (error)';



COMMENT ON COLUMN "public"."whatsapp_notificaciones"."respuesta_backend" IS 'Respuesta completa del backend de WhatsApp en formato JSON';



COMMENT ON COLUMN "public"."whatsapp_notificaciones"."cliente_id" IS 'Cliente relacionado con la notificación (para notificaciones de registro, aprobación, rechazo)';



COMMENT ON CONSTRAINT "whatsapp_notificaciones_check_referencia" ON "public"."whatsapp_notificaciones" IS 'Asegura que cada notificación esté asociada a exactamente UNA entidad: orden_trabajo, orden_copiado, presupuesto O cliente';



COMMENT ON CONSTRAINT "whatsapp_notificaciones_tipo_notificacion_check" ON "public"."whatsapp_notificaciones" IS 'Tipos de notificación permitidos: órdenes, presupuestos, clientes y facturas';



ALTER TABLE ONLY "public"."acabados_categorias"
    ADD CONSTRAINT "acabados_categorias_acabado_id_categoria_id_key" UNIQUE ("acabado_id", "categoria_id");



ALTER TABLE ONLY "public"."acabados_categorias"
    ADD CONSTRAINT "acabados_categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acabados_niveles_precio"
    ADD CONSTRAINT "acabados_niveles_precio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acabados_pasos"
    ADD CONSTRAINT "acabados_pasos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acabados"
    ADD CONSTRAINT "acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."arqueos_cajas"
    ADD CONSTRAINT "arqueos_cajas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cajas"
    ADD CONSTRAINT "cajas_nombre_company_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."cajas"
    ADD CONSTRAINT "cajas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_ordenes_archivos"
    ADD CONSTRAINT "centro_copiado_ordenes_archivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_ordenes_items"
    ADD CONSTRAINT "centro_copiado_ordenes_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_numero_company_unique" UNIQUE ("company_id", "numero_orden");



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_orden_trabajo_id_unique" UNIQUE ("orden_trabajo_id");



COMMENT ON CONSTRAINT "centro_copiado_ordenes_orden_trabajo_id_unique" ON "public"."centro_copiado_ordenes" IS 'Asegura que una orden de trabajo solo pueda tener una orden de copiado asociada (relación 1:1).';



ALTER TABLE ONLY "public"."centro_copiado_ordenes_pagos"
    ADD CONSTRAINT "centro_copiado_ordenes_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_papeles"
    ADD CONSTRAINT "centro_copiado_papeles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_papeles"
    ADD CONSTRAINT "centro_copiado_papeles_unique" UNIQUE ("company_id", "material_id", "variante_nombre", "espesor");



ALTER TABLE ONLY "public"."centro_copiado_plastificados"
    ADD CONSTRAINT "centro_copiado_plastificados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_plastificados"
    ADD CONSTRAINT "centro_copiado_plastificados_unique_rango" UNIQUE ("company_id", "tipo", "unidades_desde");



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_unique" UNIQUE ("company_id", "tamanio_papel_id", "papel_id", "tipo_tinta", "rango_precio_id", "cara_impresa");



ALTER TABLE ONLY "public"."centro_copiado_rangos_anillado"
    ADD CONSTRAINT "centro_copiado_rangos_anillado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_rangos_precio_impresion"
    ADD CONSTRAINT "centro_copiado_rangos_precio_impresion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centro_copiado_rangos_precio_impresion"
    ADD CONSTRAINT "centro_copiado_rangos_precio_nombre_company_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."centro_copiado_tamanios_papel"
    ADD CONSTRAINT "centro_copiado_tamanios_papel_nombre_company_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."centro_copiado_tamanios_papel"
    ADD CONSTRAINT "centro_copiado_tamanios_papel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_province_id_name_key" UNIQUE ("province_id", "name");



ALTER TABLE ONLY "public"."cliente_registro_intentos"
    ADD CONSTRAINT "cliente_registro_intentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_company_id_numero_documento_key" UNIQUE ("company_id", "numero_documento");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."company_business_hours"
    ADD CONSTRAINT "company_business_hours_company_id_day_of_week_key" UNIQUE ("company_id", "day_of_week");



ALTER TABLE ONLY "public"."company_business_hours"
    ADD CONSTRAINT "company_business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compras_proveedores"
    ADD CONSTRAINT "compras_proveedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_condiciones_comerciales"
    ADD CONSTRAINT "condiciones_nombre_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_iso_code_key" UNIQUE ("iso_code");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_company_id_name_key" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estaciones_trabajo"
    ADD CONSTRAINT "estaciones_trabajo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facturas_historial"
    ADD CONSTRAINT "facturas_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facturas_urls_cortas"
    ADD CONSTRAINT "facturas_urls_cortas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."liquidaciones_items"
    ADD CONSTRAINT "liquidaciones_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."liquidaciones_pagos"
    ADD CONSTRAINT "liquidaciones_pagos_liquidacion_id_pago_id_key" UNIQUE ("liquidacion_id", "pago_id");



ALTER TABLE ONLY "public"."liquidaciones_pagos"
    ADD CONSTRAINT "liquidaciones_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiales"
    ADD CONSTRAINT "materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medios_cobro"
    ADD CONSTRAINT "medios_cobro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones_internas"
    ADD CONSTRAINT "notificaciones_internas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_items_rutas_pausas"
    ADD CONSTRAINT "ordenes_items_rutas_pausas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_acabados_compartidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_acabados_compartidos_unique_acabado" UNIQUE ("orden_trabajo_id", "acabado_id");



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_items"
    ADD CONSTRAINT "ordenes_trabajo_acabados_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_historial"
    ADD CONSTRAINT "ordenes_trabajo_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_items"
    ADD CONSTRAINT "ordenes_trabajo_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_items_rutas"
    ADD CONSTRAINT "ordenes_trabajo_items_rutas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_links"
    ADD CONSTRAINT "ordenes_trabajo_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_pagos"
    ADD CONSTRAINT "ordenes_trabajo_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_servicios_compartidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_servicios_compartidos_unique_servicio" UNIQUE ("orden_trabajo_id", "servicio_id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_items"
    ADD CONSTRAINT "ordenes_trabajo_servicios_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios"
    ADD CONSTRAINT "ordenes_trabajo_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_tracking_token_key" UNIQUE ("tracking_token");



ALTER TABLE ONLY "public"."pasos_motivos_pausa"
    ADD CONSTRAINT "pasos_motivos_pausa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pasos"
    ADD CONSTRAINT "pasos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos_opciones"
    ADD CONSTRAINT "pedidos_opciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos_rutas_resueltas"
    ADD CONSTRAINT "pedidos_rutas_resueltas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_acabados_compartidos"
    ADD CONSTRAINT "presupuestos_acabados_compartidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_acabados_compartidos"
    ADD CONSTRAINT "presupuestos_acabados_compartidos_unique_acabado" UNIQUE ("presupuesto_id", "acabado_id");



ALTER TABLE ONLY "public"."presupuestos_archivos"
    ADD CONSTRAINT "presupuestos_archivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_condiciones_comerciales"
    ADD CONSTRAINT "presupuestos_condiciones_comerciales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_historial"
    ADD CONSTRAINT "presupuestos_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_items"
    ADD CONSTRAINT "presupuestos_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_numero_unique" UNIQUE ("company_id", "numero_presupuesto");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_servicios_compartidos"
    ADD CONSTRAINT "presupuestos_servicios_compartidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_servicios_compartidos"
    ADD CONSTRAINT "presupuestos_servicios_compartidos_unique_servicio" UNIQUE ("presupuesto_id", "servicio_id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_tracking_token_key" UNIQUE ("tracking_token");



ALTER TABLE ONLY "public"."productos_acabados_v2"
    ADD CONSTRAINT "productos_acabados_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_acabados_v2"
    ADD CONSTRAINT "productos_acabados_v2_producto_tipo_producto_id_acabado_id_key" UNIQUE ("producto_tipo", "producto_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_gran_formato_acabados"
    ADD CONSTRAINT "productos_gran_formato_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_gran_formato_materiales"
    ADD CONSTRAINT "productos_gran_formato_materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_gran_formato"
    ADD CONSTRAINT "productos_gran_formato_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_gran_formato_precios"
    ADD CONSTRAINT "productos_gran_formato_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_gran_formato_servicios"
    ADD CONSTRAINT "productos_gran_formato_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_gran_formato_tecnologias"
    ADD CONSTRAINT "productos_gran_formato_tecnologias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser_acabados"
    ADD CONSTRAINT "productos_impresion_laser_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser_materiales"
    ADD CONSTRAINT "productos_impresion_laser_materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser"
    ADD CONSTRAINT "productos_impresion_laser_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser_precios"
    ADD CONSTRAINT "productos_impresion_laser_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser_servicios"
    ADD CONSTRAINT "productos_impresion_laser_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_impresion_laser_tecnologias"
    ADD CONSTRAINT "productos_impresion_laser_tecnologias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales"
    ADD CONSTRAINT "productos_materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_acabados"
    ADD CONSTRAINT "productos_materiales_rigidos_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_materiales"
    ADD CONSTRAINT "productos_materiales_rigidos_materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos"
    ADD CONSTRAINT "productos_materiales_rigidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_precios"
    ADD CONSTRAINT "productos_materiales_rigidos_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_servicios"
    ADD CONSTRAINT "productos_materiales_rigidos_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_materiales_v2"
    ADD CONSTRAINT "productos_materiales_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_plotter_corte_acabados"
    ADD CONSTRAINT "productos_plotter_corte_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "productos_plotter_corte_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_plotter_corte_precios"
    ADD CONSTRAINT "productos_plotter_corte_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_plotter_corte_servicios"
    ADD CONSTRAINT "productos_plotter_corte_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_portabanners_acabados"
    ADD CONSTRAINT "productos_portabanners_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "productos_portabanners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_portabanners_precios"
    ADD CONSTRAINT "productos_portabanners_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_portabanners_servicios"
    ADD CONSTRAINT "productos_portabanners_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_portabanners_tecnologias"
    ADD CONSTRAINT "productos_portabanners_tecnologias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_pricing"
    ADD CONSTRAINT "productos_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_pricing"
    ADD CONSTRAINT "productos_pricing_producto_id_key" UNIQUE ("producto_id");



ALTER TABLE ONLY "public"."productos_rutas_produccion"
    ADD CONSTRAINT "productos_rutas_produccion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_sellos"
    ADD CONSTRAINT "productos_sellos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_sellos_precios"
    ADD CONSTRAINT "productos_sellos_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_servicios_v2"
    ADD CONSTRAINT "productos_servicios_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_servicios_v2"
    ADD CONSTRAINT "productos_servicios_v2_producto_tipo_producto_id_servicio_i_key" UNIQUE ("producto_tipo", "producto_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_talonarios_acabados"
    ADD CONSTRAINT "productos_talonarios_acabados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_talonarios_materiales"
    ADD CONSTRAINT "productos_talonarios_materiales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_talonarios"
    ADD CONSTRAINT "productos_talonarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_talonarios_precios"
    ADD CONSTRAINT "productos_talonarios_precios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_talonarios_servicios"
    ADD CONSTRAINT "productos_talonarios_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_talonarios_tecnologias"
    ADD CONSTRAINT "productos_talonarios_tecnologias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_tecnologias_v2"
    ADD CONSTRAINT "productos_tecnologias_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_tecnologias_v2"
    ADD CONSTRAINT "productos_tecnologias_v2_producto_tipo_producto_id_tecnolog_key" UNIQUE ("producto_tipo", "producto_id", "tecnologia_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_country_id_name_key" UNIQUE ("country_id", "name");



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rangos_precio"
    ADD CONSTRAINT "rangos_precio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_executions"
    ADD CONSTRAINT "recurring_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_executions"
    ADD CONSTRAINT "recurring_executions_recurring_id_periodo_key" UNIQUE ("recurring_id", "periodo");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_module_id_key" UNIQUE ("role_id", "module_id");



ALTER TABLE ONLY "public"."rutas_produccion_pasos"
    ADD CONSTRAINT "rutas_produccion_pasos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rutas_produccion"
    ADD CONSTRAINT "rutas_produccion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."servicios_categorias"
    ADD CONSTRAINT "servicios_categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."servicios_categorias"
    ADD CONSTRAINT "servicios_categorias_servicio_id_categoria_id_key" UNIQUE ("servicio_id", "categoria_id");



ALTER TABLE ONLY "public"."servicios_niveles_precio"
    ADD CONSTRAINT "servicios_niveles_precio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."servicios_pasos"
    ADD CONSTRAINT "servicios_pasos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."servicios"
    ADD CONSTRAINT "servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarjetas_credito"
    ADD CONSTRAINT "tarjetas_credito_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarjetas_resumenes"
    ADD CONSTRAINT "tarjetas_resumenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarjetas_resumenes"
    ADD CONSTRAINT "tarjetas_resumenes_tarjeta_id_periodo_key" UNIQUE ("tarjeta_id", "periodo");



ALTER TABLE ONLY "public"."tecnologias"
    ADD CONSTRAINT "tecnologias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tecnologias_tintas_pasos"
    ADD CONSTRAINT "tecnologias_tintas_pasos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_egreso"
    ADD CONSTRAINT "tipos_egreso_codigo_unique" UNIQUE ("company_id", "codigo");



ALTER TABLE ONLY "public"."tipos_egreso"
    ADD CONSTRAINT "tipos_egreso_nombre_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."tipos_egreso"
    ADD CONSTRAINT "tipos_egreso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_ingreso"
    ADD CONSTRAINT "tipos_ingreso_codigo_unique" UNIQUE ("company_id", "codigo");



ALTER TABLE ONLY "public"."tipos_ingreso"
    ADD CONSTRAINT "tipos_ingreso_nombre_unique" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."tipos_ingreso"
    ADD CONSTRAINT "tipos_ingreso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pasos_motivos_pausa"
    ADD CONSTRAINT "unique_motivo_nombre_por_company" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_gran_formato"
    ADD CONSTRAINT "unique_nombre_gran_formato_por_company" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_materiales_rigidos"
    ADD CONSTRAINT "unique_nombre_materiales_rigidos_por_company" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_impresion_laser"
    ADD CONSTRAINT "unique_nombre_por_company" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."medios_cobro"
    ADD CONSTRAINT "unique_nombre_por_empresa" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_talonarios"
    ADD CONSTRAINT "unique_nombre_talonario_por_company" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "unique_numero_liquidacion_por_company" UNIQUE ("company_id", "numero_liquidacion");



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "unique_numero_orden_por_company" UNIQUE ("company_id", "numero_orden");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "unique_numero_pedido_por_company" UNIQUE ("company_id", "numero_pedido");



ALTER TABLE ONLY "public"."productos_plotter_corte_acabados"
    ADD CONSTRAINT "unique_plotter_corte_acabado" UNIQUE ("producto_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "unique_plotter_corte_nombre_por_empresa" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_plotter_corte_precios"
    ADD CONSTRAINT "unique_plotter_corte_precio_rango" UNIQUE ("producto_id", "ancho", "cantidad_desde");



ALTER TABLE ONLY "public"."productos_plotter_corte_servicios"
    ADD CONSTRAINT "unique_plotter_corte_servicio" UNIQUE ("producto_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_portabanners_acabados"
    ADD CONSTRAINT "unique_portabanner_acabado" UNIQUE ("producto_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "unique_portabanner_nombre_por_empresa" UNIQUE ("company_id", "nombre");



ALTER TABLE ONLY "public"."productos_portabanners_servicios"
    ADD CONSTRAINT "unique_portabanner_servicio" UNIQUE ("producto_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_portabanners_tecnologias"
    ADD CONSTRAINT "unique_portabanner_tecnologia" UNIQUE ("producto_id", "tecnologia_id");



ALTER TABLE ONLY "public"."productos_portabanners_precios"
    ADD CONSTRAINT "unique_portabanners_precio_configuracion_v2" UNIQUE NULLS NOT DISTINCT ("producto_id", "ancho_cm", "alto_cm", "cantidad_desde", "cantidad_hasta", "tecnologia_id");



ALTER TABLE ONLY "public"."productos_gran_formato_precios"
    ADD CONSTRAINT "unique_precio_gf_configuracion" UNIQUE ("producto_gran_formato_id", "tecnologia_id", "tinta", "rango_precio_min", "rango_precio_max");



ALTER TABLE ONLY "public"."productos_talonarios_precios"
    ADD CONSTRAINT "unique_precio_talonario_configuracion" UNIQUE ("producto_talonario_id", "medida_ancho", "medida_alto", "tinta", "cantidad", "tipo_copia");



ALTER TABLE ONLY "public"."productos_impresion_laser_acabados"
    ADD CONSTRAINT "unique_producto_acabado" UNIQUE ("producto_laser_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_gran_formato_acabados"
    ADD CONSTRAINT "unique_producto_gf_acabado" UNIQUE ("producto_gran_formato_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_gran_formato_materiales"
    ADD CONSTRAINT "unique_producto_gf_material" UNIQUE ("producto_gran_formato_id", "material_id", "variante_nombre");



ALTER TABLE ONLY "public"."productos_gran_formato_servicios"
    ADD CONSTRAINT "unique_producto_gf_servicio" UNIQUE ("producto_gran_formato_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_gran_formato_tecnologias"
    ADD CONSTRAINT "unique_producto_gf_tecnologia" UNIQUE ("producto_gran_formato_id", "tecnologia_id");



ALTER TABLE ONLY "public"."productos_impresion_laser_materiales"
    ADD CONSTRAINT "unique_producto_material" UNIQUE ("producto_laser_id", "material_id", "variante_nombre");



ALTER TABLE ONLY "public"."productos_impresion_laser_precios"
    ADD CONSTRAINT "unique_producto_medida_tinta_cantidad_cara" UNIQUE ("producto_laser_id", "medida_ancho", "medida_alto", "tinta", "cantidad", "cara_impresa");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_acabados"
    ADD CONSTRAINT "unique_producto_mr_acabado" UNIQUE ("producto_materiales_rigidos_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_materiales_rigidos_servicios"
    ADD CONSTRAINT "unique_producto_mr_servicio" UNIQUE ("producto_materiales_rigidos_id", "servicio_id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "unique_producto_nombre_por_categoria" UNIQUE ("company_id", "categoria_id", "nombre");



ALTER TABLE ONLY "public"."productos_impresion_laser_servicios"
    ADD CONSTRAINT "unique_producto_servicio" UNIQUE ("producto_laser_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_talonarios_acabados"
    ADD CONSTRAINT "unique_producto_talonario_acabado" UNIQUE ("producto_talonario_id", "acabado_id");



ALTER TABLE ONLY "public"."productos_talonarios_materiales"
    ADD CONSTRAINT "unique_producto_talonario_material" UNIQUE ("producto_talonario_id", "material_id", "variante_nombre");



ALTER TABLE ONLY "public"."productos_talonarios_servicios"
    ADD CONSTRAINT "unique_producto_talonario_servicio" UNIQUE ("producto_talonario_id", "servicio_id");



ALTER TABLE ONLY "public"."productos_talonarios_tecnologias"
    ADD CONSTRAINT "unique_producto_talonario_tecnologia" UNIQUE ("producto_talonario_id", "tecnologia_id");



ALTER TABLE ONLY "public"."productos_impresion_laser_tecnologias"
    ADD CONSTRAINT "unique_producto_tecnologia" UNIQUE ("producto_laser_id", "tecnologia_id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "unique_provider_document_per_company" UNIQUE ("company_id", "numero_documento");



ALTER TABLE ONLY "public"."rutas_produccion_pasos"
    ADD CONSTRAINT "unique_ruta_etapa_paso" UNIQUE ("ruta_id", "etapa", "paso_id", "orden");



ALTER TABLE ONLY "public"."productos_sellos_precios"
    ADD CONSTRAINT "unique_sellos_precio_producto" UNIQUE ("producto_id");



ALTER TABLE ONLY "public"."tecnologias_tintas_pasos"
    ADD CONSTRAINT "unique_tecnologia_tinta" UNIQUE ("tecnologia_id", "tinta");



ALTER TABLE ONLY "public"."facturas_urls_cortas"
    ADD CONSTRAINT "uq_facturas_urls_company_token" UNIQUE ("company_id", "token_corto");



ALTER TABLE ONLY "public"."user_ip_restrictions"
    ADD CONSTRAINT "user_ip_restrictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_acabados_alcance" ON "public"."acabados" USING "btree" ("alcance");



CREATE INDEX "idx_acabados_categorias_acabado_id" ON "public"."acabados_categorias" USING "btree" ("acabado_id");



CREATE INDEX "idx_acabados_categorias_categoria_id" ON "public"."acabados_categorias" USING "btree" ("categoria_id");



CREATE INDEX "idx_acabados_company_id" ON "public"."acabados" USING "btree" ("company_id");



CREATE INDEX "idx_acabados_estacion_id" ON "public"."acabados" USING "btree" ("estacion_id");



CREATE INDEX "idx_acabados_niveles_precio_acabado_id" ON "public"."acabados_niveles_precio" USING "btree" ("acabado_id");



CREATE INDEX "idx_acabados_niveles_precio_orden" ON "public"."acabados_niveles_precio" USING "btree" ("orden");



CREATE INDEX "idx_acabados_niveles_precio_paso_id" ON "public"."acabados_niveles_precio" USING "btree" ("paso_id") WHERE ("paso_id" IS NOT NULL);



CREATE INDEX "idx_acabados_nombre" ON "public"."acabados" USING "btree" ("nombre");



CREATE INDEX "idx_acabados_pasos_acabado_id" ON "public"."acabados_pasos" USING "btree" ("acabado_id");



CREATE INDEX "idx_acabados_pasos_paso_id" ON "public"."acabados_pasos" USING "btree" ("paso_id");



CREATE INDEX "idx_acabados_tipo_impacto_combinado" ON "public"."acabados" USING "btree" ("tipo_impacto") WHERE ("tipo_impacto" = ANY (ARRAY['fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]));



CREATE INDEX "idx_arqueos_caja_id" ON "public"."arqueos_cajas" USING "btree" ("caja_id");



CREATE INDEX "idx_arqueos_company_id" ON "public"."arqueos_cajas" USING "btree" ("company_id");



CREATE INDEX "idx_arqueos_fecha" ON "public"."arqueos_cajas" USING "btree" ("fecha_cierre" DESC);



CREATE INDEX "idx_audit_log_company_id" ON "public"."audit_log" USING "btree" ("company_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_module_id" ON "public"."audit_log" USING "btree" ("module_id");



CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_banks_code" ON "public"."banks" USING "btree" ("code") WHERE ("code" IS NOT NULL);



CREATE INDEX "idx_banks_is_active" ON "public"."banks" USING "btree" ("is_active");



CREATE INDEX "idx_banks_name" ON "public"."banks" USING "btree" ("name");



CREATE INDEX "idx_cajas_active" ON "public"."cajas" USING "btree" ("is_active");



CREATE INDEX "idx_cajas_company_id" ON "public"."cajas" USING "btree" ("company_id");



CREATE INDEX "idx_cajas_movimientos_caja_id" ON "public"."cajas_movimientos" USING "btree" ("caja_id");



CREATE INDEX "idx_cajas_movimientos_caja_origen_id" ON "public"."cajas_movimientos" USING "btree" ("caja_origen_id");



CREATE INDEX "idx_cajas_movimientos_fecha" ON "public"."cajas_movimientos" USING "btree" ("fecha");



CREATE INDEX "idx_cajas_movimientos_medio_cobro" ON "public"."cajas_movimientos" USING "btree" ("medio_cobro_id");



CREATE INDEX "idx_cajas_movimientos_referencia" ON "public"."cajas_movimientos" USING "btree" ("referencia_tipo", "referencia_id");



CREATE INDEX "idx_cajas_movimientos_tipo" ON "public"."cajas_movimientos" USING "btree" ("tipo_movimiento");



CREATE INDEX "idx_cajas_tipo" ON "public"."cajas" USING "btree" ("tipo");



CREATE INDEX "idx_categorias_company_id" ON "public"."categorias" USING "btree" ("company_id");



CREATE INDEX "idx_categorias_is_active" ON "public"."categorias" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_categorias_is_system" ON "public"."categorias" USING "btree" ("is_system_category");



CREATE INDEX "idx_categorias_nombre" ON "public"."categorias" USING "btree" ("nombre");



CREATE INDEX "idx_cc_archivos_created" ON "public"."centro_copiado_ordenes_archivos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cc_archivos_item" ON "public"."centro_copiado_ordenes_archivos" USING "btree" ("item_generado_id") WHERE ("item_generado_id" IS NOT NULL);



CREATE INDEX "idx_cc_archivos_orden" ON "public"."centro_copiado_ordenes_archivos" USING "btree" ("orden_copiado_id", "company_id");



CREATE INDEX "idx_cc_archivos_temporal" ON "public"."centro_copiado_ordenes_archivos" USING "btree" ("orden_temporal_id", "company_id") WHERE ("orden_temporal_id" IS NOT NULL);



CREATE INDEX "idx_cc_archivos_uploaded_by" ON "public"."centro_copiado_ordenes_archivos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_cc_movimientos_cliente_id" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("cliente_id");



CREATE INDEX "idx_cc_movimientos_company_id" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("company_id");



CREATE INDEX "idx_cc_movimientos_fecha" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("fecha");



CREATE INDEX "idx_cc_movimientos_liquidacion_id" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("liquidacion_id");



CREATE INDEX "idx_cc_movimientos_orden_id" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("orden_id");



CREATE INDEX "idx_cc_movimientos_tipo" ON "public"."cuentas_corrientes_movimientos" USING "btree" ("tipo_movimiento");



CREATE INDEX "idx_centro_copiado_ordenes_company" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id");



CREATE INDEX "idx_centro_copiado_ordenes_created_by_company" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id", "created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_centro_copiado_ordenes_estado" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id", "estado");



CREATE INDEX "idx_centro_copiado_ordenes_fecha" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id", "fecha_solicitud" DESC);



CREATE INDEX "idx_centro_copiado_ordenes_fecha_solicitud_company" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id", "fecha_solicitud") WHERE ("estado" <> 'cancelada'::"text");



CREATE INDEX "idx_centro_copiado_ordenes_items_orden" ON "public"."centro_copiado_ordenes_items" USING "btree" ("orden_copiado_id");



CREATE INDEX "idx_centro_copiado_ordenes_orden_trabajo_id" ON "public"."centro_copiado_ordenes" USING "btree" ("orden_trabajo_id") WHERE ("orden_trabajo_id" IS NOT NULL);



CREATE INDEX "idx_centro_copiado_ordenes_pagos_fecha_pago" ON "public"."centro_copiado_ordenes_pagos" USING "btree" ("fecha_pago");



CREATE INDEX "idx_centro_copiado_ordenes_pagos_medio_cobro_id" ON "public"."centro_copiado_ordenes_pagos" USING "btree" ("medio_cobro_id");



CREATE INDEX "idx_centro_copiado_ordenes_pagos_orden_id" ON "public"."centro_copiado_ordenes_pagos" USING "btree" ("orden_copiado_id");



CREATE INDEX "idx_centro_copiado_papeles_company" ON "public"."centro_copiado_papeles" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_papeles_orden" ON "public"."centro_copiado_papeles" USING "btree" ("company_id", "orden") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_plastificados_company_tipo" ON "public"."centro_copiado_plastificados" USING "btree" ("company_id", "tipo") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_plastificados_rangos" ON "public"."centro_copiado_plastificados" USING "btree" ("company_id", "tipo", "unidades_desde") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_precios_impresion_company" ON "public"."centro_copiado_precios_impresion" USING "btree" ("company_id");



CREATE INDEX "idx_centro_copiado_precios_impresion_lookup" ON "public"."centro_copiado_precios_impresion" USING "btree" ("tamanio_papel_id", "papel_id", "tipo_tinta", "rango_precio_id");



CREATE INDEX "idx_centro_copiado_rangos_anillado_company" ON "public"."centro_copiado_rangos_anillado" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_rangos_precio_impresion_company" ON "public"."centro_copiado_rangos_precio_impresion" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_rangos_precio_impresion_orden" ON "public"."centro_copiado_rangos_precio_impresion" USING "btree" ("company_id", "orden") WHERE ("is_active" = true);



CREATE INDEX "idx_centro_copiado_reporte_ventas" ON "public"."centro_copiado_ordenes" USING "btree" ("company_id", "fecha_solicitud", "estado");



CREATE INDEX "idx_centro_copiado_tamanios_papel_company" ON "public"."centro_copiado_tamanios_papel" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE INDEX "idx_cheques_client" ON "public"."cheques_cartera" USING "btree" ("client_id");



CREATE INDEX "idx_cheques_company" ON "public"."cheques_cartera" USING "btree" ("company_id");



CREATE INDEX "idx_cheques_direction" ON "public"."cheques_cartera" USING "btree" ("direction");



CREATE INDEX "idx_cheques_estado" ON "public"."cheques_cartera" USING "btree" ("estado");



CREATE INDEX "idx_cheques_fecha_pago" ON "public"."cheques_cartera" USING "btree" ("fecha_pago");



CREATE INDEX "idx_cheques_orden" ON "public"."cheques_cartera" USING "btree" ("orden_id");



CREATE INDEX "idx_cities_company_id" ON "public"."cities" USING "btree" ("company_id");



CREATE INDEX "idx_cities_name" ON "public"."cities" USING "btree" ("name");



CREATE INDEX "idx_cities_postal_code" ON "public"."cities" USING "btree" ("postal_code");



CREATE INDEX "idx_cities_province_id" ON "public"."cities" USING "btree" ("province_id");



CREATE INDEX "idx_clients_city_id_fkey" ON "public"."clients" USING "btree" ("city_id");



CREATE INDEX "idx_clients_company_id" ON "public"."clients" USING "btree" ("company_id");



CREATE INDEX "idx_clients_company_status" ON "public"."clients" USING "btree" ("company_id", "status_aprobacion");



CREATE INDEX "idx_clients_country_id_fkey" ON "public"."clients" USING "btree" ("country_id");



CREATE INDEX "idx_clients_created_at" ON "public"."clients" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_clients_created_by_fkey" ON "public"."clients" USING "btree" ("created_by");



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_clients_fecha_registro" ON "public"."clients" USING "btree" ("fecha_registro" DESC);



CREATE INDEX "idx_clients_is_active" ON "public"."clients" USING "btree" ("is_active");



CREATE INDEX "idx_clients_nombre_fantasia" ON "public"."clients" USING "btree" ("nombre_fantasia");



CREATE INDEX "idx_clients_numero_documento" ON "public"."clients" USING "btree" ("numero_documento");



CREATE INDEX "idx_clients_province_id_fkey" ON "public"."clients" USING "btree" ("province_id");



CREATE INDEX "idx_clients_razon_social" ON "public"."clients" USING "btree" ("razon_social");



CREATE INDEX "idx_clients_search" ON "public"."clients" USING "btree" ("company_id", "is_active", "nombre_fantasia", "razon_social");



CREATE INDEX "idx_clients_status_aprobacion" ON "public"."clients" USING "btree" ("status_aprobacion");



CREATE INDEX "idx_clients_updated_by_fkey" ON "public"."clients" USING "btree" ("updated_by");



CREATE INDEX "idx_companies_city_id" ON "public"."companies" USING "btree" ("city_id");



CREATE INDEX "idx_companies_country_id" ON "public"."companies" USING "btree" ("country_id");



CREATE INDEX "idx_companies_logo_url" ON "public"."companies" USING "btree" ("logo_url") WHERE ("logo_url" IS NOT NULL);



CREATE INDEX "idx_companies_province_id" ON "public"."companies" USING "btree" ("province_id");



CREATE INDEX "idx_companies_slug" ON "public"."companies" USING "btree" ("slug");



CREATE INDEX "idx_companies_tax_id_number" ON "public"."companies" USING "btree" ("tax_id_number");



CREATE INDEX "idx_company_business_hours_company_id" ON "public"."company_business_hours" USING "btree" ("company_id");



CREATE INDEX "idx_company_subscriptions_company_id" ON "public"."company_subscriptions" USING "btree" ("company_id");



CREATE INDEX "idx_company_subscriptions_plan_id_fkey" ON "public"."company_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_compras_company" ON "public"."compras_proveedores" USING "btree" ("company_id");



CREATE INDEX "idx_compras_estado" ON "public"."compras_proveedores" USING "btree" ("estado");



CREATE INDEX "idx_compras_provider" ON "public"."compras_proveedores" USING "btree" ("provider_id");



CREATE INDEX "idx_condiciones_company_id" ON "public"."presupuestos_condiciones_comerciales" USING "btree" ("company_id");



CREATE INDEX "idx_condiciones_es_default" ON "public"."presupuestos_condiciones_comerciales" USING "btree" ("es_default") WHERE ("es_default" = true);



CREATE INDEX "idx_condiciones_is_active" ON "public"."presupuestos_condiciones_comerciales" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_consumos_resumen" ON "public"."tarjetas_consumos" USING "btree" ("resumen_id");



CREATE INDEX "idx_countries_company_id" ON "public"."countries" USING "btree" ("company_id");



CREATE INDEX "idx_custom_roles_company_id" ON "public"."custom_roles" USING "btree" ("company_id");



CREATE INDEX "idx_custom_roles_created_by_fkey" ON "public"."custom_roles" USING "btree" ("created_by");



CREATE INDEX "idx_egresos_caja" ON "public"."egresos" USING "btree" ("caja_id");



CREATE INDEX "idx_egresos_company" ON "public"."egresos" USING "btree" ("company_id");



CREATE INDEX "idx_egresos_compra" ON "public"."egresos" USING "btree" ("compra_id");



CREATE INDEX "idx_egresos_fecha" ON "public"."egresos" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_egresos_proveedor" ON "public"."egresos" USING "btree" ("proveedor_id");



CREATE INDEX "idx_egresos_recurrente" ON "public"."egresos" USING "btree" ("recurrente_id");



CREATE INDEX "idx_egresos_tarjeta" ON "public"."egresos" USING "btree" ("tarjeta_id");



CREATE INDEX "idx_egresos_tipo" ON "public"."egresos" USING "btree" ("tipo_egreso_id");



CREATE INDEX "idx_estaciones_trabajo_company_id" ON "public"."estaciones_trabajo" USING "btree" ("company_id");



CREATE INDEX "idx_estaciones_trabajo_nombre" ON "public"."estaciones_trabajo" USING "btree" ("nombre");



CREATE INDEX "idx_facturas_historial_company" ON "public"."facturas_historial" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_facturas_historial_numero" ON "public"."facturas_historial" USING "btree" ("company_id", "numero_factura");



CREATE INDEX "idx_facturas_historial_orden" ON "public"."facturas_historial" USING "btree" ("orden_id");



CREATE INDEX "idx_facturas_urls_company_id" ON "public"."facturas_urls_cortas" USING "btree" ("company_id");



CREATE INDEX "idx_facturas_urls_expires_at" ON "public"."facturas_urls_cortas" USING "btree" ("expires_at");



CREATE INDEX "idx_facturas_urls_orden_id" ON "public"."facturas_urls_cortas" USING "btree" ("orden_trabajo_id");



CREATE INDEX "idx_ingresos_caja" ON "public"."ingresos" USING "btree" ("caja_id");



CREATE INDEX "idx_ingresos_company" ON "public"."ingresos" USING "btree" ("company_id");



CREATE INDEX "idx_ingresos_fecha" ON "public"."ingresos" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_ingresos_movimiento" ON "public"."ingresos" USING "btree" ("movimiento_id");



CREATE INDEX "idx_ingresos_tipo" ON "public"."ingresos" USING "btree" ("tipo_ingreso_id");



CREATE INDEX "idx_items_rutas_fecha_fin_completado" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("company_id", "fecha_fin") WHERE (("estado_paso" = 'completado'::"text") AND ("fecha_inicio" IS NOT NULL) AND ("fecha_fin" IS NOT NULL));



CREATE INDEX "idx_items_rutas_paso_nombre" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("company_id", "paso_nombre", "estado_paso");



CREATE INDEX "idx_items_rutas_tipo_etapa_estado" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("company_id", "tipo_etapa", "estado_paso");



CREATE INDEX "idx_links_created" ON "public"."ordenes_trabajo_links" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_links_created_by" ON "public"."ordenes_trabajo_links" USING "btree" ("created_by");



CREATE INDEX "idx_links_orden" ON "public"."ordenes_trabajo_links" USING "btree" ("orden_id", "company_id");



CREATE INDEX "idx_liquidaciones_cliente_id" ON "public"."liquidaciones" USING "btree" ("cliente_id");



CREATE INDEX "idx_liquidaciones_company_id" ON "public"."liquidaciones" USING "btree" ("company_id");



CREATE INDEX "idx_liquidaciones_estado" ON "public"."liquidaciones" USING "btree" ("estado");



CREATE INDEX "idx_liquidaciones_fecha_emision" ON "public"."liquidaciones" USING "btree" ("fecha_emision");



CREATE INDEX "idx_liquidaciones_items_liquidacion_id" ON "public"."liquidaciones_items" USING "btree" ("liquidacion_id");



CREATE INDEX "idx_liquidaciones_items_orden_id" ON "public"."liquidaciones_items" USING "btree" ("orden_id");



CREATE INDEX "idx_liquidaciones_numero" ON "public"."liquidaciones" USING "btree" ("numero_liquidacion");



CREATE INDEX "idx_liquidaciones_pagos_liquidacion_id" ON "public"."liquidaciones_pagos" USING "btree" ("liquidacion_id");



CREATE INDEX "idx_liquidaciones_pagos_pago_id" ON "public"."liquidaciones_pagos" USING "btree" ("pago_id");



CREATE INDEX "idx_login_attempts_created_at" ON "public"."login_attempts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_login_attempts_email" ON "public"."login_attempts" USING "btree" ("email");



CREATE INDEX "idx_materiales_company_id" ON "public"."materiales" USING "btree" ("company_id");



CREATE INDEX "idx_materiales_nombre" ON "public"."materiales" USING "btree" ("nombre");



CREATE INDEX "idx_medios_cobro_active" ON "public"."medios_cobro" USING "btree" ("is_active");



CREATE INDEX "idx_medios_cobro_caja_id" ON "public"."medios_cobro" USING "btree" ("caja_id");



CREATE INDEX "idx_medios_cobro_company_id" ON "public"."medios_cobro" USING "btree" ("company_id");



CREATE INDEX "idx_medios_cobro_orden" ON "public"."medios_cobro" USING "btree" ("orden");



CREATE INDEX "idx_medios_cobro_tipo" ON "public"."medios_cobro" USING "btree" ("tipo");



CREATE INDEX "idx_motivos_pausa_activos" ON "public"."pasos_motivos_pausa" USING "btree" ("company_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_motivos_pausa_categoria" ON "public"."pasos_motivos_pausa" USING "btree" ("categoria");



CREATE INDEX "idx_motivos_pausa_company" ON "public"."pasos_motivos_pausa" USING "btree" ("company_id");



CREATE INDEX "idx_notificaciones_company" ON "public"."notificaciones_internas" USING "btree" ("company_id");



CREATE INDEX "idx_notificaciones_no_leidas" ON "public"."notificaciones_internas" USING "btree" ("usuario_id", "company_id") WHERE ("leida" = false);



CREATE INDEX "idx_notificaciones_referencia" ON "public"."notificaciones_internas" USING "btree" ("referencia_tipo", "referencia_id");



CREATE INDEX "idx_notificaciones_usuario" ON "public"."notificaciones_internas" USING "btree" ("usuario_id", "leida", "created_at" DESC);



CREATE INDEX "idx_ordenes_acabados_compartidos_acabado" ON "public"."ordenes_trabajo_acabados_compartidos" USING "btree" ("acabado_id");



CREATE INDEX "idx_ordenes_acabados_compartidos_orden" ON "public"."ordenes_trabajo_acabados_compartidos" USING "btree" ("orden_trabajo_id");



CREATE INDEX "idx_ordenes_estado_entregada" ON "public"."ordenes_trabajo" USING "btree" ("estado") WHERE ("estado" = 'entregada'::"text");



CREATE INDEX "idx_ordenes_facturadas" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "facturada", "fecha_facturacion" DESC) WHERE ("facturada" = true);



CREATE INDEX "idx_ordenes_fecha_entrega_real" ON "public"."ordenes_trabajo" USING "btree" ("fecha_entrega_real") WHERE ("fecha_entrega_real" IS NOT NULL);



CREATE INDEX "idx_ordenes_items_estado" ON "public"."ordenes_trabajo_items" USING "btree" ("estado");



CREATE INDEX "idx_ordenes_items_orden_estado" ON "public"."ordenes_trabajo_items" USING "btree" ("orden_id", "estado");



CREATE INDEX "idx_ordenes_items_rutas_company" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("company_id");



CREATE INDEX "idx_ordenes_items_rutas_en_proceso" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("estado_paso", "fecha_inicio") WHERE ("estado_paso" = 'en_proceso'::"text");



CREATE INDEX "idx_ordenes_items_rutas_estado_paso" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("estado_paso");



CREATE INDEX "idx_ordenes_items_rutas_global_task" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("global_task_id");



CREATE INDEX "idx_ordenes_items_rutas_item_estado" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("orden_item_id", "estado_paso");



CREATE INDEX "idx_ordenes_items_rutas_orden_item" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("orden_item_id");



CREATE INDEX "idx_ordenes_items_rutas_orden_item_orden" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("orden_item_id", "orden");



CREATE INDEX "idx_ordenes_items_rutas_responsable" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("responsable_id");



CREATE INDEX "idx_ordenes_items_rutas_tipo_etapa" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("tipo_etapa");



CREATE INDEX "idx_ordenes_numero_factura" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "numero_factura") WHERE ("numero_factura" IS NOT NULL);



CREATE INDEX "idx_ordenes_pendientes_facturacion" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "requiere_factura", "facturada") WHERE (("requiere_factura" = true) AND ("facturada" = false));



CREATE INDEX "idx_ordenes_requiere_factura" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "requiere_factura") WHERE ("requiere_factura" = true);



CREATE INDEX "idx_ordenes_servicios_compartidos_orden" ON "public"."ordenes_trabajo_servicios_compartidos" USING "btree" ("orden_trabajo_id");



CREATE INDEX "idx_ordenes_servicios_compartidos_servicio" ON "public"."ordenes_trabajo_servicios_compartidos" USING "btree" ("servicio_id");



CREATE INDEX "idx_ordenes_trabajo_acabados_items_acabado_id" ON "public"."ordenes_trabajo_acabados_items" USING "btree" ("acabado_id");



CREATE INDEX "idx_ordenes_trabajo_acabados_items_orden_item_id" ON "public"."ordenes_trabajo_acabados_items" USING "btree" ("orden_item_id");



CREATE INDEX "idx_ordenes_trabajo_cliente_fecha_completado" ON "public"."ordenes_trabajo" USING "btree" ("cliente_id", "fecha_completado") WHERE (("estado" = 'completado'::"text") AND ("fecha_completado" IS NOT NULL));



CREATE INDEX "idx_ordenes_trabajo_cliente_id" ON "public"."ordenes_trabajo" USING "btree" ("cliente_id");



CREATE INDEX "idx_ordenes_trabajo_company_estado" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "estado");



CREATE INDEX "idx_ordenes_trabajo_company_id" ON "public"."ordenes_trabajo" USING "btree" ("company_id");



CREATE INDEX "idx_ordenes_trabajo_created_by_company" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_created_by_fkey" ON "public"."ordenes_trabajo" USING "btree" ("created_by");



CREATE INDEX "idx_ordenes_trabajo_estado" ON "public"."ordenes_trabajo" USING "btree" ("estado");



CREATE INDEX "idx_ordenes_trabajo_estado_fechas_cumplimiento" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "estado", "fecha_completado", "fecha_estimada_entrega") WHERE (("estado" = ANY (ARRAY['finalizada'::"text", 'entregada'::"text"])) AND ("fecha_completado" IS NOT NULL));



CREATE INDEX "idx_ordenes_trabajo_fecha_completado" ON "public"."ordenes_trabajo" USING "btree" ("fecha_completado") WHERE (("estado" = 'completado'::"text") AND ("fecha_completado" IS NOT NULL));



CREATE INDEX "idx_ordenes_trabajo_fecha_completado_range" ON "public"."ordenes_trabajo" USING "btree" ("fecha_completado" DESC) WHERE ("fecha_completado" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_fecha_creacion" ON "public"."ordenes_trabajo" USING "btree" ("fecha_creacion");



CREATE INDEX "idx_ordenes_trabajo_fecha_creacion_company" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "fecha_creacion") WHERE ("estado" <> ALL (ARRAY['cancelado'::"text", 'borrador'::"text"]));



CREATE INDEX "idx_ordenes_trabajo_fecha_estimada_entrega" ON "public"."ordenes_trabajo" USING "btree" ("fecha_estimada_entrega") WHERE ("fecha_estimada_entrega" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_historial_created_at" ON "public"."ordenes_trabajo_historial" USING "btree" ("created_at");



CREATE INDEX "idx_ordenes_trabajo_historial_orden_id" ON "public"."ordenes_trabajo_historial" USING "btree" ("orden_id");



CREATE INDEX "idx_ordenes_trabajo_historial_tipo_evento" ON "public"."ordenes_trabajo_historial" USING "btree" ("tipo_evento");



CREATE INDEX "idx_ordenes_trabajo_historial_usuario_id" ON "public"."ordenes_trabajo_historial" USING "btree" ("usuario_id");



CREATE INDEX "idx_ordenes_trabajo_items_acabados_globales_grupo" ON "public"."ordenes_trabajo_items" USING "gin" ("acabados_globales_grupo") WHERE ("acabados_globales_grupo" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_items_item_grupo_id" ON "public"."ordenes_trabajo_items" USING "btree" ("item_grupo_id") WHERE ("item_grupo_id" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_items_orden_id" ON "public"."ordenes_trabajo_items" USING "btree" ("orden_id");



CREATE INDEX "idx_ordenes_trabajo_items_producto" ON "public"."ordenes_trabajo_items" USING "btree" ("orden_id", "producto_nombre", "producto_categoria");



CREATE INDEX "idx_ordenes_trabajo_items_producto_categoria" ON "public"."ordenes_trabajo_items" USING "btree" ("producto_categoria");



CREATE INDEX "idx_ordenes_trabajo_items_producto_id" ON "public"."ordenes_trabajo_items" USING "btree" ("producto_id") WHERE ("producto_id" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_items_producto_nombre" ON "public"."ordenes_trabajo_items" USING "btree" ("producto_nombre");



CREATE INDEX "idx_ordenes_trabajo_items_rutas_paso_id_fkey" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("paso_id");



CREATE INDEX "idx_ordenes_trabajo_items_servicios_globales_grupo" ON "public"."ordenes_trabajo_items" USING "gin" ("servicios_globales_grupo") WHERE ("servicios_globales_grupo" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_items_tipo_item" ON "public"."ordenes_trabajo_items" USING "btree" ("tipo_item");



CREATE INDEX "idx_ordenes_trabajo_numero_orden" ON "public"."ordenes_trabajo" USING "btree" ("numero_orden");



CREATE INDEX "idx_ordenes_trabajo_pagos_created_by_fkey" ON "public"."ordenes_trabajo_pagos" USING "btree" ("created_by");



CREATE INDEX "idx_ordenes_trabajo_pagos_fecha_liberacion" ON "public"."ordenes_trabajo_pagos" USING "btree" ("fecha_liberacion_estimada");



CREATE INDEX "idx_ordenes_trabajo_pagos_fecha_pago" ON "public"."ordenes_trabajo_pagos" USING "btree" ("fecha_pago");



CREATE INDEX "idx_ordenes_trabajo_pagos_medio_cobro_id" ON "public"."ordenes_trabajo_pagos" USING "btree" ("medio_cobro_id");



CREATE INDEX "idx_ordenes_trabajo_pagos_orden_id" ON "public"."ordenes_trabajo_pagos" USING "btree" ("orden_id");



CREATE INDEX "idx_ordenes_trabajo_presupuesto_id" ON "public"."ordenes_trabajo" USING "btree" ("presupuesto_id") WHERE ("presupuesto_id" IS NOT NULL);



CREATE INDEX "idx_ordenes_trabajo_reporte_ventas" ON "public"."ordenes_trabajo" USING "btree" ("company_id", "fecha_creacion", "estado");



CREATE INDEX "idx_ordenes_trabajo_servicios_items_orden_item_id" ON "public"."ordenes_trabajo_servicios_items" USING "btree" ("orden_item_id");



CREATE INDEX "idx_ordenes_trabajo_servicios_items_servicio_id" ON "public"."ordenes_trabajo_servicios_items" USING "btree" ("servicio_id");



CREATE INDEX "idx_ordenes_trabajo_updated_by_fkey" ON "public"."ordenes_trabajo" USING "btree" ("updated_by");



CREATE INDEX "idx_ordenes_trabajo_vendedor_id" ON "public"."ordenes_trabajo" USING "btree" ("vendedor_id");



CREATE UNIQUE INDEX "idx_ordenes_tracking_token" ON "public"."ordenes_trabajo" USING "btree" ("tracking_token");



CREATE INDEX "idx_ots_orden_id" ON "public"."ordenes_trabajo_servicios" USING "btree" ("orden_id");



CREATE INDEX "idx_pasos_company_id" ON "public"."pasos" USING "btree" ("company_id");



CREATE INDEX "idx_pasos_estacion_id" ON "public"."pasos" USING "btree" ("estacion_id");



CREATE INDEX "idx_pasos_estacion_id_active" ON "public"."pasos" USING "btree" ("estacion_id") WHERE ("is_active" = true);



CREATE INDEX "idx_pasos_etapa" ON "public"."pasos" USING "btree" ("etapa");



CREATE INDEX "idx_pasos_nombre" ON "public"."pasos" USING "btree" ("nombre");



CREATE INDEX "idx_pausas_activas" ON "public"."ordenes_items_rutas_pausas" USING "btree" ("ruta_id") WHERE ("fecha_fin_pausa" IS NULL);



CREATE INDEX "idx_pausas_categoria" ON "public"."ordenes_items_rutas_pausas" USING "btree" ("categoria_motivo");



CREATE INDEX "idx_pausas_fecha_inicio" ON "public"."ordenes_items_rutas_pausas" USING "btree" ("fecha_inicio_pausa");



CREATE INDEX "idx_pausas_motivo" ON "public"."ordenes_items_rutas_pausas" USING "btree" ("motivo_pausa_id");



CREATE INDEX "idx_pausas_ruta" ON "public"."ordenes_items_rutas_pausas" USING "btree" ("ruta_id");



CREATE INDEX "idx_pedidos_cliente_id" ON "public"."pedidos" USING "btree" ("cliente_id");



CREATE INDEX "idx_pedidos_company_id" ON "public"."pedidos" USING "btree" ("company_id");



CREATE INDEX "idx_pedidos_created_by" ON "public"."pedidos" USING "btree" ("created_by");



CREATE INDEX "idx_pedidos_estado" ON "public"."pedidos" USING "btree" ("estado");



CREATE INDEX "idx_pedidos_fecha_pedido" ON "public"."pedidos" USING "btree" ("fecha_pedido");



CREATE INDEX "idx_pedidos_numero_pedido" ON "public"."pedidos" USING "btree" ("numero_pedido");



CREATE INDEX "idx_pedidos_opciones_opcion_id" ON "public"."pedidos_opciones" USING "btree" ("opcion_id");



CREATE INDEX "idx_pedidos_opciones_pedido_id" ON "public"."pedidos_opciones" USING "btree" ("pedido_id");



CREATE INDEX "idx_pedidos_opciones_tipo_opcion" ON "public"."pedidos_opciones" USING "btree" ("tipo_opcion");



CREATE INDEX "idx_pedidos_producto_id" ON "public"."pedidos" USING "btree" ("producto_id");



CREATE INDEX "idx_pedidos_rutas_resueltas_estado_paso" ON "public"."pedidos_rutas_resueltas" USING "btree" ("estado_paso");



CREATE INDEX "idx_pedidos_rutas_resueltas_orden" ON "public"."pedidos_rutas_resueltas" USING "btree" ("orden");



CREATE INDEX "idx_pedidos_rutas_resueltas_paso_id" ON "public"."pedidos_rutas_resueltas" USING "btree" ("paso_id");



CREATE INDEX "idx_pedidos_rutas_resueltas_pedido_id" ON "public"."pedidos_rutas_resueltas" USING "btree" ("pedido_id");



CREATE INDEX "idx_pedidos_rutas_resueltas_responsable_id" ON "public"."pedidos_rutas_resueltas" USING "btree" ("responsable_id");



CREATE INDEX "idx_pedidos_rutas_resueltas_tipo_etapa" ON "public"."pedidos_rutas_resueltas" USING "btree" ("tipo_etapa");



CREATE INDEX "idx_pedidos_updated_by_fkey" ON "public"."pedidos" USING "btree" ("updated_by");



CREATE INDEX "idx_pgf_acabados_acabado" ON "public"."productos_gran_formato_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_pgf_acabados_active" ON "public"."productos_gran_formato_acabados" USING "btree" ("is_active");



CREATE INDEX "idx_pgf_acabados_producto" ON "public"."productos_gran_formato_acabados" USING "btree" ("producto_gran_formato_id");



CREATE INDEX "idx_pgf_materiales_material" ON "public"."productos_gran_formato_materiales" USING "btree" ("material_id");



CREATE INDEX "idx_pgf_materiales_producto" ON "public"."productos_gran_formato_materiales" USING "btree" ("producto_gran_formato_id");



CREATE INDEX "idx_pgf_precios_company" ON "public"."productos_gran_formato_precios" USING "btree" ("company_id");



CREATE INDEX "idx_pgf_precios_lookup" ON "public"."productos_gran_formato_precios" USING "btree" ("producto_gran_formato_id", "tecnologia_id", "tinta");



CREATE INDEX "idx_pgf_precios_producto" ON "public"."productos_gran_formato_precios" USING "btree" ("producto_gran_formato_id");



CREATE INDEX "idx_pgf_precios_rangos" ON "public"."productos_gran_formato_precios" USING "btree" ("rango_precio_min", "rango_precio_max");



CREATE INDEX "idx_pgf_precios_tecnologia" ON "public"."productos_gran_formato_precios" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_pgf_precios_tinta" ON "public"."productos_gran_formato_precios" USING "btree" ("tinta");



CREATE INDEX "idx_pgf_servicios_active" ON "public"."productos_gran_formato_servicios" USING "btree" ("is_active");



CREATE INDEX "idx_pgf_servicios_producto" ON "public"."productos_gran_formato_servicios" USING "btree" ("producto_gran_formato_id");



CREATE INDEX "idx_pgf_servicios_servicio" ON "public"."productos_gran_formato_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_pgf_tecnologias_producto" ON "public"."productos_gran_formato_tecnologias" USING "btree" ("producto_gran_formato_id");



CREATE INDEX "idx_pgf_tecnologias_tecnologia" ON "public"."productos_gran_formato_tecnologias" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_pl_acabados_acabado" ON "public"."productos_impresion_laser_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_pl_acabados_active" ON "public"."productos_impresion_laser_acabados" USING "btree" ("is_active");



CREATE INDEX "idx_pl_acabados_producto" ON "public"."productos_impresion_laser_acabados" USING "btree" ("producto_laser_id");



CREATE INDEX "idx_pl_materiales_material" ON "public"."productos_impresion_laser_materiales" USING "btree" ("material_id");



CREATE INDEX "idx_pl_materiales_producto" ON "public"."productos_impresion_laser_materiales" USING "btree" ("producto_laser_id");



CREATE INDEX "idx_pl_precios_company" ON "public"."productos_impresion_laser_precios" USING "btree" ("company_id");



CREATE INDEX "idx_pl_precios_producto" ON "public"."productos_impresion_laser_precios" USING "btree" ("producto_laser_id");



CREATE INDEX "idx_pl_precios_producto_medida" ON "public"."productos_impresion_laser_precios" USING "btree" ("producto_laser_id", "medida_ancho", "medida_alto");



CREATE INDEX "idx_pl_precios_rangos" ON "public"."productos_impresion_laser_precios" USING "btree" ("rango_precio_min", "rango_precio_max");



CREATE INDEX "idx_pl_precios_tinta" ON "public"."productos_impresion_laser_precios" USING "btree" ("tinta");



CREATE INDEX "idx_pl_servicios_active" ON "public"."productos_impresion_laser_servicios" USING "btree" ("is_active");



CREATE INDEX "idx_pl_servicios_producto" ON "public"."productos_impresion_laser_servicios" USING "btree" ("producto_laser_id");



CREATE INDEX "idx_pl_servicios_servicio" ON "public"."productos_impresion_laser_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_pl_tecnologias_producto" ON "public"."productos_impresion_laser_tecnologias" USING "btree" ("producto_laser_id");



CREATE INDEX "idx_pl_tecnologias_tecnologia" ON "public"."productos_impresion_laser_tecnologias" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_pl_tecnologias_tintas_gin" ON "public"."productos_impresion_laser_tecnologias" USING "gin" ("tintas");



CREATE INDEX "idx_plotter_corte_acabados_acabado_id" ON "public"."productos_plotter_corte_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_plotter_corte_acabados_producto_id" ON "public"."productos_plotter_corte_acabados" USING "btree" ("producto_id");



CREATE INDEX "idx_plotter_corte_precios_ancho" ON "public"."productos_plotter_corte_precios" USING "btree" ("ancho");



CREATE INDEX "idx_plotter_corte_precios_cantidad_desde" ON "public"."productos_plotter_corte_precios" USING "btree" ("cantidad_desde");



CREATE INDEX "idx_plotter_corte_precios_producto_ancho" ON "public"."productos_plotter_corte_precios" USING "btree" ("producto_id", "ancho");



CREATE INDEX "idx_plotter_corte_precios_producto_id" ON "public"."productos_plotter_corte_precios" USING "btree" ("producto_id");



CREATE INDEX "idx_plotter_corte_servicios_producto_id" ON "public"."productos_plotter_corte_servicios" USING "btree" ("producto_id");



CREATE INDEX "idx_plotter_corte_servicios_servicio_id" ON "public"."productos_plotter_corte_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_pmr_acabados_acabado" ON "public"."productos_materiales_rigidos_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_pmr_acabados_active" ON "public"."productos_materiales_rigidos_acabados" USING "btree" ("is_active");



CREATE INDEX "idx_pmr_acabados_producto" ON "public"."productos_materiales_rigidos_acabados" USING "btree" ("producto_materiales_rigidos_id");



CREATE INDEX "idx_pmr_materiales_combo_with_esp" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("producto_materiales_rigidos_id", "material_id", "variante_nombre", "espesor") WHERE ("espesor" IS NOT NULL);



CREATE INDEX "idx_pmr_materiales_combo_without_esp" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("producto_materiales_rigidos_id", "material_id", "variante_nombre") WHERE ("espesor" IS NULL);



CREATE INDEX "idx_pmr_materiales_material" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("material_id");



CREATE INDEX "idx_pmr_materiales_producto" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("producto_materiales_rigidos_id");



CREATE INDEX "idx_pmr_precios_combo_with_esp" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id", "producto_materiales_rigidos_id", "material_id", "variante_nombre", "espesor") WHERE ("espesor" IS NOT NULL);



CREATE INDEX "idx_pmr_precios_combo_without_esp" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id", "producto_materiales_rigidos_id", "material_id", "variante_nombre") WHERE ("espesor" IS NULL);



CREATE INDEX "idx_pmr_precios_company" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id");



CREATE INDEX "idx_pmr_precios_company_producto" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id", "producto_materiales_rigidos_id");



CREATE INDEX "idx_pmr_precios_material" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("material_id");



CREATE INDEX "idx_pmr_precios_producto" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("producto_materiales_rigidos_id");



CREATE INDEX "idx_pmr_servicios_active" ON "public"."productos_materiales_rigidos_servicios" USING "btree" ("is_active");



CREATE INDEX "idx_pmr_servicios_producto" ON "public"."productos_materiales_rigidos_servicios" USING "btree" ("producto_materiales_rigidos_id");



CREATE INDEX "idx_pmr_servicios_servicio" ON "public"."productos_materiales_rigidos_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_portabanners_acabados_acabado_id" ON "public"."productos_portabanners_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_portabanners_acabados_producto_id" ON "public"."productos_portabanners_acabados" USING "btree" ("producto_id");



CREATE INDEX "idx_portabanners_precios_company" ON "public"."productos_portabanners_precios" USING "btree" ("company_id");



CREATE INDEX "idx_portabanners_precios_lookup" ON "public"."productos_portabanners_precios" USING "btree" ("producto_id", "ancho_cm", "alto_cm");



CREATE INDEX "idx_portabanners_precios_medidas" ON "public"."productos_portabanners_precios" USING "btree" ("ancho_cm", "alto_cm");



CREATE INDEX "idx_portabanners_precios_producto" ON "public"."productos_portabanners_precios" USING "btree" ("producto_id");



CREATE INDEX "idx_portabanners_precios_rangos" ON "public"."productos_portabanners_precios" USING "btree" ("cantidad_desde", "cantidad_hasta");



CREATE INDEX "idx_portabanners_precios_tecnologia" ON "public"."productos_portabanners_precios" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_portabanners_servicios_producto_id" ON "public"."productos_portabanners_servicios" USING "btree" ("producto_id");



CREATE INDEX "idx_portabanners_servicios_servicio_id" ON "public"."productos_portabanners_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_portabanners_tecnologias_producto" ON "public"."productos_portabanners_tecnologias" USING "btree" ("producto_id");



CREATE INDEX "idx_portabanners_tecnologias_tecnologia" ON "public"."productos_portabanners_tecnologias" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_presupuestos_acabados_compartidos_acabado" ON "public"."presupuestos_acabados_compartidos" USING "btree" ("acabado_id");



CREATE INDEX "idx_presupuestos_acabados_compartidos_presupuesto" ON "public"."presupuestos_acabados_compartidos" USING "btree" ("presupuesto_id");



CREATE INDEX "idx_presupuestos_archivos_company_id" ON "public"."presupuestos_archivos" USING "btree" ("company_id");



CREATE INDEX "idx_presupuestos_archivos_presupuesto_id" ON "public"."presupuestos_archivos" USING "btree" ("presupuesto_id") WHERE ("presupuesto_id" IS NOT NULL);



CREATE INDEX "idx_presupuestos_archivos_temporal" ON "public"."presupuestos_archivos" USING "btree" ("presupuesto_temporal_id") WHERE ("presupuesto_temporal_id" IS NOT NULL);



CREATE INDEX "idx_presupuestos_cliente_id" ON "public"."presupuestos" USING "btree" ("cliente_id");



CREATE INDEX "idx_presupuestos_company_id" ON "public"."presupuestos" USING "btree" ("company_id");



CREATE INDEX "idx_presupuestos_estado" ON "public"."presupuestos" USING "btree" ("estado");



CREATE INDEX "idx_presupuestos_fecha_creacion" ON "public"."presupuestos" USING "btree" ("fecha_creacion" DESC);



CREATE INDEX "idx_presupuestos_historial_created_at" ON "public"."presupuestos_historial" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_presupuestos_historial_presupuesto_id" ON "public"."presupuestos_historial" USING "btree" ("presupuesto_id");



CREATE INDEX "idx_presupuestos_items_presupuesto_id" ON "public"."presupuestos_items" USING "btree" ("presupuesto_id");



CREATE INDEX "idx_presupuestos_items_producto_id" ON "public"."presupuestos_items" USING "btree" ("producto_id") WHERE ("producto_id" IS NOT NULL);



CREATE INDEX "idx_presupuestos_items_sin_precio" ON "public"."presupuestos_items" USING "btree" ("presupuesto_id") WHERE (("precio_unitario_final" IS NULL) OR ("precio_total" IS NULL));



CREATE INDEX "idx_presupuestos_orden_trabajo_id" ON "public"."presupuestos" USING "btree" ("orden_trabajo_id") WHERE ("orden_trabajo_id" IS NOT NULL);



CREATE INDEX "idx_presupuestos_servicios_compartidos_presupuesto" ON "public"."presupuestos_servicios_compartidos" USING "btree" ("presupuesto_id");



CREATE INDEX "idx_presupuestos_servicios_compartidos_servicio" ON "public"."presupuestos_servicios_compartidos" USING "btree" ("servicio_id");



CREATE INDEX "idx_presupuestos_tracking_token" ON "public"."presupuestos" USING "btree" ("tracking_token") WHERE ("tracking_token" IS NOT NULL);



CREATE INDEX "idx_presupuestos_vendedor_id" ON "public"."presupuestos" USING "btree" ("vendedor_id");



CREATE INDEX "idx_productos_acabados_v2_acabado_id" ON "public"."productos_acabados_v2" USING "btree" ("acabado_id");



CREATE INDEX "idx_productos_acabados_v2_producto" ON "public"."productos_acabados_v2" USING "btree" ("producto_tipo", "producto_id");



CREATE INDEX "idx_productos_categoria_id" ON "public"."productos" USING "btree" ("categoria_id");



CREATE INDEX "idx_productos_company_id" ON "public"."productos" USING "btree" ("company_id");



CREATE INDEX "idx_productos_gran_formato_active" ON "public"."productos_gran_formato" USING "btree" ("is_active");



CREATE INDEX "idx_productos_gran_formato_cantidad_minima" ON "public"."productos_gran_formato" USING "btree" ("cantidad_minima") WHERE ("cantidad_minima" IS NOT NULL);



CREATE INDEX "idx_productos_gran_formato_company" ON "public"."productos_gran_formato" USING "btree" ("company_id");



CREATE INDEX "idx_productos_gran_formato_nombre" ON "public"."productos_gran_formato" USING "btree" ("nombre");



CREATE INDEX "idx_productos_gran_formato_rango_precio" ON "public"."productos_gran_formato" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_gran_formato_ruta_produccion_id" ON "public"."productos_gran_formato" USING "btree" ("ruta_produccion_id") WHERE ("ruta_produccion_id" IS NOT NULL);



CREATE INDEX "idx_productos_gran_formato_tipo_venta" ON "public"."productos_gran_formato" USING "btree" ("tipo_venta");



CREATE INDEX "idx_productos_impresion_laser_active" ON "public"."productos_impresion_laser" USING "btree" ("is_active");



CREATE INDEX "idx_productos_impresion_laser_company" ON "public"."productos_impresion_laser" USING "btree" ("company_id");



CREATE INDEX "idx_productos_impresion_laser_nombre" ON "public"."productos_impresion_laser" USING "btree" ("nombre");



CREATE INDEX "idx_productos_impresion_laser_ruta_produccion_id" ON "public"."productos_impresion_laser" USING "btree" ("ruta_produccion_id") WHERE ("ruta_produccion_id" IS NOT NULL);



CREATE INDEX "idx_productos_is_active" ON "public"."productos" USING "btree" ("is_active");



CREATE INDEX "idx_productos_laser_rango_precio" ON "public"."productos_impresion_laser" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_materiales_material_id" ON "public"."productos_materiales" USING "btree" ("material_id");



CREATE INDEX "idx_productos_materiales_producto_id" ON "public"."productos_materiales" USING "btree" ("producto_id");



CREATE INDEX "idx_productos_materiales_rigidos_active" ON "public"."productos_materiales_rigidos" USING "btree" ("is_active");



CREATE INDEX "idx_productos_materiales_rigidos_cantidad_minima" ON "public"."productos_materiales_rigidos" USING "btree" ("cantidad_minima") WHERE ("cantidad_minima" IS NOT NULL);



CREATE INDEX "idx_productos_materiales_rigidos_company" ON "public"."productos_materiales_rigidos" USING "btree" ("company_id");



CREATE INDEX "idx_productos_materiales_rigidos_nombre" ON "public"."productos_materiales_rigidos" USING "btree" ("nombre");



CREATE INDEX "idx_productos_materiales_rigidos_rango_precio" ON "public"."productos_materiales_rigidos" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_materiales_rigidos_ruta_produccion_id" ON "public"."productos_materiales_rigidos" USING "btree" ("ruta_produccion_id") WHERE ("ruta_produccion_id" IS NOT NULL);



CREATE INDEX "idx_productos_materiales_v2_material_id" ON "public"."productos_materiales_v2" USING "btree" ("material_id");



CREATE INDEX "idx_productos_materiales_v2_producto" ON "public"."productos_materiales_v2" USING "btree" ("producto_tipo", "producto_id");



CREATE INDEX "idx_productos_nombre" ON "public"."productos" USING "btree" ("nombre");



CREATE INDEX "idx_productos_plotter_corte_company_active" ON "public"."productos_plotter_corte" USING "btree" ("company_id", "is_active");



CREATE INDEX "idx_productos_plotter_corte_company_id" ON "public"."productos_plotter_corte" USING "btree" ("company_id");



CREATE INDEX "idx_productos_plotter_corte_is_active" ON "public"."productos_plotter_corte" USING "btree" ("is_active");



CREATE INDEX "idx_productos_plotter_corte_material_id" ON "public"."productos_plotter_corte" USING "btree" ("material_id");



CREATE INDEX "idx_productos_plotter_corte_nombre" ON "public"."productos_plotter_corte" USING "btree" ("nombre");



CREATE INDEX "idx_productos_plotter_corte_rango_precio_id" ON "public"."productos_plotter_corte" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_plotter_corte_ruta_produccion_id" ON "public"."productos_plotter_corte" USING "btree" ("ruta_produccion_id");



CREATE INDEX "idx_productos_portabanners_company_active" ON "public"."productos_portabanners" USING "btree" ("company_id", "is_active");



CREATE INDEX "idx_productos_portabanners_company_id" ON "public"."productos_portabanners" USING "btree" ("company_id");



CREATE INDEX "idx_productos_portabanners_is_active" ON "public"."productos_portabanners" USING "btree" ("is_active");



CREATE INDEX "idx_productos_portabanners_nombre" ON "public"."productos_portabanners" USING "btree" ("nombre");



CREATE INDEX "idx_productos_portabanners_rango_precio_id" ON "public"."productos_portabanners" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_portabanners_ruta_produccion_id" ON "public"."productos_portabanners" USING "btree" ("ruta_produccion_id");



CREATE INDEX "idx_productos_portabanners_tecnologia_id" ON "public"."productos_portabanners" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_productos_pricing_producto_id" ON "public"."productos_pricing" USING "btree" ("producto_id");



CREATE INDEX "idx_productos_pricing_rango_precio_id" ON "public"."productos_pricing" USING "btree" ("rango_precio_id");



CREATE INDEX "idx_productos_producto_impreso" ON "public"."productos" USING "btree" ("producto_impreso") WHERE ("is_active" = true);



CREATE INDEX "idx_productos_rutas_produccion_grupo_paso_id" ON "public"."productos_rutas_produccion" USING "btree" ("grupo_paso_id");



CREATE INDEX "idx_productos_rutas_produccion_orden" ON "public"."productos_rutas_produccion" USING "btree" ("orden");



CREATE INDEX "idx_productos_rutas_produccion_paso_id" ON "public"."productos_rutas_produccion" USING "btree" ("paso_id");



CREATE INDEX "idx_productos_rutas_produccion_producto_id" ON "public"."productos_rutas_produccion" USING "btree" ("producto_id");



CREATE INDEX "idx_productos_rutas_produccion_tipo_etapa" ON "public"."productos_rutas_produccion" USING "btree" ("tipo_etapa");



CREATE INDEX "idx_productos_sellos_company_id" ON "public"."productos_sellos" USING "btree" ("company_id");



CREATE INDEX "idx_productos_sellos_is_active" ON "public"."productos_sellos" USING "btree" ("is_active");



CREATE INDEX "idx_productos_sellos_nombre" ON "public"."productos_sellos" USING "btree" ("nombre");



CREATE INDEX "idx_productos_sellos_ruta" ON "public"."productos_sellos" USING "btree" ("ruta_produccion_id");



CREATE INDEX "idx_productos_sellos_tipo_producto" ON "public"."productos_sellos" USING "btree" ("tipo_producto");



CREATE INDEX "idx_productos_servicios_v2_producto" ON "public"."productos_servicios_v2" USING "btree" ("producto_tipo", "producto_id");



CREATE INDEX "idx_productos_servicios_v2_servicio_id" ON "public"."productos_servicios_v2" USING "btree" ("servicio_id");



CREATE INDEX "idx_productos_talonarios_active" ON "public"."productos_talonarios" USING "btree" ("is_active");



CREATE INDEX "idx_productos_talonarios_company" ON "public"."productos_talonarios" USING "btree" ("company_id");



CREATE INDEX "idx_productos_talonarios_nombre" ON "public"."productos_talonarios" USING "btree" ("nombre");



CREATE INDEX "idx_productos_talonarios_ruta" ON "public"."productos_talonarios" USING "btree" ("ruta_produccion_id");



CREATE INDEX "idx_productos_tecnologias_v2_producto" ON "public"."productos_tecnologias_v2" USING "btree" ("producto_tipo", "producto_id");



CREATE INDEX "idx_productos_tecnologias_v2_tecnologia_id" ON "public"."productos_tecnologias_v2" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_productos_tipo_medida" ON "public"."productos" USING "btree" ("tipo_medida");



CREATE INDEX "idx_profiles_company_id" ON "public"."profiles" USING "btree" ("company_id");



CREATE INDEX "idx_profiles_custom_role_id" ON "public"."profiles" USING "btree" ("custom_role_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_providers_city_id_fkey" ON "public"."providers" USING "btree" ("city_id");



CREATE INDEX "idx_providers_company_active_name" ON "public"."providers" USING "btree" ("company_id", "is_active", "nombre_fantasia");



CREATE INDEX "idx_providers_company_id" ON "public"."providers" USING "btree" ("company_id");



CREATE INDEX "idx_providers_country_id_fkey" ON "public"."providers" USING "btree" ("country_id");



CREATE INDEX "idx_providers_created_at" ON "public"."providers" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_providers_created_by_fkey" ON "public"."providers" USING "btree" ("created_by");



CREATE INDEX "idx_providers_email" ON "public"."providers" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_providers_is_active" ON "public"."providers" USING "btree" ("is_active");



CREATE INDEX "idx_providers_nombre_fantasia" ON "public"."providers" USING "btree" ("nombre_fantasia");



CREATE INDEX "idx_providers_numero_documento" ON "public"."providers" USING "btree" ("numero_documento");



CREATE INDEX "idx_providers_province_id_fkey" ON "public"."providers" USING "btree" ("province_id");



CREATE INDEX "idx_providers_razon_social" ON "public"."providers" USING "btree" ("razon_social");



CREATE INDEX "idx_providers_tipo_egreso" ON "public"."providers" USING "btree" ("tipo_egreso_id");



CREATE INDEX "idx_providers_updated_by_fkey" ON "public"."providers" USING "btree" ("updated_by");



CREATE INDEX "idx_provinces_company_id" ON "public"."provinces" USING "btree" ("company_id");



CREATE INDEX "idx_provinces_country_id" ON "public"."provinces" USING "btree" ("country_id");



CREATE INDEX "idx_provinces_name" ON "public"."provinces" USING "btree" ("name");



CREATE INDEX "idx_pt_acabados_acabado" ON "public"."productos_talonarios_acabados" USING "btree" ("acabado_id");



CREATE INDEX "idx_pt_acabados_producto" ON "public"."productos_talonarios_acabados" USING "btree" ("producto_talonario_id");



CREATE INDEX "idx_pt_materiales_material" ON "public"."productos_talonarios_materiales" USING "btree" ("material_id");



CREATE INDEX "idx_pt_materiales_producto" ON "public"."productos_talonarios_materiales" USING "btree" ("producto_talonario_id");



CREATE INDEX "idx_pt_precios_company" ON "public"."productos_talonarios_precios" USING "btree" ("company_id");



CREATE INDEX "idx_pt_precios_producto" ON "public"."productos_talonarios_precios" USING "btree" ("producto_talonario_id");



CREATE INDEX "idx_pt_precios_producto_medida" ON "public"."productos_talonarios_precios" USING "btree" ("producto_talonario_id", "medida_ancho", "medida_alto");



CREATE INDEX "idx_pt_precios_tinta" ON "public"."productos_talonarios_precios" USING "btree" ("tinta");



CREATE INDEX "idx_pt_servicios_producto" ON "public"."productos_talonarios_servicios" USING "btree" ("producto_talonario_id");



CREATE INDEX "idx_pt_servicios_servicio" ON "public"."productos_talonarios_servicios" USING "btree" ("servicio_id");



CREATE INDEX "idx_pt_tecnologias_producto" ON "public"."productos_talonarios_tecnologias" USING "btree" ("producto_talonario_id");



CREATE INDEX "idx_pt_tecnologias_tecnologia" ON "public"."productos_talonarios_tecnologias" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_rangos_precio_company_id" ON "public"."rangos_precio" USING "btree" ("company_id");



CREATE INDEX "idx_rangos_precio_nombre" ON "public"."rangos_precio" USING "btree" ("nombre");



CREATE INDEX "idx_recurring_exec_lookup" ON "public"."recurring_executions" USING "btree" ("recurring_id", "periodo");



CREATE INDEX "idx_recurring_expenses_active" ON "public"."recurring_expenses" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_recurring_expenses_company" ON "public"."recurring_expenses" USING "btree" ("company_id");



CREATE INDEX "idx_registro_intentos_created_at" ON "public"."cliente_registro_intentos" USING "btree" ("created_at");



CREATE INDEX "idx_registro_intentos_ip_company" ON "public"."cliente_registro_intentos" USING "btree" ("ip_address", "company_id");



CREATE INDEX "idx_resumenes_periodo" ON "public"."tarjetas_resumenes" USING "btree" ("periodo");



CREATE INDEX "idx_resumenes_tarjeta" ON "public"."tarjetas_resumenes" USING "btree" ("tarjeta_id");



CREATE INDEX "idx_role_permissions_module_id" ON "public"."role_permissions" USING "btree" ("module_id");



CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_rutas_pausadas" ON "public"."ordenes_trabajo_items_rutas" USING "btree" ("company_id", "estado_paso") WHERE ("estado_paso" = 'pausado'::"text");



CREATE INDEX "idx_rutas_produccion_company_id" ON "public"."rutas_produccion" USING "btree" ("company_id");



CREATE INDEX "idx_rutas_produccion_is_active" ON "public"."rutas_produccion" USING "btree" ("is_active");



CREATE INDEX "idx_rutas_produccion_nombre" ON "public"."rutas_produccion" USING "btree" ("nombre");



CREATE INDEX "idx_rutas_produccion_pasos_etapa" ON "public"."rutas_produccion_pasos" USING "btree" ("etapa");



CREATE INDEX "idx_rutas_produccion_pasos_paso_id" ON "public"."rutas_produccion_pasos" USING "btree" ("paso_id");



CREATE INDEX "idx_rutas_produccion_pasos_ruta_etapa_orden" ON "public"."rutas_produccion_pasos" USING "btree" ("ruta_id", "etapa", "orden");



CREATE INDEX "idx_rutas_produccion_pasos_ruta_id" ON "public"."rutas_produccion_pasos" USING "btree" ("ruta_id");



CREATE INDEX "idx_rutas_produccion_pasos_tipo_condicion" ON "public"."rutas_produccion_pasos" USING "btree" ("tipo_condicion");



CREATE INDEX "idx_sellos_precios_producto_id" ON "public"."productos_sellos_precios" USING "btree" ("producto_id");



CREATE INDEX "idx_servicios_alcance" ON "public"."servicios" USING "btree" ("alcance");



CREATE INDEX "idx_servicios_categorias_categoria_id" ON "public"."servicios_categorias" USING "btree" ("categoria_id");



CREATE INDEX "idx_servicios_categorias_servicio_id" ON "public"."servicios_categorias" USING "btree" ("servicio_id");



CREATE INDEX "idx_servicios_company_id" ON "public"."servicios" USING "btree" ("company_id");



CREATE INDEX "idx_servicios_estacion_id" ON "public"."servicios" USING "btree" ("estacion_id");



CREATE INDEX "idx_servicios_niveles_precio_orden" ON "public"."servicios_niveles_precio" USING "btree" ("orden");



CREATE INDEX "idx_servicios_niveles_precio_paso_id" ON "public"."servicios_niveles_precio" USING "btree" ("paso_id") WHERE ("paso_id" IS NOT NULL);



CREATE INDEX "idx_servicios_niveles_precio_servicio_id" ON "public"."servicios_niveles_precio" USING "btree" ("servicio_id");



CREATE INDEX "idx_servicios_nombre" ON "public"."servicios" USING "btree" ("nombre");



CREATE INDEX "idx_servicios_pasos_paso_id" ON "public"."servicios_pasos" USING "btree" ("paso_id");



CREATE INDEX "idx_servicios_pasos_servicio_id" ON "public"."servicios_pasos" USING "btree" ("servicio_id");



CREATE INDEX "idx_servicios_tipo_impacto_combinado" ON "public"."servicios" USING "btree" ("tipo_impacto") WHERE ("tipo_impacto" = ANY (ARRAY['fijo_porcentual'::"text", 'fijo_mt2'::"text", 'fijo_mt_lineal'::"text", 'fijo_minuto'::"text"]));



CREATE INDEX "idx_tarjetas_company" ON "public"."tarjetas_credito" USING "btree" ("company_id");



CREATE INDEX "idx_tecnologias_company_id" ON "public"."tecnologias" USING "btree" ("company_id");



CREATE INDEX "idx_tecnologias_nombre" ON "public"."tecnologias" USING "btree" ("nombre");



CREATE INDEX "idx_tecnologias_tintas_gin" ON "public"."tecnologias" USING "gin" ("tintas");



CREATE INDEX "idx_tecnologias_tintas_pasos_paso_id" ON "public"."tecnologias_tintas_pasos" USING "btree" ("paso_id") WHERE ("paso_id" IS NOT NULL);



CREATE INDEX "idx_tecnologias_tintas_pasos_tecnologia_id" ON "public"."tecnologias_tintas_pasos" USING "btree" ("tecnologia_id");



CREATE INDEX "idx_tecnologias_tintas_pasos_tecnologia_tinta" ON "public"."tecnologias_tintas_pasos" USING "btree" ("tecnologia_id", "tinta");



CREATE INDEX "idx_tipos_egreso_company" ON "public"."tipos_egreso" USING "btree" ("company_id");



CREATE INDEX "idx_tipos_ingreso_active" ON "public"."tipos_ingreso" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_tipos_ingreso_company" ON "public"."tipos_ingreso" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_unique_precio_cantidades" ON "public"."productos_impresion_laser_precios" USING "btree" ("producto_laser_id", "medida_ancho", "medida_alto", "tinta", "cantidad", "cara_impresa") WHERE ("cantidad" IS NOT NULL);



CREATE UNIQUE INDEX "idx_unique_precio_rangos" ON "public"."productos_impresion_laser_precios" USING "btree" ("producto_laser_id", "medida_ancho", "medida_alto", "tinta", "rango_precio_min", "rango_precio_max", "cara_impresa") WHERE ("rango_precio_min" IS NOT NULL);



CREATE INDEX "idx_user_ip_restrictions_created_by_fkey" ON "public"."user_ip_restrictions" USING "btree" ("created_by");



CREATE INDEX "idx_user_ip_restrictions_lookup" ON "public"."user_ip_restrictions" USING "btree" ("user_id", "is_active", "ip_address") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."idx_user_ip_restrictions_lookup" IS 'Índice para optimizar búsquedas de restricciones de IP activas en el password verification hook';



CREATE INDEX "idx_user_ip_restrictions_user_id" ON "public"."user_ip_restrictions" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions_session_token" ON "public"."user_sessions" USING "btree" ("session_token");



CREATE INDEX "idx_user_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_notif_presupuesto" ON "public"."whatsapp_notificaciones" USING "btree" ("presupuesto_id") WHERE ("presupuesto_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_notificaciones_cliente_id" ON "public"."whatsapp_notificaciones" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_whatsapp_notificaciones_cliente_id" IS 'Índice para búsquedas rápidas de notificaciones por cliente';



CREATE INDEX "idx_whatsapp_notificaciones_company_id" ON "public"."whatsapp_notificaciones" USING "btree" ("company_id");



CREATE INDEX "idx_whatsapp_notificaciones_created_at" ON "public"."whatsapp_notificaciones" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_whatsapp_notificaciones_estado" ON "public"."whatsapp_notificaciones" USING "btree" ("company_id", "estado_envio");



CREATE INDEX "idx_whatsapp_notificaciones_orden_copiado_id" ON "public"."whatsapp_notificaciones" USING "btree" ("orden_copiado_id") WHERE ("orden_copiado_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_notificaciones_orden_trabajo_id" ON "public"."whatsapp_notificaciones" USING "btree" ("orden_trabajo_id") WHERE ("orden_trabajo_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_notificaciones_tipo" ON "public"."whatsapp_notificaciones" USING "btree" ("company_id", "tipo_notificacion");



CREATE UNIQUE INDEX "unique_precio_mr_combo_not_null" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id", "producto_materiales_rigidos_id", "material_id", "variante_nombre", "espesor") WHERE ("espesor" IS NOT NULL);



CREATE UNIQUE INDEX "unique_precio_mr_combo_null" ON "public"."productos_materiales_rigidos_precios" USING "btree" ("company_id", "producto_materiales_rigidos_id", "material_id", "variante_nombre") WHERE ("espesor" IS NULL);



CREATE UNIQUE INDEX "unique_producto_mr_mat_var_esp_not_null" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("producto_materiales_rigidos_id", "material_id", "variante_nombre", "espesor") WHERE ("espesor" IS NOT NULL);



CREATE UNIQUE INDEX "unique_producto_mr_mat_var_no_esp" ON "public"."productos_materiales_rigidos_materiales" USING "btree" ("producto_materiales_rigidos_id", "material_id", "variante_nombre") WHERE ("espesor" IS NULL);



CREATE OR REPLACE TRIGGER "before_insert_ordenes_trabajo_numero_orden" BEFORE INSERT ON "public"."ordenes_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_generate_numero_orden"();



CREATE OR REPLACE TRIGGER "calcular_precio_mt2_before_insert_update" BEFORE INSERT OR UPDATE ON "public"."productos_materiales_rigidos_precios" FOR EACH ROW EXECUTE FUNCTION "public"."calcular_precio_mt2_placa"();



CREATE OR REPLACE TRIGGER "on_presupuesto_aprobado" AFTER UPDATE ON "public"."presupuestos" FOR EACH ROW WHEN ((("new"."estado" = 'aprobado'::"text") AND (("old"."estado" IS NULL) OR ("old"."estado" <> 'aprobado'::"text")))) EXECUTE FUNCTION "public"."fn_notificar_aprobacion_presupuesto"();



COMMENT ON TRIGGER "on_presupuesto_aprobado" ON "public"."presupuestos" IS 'Notifica al equipo cuando un presupuesto es aprobado';



CREATE OR REPLACE TRIGGER "on_presupuesto_aprobado_whatsapp" AFTER UPDATE ON "public"."presupuestos" FOR EACH ROW WHEN ((("new"."estado" = 'aprobado'::"text") AND (("old"."estado" IS NULL) OR ("old"."estado" <> 'aprobado'::"text")))) EXECUTE FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"();



COMMENT ON TRIGGER "on_presupuesto_aprobado_whatsapp" ON "public"."presupuestos" IS 'Notifica al cliente via WhatsApp cuando aprueba el presupuesto';



CREATE OR REPLACE TRIGGER "on_presupuesto_enviado" AFTER UPDATE ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_notify_presupuesto_enviado"();



COMMENT ON TRIGGER "on_presupuesto_enviado" ON "public"."presupuestos" IS 'Notifica al cliente cuando el presupuesto está listo (enviado + total calculado)';



CREATE OR REPLACE TRIGGER "on_presupuesto_rechazado" AFTER UPDATE ON "public"."presupuestos" FOR EACH ROW WHEN ((("new"."estado" = 'rechazado'::"text") AND (("old"."estado" IS NULL) OR ("old"."estado" <> 'rechazado'::"text")))) EXECUTE FUNCTION "public"."fn_notificar_rechazo_presupuesto"();



COMMENT ON TRIGGER "on_presupuesto_rechazado" ON "public"."presupuestos" IS 'Notifica al equipo cuando un presupuesto es rechazado';



CREATE OR REPLACE TRIGGER "set_client_audit_fields_trigger" BEFORE INSERT OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_audit_fields"();



CREATE OR REPLACE TRIGGER "set_providers_audit_fields" BEFORE INSERT OR UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."set_provider_audit_fields"();



CREATE OR REPLACE TRIGGER "tr_condiciones_updated_at" BEFORE UPDATE ON "public"."presupuestos_condiciones_comerciales" FOR EACH ROW EXECUTE FUNCTION "public"."update_presupuestos_updated_at"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_items_update_totales" AFTER INSERT OR DELETE OR UPDATE ON "public"."presupuestos_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_actualizar_totales_presupuesto"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_items_updated_at" BEFORE UPDATE ON "public"."presupuestos_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_presupuestos_updated_at"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_numero" BEFORE INSERT ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_numero_presupuesto"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_registro_historial" AFTER INSERT OR DELETE OR UPDATE ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_presupuestos_registro_historial"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_tracking_token" BEFORE INSERT ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."set_tracking_token"();



CREATE OR REPLACE TRIGGER "tr_presupuestos_updated_at" BEFORE UPDATE ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."update_presupuestos_updated_at"();



CREATE OR REPLACE TRIGGER "trg_actualizar_total_cuando_cambia_total_oc" AFTER UPDATE ON "public"."centro_copiado_ordenes" FOR EACH ROW WHEN ((("old"."total" IS DISTINCT FROM "new"."total") OR ("old"."estado" IS DISTINCT FROM "new"."estado"))) EXECUTE FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"();



CREATE OR REPLACE TRIGGER "trg_actualizar_total_orden_trabajo" AFTER INSERT OR DELETE OR UPDATE ON "public"."centro_copiado_ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_actualizar_total_orden_trabajo"();



CREATE OR REPLACE TRIGGER "trg_crear_movimiento_egreso" BEFORE INSERT ON "public"."egresos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_crear_movimiento_egreso"();



CREATE OR REPLACE TRIGGER "trg_ingresos_crear_movimiento" AFTER INSERT ON "public"."ingresos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_crear_movimiento_ingreso"();



CREATE OR REPLACE TRIGGER "trg_ingresos_eliminar_movimiento" BEFORE DELETE ON "public"."ingresos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_eliminar_movimiento_ingreso"();



CREATE OR REPLACE TRIGGER "trg_update_cheques_timestamp" BEFORE UPDATE ON "public"."cheques_cartera" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_egresos_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_egresos_timestamp" BEFORE UPDATE ON "public"."egresos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_egresos_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_recurring_expenses_timestamp" BEFORE UPDATE ON "public"."recurring_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_egresos_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_tipos_egreso_timestamp" BEFORE UPDATE ON "public"."tipos_egreso" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_egresos_timestamp"();



CREATE OR REPLACE TRIGGER "trg_validar_estado_presupuesto_completo" BEFORE UPDATE OF "estado" ON "public"."presupuestos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_estado_presupuesto_completo"();



COMMENT ON TRIGGER "trg_validar_estado_presupuesto_completo" ON "public"."presupuestos" IS 'Previene cambio de estado si hay items pendientes de cotización';



CREATE OR REPLACE TRIGGER "trigger_actualizar_estado_item" AFTER INSERT OR UPDATE OF "estado_paso" ON "public"."ordenes_trabajo_items_rutas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_actualizar_estado_item"();



CREATE OR REPLACE TRIGGER "trigger_actualizar_estado_liquidacion" AFTER INSERT OR UPDATE ON "public"."liquidaciones_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_actualizar_estado_liquidacion"();



CREATE OR REPLACE TRIGGER "trigger_actualizar_estado_orden" AFTER INSERT OR UPDATE OF "estado" ON "public"."ordenes_trabajo_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_actualizar_estado_orden"();



CREATE OR REPLACE TRIGGER "trigger_actualizar_saldo_caja" AFTER INSERT OR DELETE OR UPDATE ON "public"."cajas_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_saldo_caja_v2"();



CREATE OR REPLACE TRIGGER "trigger_actualizar_saldo_caja_on_delete" AFTER DELETE ON "public"."cajas_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_saldo_caja_on_delete"();



CREATE OR REPLACE TRIGGER "trigger_auto_complete_liquidacion" BEFORE INSERT ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auto_complete_liquidacion"();



COMMENT ON TRIGGER "trigger_auto_complete_liquidacion" ON "public"."liquidaciones" IS 'Ejecuta fn_auto_complete_liquidacion antes de cada INSERT para preparar campos obligatorios';



CREATE OR REPLACE TRIGGER "trigger_auto_recalcular_tiempos_pausa" AFTER INSERT OR DELETE OR UPDATE ON "public"."ordenes_items_rutas_pausas" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_recalcular_tiempos_pausa"();



CREATE OR REPLACE TRIGGER "trigger_auto_seed_motivos_pausa" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_seed_motivos_pausa_new_company"();



CREATE OR REPLACE TRIGGER "trigger_calcular_datos_pago_from_medio_cobro" BEFORE INSERT OR UPDATE OF "medio_cobro_id", "monto", "fecha_pago" ON "public"."ordenes_trabajo_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."calcular_datos_pago_from_medio_cobro"();



CREATE OR REPLACE TRIGGER "trigger_crear_cajas_nueva_empresa" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"();



CREATE OR REPLACE TRIGGER "trigger_crear_medios_cobro_para_nueva_empresa" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_crear_medios_cobro_default"();



CREATE OR REPLACE TRIGGER "trigger_motivos_pausa_updated_at" BEFORE UPDATE ON "public"."pasos_motivos_pausa" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_notify_orden_copiado_finalizada" AFTER UPDATE OF "estado" ON "public"."centro_copiado_ordenes" FOR EACH ROW WHEN ((("new"."estado" = 'finalizada'::"text") AND (("old"."estado" IS NULL) OR ("old"."estado" <> 'finalizada'::"text")))) EXECUTE FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"();



COMMENT ON TRIGGER "trigger_notify_orden_copiado_finalizada" ON "public"."centro_copiado_ordenes" IS 'Envía notificación de WhatsApp cuando orden de copiado se finaliza';



CREATE OR REPLACE TRIGGER "trigger_notify_orden_finalizada" AFTER UPDATE OF "estado" ON "public"."ordenes_trabajo" FOR EACH ROW WHEN ((("new"."estado" = 'finalizada'::"text") AND (("old"."estado" IS NULL) OR ("old"."estado" <> 'finalizada'::"text")))) EXECUTE FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"();



COMMENT ON TRIGGER "trigger_notify_orden_finalizada" ON "public"."ordenes_trabajo" IS 'Envía notificación de WhatsApp cuando orden de trabajo se finaliza.
Para nuevas órdenes, las notificaciones se manejan explícitamente via Edge Function.';



CREATE OR REPLACE TRIGGER "trigger_ordenes_items_rutas_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo_items_rutas" FOR EACH ROW EXECUTE FUNCTION "public"."update_ordenes_items_rutas_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_recalcular_total_ot_on_oc_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."centro_copiado_ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_recalcular_total_ot"();



CREATE OR REPLACE TRIGGER "trigger_registrar_cargo_cc" AFTER UPDATE OF "estado" ON "public"."ordenes_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"();



CREATE OR REPLACE TRIGGER "trigger_registrar_pago_cc" AFTER INSERT ON "public"."ordenes_trabajo_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_registrar_pago_cc"();



CREATE OR REPLACE TRIGGER "trigger_set_fecha_completado" BEFORE UPDATE OF "estado" ON "public"."ordenes_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_fecha_completado"();



COMMENT ON TRIGGER "trigger_set_fecha_completado" ON "public"."ordenes_trabajo" IS 'Actualiza automáticamente fecha_completado cuando el estado cambia a/desde finalizada o entregada';



CREATE OR REPLACE TRIGGER "trigger_set_tracking_token" BEFORE INSERT ON "public"."ordenes_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."set_tracking_token"();



CREATE OR REPLACE TRIGGER "trigger_sincronizar_pago_con_caja" AFTER INSERT ON "public"."ordenes_trabajo_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sincronizar_pago_con_caja"();



CREATE OR REPLACE TRIGGER "trigger_update_centro_copiado_archivos_updated_at" BEFORE UPDATE ON "public"."centro_copiado_ordenes_archivos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_ordenes_trabajo_items_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_ordenes_trabajo_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_ordenes_trabajo_pagos_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."update_ordenes_trabajo_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_ordenes_trabajo_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."update_ordenes_trabajo_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_pedidos_rutas_resueltas_updated_at" BEFORE UPDATE ON "public"."pedidos_rutas_resueltas" FOR EACH ROW EXECUTE FUNCTION "public"."update_pedidos_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_pedidos_updated_at" BEFORE UPDATE ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_pedidos_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_productos_plotter_corte_precios_updated_at" BEFORE UPDATE ON "public"."productos_plotter_corte_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_productos_plotter_corte_updated_at" BEFORE UPDATE ON "public"."productos_plotter_corte" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_plotter_corte_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_productos_portabanners_updated_at" BEFORE UPDATE ON "public"."productos_portabanners" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_portabanners_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_productos_sellos_precios_updated_at" BEFORE UPDATE ON "public"."productos_sellos_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_sellos_precios_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_productos_sellos_updated_at" BEFORE UPDATE ON "public"."productos_sellos" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_sellos_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_rutas_produccion_pasos_updated_at" BEFORE UPDATE ON "public"."rutas_produccion_pasos" FOR EACH ROW EXECUTE FUNCTION "public"."update_rutas_produccion_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_rutas_produccion_updated_at" BEFORE UPDATE ON "public"."rutas_produccion" FOR EACH ROW EXECUTE FUNCTION "public"."update_rutas_produccion_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_total_on_service" AFTER INSERT OR DELETE OR UPDATE ON "public"."ordenes_trabajo_servicios" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_recalcular_total_ot_servicios"();



CREATE OR REPLACE TRIGGER "trigger_validar_etapa_paso" BEFORE INSERT OR UPDATE OF "etapa" ON "public"."rutas_produccion_pasos" FOR EACH ROW EXECUTE FUNCTION "public"."validar_etapa_paso"();



CREATE OR REPLACE TRIGGER "trigger_validar_limite_archivos_copiado" BEFORE INSERT ON "public"."centro_copiado_ordenes_archivos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_limite_total_archivos_copiado"();



CREATE OR REPLACE TRIGGER "trigger_validar_rango_precio_laser" BEFORE INSERT OR UPDATE ON "public"."productos_impresion_laser" FOR EACH ROW EXECUTE FUNCTION "public"."validar_rango_precio_laser"();



CREATE OR REPLACE TRIGGER "trigger_validate_categoria_deactivation" BEFORE UPDATE ON "public"."categorias" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"();



CREATE OR REPLACE TRIGGER "trigger_validate_estacion_deactivation" BEFORE UPDATE ON "public"."estaciones_trabajo" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"();



CREATE OR REPLACE TRIGGER "trigger_validate_material_variantes" BEFORE INSERT OR UPDATE ON "public"."materiales" FOR EACH ROW EXECUTE FUNCTION "public"."validate_material_variantes_trigger"();



CREATE OR REPLACE TRIGGER "trigger_validate_paso_deactivation" BEFORE UPDATE ON "public"."pasos" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_paso_deactivation_with_dependencies"();



CREATE OR REPLACE TRIGGER "update_banks_updated_at" BEFORE UPDATE ON "public"."banks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cajas_updated_at" BEFORE UPDATE ON "public"."cajas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cc_movimientos_updated_at" BEFORE UPDATE ON "public"."cuentas_corrientes_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_centro_copiado_ordenes_pagos_updated_at" BEFORE UPDATE ON "public"."centro_copiado_ordenes_pagos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_roles_updated_at" BEFORE UPDATE ON "public"."custom_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ingresos_updated_at" BEFORE UPDATE ON "public"."ingresos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_liquidaciones_updated_at" BEFORE UPDATE ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_medios_cobro_updated_at" BEFORE UPDATE ON "public"."medios_cobro" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ordenes_acabados_compartidos_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo_acabados_compartidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ordenes_servicios_compartidos_updated_at" BEFORE UPDATE ON "public"."ordenes_trabajo_servicios_compartidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pl_precios_timestamp" BEFORE UPDATE ON "public"."productos_impresion_laser_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_pl_precios_updated_at"();



CREATE OR REPLACE TRIGGER "update_pmr_precios_timestamp" BEFORE UPDATE ON "public"."productos_materiales_rigidos_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_pmr_precios_updated_at"();



CREATE OR REPLACE TRIGGER "update_presupuestos_acabados_compartidos_updated_at" BEFORE UPDATE ON "public"."presupuestos_acabados_compartidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_presupuestos_servicios_compartidos_updated_at" BEFORE UPDATE ON "public"."presupuestos_servicios_compartidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_productos_gran_formato_precios_timestamp" BEFORE UPDATE ON "public"."productos_gran_formato_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_gran_formato_precios_updated_at"();



CREATE OR REPLACE TRIGGER "update_productos_gran_formato_timestamp" BEFORE UPDATE ON "public"."productos_gran_formato" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_gran_formato_updated_at"();



CREATE OR REPLACE TRIGGER "update_productos_impresion_laser_timestamp" BEFORE UPDATE ON "public"."productos_impresion_laser" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_impresion_laser_updated_at"();



CREATE OR REPLACE TRIGGER "update_productos_materiales_rigidos_timestamp" BEFORE UPDATE ON "public"."productos_materiales_rigidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_materiales_rigidos_updated_at"();



CREATE OR REPLACE TRIGGER "update_productos_portabanners_precios_timestamp" BEFORE UPDATE ON "public"."productos_portabanners_precios" FOR EACH ROW EXECUTE FUNCTION "public"."update_productos_portabanners_precios_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_providers_updated_at" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tipos_ingreso_updated_at" BEFORE UPDATE ON "public"."tipos_ingreso" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_precio_mr_combination_trigger" BEFORE INSERT OR UPDATE ON "public"."productos_materiales_rigidos_precios" FOR EACH ROW EXECUTE FUNCTION "public"."validate_precio_mr_combination"();



ALTER TABLE ONLY "public"."acabados_categorias"
    ADD CONSTRAINT "acabados_categorias_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."acabados_categorias"
    ADD CONSTRAINT "acabados_categorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."acabados"
    ADD CONSTRAINT "acabados_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."acabados"
    ADD CONSTRAINT "acabados_estacion_id_fkey" FOREIGN KEY ("estacion_id") REFERENCES "public"."estaciones_trabajo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."acabados_niveles_precio"
    ADD CONSTRAINT "acabados_niveles_precio_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."acabados_niveles_precio"
    ADD CONSTRAINT "acabados_niveles_precio_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."acabados_pasos"
    ADD CONSTRAINT "acabados_pasos_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."acabados_pasos"
    ADD CONSTRAINT "acabados_pasos_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."arqueos_cajas"
    ADD CONSTRAINT "arqueos_cajas_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."arqueos_cajas"
    ADD CONSTRAINT "arqueos_cajas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."arqueos_cajas"
    ADD CONSTRAINT "arqueos_cajas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cajas"
    ADD CONSTRAINT "cajas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_caja_destino_id_fkey" FOREIGN KEY ("caja_destino_id") REFERENCES "public"."cajas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_caja_origen_id_fkey" FOREIGN KEY ("caja_origen_id") REFERENCES "public"."cajas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cajas_movimientos"
    ADD CONSTRAINT "cajas_movimientos_medio_cobro_id_fkey" FOREIGN KEY ("medio_cobro_id") REFERENCES "public"."medios_cobro"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_archivos"
    ADD CONSTRAINT "centro_copiado_ordenes_archivos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_archivos"
    ADD CONSTRAINT "centro_copiado_ordenes_archivos_item_generado_id_fkey" FOREIGN KEY ("item_generado_id") REFERENCES "public"."centro_copiado_ordenes_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_archivos"
    ADD CONSTRAINT "centro_copiado_ordenes_archivos_orden_copiado_id_fkey" FOREIGN KEY ("orden_copiado_id") REFERENCES "public"."centro_copiado_ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_archivos"
    ADD CONSTRAINT "centro_copiado_ordenes_archivos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_items"
    ADD CONSTRAINT "centro_copiado_ordenes_items_orden_copiado_id_fkey" FOREIGN KEY ("orden_copiado_id") REFERENCES "public"."centro_copiado_ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_items"
    ADD CONSTRAINT "centro_copiado_ordenes_items_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "public"."centro_copiado_papeles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_items"
    ADD CONSTRAINT "centro_copiado_ordenes_items_tamanio_papel_id_fkey" FOREIGN KEY ("tamanio_papel_id") REFERENCES "public"."centro_copiado_tamanios_papel"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes"
    ADD CONSTRAINT "centro_copiado_ordenes_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_pagos"
    ADD CONSTRAINT "centro_copiado_ordenes_pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_pagos"
    ADD CONSTRAINT "centro_copiado_ordenes_pagos_medio_cobro_id_fkey" FOREIGN KEY ("medio_cobro_id") REFERENCES "public"."medios_cobro"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."centro_copiado_ordenes_pagos"
    ADD CONSTRAINT "centro_copiado_ordenes_pagos_orden_copiado_id_fkey" FOREIGN KEY ("orden_copiado_id") REFERENCES "public"."centro_copiado_ordenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_papeles"
    ADD CONSTRAINT "centro_copiado_papeles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_papeles"
    ADD CONSTRAINT "centro_copiado_papeles_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_plastificados"
    ADD CONSTRAINT "centro_copiado_plastificados_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "public"."centro_copiado_papeles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."centro_copiado_rangos_precio_impresion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_precios_impresion"
    ADD CONSTRAINT "centro_copiado_precios_impresion_tamanio_papel_id_fkey" FOREIGN KEY ("tamanio_papel_id") REFERENCES "public"."centro_copiado_tamanios_papel"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_rangos_anillado"
    ADD CONSTRAINT "centro_copiado_rangos_anillado_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_rangos_precio_impresion"
    ADD CONSTRAINT "centro_copiado_rangos_precio_impresion_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centro_copiado_tamanios_papel"
    ADD CONSTRAINT "centro_copiado_tamanios_papel_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cheques_cartera"
    ADD CONSTRAINT "cheques_cartera_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."providers"("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_registro_intentos"
    ADD CONSTRAINT "cliente_registro_intentos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");



ALTER TABLE ONLY "public"."company_business_hours"
    ADD CONSTRAINT "company_business_hours_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."compras_proveedores"
    ADD CONSTRAINT "compras_proveedores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compras_proveedores"
    ADD CONSTRAINT "compras_proveedores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."compras_proveedores"
    ADD CONSTRAINT "compras_proveedores_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "cuentas_corrientes_movimientos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "public"."ordenes_trabajo_pagos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras_proveedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_recurrente_id_fkey" FOREIGN KEY ("recurrente_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "public"."tarjetas_credito"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_tipo_egreso_id_fkey" FOREIGN KEY ("tipo_egreso_id") REFERENCES "public"."tipos_egreso"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."estaciones_trabajo"
    ADD CONSTRAINT "estaciones_trabajo_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facturas_historial"
    ADD CONSTRAINT "facturas_historial_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facturas_historial"
    ADD CONSTRAINT "facturas_historial_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facturas_historial"
    ADD CONSTRAINT "facturas_historial_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facturas_urls_cortas"
    ADD CONSTRAINT "facturas_urls_cortas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facturas_urls_cortas"
    ADD CONSTRAINT "facturas_urls_cortas_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_corrientes_movimientos"
    ADD CONSTRAINT "fk_cc_movimientos_liquidacion" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_medio_cobro_id_fkey" FOREIGN KEY ("medio_cobro_id") REFERENCES "public"."medios_cobro"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingresos"
    ADD CONSTRAINT "ingresos_tipo_ingreso_id_fkey" FOREIGN KEY ("tipo_ingreso_id") REFERENCES "public"."tipos_ingreso"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."liquidaciones_items"
    ADD CONSTRAINT "liquidaciones_items_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liquidaciones_items"
    ADD CONSTRAINT "liquidaciones_items_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."liquidaciones_pagos"
    ADD CONSTRAINT "liquidaciones_pagos_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liquidaciones_pagos"
    ADD CONSTRAINT "liquidaciones_pagos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "public"."ordenes_trabajo_pagos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."materiales"
    ADD CONSTRAINT "materiales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medios_cobro"
    ADD CONSTRAINT "medios_cobro_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."medios_cobro"
    ADD CONSTRAINT "medios_cobro_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones_internas"
    ADD CONSTRAINT "notificaciones_internas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones_internas"
    ADD CONSTRAINT "notificaciones_internas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_items_rutas_pausas"
    ADD CONSTRAINT "ordenes_items_rutas_pausas_motivo_pausa_id_fkey" FOREIGN KEY ("motivo_pausa_id") REFERENCES "public"."pasos_motivos_pausa"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_items_rutas_pausas"
    ADD CONSTRAINT "ordenes_items_rutas_pausas_pausado_por_fkey" FOREIGN KEY ("pausado_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_items_rutas_pausas"
    ADD CONSTRAINT "ordenes_items_rutas_pausas_reanudado_por_fkey" FOREIGN KEY ("reanudado_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_items_rutas_pausas"
    ADD CONSTRAINT "ordenes_items_rutas_pausas_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "public"."ordenes_trabajo_items_rutas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_acabados_compartidos_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_acabados_compartidos_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_items"
    ADD CONSTRAINT "ordenes_trabajo_acabados_items_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo_acabados_items"
    ADD CONSTRAINT "ordenes_trabajo_acabados_items_orden_item_id_fkey" FOREIGN KEY ("orden_item_id") REFERENCES "public"."ordenes_trabajo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo_historial"
    ADD CONSTRAINT "ordenes_trabajo_historial_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_historial"
    ADD CONSTRAINT "ordenes_trabajo_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo_items"
    ADD CONSTRAINT "ordenes_trabajo_items_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_items_rutas"
    ADD CONSTRAINT "ordenes_trabajo_items_rutas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_items_rutas"
    ADD CONSTRAINT "ordenes_trabajo_items_rutas_orden_item_id_fkey" FOREIGN KEY ("orden_item_id") REFERENCES "public"."ordenes_trabajo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_items_rutas"
    ADD CONSTRAINT "ordenes_trabajo_items_rutas_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo_items_rutas"
    ADD CONSTRAINT "ordenes_trabajo_items_rutas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo_links"
    ADD CONSTRAINT "ordenes_trabajo_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_links"
    ADD CONSTRAINT "ordenes_trabajo_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_links"
    ADD CONSTRAINT "ordenes_trabajo_links_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_pagos"
    ADD CONSTRAINT "ordenes_trabajo_pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo_pagos"
    ADD CONSTRAINT "ordenes_trabajo_pagos_medio_cobro_id_fkey" FOREIGN KEY ("medio_cobro_id") REFERENCES "public"."medios_cobro"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo_pagos"
    ADD CONSTRAINT "ordenes_trabajo_pagos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_servicios_compartidos_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_compartidos"
    ADD CONSTRAINT "ordenes_trabajo_servicios_compartidos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios"
    ADD CONSTRAINT "ordenes_trabajo_servicios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_items"
    ADD CONSTRAINT "ordenes_trabajo_servicios_items_orden_item_id_fkey" FOREIGN KEY ("orden_item_id") REFERENCES "public"."ordenes_trabajo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios_items"
    ADD CONSTRAINT "ordenes_trabajo_servicios_items_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios"
    ADD CONSTRAINT "ordenes_trabajo_servicios_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_trabajo_servicios"
    ADD CONSTRAINT "ordenes_trabajo_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id");



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_trabajo"
    ADD CONSTRAINT "ordenes_trabajo_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pasos"
    ADD CONSTRAINT "pasos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pasos"
    ADD CONSTRAINT "pasos_estacion_id_fkey" FOREIGN KEY ("estacion_id") REFERENCES "public"."estaciones_trabajo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pasos_motivos_pausa"
    ADD CONSTRAINT "pasos_motivos_pausa_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos_opciones"
    ADD CONSTRAINT "pedidos_opciones_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pedidos_rutas_resueltas"
    ADD CONSTRAINT "pedidos_rutas_resueltas_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos_rutas_resueltas"
    ADD CONSTRAINT "pedidos_rutas_resueltas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_rutas_resueltas"
    ADD CONSTRAINT "pedidos_rutas_resueltas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."presupuestos_acabados_compartidos"
    ADD CONSTRAINT "presupuestos_acabados_compartidos_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."presupuestos_acabados_compartidos"
    ADD CONSTRAINT "presupuestos_acabados_compartidos_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuestos_archivos"
    ADD CONSTRAINT "presupuestos_archivos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."presupuestos_archivos"
    ADD CONSTRAINT "presupuestos_archivos_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuestos_archivos"
    ADD CONSTRAINT "presupuestos_archivos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."presupuestos_condiciones_comerciales"
    ADD CONSTRAINT "presupuestos_condiciones_comerciales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."presupuestos_historial"
    ADD CONSTRAINT "presupuestos_historial_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuestos_historial"
    ADD CONSTRAINT "presupuestos_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."presupuestos_items"
    ADD CONSTRAINT "presupuestos_items_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id");



ALTER TABLE ONLY "public"."presupuestos_servicios_compartidos"
    ADD CONSTRAINT "presupuestos_servicios_compartidos_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuestos_servicios_compartidos"
    ADD CONSTRAINT "presupuestos_servicios_compartidos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."productos_acabados_v2"
    ADD CONSTRAINT "productos_acabados_v2_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_acabados"
    ADD CONSTRAINT "productos_gran_formato_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_gran_formato_acabados"
    ADD CONSTRAINT "productos_gran_formato_acabados_producto_gran_formato_id_fkey" FOREIGN KEY ("producto_gran_formato_id") REFERENCES "public"."productos_gran_formato"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato"
    ADD CONSTRAINT "productos_gran_formato_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_materiales"
    ADD CONSTRAINT "productos_gran_formato_materiales_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_gran_formato_materiales"
    ADD CONSTRAINT "productos_gran_formato_materiales_producto_gran_formato_id_fkey" FOREIGN KEY ("producto_gran_formato_id") REFERENCES "public"."productos_gran_formato"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_precios"
    ADD CONSTRAINT "productos_gran_formato_precios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_precios"
    ADD CONSTRAINT "productos_gran_formato_precios_producto_gran_formato_id_fkey" FOREIGN KEY ("producto_gran_formato_id") REFERENCES "public"."productos_gran_formato"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_precios"
    ADD CONSTRAINT "productos_gran_formato_precios_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_gran_formato"
    ADD CONSTRAINT "productos_gran_formato_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_gran_formato"
    ADD CONSTRAINT "productos_gran_formato_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_gran_formato_servicios"
    ADD CONSTRAINT "productos_gran_formato_servicios_producto_gran_formato_id_fkey" FOREIGN KEY ("producto_gran_formato_id") REFERENCES "public"."productos_gran_formato"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_servicios"
    ADD CONSTRAINT "productos_gran_formato_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_gran_formato_tecnologias"
    ADD CONSTRAINT "productos_gran_formato_tecnologia_producto_gran_formato_id_fkey" FOREIGN KEY ("producto_gran_formato_id") REFERENCES "public"."productos_gran_formato"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_gran_formato_tecnologias"
    ADD CONSTRAINT "productos_gran_formato_tecnologias_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_impresion_laser_acabados"
    ADD CONSTRAINT "productos_impresion_laser_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_impresion_laser_acabados"
    ADD CONSTRAINT "productos_impresion_laser_acabados_producto_laser_id_fkey" FOREIGN KEY ("producto_laser_id") REFERENCES "public"."productos_impresion_laser"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser"
    ADD CONSTRAINT "productos_impresion_laser_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser_materiales"
    ADD CONSTRAINT "productos_impresion_laser_materiales_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_impresion_laser_materiales"
    ADD CONSTRAINT "productos_impresion_laser_materiales_producto_laser_id_fkey" FOREIGN KEY ("producto_laser_id") REFERENCES "public"."productos_impresion_laser"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser_precios"
    ADD CONSTRAINT "productos_impresion_laser_precios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser_precios"
    ADD CONSTRAINT "productos_impresion_laser_precios_producto_laser_id_fkey" FOREIGN KEY ("producto_laser_id") REFERENCES "public"."productos_impresion_laser"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser"
    ADD CONSTRAINT "productos_impresion_laser_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_impresion_laser"
    ADD CONSTRAINT "productos_impresion_laser_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_impresion_laser_servicios"
    ADD CONSTRAINT "productos_impresion_laser_servicios_producto_laser_id_fkey" FOREIGN KEY ("producto_laser_id") REFERENCES "public"."productos_impresion_laser"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser_servicios"
    ADD CONSTRAINT "productos_impresion_laser_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_impresion_laser_tecnologias"
    ADD CONSTRAINT "productos_impresion_laser_tecnologias_producto_laser_id_fkey" FOREIGN KEY ("producto_laser_id") REFERENCES "public"."productos_impresion_laser"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_impresion_laser_tecnologias"
    ADD CONSTRAINT "productos_impresion_laser_tecnologias_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales"
    ADD CONSTRAINT "productos_materiales_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales"
    ADD CONSTRAINT "productos_materiales_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_materiales"
    ADD CONSTRAINT "productos_materiales_rigidos__producto_materiales_rigidos__fkey" FOREIGN KEY ("producto_materiales_rigidos_id") REFERENCES "public"."productos_materiales_rigidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_acabados"
    ADD CONSTRAINT "productos_materiales_rigidos_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales_rigidos"
    ADD CONSTRAINT "productos_materiales_rigidos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_materiales"
    ADD CONSTRAINT "productos_materiales_rigidos_materiales_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_precios"
    ADD CONSTRAINT "productos_materiales_rigidos_precios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_precios"
    ADD CONSTRAINT "productos_materiales_rigidos_precios_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_servicios"
    ADD CONSTRAINT "productos_materiales_rigidos_producto_materiales_rigidos__fkey1" FOREIGN KEY ("producto_materiales_rigidos_id") REFERENCES "public"."productos_materiales_rigidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_acabados"
    ADD CONSTRAINT "productos_materiales_rigidos_producto_materiales_rigidos__fkey2" FOREIGN KEY ("producto_materiales_rigidos_id") REFERENCES "public"."productos_materiales_rigidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_precios"
    ADD CONSTRAINT "productos_materiales_rigidos_producto_materiales_rigidos__fkey3" FOREIGN KEY ("producto_materiales_rigidos_id") REFERENCES "public"."productos_materiales_rigidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_materiales_rigidos"
    ADD CONSTRAINT "productos_materiales_rigidos_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_materiales_rigidos"
    ADD CONSTRAINT "productos_materiales_rigidos_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_materiales_rigidos_servicios"
    ADD CONSTRAINT "productos_materiales_rigidos_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_materiales_v2"
    ADD CONSTRAINT "productos_materiales_v2_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_plotter_corte_acabados"
    ADD CONSTRAINT "productos_plotter_corte_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_plotter_corte_acabados"
    ADD CONSTRAINT "productos_plotter_corte_acabados_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_plotter_corte"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "productos_plotter_corte_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "productos_plotter_corte_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_plotter_corte_precios"
    ADD CONSTRAINT "productos_plotter_corte_precios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_plotter_corte"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "productos_plotter_corte_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_plotter_corte"
    ADD CONSTRAINT "productos_plotter_corte_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_plotter_corte_servicios"
    ADD CONSTRAINT "productos_plotter_corte_servicios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_plotter_corte"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_plotter_corte_servicios"
    ADD CONSTRAINT "productos_plotter_corte_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_acabados"
    ADD CONSTRAINT "productos_portabanners_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_acabados"
    ADD CONSTRAINT "productos_portabanners_acabados_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_portabanners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "productos_portabanners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_precios"
    ADD CONSTRAINT "productos_portabanners_precios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_precios"
    ADD CONSTRAINT "productos_portabanners_precios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_portabanners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_precios"
    ADD CONSTRAINT "productos_portabanners_precios_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "productos_portabanners_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "productos_portabanners_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_portabanners_servicios"
    ADD CONSTRAINT "productos_portabanners_servicios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_portabanners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_servicios"
    ADD CONSTRAINT "productos_portabanners_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners"
    ADD CONSTRAINT "productos_portabanners_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_portabanners_tecnologias"
    ADD CONSTRAINT "productos_portabanners_tecnologias_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_portabanners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_portabanners_tecnologias"
    ADD CONSTRAINT "productos_portabanners_tecnologias_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_pricing"
    ADD CONSTRAINT "productos_pricing_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_pricing"
    ADD CONSTRAINT "productos_pricing_rango_precio_id_fkey" FOREIGN KEY ("rango_precio_id") REFERENCES "public"."rangos_precio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_rutas_produccion"
    ADD CONSTRAINT "productos_rutas_produccion_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_rutas_produccion"
    ADD CONSTRAINT "productos_rutas_produccion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_sellos"
    ADD CONSTRAINT "productos_sellos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_sellos"
    ADD CONSTRAINT "productos_sellos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_sellos_precios"
    ADD CONSTRAINT "productos_sellos_precios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_sellos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_sellos"
    ADD CONSTRAINT "productos_sellos_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_sellos"
    ADD CONSTRAINT "productos_sellos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_servicios_v2"
    ADD CONSTRAINT "productos_servicios_v2_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_talonarios_acabados"
    ADD CONSTRAINT "productos_talonarios_acabados_acabado_id_fkey" FOREIGN KEY ("acabado_id") REFERENCES "public"."acabados"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_talonarios_acabados"
    ADD CONSTRAINT "productos_talonarios_acabados_producto_talonario_id_fkey" FOREIGN KEY ("producto_talonario_id") REFERENCES "public"."productos_talonarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios"
    ADD CONSTRAINT "productos_talonarios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios_materiales"
    ADD CONSTRAINT "productos_talonarios_materiales_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_talonarios_materiales"
    ADD CONSTRAINT "productos_talonarios_materiales_producto_talonario_id_fkey" FOREIGN KEY ("producto_talonario_id") REFERENCES "public"."productos_talonarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios_precios"
    ADD CONSTRAINT "productos_talonarios_precios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios_precios"
    ADD CONSTRAINT "productos_talonarios_precios_producto_talonario_id_fkey" FOREIGN KEY ("producto_talonario_id") REFERENCES "public"."productos_talonarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios"
    ADD CONSTRAINT "productos_talonarios_ruta_produccion_id_fkey" FOREIGN KEY ("ruta_produccion_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."productos_talonarios_servicios"
    ADD CONSTRAINT "productos_talonarios_servicios_producto_talonario_id_fkey" FOREIGN KEY ("producto_talonario_id") REFERENCES "public"."productos_talonarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios_servicios"
    ADD CONSTRAINT "productos_talonarios_servicios_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_talonarios_tecnologias"
    ADD CONSTRAINT "productos_talonarios_tecnologias_producto_talonario_id_fkey" FOREIGN KEY ("producto_talonario_id") REFERENCES "public"."productos_talonarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_talonarios_tecnologias"
    ADD CONSTRAINT "productos_talonarios_tecnologias_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."productos_tecnologias_v2"
    ADD CONSTRAINT "productos_tecnologias_v2_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_tipo_egreso_id_fkey" FOREIGN KEY ("tipo_egreso_id") REFERENCES "public"."tipos_egreso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rangos_precio"
    ADD CONSTRAINT "rangos_precio_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_executions"
    ADD CONSTRAINT "recurring_executions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."recurring_executions"
    ADD CONSTRAINT "recurring_executions_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_tipo_egreso_id_fkey" FOREIGN KEY ("tipo_egreso_id") REFERENCES "public"."tipos_egreso"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rutas_produccion"
    ADD CONSTRAINT "rutas_produccion_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rutas_produccion_pasos"
    ADD CONSTRAINT "rutas_produccion_pasos_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rutas_produccion_pasos"
    ADD CONSTRAINT "rutas_produccion_pasos_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas_produccion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicios_categorias"
    ADD CONSTRAINT "servicios_categorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."servicios_categorias"
    ADD CONSTRAINT "servicios_categorias_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicios"
    ADD CONSTRAINT "servicios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicios"
    ADD CONSTRAINT "servicios_estacion_id_fkey" FOREIGN KEY ("estacion_id") REFERENCES "public"."estaciones_trabajo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."servicios_niveles_precio"
    ADD CONSTRAINT "servicios_niveles_precio_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."servicios_niveles_precio"
    ADD CONSTRAINT "servicios_niveles_precio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicios_pasos"
    ADD CONSTRAINT "servicios_pasos_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."servicios_pasos"
    ADD CONSTRAINT "servicios_pasos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_resumen_id_fkey" FOREIGN KEY ("resumen_id") REFERENCES "public"."tarjetas_resumenes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_consumos"
    ADD CONSTRAINT "tarjetas_consumos_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "public"."tarjetas_credito"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_credito"
    ADD CONSTRAINT "tarjetas_credito_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_credito"
    ADD CONSTRAINT "tarjetas_credito_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tarjetas_resumenes"
    ADD CONSTRAINT "tarjetas_resumenes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarjetas_resumenes"
    ADD CONSTRAINT "tarjetas_resumenes_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "public"."tarjetas_credito"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tecnologias"
    ADD CONSTRAINT "tecnologias_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tecnologias_tintas_pasos"
    ADD CONSTRAINT "tecnologias_tintas_pasos_paso_id_fkey" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tecnologias_tintas_pasos"
    ADD CONSTRAINT "tecnologias_tintas_pasos_tecnologia_id_fkey" FOREIGN KEY ("tecnologia_id") REFERENCES "public"."tecnologias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tipos_egreso"
    ADD CONSTRAINT "tipos_egreso_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tipos_ingreso"
    ADD CONSTRAINT "tipos_ingreso_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ip_restrictions"
    ADD CONSTRAINT "user_ip_restrictions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_ip_restrictions"
    ADD CONSTRAINT "user_ip_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_orden_copiado_id_fkey" FOREIGN KEY ("orden_copiado_id") REFERENCES "public"."centro_copiado_ordenes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_notificaciones"
    ADD CONSTRAINT "whatsapp_notificaciones_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id");



CREATE POLICY "Admin puede actualizar tipos de egreso" ON "public"."tipos_egreso" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admin puede crear tipos de egreso" ON "public"."tipos_egreso" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admin y super_admin pueden eliminar egresos" ON "public"."egresos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admin, super_admin, and manager can insert providers" ON "public"."providers" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))));



CREATE POLICY "Admin, super_admin, and manager can update providers" ON "public"."providers" FOR UPDATE TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))));



CREATE POLICY "Admin/Manager can manage compras" ON "public"."compras_proveedores" TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'contador'::"text"])))))));



CREATE POLICY "Admin/Manager can manage recurring executions" ON "public"."recurring_executions" TO "authenticated" USING ((("recurring_id" IN ( SELECT "recurring_expenses"."id"
   FROM "public"."recurring_expenses"
  WHERE ("recurring_expenses"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'contador'::"text"])))))));



CREATE POLICY "Admins and managers can create clients" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())
 LIMIT 1)) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'operador_diseno'::"text"])))))));



COMMENT ON POLICY "Admins and managers can create clients" ON "public"."clients" IS 'Permite a super_admin, admin, manager y operador_diseno crear clientes.
Restricción: Solo en su propia company_id.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir gestión completa de órdenes de trabajo.';



CREATE POLICY "Admins and managers can update clients" ON "public"."clients" FOR UPDATE TO "authenticated" USING ((("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())
 LIMIT 1)) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'operador_diseno'::"text"]))))))) WITH CHECK (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())
 LIMIT 1)));



COMMENT ON POLICY "Admins and managers can update clients" ON "public"."clients" IS 'Permite a super_admin, admin, manager y operador_diseno editar clientes.
Restricción: Solo clientes de su propia company_id.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir gestión completa de órdenes de trabajo.';



CREATE POLICY "Admins can delete own company cajas" ON "public"."cajas" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can delete own company ingresos" ON "public"."ingresos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can delete own company medios_cobro" ON "public"."medios_cobro" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins can insert cajas" ON "public"."cajas" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can insert medios_cobro" ON "public"."medios_cobro" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins can insert tipos_ingreso" ON "public"."tipos_ingreso" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can manage cities" ON "public"."cities" TO "authenticated" USING (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())))) WITH CHECK (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"()))));



CREATE POLICY "Admins can manage countries" ON "public"."countries" TO "authenticated" USING (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())))) WITH CHECK (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"()))));



CREATE POLICY "Admins can manage provinces" ON "public"."provinces" TO "authenticated" USING (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())))) WITH CHECK (("public"."is_user_admin"() AND (("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"()))));



CREATE POLICY "Admins can update company" ON "public"."companies" FOR UPDATE TO "authenticated" USING ((("id" = "public"."get_user_company_id"()) AND "public"."is_user_admin"()));



CREATE POLICY "Admins can update own company cajas" ON "public"."cajas" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"])))))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can update own company medios_cobro" ON "public"."medios_cobro" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins can update own company tipos_ingreso" ON "public"."tipos_ingreso" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins manage own company motivos pausa" ON "public"."pasos_motivos_pausa" TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"])))))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Allow public read access to basic company info" ON "public"."companies" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can insert login attempts" ON "public"."login_attempts" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can view active subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Auth delete" ON "public"."ordenes_trabajo_servicios" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Auth insert" ON "public"."ordenes_trabajo_servicios" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Auth update" ON "public"."ordenes_trabajo_servicios" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Authenticated users can insert audit logs" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can view all banks" ON "public"."banks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authorized users can manage cheques" ON "public"."cheques_cartera" TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'owner'::"text", 'admin'::"text", 'manager'::"text", 'contador'::"text"])))))));



CREATE POLICY "Authorized users can manage recurring expenses" ON "public"."recurring_expenses" TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'owner'::"text", 'admin'::"text", 'manager'::"text", 'contador'::"text"])))))));



CREATE POLICY "Enable delete for admins and managers" ON "public"."presupuestos" FOR DELETE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"])))));



CREATE POLICY "Enable insert for authenticated users during signup" ON "public"."companies" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for new company subscriptions" ON "public"."company_subscriptions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for new user profiles" ON "public"."profiles" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Managers can insert cajas_movimientos" ON "public"."cajas_movimientos" FOR INSERT TO "authenticated" WITH CHECK (("caja_id" IN ( SELECT "cajas"."id"
   FROM "public"."cajas"
  WHERE ("cajas"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'operador_diseno'::"text"]))))))));



COMMENT ON POLICY "Managers can insert cajas_movimientos" ON "public"."cajas_movimientos" IS 'Permite a super_admin, admin, manager y operador_diseno crear movimientos de caja.
Restricción: Solo pueden insertar en cajas de su propia company.
Actualizado: 2025-11-29 - Agregado operador_diseno para permitir registro de pagos en órdenes de trabajo.
El operador_diseno gestiona órdenes de trabajo y necesita poder registrar pagos, lo cual genera
movimientos automáticos en cajas a través del trigger trigger_sincronizar_pago_con_caja.';



CREATE POLICY "Managers can insert cc_movimientos" ON "public"."cuentas_corrientes_movimientos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Managers can insert ingresos" ON "public"."ingresos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Managers can update own company cc_movimientos" ON "public"."cuentas_corrientes_movimientos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Managers can update own company liquidaciones" ON "public"."liquidaciones" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Only admins can delete condiciones" ON "public"."presupuestos_condiciones_comerciales" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))));



CREATE POLICY "Only admins can delete presupuestos" ON "public"."presupuestos" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))));



CREATE POLICY "Only admins can update condiciones" ON "public"."presupuestos_condiciones_comerciales" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Only super_admin can delete clients" ON "public"."clients" FOR DELETE TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Public access to client name via tracking token" ON "public"."clients" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo" "ot"
  WHERE (("ot"."cliente_id" = "clients"."id") AND ("ot"."tracking_token" IS NOT NULL)))));



COMMENT ON POLICY "Public access to client name via tracking token" ON "public"."clients" IS 'Permite acceso público solo al nombre del cliente de órdenes con tracking_token válido';



CREATE POLICY "Public access to item rutas via token" ON "public"."ordenes_trabajo_items_rutas" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo_items" "oti"
     JOIN "public"."ordenes_trabajo" "ot" ON (("ot"."id" = "oti"."orden_id")))
  WHERE (("oti"."id" = "ordenes_trabajo_items_rutas"."orden_item_id") AND ("ot"."tracking_token" IS NOT NULL)))));



COMMENT ON POLICY "Public access to item rutas via token" ON "public"."ordenes_trabajo_items_rutas" IS 'Permite acceso público a rutas de producción de items de órdenes con tracking_token';



CREATE POLICY "Public access to orden items via token" ON "public"."ordenes_trabajo_items" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo" "ot"
  WHERE (("ot"."id" = "ordenes_trabajo_items"."orden_id") AND ("ot"."tracking_token" IS NOT NULL)))));



COMMENT ON POLICY "Public access to orden items via token" ON "public"."ordenes_trabajo_items" IS 'Permite acceso público a items de órdenes que tienen tracking_token válido';



CREATE POLICY "Public access to paso names via tracking" ON "public"."pasos" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM (("public"."ordenes_trabajo_items_rutas" "otir"
     JOIN "public"."ordenes_trabajo_items" "oti" ON (("oti"."id" = "otir"."orden_item_id")))
     JOIN "public"."ordenes_trabajo" "ot" ON (("ot"."id" = "oti"."orden_id")))
  WHERE (("otir"."paso_id" = "pasos"."id") AND ("ot"."tracking_token" IS NOT NULL)))));



COMMENT ON POLICY "Public access to paso names via tracking" ON "public"."pasos" IS 'Permite acceso público a nombres de pasos referenciados en rutas de órdenes con tracking_token';



CREATE POLICY "Public access with tracking token" ON "public"."ordenes_trabajo" FOR SELECT TO "anon" USING (("tracking_token" IS NOT NULL));



COMMENT ON POLICY "Public access with tracking token" ON "public"."ordenes_trabajo" IS 'Permite acceso público de lectura a órdenes mediante tracking_token válido';



CREATE POLICY "Public read" ON "public"."ordenes_trabajo_servicios" FOR SELECT USING (true);



CREATE POLICY "Public tracking can view business hours" ON "public"."company_business_hours" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Role based view access for cajas" ON "public"."cajas" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'operador_diseno'::"text")))) AND ("tipo" = 'efectivo'::"text") AND ("es_principal" = false)))));



CREATE POLICY "Role based view access for cajas_movimientos" ON "public"."cajas_movimientos" FOR SELECT TO "authenticated" USING (("caja_id" IN ( SELECT "cajas"."id"
   FROM "public"."cajas")));



CREATE POLICY "Service role can insert URLs" ON "public"."facturas_urls_cortas" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert notificaciones" ON "public"."whatsapp_notificaciones" FOR INSERT TO "service_role" WITH CHECK (true);



COMMENT ON POLICY "Service role can insert notificaciones" ON "public"."whatsapp_notificaciones" IS 'Permite a Edge Functions insertar notificaciones usando SERVICE_ROLE_KEY';



CREATE POLICY "Super admin can delete providers from their company" ON "public"."providers" FOR DELETE TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admin can manage banks" ON "public"."banks" TO "authenticated" USING ("public"."is_user_super_admin"());



CREATE POLICY "Super admins can create custom roles" ON "public"."custom_roles" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can delete custom roles in their company" ON "public"."custom_roles" FOR DELETE TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can delete tipos_ingreso" ON "public"."tipos_ingreso" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can manage IP restrictions" ON "public"."user_ip_restrictions" TO "authenticated" USING ((("public"."get_target_user_company_id"("user_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can manage role permissions" ON "public"."role_permissions" TO "authenticated" USING ((("public"."get_role_company_id"("role_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can update company sessions" ON "public"."user_sessions" FOR UPDATE TO "authenticated" USING ((("public"."get_target_user_company_id"("user_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can update custom roles in their company" ON "public"."custom_roles" FOR UPDATE TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can view IP restrictions in their company" ON "public"."user_ip_restrictions" FOR SELECT TO "authenticated" USING ((("public"."get_target_user_company_id"("user_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can view audit logs in their company" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can view company sessions" ON "public"."user_sessions" FOR SELECT TO "authenticated" USING ((("public"."get_target_user_company_id"("user_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can view custom roles in their company" ON "public"."custom_roles" FOR SELECT TO "authenticated" USING ((("company_id" = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "Super admins can view login attempts" ON "public"."login_attempts" FOR SELECT TO "authenticated" USING ("public"."is_user_super_admin"());



CREATE POLICY "Super admins can view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ((("public"."get_role_company_id"("role_id") = "public"."get_user_company_id"()) AND "public"."is_user_super_admin"()));



CREATE POLICY "System can insert notifications" ON "public"."notificaciones_internas" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can create condiciones from their company" ON "public"."presupuestos_condiciones_comerciales" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can create items in their company presupuestos" ON "public"."presupuestos_items" FOR INSERT TO "authenticated" WITH CHECK (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can create presupuestos in their company" ON "public"."presupuestos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete acabados compartidos in their company orders" ON "public"."ordenes_trabajo_acabados_compartidos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_acabados_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can delete acabados compartidos in their company presupue" ON "public"."presupuestos_acabados_compartidos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_acabados_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can delete archivos from their company" ON "public"."presupuestos_archivos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete items from their company presupuestos" ON "public"."presupuestos_items" FOR DELETE TO "authenticated" USING (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" FOR DELETE TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can delete liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" IS 'Permite eliminar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can delete liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" FOR DELETE TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can delete liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" IS 'Permite eliminar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can delete own company acabados" ON "public"."acabados" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company acabados_categorias" ON "public"."acabados_categorias" FOR DELETE TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company acabados_niveles_precio" ON "public"."acabados_niveles_precio" FOR DELETE TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company acabados_pasos" ON "public"."acabados_pasos" FOR DELETE TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company business hours" ON "public"."company_business_hours" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company estaciones" ON "public"."estaciones_trabajo" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can delete own company materiales" ON "public"."materiales" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can delete own company ordenes copiado" ON "public"."centro_copiado_ordenes" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company ordenes copiado pagos" ON "public"."centro_copiado_ordenes_pagos" FOR DELETE TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company ordenes items" ON "public"."centro_copiado_ordenes_items" FOR DELETE TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company ordenes items rutas" ON "public"."ordenes_trabajo_items_rutas" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company ordenes_trabajo" ON "public"."ordenes_trabajo" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company ordenes_trabajo_acabados_items" ON "public"."ordenes_trabajo_acabados_items" FOR DELETE TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can delete own company ordenes_trabajo_items" ON "public"."ordenes_trabajo_items" FOR DELETE TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company ordenes_trabajo_pagos" ON "public"."ordenes_trabajo_pagos" FOR DELETE TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company ordenes_trabajo_servicios_items" ON "public"."ordenes_trabajo_servicios_items" FOR DELETE TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can delete own company papeles" ON "public"."centro_copiado_papeles" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company pasos" ON "public"."pasos" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can delete own company pedidos" ON "public"."pedidos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company pedidos_opciones" ON "public"."pedidos_opciones" FOR DELETE TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company pedidos_rutas_resueltas" ON "public"."pedidos_rutas_resueltas" FOR DELETE TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company plastificados" ON "public"."centro_copiado_plastificados" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company plotter_corte_acabados" ON "public"."productos_plotter_corte_acabados" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company plotter_corte_precios" ON "public"."productos_plotter_corte_precios" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company plotter_corte_servicios" ON "public"."productos_plotter_corte_servicios" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company portabanners tecnologias" ON "public"."productos_portabanners_tecnologias" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company portabanners_acabados" ON "public"."productos_portabanners_acabados" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company portabanners_servicios" ON "public"."productos_portabanners_servicios" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company precios impresion" ON "public"."centro_copiado_precios_impresion" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company productos" ON "public"."productos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company productos_materiales" ON "public"."productos_materiales" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company productos_plotter_corte" ON "public"."productos_plotter_corte" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company productos_portabanners" ON "public"."productos_portabanners" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company productos_pricing" ON "public"."productos_pricing" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company productos_rutas_produccion" ON "public"."productos_rutas_produccion" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company rangos anillado" ON "public"."centro_copiado_rangos_anillado" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company rangos precio impresion" ON "public"."centro_copiado_rangos_precio_impresion" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company rangos_precio" ON "public"."rangos_precio" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company rutas_produccion" ON "public"."rutas_produccion" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company rutas_produccion_pasos" ON "public"."rutas_produccion_pasos" FOR DELETE TO "authenticated" USING (("ruta_id" IN ( SELECT "rutas_produccion"."id"
   FROM "public"."rutas_produccion"
  WHERE ("rutas_produccion"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company sellos precios" ON "public"."productos_sellos_precios" FOR DELETE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_sellos"."id"
   FROM "public"."productos_sellos"
  WHERE ("productos_sellos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company sellos products" ON "public"."productos_sellos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company servicios" ON "public"."servicios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company servicios_categorias" ON "public"."servicios_categorias" FOR DELETE TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company servicios_niveles_precio" ON "public"."servicios_niveles_precio" FOR DELETE TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company servicios_pasos" ON "public"."servicios_pasos" FOR DELETE TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company tamaños papel" ON "public"."centro_copiado_tamanios_papel" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own company tecnologias" ON "public"."tecnologias" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can delete own company tecnologias_tintas_pasos" ON "public"."tecnologias_tintas_pasos" FOR DELETE TO "authenticated" USING (("tecnologia_id" IN ( SELECT "tecnologias"."id"
   FROM "public"."tecnologias"
  WHERE ("tecnologias"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete prices from their company" ON "public"."productos_gran_formato_precios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete prices from their company" ON "public"."productos_impresion_laser_precios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete prices from their company" ON "public"."productos_materiales_rigidos_precios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete prices from their company" ON "public"."productos_portabanners_precios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete productos_talonarios in their company" ON "public"."productos_talonarios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete productos_talonarios_precios in their company" ON "public"."productos_talonarios_precios" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete products from their company" ON "public"."productos_gran_formato" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete products from their company" ON "public"."productos_impresion_laser" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete products from their company" ON "public"."productos_materiales_rigidos" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete servicios compartidos in their company orders" ON "public"."ordenes_trabajo_servicios_compartidos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_servicios_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can delete servicios compartidos in their company presupu" ON "public"."presupuestos_servicios_compartidos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_servicios_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own archivos or admins can delete any" ON "public"."centro_copiado_ordenes_archivos" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (("uploaded_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))))));



CREATE POLICY "Users can delete their own links or admins can delete any" ON "public"."ordenes_trabajo_links" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))))));



CREATE POLICY "Users can insert acabados compartidos in their company orders" ON "public"."ordenes_trabajo_acabados_compartidos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_acabados_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can insert acabados compartidos in their company presupue" ON "public"."presupuestos_acabados_compartidos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_acabados_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can insert archivos for their company" ON "public"."centro_copiado_ordenes_archivos" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND ("uploaded_by" = "auth"."uid"()) AND (("orden_copiado_id" IS NOT NULL) OR ("orden_temporal_id" IS NOT NULL))));



CREATE POLICY "Users can insert historial for their company presupuestos" ON "public"."presupuestos_historial" FOR INSERT TO "authenticated" WITH CHECK (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert links for their company" ON "public"."ordenes_trabajo_links" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can insert liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" FOR INSERT TO "authenticated" WITH CHECK (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can insert liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" IS 'Permite insertar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can insert liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" FOR INSERT TO "authenticated" WITH CHECK (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can insert liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" IS 'Permite insertar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can insert own company acabados" ON "public"."acabados" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company acabados_categorias" ON "public"."acabados_categorias" FOR INSERT TO "authenticated" WITH CHECK (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company acabados_niveles_precio" ON "public"."acabados_niveles_precio" FOR INSERT TO "authenticated" WITH CHECK (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company acabados_pasos" ON "public"."acabados_pasos" FOR INSERT TO "authenticated" WITH CHECK (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company arqueos" ON "public"."arqueos_cajas" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company business hours" ON "public"."company_business_hours" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company estaciones" ON "public"."estaciones_trabajo" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can insert own company facturas historial" ON "public"."facturas_historial" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company liquidaciones" ON "public"."liquidaciones" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company materiales" ON "public"."materiales" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can insert own company notificaciones" ON "public"."whatsapp_notificaciones" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company ordenes copiado" ON "public"."centro_copiado_ordenes" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company ordenes copiado pagos" ON "public"."centro_copiado_ordenes_pagos" FOR INSERT TO "authenticated" WITH CHECK (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company ordenes items" ON "public"."centro_copiado_ordenes_items" FOR INSERT TO "authenticated" WITH CHECK (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company ordenes items rutas" ON "public"."ordenes_trabajo_items_rutas" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company ordenes_trabajo" ON "public"."ordenes_trabajo" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company ordenes_trabajo_acabados_items" ON "public"."ordenes_trabajo_acabados_items" FOR INSERT TO "authenticated" WITH CHECK (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can insert own company ordenes_trabajo_historial" ON "public"."ordenes_trabajo_historial" FOR INSERT TO "authenticated" WITH CHECK (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company ordenes_trabajo_items" ON "public"."ordenes_trabajo_items" FOR INSERT TO "authenticated" WITH CHECK (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company ordenes_trabajo_pagos" ON "public"."ordenes_trabajo_pagos" FOR INSERT TO "authenticated" WITH CHECK (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company ordenes_trabajo_servicios_items" ON "public"."ordenes_trabajo_servicios_items" FOR INSERT TO "authenticated" WITH CHECK (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can insert own company papeles" ON "public"."centro_copiado_papeles" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company pasos" ON "public"."pasos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can insert own company pedidos" ON "public"."pedidos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company pedidos_opciones" ON "public"."pedidos_opciones" FOR INSERT TO "authenticated" WITH CHECK (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company pedidos_rutas_resueltas" ON "public"."pedidos_rutas_resueltas" FOR INSERT TO "authenticated" WITH CHECK (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company plastificados" ON "public"."centro_copiado_plastificados" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company plotter_corte_acabados" ON "public"."productos_plotter_corte_acabados" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company plotter_corte_precios" ON "public"."productos_plotter_corte_precios" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company plotter_corte_servicios" ON "public"."productos_plotter_corte_servicios" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company portabanners tecnologias" ON "public"."productos_portabanners_tecnologias" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company portabanners_acabados" ON "public"."productos_portabanners_acabados" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company portabanners_servicios" ON "public"."productos_portabanners_servicios" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company precios impresion" ON "public"."centro_copiado_precios_impresion" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company productos" ON "public"."productos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company productos_materiales" ON "public"."productos_materiales" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company productos_plotter_corte" ON "public"."productos_plotter_corte" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company productos_portabanners" ON "public"."productos_portabanners" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company productos_pricing" ON "public"."productos_pricing" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company productos_rutas_produccion" ON "public"."productos_rutas_produccion" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company rangos anillado" ON "public"."centro_copiado_rangos_anillado" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company rangos precio impresion" ON "public"."centro_copiado_rangos_precio_impresion" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company rangos_precio" ON "public"."rangos_precio" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company rutas_produccion" ON "public"."rutas_produccion" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company rutas_produccion_pasos" ON "public"."rutas_produccion_pasos" FOR INSERT TO "authenticated" WITH CHECK (("ruta_id" IN ( SELECT "rutas_produccion"."id"
   FROM "public"."rutas_produccion"
  WHERE ("rutas_produccion"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company sellos precios" ON "public"."productos_sellos_precios" FOR INSERT TO "authenticated" WITH CHECK (("producto_id" IN ( SELECT "productos_sellos"."id"
   FROM "public"."productos_sellos"
  WHERE ("productos_sellos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company sellos products" ON "public"."productos_sellos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company servicios" ON "public"."servicios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company servicios_categorias" ON "public"."servicios_categorias" FOR INSERT TO "authenticated" WITH CHECK (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company servicios_niveles_precio" ON "public"."servicios_niveles_precio" FOR INSERT TO "authenticated" WITH CHECK (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company servicios_pasos" ON "public"."servicios_pasos" FOR INSERT TO "authenticated" WITH CHECK (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company tamaños papel" ON "public"."centro_copiado_tamanios_papel" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own company tecnologias" ON "public"."tecnologias" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can insert own company tecnologias_tintas_pasos" ON "public"."tecnologias_tintas_pasos" FOR INSERT TO "authenticated" WITH CHECK (("tecnologia_id" IN ( SELECT "tecnologias"."id"
   FROM "public"."tecnologias"
  WHERE ("tecnologias"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert prices for their company" ON "public"."productos_gran_formato_precios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert prices for their company" ON "public"."productos_portabanners_precios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert prices to their company" ON "public"."productos_impresion_laser_precios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert prices to their company" ON "public"."productos_materiales_rigidos_precios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert productos_talonarios in their company" ON "public"."productos_talonarios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert productos_talonarios_precios in their company" ON "public"."productos_talonarios_precios" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert products to their company" ON "public"."productos_gran_formato" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert products to their company" ON "public"."productos_impresion_laser" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert products to their company" ON "public"."productos_materiales_rigidos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert servicios compartidos in their company orders" ON "public"."ordenes_trabajo_servicios_compartidos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_servicios_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can insert servicios compartidos in their company presupu" ON "public"."presupuestos_servicios_compartidos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_servicios_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own sessions" ON "public"."user_sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage product acabados from their company" ON "public"."productos_gran_formato_acabados" TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product finishes from their company" ON "public"."productos_impresion_laser_acabados" TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product finishes from their company" ON "public"."productos_materiales_rigidos_acabados" TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product materials from their company" ON "public"."productos_gran_formato_materiales" TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product materials from their company" ON "public"."productos_impresion_laser_materiales" TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product materials from their company" ON "public"."productos_materiales_rigidos_materiales" TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product services from their company" ON "public"."productos_gran_formato_servicios" TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product services from their company" ON "public"."productos_impresion_laser_servicios" TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product services from their company" ON "public"."productos_materiales_rigidos_servicios" TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product technologies from their company" ON "public"."productos_gran_formato_tecnologias" TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage product technologies from their company" ON "public"."productos_impresion_laser_tecnologias" TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage productos_talonarios_acabados" ON "public"."productos_talonarios_acabados" TO "authenticated" USING (("producto_talonario_id" IN ( SELECT "productos_talonarios"."id"
   FROM "public"."productos_talonarios"
  WHERE ("productos_talonarios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage productos_talonarios_materiales" ON "public"."productos_talonarios_materiales" TO "authenticated" USING (("producto_talonario_id" IN ( SELECT "productos_talonarios"."id"
   FROM "public"."productos_talonarios"
  WHERE ("productos_talonarios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage productos_talonarios_servicios" ON "public"."productos_talonarios_servicios" TO "authenticated" USING (("producto_talonario_id" IN ( SELECT "productos_talonarios"."id"
   FROM "public"."productos_talonarios"
  WHERE ("productos_talonarios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage productos_talonarios_tecnologias" ON "public"."productos_talonarios_tecnologias" TO "authenticated" USING (("producto_talonario_id" IN ( SELECT "productos_talonarios"."id"
   FROM "public"."productos_talonarios"
  WHERE ("productos_talonarios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their company cheques" ON "public"."cheques" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their company consumptions" ON "public"."tarjetas_consumos" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their company credit cards" ON "public"."tarjetas_credito" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their company recurring expenses" ON "public"."recurring_expenses" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their company summaries" ON "public"."tarjetas_resumenes" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update acabados compartidos in their company orders" ON "public"."ordenes_trabajo_acabados_compartidos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_acabados_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update acabados compartidos in their company presupue" ON "public"."presupuestos_acabados_compartidos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_acabados_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update archivos from their company" ON "public"."presupuestos_archivos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update items from their company presupuestos" ON "public"."presupuestos_items" FOR UPDATE TO "authenticated" USING (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" FOR UPDATE TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can update liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" IS 'Permite actualizar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can update liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" FOR UPDATE TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can update liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" IS 'Permite actualizar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';



CREATE POLICY "Users can update own company acabados" ON "public"."acabados" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company acabados_niveles_precio" ON "public"."acabados_niveles_precio" FOR UPDATE TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company acabados_pasos" ON "public"."acabados_pasos" FOR UPDATE TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company business hours" ON "public"."company_business_hours" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company estaciones" ON "public"."estaciones_trabajo" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can update own company materiales" ON "public"."materiales" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can update own company ordenes copiado" ON "public"."centro_copiado_ordenes" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company ordenes copiado pagos" ON "public"."centro_copiado_ordenes_pagos" FOR UPDATE TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company ordenes items" ON "public"."centro_copiado_ordenes_items" FOR UPDATE TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company ordenes items rutas" ON "public"."ordenes_trabajo_items_rutas" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company ordenes_trabajo" ON "public"."ordenes_trabajo" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company ordenes_trabajo_acabados_items" ON "public"."ordenes_trabajo_acabados_items" FOR UPDATE TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can update own company ordenes_trabajo_items" ON "public"."ordenes_trabajo_items" FOR UPDATE TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company ordenes_trabajo_pagos" ON "public"."ordenes_trabajo_pagos" FOR UPDATE TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company ordenes_trabajo_servicios_items" ON "public"."ordenes_trabajo_servicios_items" FOR UPDATE TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can update own company papeles" ON "public"."centro_copiado_papeles" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company pasos" ON "public"."pasos" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can update own company pedidos" ON "public"."pedidos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company pedidos_opciones" ON "public"."pedidos_opciones" FOR UPDATE TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company pedidos_rutas_resueltas" ON "public"."pedidos_rutas_resueltas" FOR UPDATE TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company plastificados" ON "public"."centro_copiado_plastificados" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company plotter_corte_precios" ON "public"."productos_plotter_corte_precios" FOR UPDATE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company precios impresion" ON "public"."centro_copiado_precios_impresion" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company productos" ON "public"."productos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company productos_materiales" ON "public"."productos_materiales" FOR UPDATE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company productos_plotter_corte" ON "public"."productos_plotter_corte" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company productos_portabanners" ON "public"."productos_portabanners" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company productos_pricing" ON "public"."productos_pricing" FOR UPDATE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company productos_rutas_produccion" ON "public"."productos_rutas_produccion" FOR UPDATE TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company rangos anillado" ON "public"."centro_copiado_rangos_anillado" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company rangos precio impresion" ON "public"."centro_copiado_rangos_precio_impresion" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company rangos_precio" ON "public"."rangos_precio" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company rutas_produccion" ON "public"."rutas_produccion" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company rutas_produccion_pasos" ON "public"."rutas_produccion_pasos" FOR UPDATE TO "authenticated" USING (("ruta_id" IN ( SELECT "rutas_produccion"."id"
   FROM "public"."rutas_produccion"
  WHERE ("rutas_produccion"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("ruta_id" IN ( SELECT "rutas_produccion"."id"
   FROM "public"."rutas_produccion"
  WHERE ("rutas_produccion"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company sellos precios" ON "public"."productos_sellos_precios" FOR UPDATE TO "authenticated" USING (("producto_id" IN ( SELECT "productos_sellos"."id"
   FROM "public"."productos_sellos"
  WHERE ("productos_sellos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("producto_id" IN ( SELECT "productos_sellos"."id"
   FROM "public"."productos_sellos"
  WHERE ("productos_sellos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company sellos products" ON "public"."productos_sellos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company servicios" ON "public"."servicios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company servicios_niveles_precio" ON "public"."servicios_niveles_precio" FOR UPDATE TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company servicios_pasos" ON "public"."servicios_pasos" FOR UPDATE TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own company tamaños papel" ON "public"."centro_copiado_tamanios_papel" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company tecnologias" ON "public"."tecnologias" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can update own company tecnologias_tintas_pasos" ON "public"."tecnologias_tintas_pasos" FOR UPDATE TO "authenticated" USING (("tecnologia_id" IN ( SELECT "tecnologias"."id"
   FROM "public"."tecnologias"
  WHERE ("tecnologias"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("tecnologia_id" IN ( SELECT "tecnologias"."id"
   FROM "public"."tecnologias"
  WHERE ("tecnologias"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own sessions" ON "public"."user_sessions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update presupuestos from their company" ON "public"."presupuestos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update prices from their company" ON "public"."productos_gran_formato_precios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update prices from their company" ON "public"."productos_impresion_laser_precios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update prices from their company" ON "public"."productos_materiales_rigidos_precios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update prices from their company" ON "public"."productos_portabanners_precios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update productos_talonarios in their company" ON "public"."productos_talonarios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update productos_talonarios_precios in their company" ON "public"."productos_talonarios_precios" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update products from their company" ON "public"."productos_gran_formato" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update products from their company" ON "public"."productos_impresion_laser" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update products from their company" ON "public"."productos_materiales_rigidos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update servicios compartidos in their company orders" ON "public"."ordenes_trabajo_servicios_compartidos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_servicios_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update servicios compartidos in their company presupu" ON "public"."presupuestos_servicios_compartidos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_servicios_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own archivos" ON "public"."centro_copiado_ordenes_archivos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own links" ON "public"."ordenes_trabajo_links" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"()))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can upload archivos to their company" ON "public"."presupuestos_archivos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view acabados compartidos from their company" ON "public"."ordenes_trabajo_acabados_compartidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_acabados_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view acabados compartidos from their company presupue" ON "public"."presupuestos_acabados_compartidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_acabados_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view all system categories" ON "public"."categorias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view archivos from their company" ON "public"."centro_copiado_ordenes_archivos" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (("orden_copiado_id" IS NOT NULL) OR (("orden_temporal_id" IS NOT NULL) AND ("uploaded_by" = "auth"."uid"())))));



CREATE POLICY "Users can view archivos from their company" ON "public"."presupuestos_archivos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view cities" ON "public"."cities" FOR SELECT TO "authenticated" USING ((("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())));



CREATE POLICY "Users can view clients from their company" ON "public"."clients" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view company profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view company subscription" ON "public"."company_subscriptions" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view compras of their company" ON "public"."compras_proveedores" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view condiciones from their company" ON "public"."presupuestos_condiciones_comerciales" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view countries" ON "public"."countries" FOR SELECT TO "authenticated" USING ((("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())));



CREATE POLICY "Users can view historial from their company" ON "public"."presupuestos_historial" FOR SELECT TO "authenticated" USING (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view items from their company presupuestos" ON "public"."presupuestos_items" FOR SELECT TO "authenticated" USING (("presupuesto_id" IN ( SELECT "presupuestos"."id"
   FROM "public"."presupuestos"
  WHERE ("presupuestos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view links from their company" ON "public"."ordenes_trabajo_links" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view liquidaciones_items via liquidacion" ON "public"."liquidaciones_items" FOR SELECT TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view liquidaciones_pagos via liquidacion" ON "public"."liquidaciones_pagos" FOR SELECT TO "authenticated" USING (("liquidacion_id" IN ( SELECT "liquidaciones"."id"
   FROM "public"."liquidaciones"
  WHERE ("liquidaciones"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view own company URLs" ON "public"."facturas_urls_cortas" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company acabados" ON "public"."acabados" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company acabados_categorias" ON "public"."acabados_categorias" FOR SELECT TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company acabados_niveles_precio" ON "public"."acabados_niveles_precio" FOR SELECT TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company acabados_pasos" ON "public"."acabados_pasos" FOR SELECT TO "authenticated" USING (("acabado_id" IN ( SELECT "acabados"."id"
   FROM "public"."acabados"
  WHERE ("acabados"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company arqueos" ON "public"."arqueos_cajas" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company business hours" ON "public"."company_business_hours" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company cc_movimientos" ON "public"."cuentas_corrientes_movimientos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company estaciones" ON "public"."estaciones_trabajo" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view own company facturas historial" ON "public"."facturas_historial" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company ingresos" ON "public"."ingresos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company liquidaciones" ON "public"."liquidaciones" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company materiales" ON "public"."materiales" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view own company medios_cobro" ON "public"."medios_cobro" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company notificaciones" ON "public"."whatsapp_notificaciones" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company ordenes copiado" ON "public"."centro_copiado_ordenes" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company ordenes copiado pagos" ON "public"."centro_copiado_ordenes_pagos" FOR SELECT TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company ordenes items" ON "public"."centro_copiado_ordenes_items" FOR SELECT TO "authenticated" USING (("orden_copiado_id" IN ( SELECT "centro_copiado_ordenes"."id"
   FROM "public"."centro_copiado_ordenes"
  WHERE ("centro_copiado_ordenes"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company ordenes items rutas" ON "public"."ordenes_trabajo_items_rutas" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company ordenes_trabajo" ON "public"."ordenes_trabajo" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company ordenes_trabajo_acabados_items" ON "public"."ordenes_trabajo_acabados_items" FOR SELECT TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can view own company ordenes_trabajo_historial" ON "public"."ordenes_trabajo_historial" FOR SELECT TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company ordenes_trabajo_items" ON "public"."ordenes_trabajo_items" FOR SELECT TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company ordenes_trabajo_pagos" ON "public"."ordenes_trabajo_pagos" FOR SELECT TO "authenticated" USING (("orden_id" IN ( SELECT "ordenes_trabajo"."id"
   FROM "public"."ordenes_trabajo"
  WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company ordenes_trabajo_servicios_items" ON "public"."ordenes_trabajo_servicios_items" FOR SELECT TO "authenticated" USING (("orden_item_id" IN ( SELECT "ordenes_trabajo_items"."id"
   FROM "public"."ordenes_trabajo_items"
  WHERE ("ordenes_trabajo_items"."orden_id" IN ( SELECT "ordenes_trabajo"."id"
           FROM "public"."ordenes_trabajo"
          WHERE ("ordenes_trabajo"."company_id" IN ( SELECT "profiles"."company_id"
                   FROM "public"."profiles"
                  WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Users can view own company papeles" ON "public"."centro_copiado_papeles" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company pasos" ON "public"."pasos" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view own company pedidos" ON "public"."pedidos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company pedidos_opciones" ON "public"."pedidos_opciones" FOR SELECT TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company pedidos_rutas_resueltas" ON "public"."pedidos_rutas_resueltas" FOR SELECT TO "authenticated" USING (("pedido_id" IN ( SELECT "pedidos"."id"
   FROM "public"."pedidos"
  WHERE ("pedidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company plastificados" ON "public"."centro_copiado_plastificados" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company plotter_corte_acabados" ON "public"."productos_plotter_corte_acabados" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company plotter_corte_precios" ON "public"."productos_plotter_corte_precios" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company plotter_corte_servicios" ON "public"."productos_plotter_corte_servicios" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_plotter_corte"."id"
   FROM "public"."productos_plotter_corte"
  WHERE ("productos_plotter_corte"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company portabanners tecnologias" ON "public"."productos_portabanners_tecnologias" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company portabanners_acabados" ON "public"."productos_portabanners_acabados" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company portabanners_servicios" ON "public"."productos_portabanners_servicios" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_portabanners"."id"
   FROM "public"."productos_portabanners"
  WHERE ("productos_portabanners"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company precios impresion" ON "public"."centro_copiado_precios_impresion" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company productos" ON "public"."productos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company productos_materiales" ON "public"."productos_materiales" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company productos_plotter_corte" ON "public"."productos_plotter_corte" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company productos_portabanners" ON "public"."productos_portabanners" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company productos_pricing" ON "public"."productos_pricing" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company productos_rutas_produccion" ON "public"."productos_rutas_produccion" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos"."id"
   FROM "public"."productos"
  WHERE ("productos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company rangos anillado" ON "public"."centro_copiado_rangos_anillado" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company rangos precio impresion" ON "public"."centro_copiado_rangos_precio_impresion" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company rangos_precio" ON "public"."rangos_precio" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company rutas_produccion" ON "public"."rutas_produccion" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company rutas_produccion_pasos" ON "public"."rutas_produccion_pasos" FOR SELECT TO "authenticated" USING (("ruta_id" IN ( SELECT "rutas_produccion"."id"
   FROM "public"."rutas_produccion"
  WHERE ("rutas_produccion"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company sellos precios" ON "public"."productos_sellos_precios" FOR SELECT TO "authenticated" USING (("producto_id" IN ( SELECT "productos_sellos"."id"
   FROM "public"."productos_sellos"
  WHERE ("productos_sellos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company sellos products" ON "public"."productos_sellos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company servicios" ON "public"."servicios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company servicios_categorias" ON "public"."servicios_categorias" FOR SELECT TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company servicios_niveles_precio" ON "public"."servicios_niveles_precio" FOR SELECT TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company servicios_pasos" ON "public"."servicios_pasos" FOR SELECT TO "authenticated" USING (("servicio_id" IN ( SELECT "servicios"."id"
   FROM "public"."servicios"
  WHERE ("servicios"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company tamaños papel" ON "public"."centro_copiado_tamanios_papel" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company tecnologias" ON "public"."tecnologias" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view own company tecnologias_tintas_pasos" ON "public"."tecnologias_tintas_pasos" FOR SELECT TO "authenticated" USING (("tecnologia_id" IN ( SELECT "tecnologias"."id"
   FROM "public"."tecnologias"
  WHERE ("tecnologias"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company tipos_ingreso" ON "public"."tipos_ingreso" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own sessions" ON "public"."user_sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view presupuestos from their company" ON "public"."presupuestos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view prices from their company" ON "public"."productos_gran_formato_precios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view prices from their company" ON "public"."productos_impresion_laser_precios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view prices from their company" ON "public"."productos_materiales_rigidos_precios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view prices from their company" ON "public"."productos_portabanners_precios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view product acabados from their company" ON "public"."productos_gran_formato_acabados" FOR SELECT TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product finishes from their company" ON "public"."productos_impresion_laser_acabados" FOR SELECT TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product finishes from their company" ON "public"."productos_materiales_rigidos_acabados" FOR SELECT TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product materials from their company" ON "public"."productos_gran_formato_materiales" FOR SELECT TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product materials from their company" ON "public"."productos_impresion_laser_materiales" FOR SELECT TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product materials from their company" ON "public"."productos_materiales_rigidos_materiales" FOR SELECT TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product services from their company" ON "public"."productos_gran_formato_servicios" FOR SELECT TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product services from their company" ON "public"."productos_impresion_laser_servicios" FOR SELECT TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product services from their company" ON "public"."productos_materiales_rigidos_servicios" FOR SELECT TO "authenticated" USING (("producto_materiales_rigidos_id" IN ( SELECT "productos_materiales_rigidos"."id"
   FROM "public"."productos_materiales_rigidos"
  WHERE ("productos_materiales_rigidos"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product technologies from their company" ON "public"."productos_gran_formato_tecnologias" FOR SELECT TO "authenticated" USING (("producto_gran_formato_id" IN ( SELECT "productos_gran_formato"."id"
   FROM "public"."productos_gran_formato"
  WHERE ("productos_gran_formato"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view product technologies from their company" ON "public"."productos_impresion_laser_tecnologias" FOR SELECT TO "authenticated" USING (("producto_laser_id" IN ( SELECT "productos_impresion_laser"."id"
   FROM "public"."productos_impresion_laser"
  WHERE ("productos_impresion_laser"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view productos_talonarios from their company" ON "public"."productos_talonarios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view productos_talonarios_precios from their company" ON "public"."productos_talonarios_precios" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view products from their company" ON "public"."productos_gran_formato" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view products from their company" ON "public"."productos_impresion_laser" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view products from their company" ON "public"."productos_materiales_rigidos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view providers from their company" ON "public"."providers" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "Users can view provinces" ON "public"."provinces" FOR SELECT TO "authenticated" USING ((("company_id" IS NULL) OR ("company_id" = "public"."get_user_company_id"())));



CREATE POLICY "Users can view recurring executions of their company" ON "public"."recurring_executions" FOR SELECT TO "authenticated" USING (("recurring_id" IN ( SELECT "recurring_expenses"."id"
   FROM "public"."recurring_expenses"
  WHERE ("recurring_expenses"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view recurring expenses of their company" ON "public"."recurring_expenses" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view servicios compartidos from their company" ON "public"."ordenes_trabajo_servicios_compartidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ordenes_trabajo" "ot"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "ot"."company_id")))
  WHERE (("ot"."id" = "ordenes_trabajo_servicios_compartidos"."orden_trabajo_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view servicios compartidos from their company presupu" ON "public"."presupuestos_servicios_compartidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."presupuestos" "p"
     JOIN "public"."profiles" "prof" ON (("prof"."company_id" = "p"."company_id")))
  WHERE (("p"."id" = "presupuestos_servicios_compartidos"."presupuesto_id") AND ("prof"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view their company cheques" ON "public"."cheques" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company consumptions" ON "public"."tarjetas_consumos" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company credit cards" ON "public"."tarjetas_credito" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company recurring expenses" ON "public"."recurring_expenses" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company summaries" ON "public"."tarjetas_resumenes" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own IP restrictions" ON "public"."user_ip_restrictions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own company pausas" ON "public"."ordenes_items_rutas_pausas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo_items_rutas" "otir"
  WHERE (("otir"."id" = "ordenes_items_rutas_pausas"."ruta_id") AND ("otir"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Users update own company pausas" ON "public"."ordenes_items_rutas_pausas" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo_items_rutas" "otir"
  WHERE (("otir"."id" = "ordenes_items_rutas_pausas"."ruta_id") AND ("otir"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo_items_rutas" "otir"
  WHERE (("otir"."id" = "ordenes_items_rutas_pausas"."ruta_id") AND ("otir"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Users update own notifications" ON "public"."notificaciones_internas" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Users view own company motivos pausa" ON "public"."pasos_motivos_pausa" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users view own company pausas" ON "public"."ordenes_items_rutas_pausas" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ordenes_trabajo_items_rutas" "otir"
  WHERE (("otir"."id" = "ordenes_items_rutas_pausas"."ruta_id") AND ("otir"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Users view own notifications" ON "public"."notificaciones_internas" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios autorizados pueden actualizar egresos" ON "public"."egresos" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"])))))) WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Usuarios autorizados pueden crear egresos" ON "public"."egresos" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Usuarios pueden ver egresos de su empresa" ON "public"."egresos" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuarios pueden ver tipos de egreso de su empresa" ON "public"."tipos_egreso" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acabados_categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acabados_niveles_precio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acabados_pasos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."arqueos_cajas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cajas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cajas_movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_ordenes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_ordenes_archivos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_ordenes_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_ordenes_pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_papeles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_plastificados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_precios_impresion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_rangos_anillado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_rangos_precio_impresion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centro_copiado_tamanios_papel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cheques" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cheques_cartera" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cliente_registro_intentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_business_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compras_proveedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuentas_corrientes_movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."egresos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estaciones_trabajo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facturas_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facturas_urls_cortas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingresos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."liquidaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."liquidaciones_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."liquidaciones_pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."login_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medios_cobro" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones_internas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_items_rutas_pausas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_acabados_compartidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_acabados_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_items_rutas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_servicios_compartidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes_trabajo_servicios_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pasos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pasos_motivos_pausa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_opciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_rutas_resueltas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_acabados_compartidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_archivos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_condiciones_comerciales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos_servicios_compartidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_acabados_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato_materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_gran_formato_tecnologias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser_materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_impresion_laser_tecnologias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_rigidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_rigidos_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_rigidos_materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_rigidos_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_rigidos_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_materiales_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_plotter_corte" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_plotter_corte_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_plotter_corte_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_plotter_corte_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_portabanners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_portabanners_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_portabanners_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_portabanners_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_portabanners_tecnologias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_rutas_produccion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_sellos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_sellos_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_servicios_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios_acabados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios_materiales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios_precios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_talonarios_tecnologias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos_tecnologias_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provinces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rangos_precio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rutas_produccion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rutas_produccion_pasos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicios_categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicios_niveles_precio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicios_pasos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tarjetas_consumos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tarjetas_credito" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tarjetas_resumenes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tecnologias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tecnologias_tintas_pasos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_egreso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_ingreso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ip_restrictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_notificaciones" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_on_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_on_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_on_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_saldo_caja_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_datos_pago_from_medio_cobro"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_datos_pago_from_medio_cobro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_datos_pago_from_medio_cobro"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_precio_mt2_placa"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_precio_mt2_placa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_precio_mt2_placa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_categoria_has_dependencies"("categoria_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_estacion_has_dependencies"("estacion_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_estacion_has_dependencies"("estacion_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_estacion_has_dependencies"("estacion_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_grupo_paso_has_dependencies"("grupo_paso_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_grupo_paso_has_dependencies"("grupo_paso_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_grupo_paso_has_dependencies"("grupo_paso_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_ip_restriction"("p_user_id" "uuid", "p_ip_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_ip_restriction"("p_user_id" "uuid", "p_ip_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_ip_restriction"("p_user_id" "uuid", "p_ip_address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_paso_has_dependencies"("paso_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_paso_has_dependencies"("paso_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_paso_has_dependencies"("paso_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tecnologia_tintas_completitud"("p_tecnologia_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_pasos_por_etapa"("p_ruta_id" "uuid", "p_etapa" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."count_pasos_por_etapa"("p_ruta_id" "uuid", "p_etapa" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_pasos_por_etapa"("p_ruta_id" "uuid", "p_etapa" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_medios_cobro_default"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_medios_cobro_default"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_medios_cobro_default"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text", "p_custom_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text", "p_custom_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team_member"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text", "p_custom_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_team_member"("p_user_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_team_member"("p_user_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_team_member"("p_user_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_team_member"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_team_member"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_team_member"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_orden"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_orden"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_estado_orden"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_total_cuando_cambia_total_oc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_actualizar_total_orden_trabajo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_actualizar_total_orden_trabajo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_total_orden_trabajo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_actualizar_totales_presupuesto"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_actualizar_totales_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_totales_presupuesto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aprobar_cliente"("p_cliente_id" "uuid", "p_aprobado_por" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asociar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_orden_id" "uuid", "p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asociar_archivos_copiado_temporales"("p_orden_temporal_id" "text", "p_orden_copiado_id" "uuid", "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_categoria"("p_categoria" "text", "p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_gran_formato"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_impresion_laser"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_materiales_rigidos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_plotter_corte"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_portabanners"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_sellos"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aumentar_precios_talonarios"("p_porcentaje" numeric, "p_productos_ids" "uuid"[], "p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auto_complete_liquidacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auto_complete_liquidacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auto_complete_liquidacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_duracion_paso"("p_fecha_inicio" timestamp with time zone, "p_fecha_fin" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado"("p_orden_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid", "p_orden_temporal_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid", "p_orden_temporal_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_espacio_usado_copiado_temporal"("p_orden_id" "uuid", "p_orden_temporal_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_liquidacion"("p_cliente_id" "uuid", "p_fecha_referencia" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_liquidacion"("p_cliente_id" "uuid", "p_fecha_referencia" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_liquidacion"("p_cliente_id" "uuid", "p_fecha_referencia" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_mensual"("p_dia_cierre" integer, "p_usa_ultimo_dia" boolean, "p_fecha_referencia" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_mensual"("p_dia_cierre" integer, "p_usa_ultimo_dia" boolean, "p_fecha_referencia" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_mensual"("p_dia_cierre" integer, "p_usa_ultimo_dia" boolean, "p_fecha_referencia" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_quincenal"("p_fecha_referencia" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_quincenal"("p_fecha_referencia" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_quincenal"("p_fecha_referencia" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_semanal"("p_dia_cierre" integer, "p_fecha_referencia" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_semanal"("p_dia_cierre" integer, "p_fecha_referencia" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_periodo_semanal"("p_dia_cierre" integer, "p_fecha_referencia" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_rango_fechas"("p_preset" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_saldo_cuenta_corriente"("p_cliente_id" "uuid", "p_fecha_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_saldo_cuenta_corriente"("p_cliente_id" "uuid", "p_fecha_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_saldo_cuenta_corriente"("p_cliente_id" "uuid", "p_fecha_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_saldos_pendientes_cobro"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_total_consolidado_orden"("p_orden_trabajo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_contar_clientes_pendientes"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_contar_items_sin_precio"("p_presupuesto_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone, "p_notas_adicionales" "text", "p_monto_pago" numeric, "p_medio_cobro_id" "uuid", "p_referencia_pago" "text", "p_rutas_personalizadas" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone, "p_notas_adicionales" "text", "p_monto_pago" numeric, "p_medio_cobro_id" "uuid", "p_referencia_pago" "text", "p_rutas_personalizadas" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_convertir_presupuesto_a_orden"("p_presupuesto_id" "uuid", "p_fecha_entrega_estimada" timestamp with time zone, "p_notas_adicionales" "text", "p_monto_pago" numeric, "p_medio_cobro_id" "uuid", "p_referencia_pago" "text", "p_rutas_personalizadas" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_cajas_desde_medios_cobro"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_cajas_desde_medios_cobro"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_cajas_desde_medios_cobro"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_egreso"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_egreso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_egreso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_ingreso"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_ingreso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_movimiento_ingreso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_notificacion_pausa_prolongada"("p_pausa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_ruta_resuelta_pedido"("p_pedido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_ruta_resuelta_pedido"("p_pedido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_ruta_resuelta_pedido"("p_pedido_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cuellos_botella"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_debug_cashflow_wip"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_debug_cashflow_wip"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_debug_cashflow_wip"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_detectar_pausas_prolongadas"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_detectar_pausas_prolongadas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_detectar_pausas_prolongadas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_diagnosticar_precios_huerfanos_mr"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_duplicar_plantilla_ruta"("p_producto_origen_id" "uuid", "p_producto_destino_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_duplicar_plantilla_ruta"("p_producto_origen_id" "uuid", "p_producto_destino_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_duplicar_plantilla_ruta"("p_producto_origen_id" "uuid", "p_producto_destino_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_eliminar_movimiento_ingreso"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_eliminar_movimiento_ingreso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_eliminar_movimiento_ingreso"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_eliminar_precios_huerfanos_mr"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_estadisticas_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_evaluar_condicion_simple"("p_condicion_config" "jsonb", "p_opciones_cliente" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_evaluar_condicion_simple"("p_condicion_config" "jsonb", "p_opciones_cliente" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_evaluar_condicion_simple"("p_condicion_config" "jsonb", "p_opciones_cliente" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_evolutivo_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_expandir_grupo_pasos"("p_grupo_paso_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_expandir_grupo_pasos"("p_grupo_paso_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_expandir_grupo_pasos"("p_grupo_paso_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_formatear_configuracion_item"("p_configuracion" "jsonb", "p_categoria" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generar_numero_liquidacion"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generar_numero_liquidacion"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generar_numero_liquidacion"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generar_numero_presupuesto"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generar_numero_presupuesto"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generar_numero_presupuesto"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generar_ruta_produccion_item"("p_orden_item_id" "uuid", "p_producto_id" "uuid", "p_categoria" "text", "p_configuracion" "jsonb", "p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generar_token_factura"("p_company_id" "uuid", "p_orden_trabajo_id" "uuid", "p_factura_storage_path" "text", "p_numero_factura" "text", "p_dias_validez" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_cajas_dashboard"("p_company_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_cajas_dashboard"("p_company_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_cajas_dashboard"("p_company_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_cajas_options"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_cajas_options"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_cajas_options"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_cashflow_projection"("p_company_id" "uuid", "p_days_to_project" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_cashflow_projection"("p_company_id" "uuid", "p_days_to_project" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_cashflow_projection"("p_company_id" "uuid", "p_days_to_project" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_clientes_con_saldo"("p_company_id" "uuid", "p_search_term" "text", "p_estado_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_clientes_con_saldo"("p_company_id" "uuid", "p_search_term" "text", "p_estado_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_clientes_con_saldo"("p_company_id" "uuid", "p_search_term" "text", "p_estado_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_movimientos_caja"("p_caja_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_movimientos_caja"("p_caja_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_movimientos_caja"("p_caja_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_public_order_tracking"("p_tracking_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_public_presupuesto_tracking"("p_tracking_token" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_vencimientos_pendientes"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_vencimientos_pendientes"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_vencimientos_pendientes"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_kpis_generales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales"("p_orden_temporal_id" "uuid", "p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_limpiar_adjuntos_temporales_antiguos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_limpiar_archivos_temporales_copiado"("p_horas_antiguedad" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_limpiar_tokens_expirados"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_limpiar_tokens_expirados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_limpiar_tokens_expirados"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_categoria"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_etapa"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_operario"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_metricas_por_paso"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_metricas_rendimiento_operadores"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_migrar_pagos_historicos_a_cajas"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_migrar_pagos_historicos_a_cajas"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_migrar_pagos_historicos_a_cajas"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_aprobacion_presupuesto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notificar_rechazo_presupuesto"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notificar_rechazo_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_rechazo_presupuesto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_clientes_pendientes"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_detalle_por_cobrar"("p_company_id" "uuid", "p_tipo_cliente" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_estado_cuenta"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_estado_cuenta"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_estado_cuenta"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_factura_por_token"("p_company_id" "uuid", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_ordenes_pendientes_liquidar"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_ordenes_pendientes_liquidar"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_ordenes_pendientes_liquidar"("p_company_id" "uuid", "p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_paso_de_nivel"("p_tipo" "text", "p_item_id" "uuid", "p_nivel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_paso_de_nivel"("p_tipo" "text", "p_item_id" "uuid", "p_nivel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_paso_de_nivel"("p_tipo" "text", "p_item_id" "uuid", "p_nivel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_obtener_resumen_cajas"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_obtener_resumen_cajas"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_obtener_resumen_cajas"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ordenes_completadas_detalle"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date", "p_cliente_id" "uuid", "p_estado" "text", "p_estado_facturacion" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date", "p_cliente_id" "uuid", "p_estado" "text", "p_estado_facturacion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ordenes_pendientes_facturacion"("p_company_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date", "p_cliente_id" "uuid", "p_estado" "text", "p_estado_facturacion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pasos_mas_pausados"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text", "p_pausado_por" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text", "p_pausado_por" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pausar_paso"("p_ruta_id" "uuid", "p_motivo_pausa_id" "uuid", "p_descripcion" "text", "p_pausado_por" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_agrupacion" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_agrupacion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pausas_evolucion_temporal"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_agrupacion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pausas_kpis_generales"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pausas_mas_prolongadas"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pausas_por_categoria"("p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_presupuesto_tiene_items_sin_precio"("p_presupuesto_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_pendientes_cotizar_detalles"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_presupuestos_registro_historial"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_registro_historial"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_presupuestos_registro_historial"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_realizar_arqueo_caja"("p_caja_id" "uuid", "p_saldo_real" numeric, "p_observaciones" "text", "p_billetes_detalle" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_realizar_arqueo_caja"("p_caja_id" "uuid", "p_saldo_real" numeric, "p_observaciones" "text", "p_billetes_detalle" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_realizar_arqueo_caja"("p_caja_id" "uuid", "p_saldo_real" numeric, "p_observaciones" "text", "p_billetes_detalle" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_realizar_transferencia_caja"("p_caja_origen_id" "uuid", "p_caja_destino_id" "uuid", "p_monto" numeric, "p_concepto" "text", "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_realizar_transferencia_caja"("p_caja_origen_id" "uuid", "p_caja_destino_id" "uuid", "p_monto" numeric, "p_concepto" "text", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_realizar_transferencia_caja"("p_caja_origen_id" "uuid", "p_caja_destino_id" "uuid", "p_monto" numeric, "p_concepto" "text", "p_notas" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reanudar_paso"("p_ruta_id" "uuid", "p_reanudado_por" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalcular_saldo_caja_especifica"("p_caja_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalcular_saldos_cajas"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalcular_saldos_cajas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalcular_saldos_cajas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalcular_tiempos_paso"("p_ruta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalcular_total_orden_trabajo"("p_orden_trabajo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalcular_totales_todas_ordenes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_rechazar_cliente"("p_cliente_id" "uuid", "p_rechazado_por" "uuid", "p_notas" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recrear_combinaciones_faltantes_mr"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_factura"("p_orden_id" "uuid", "p_numero_factura" "text", "p_factura_storage_path" "text", "p_observaciones" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ingresos_egresos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_tasa_sena"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_top_productos"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_kpis"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_canal"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_categoria"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_dia_semana"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_hora"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_por_usuario"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_ventas_timeline"("p_company_id" "uuid", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_granularidad" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_resolver_ruta_produccion"("p_producto_id" "uuid", "p_opciones_cliente" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_resolver_ruta_produccion"("p_producto_id" "uuid", "p_opciones_cliente" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_resolver_ruta_produccion"("p_producto_id" "uuid", "p_opciones_cliente" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_resumen_actividad_equipo"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_seed_motivos_pausa_default"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_seed_tipos_egreso_default"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_seed_tipos_egreso_default"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_seed_tipos_egreso_default"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_seed_tipos_ingreso_default"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_fecha_completado"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_fecha_completado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_fecha_completado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_numero_presupuesto"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_numero_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_numero_presupuesto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sincronizar_pago_con_caja"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sincronizar_pago_con_caja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sincronizar_pago_con_caja"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sugerir_ordenes_para_liquidacion"("p_cliente_id" "uuid", "p_fecha_desde" "date", "p_fecha_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_tasa_cumplimiento"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_tendencias_temporales"("p_company_id" "uuid", "p_fecha_desde" timestamp with time zone, "p_fecha_hasta" timestamp with time zone, "p_intervalo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_trigger_whatsapp_orden_finalizada"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_update_centro_copiado_archivos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_update_egresos_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_update_egresos_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_update_egresos_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_estado_presupuesto_completo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_estado_presupuesto_completo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_estado_presupuesto_completo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_copiado"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_copiado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_copiado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_produccion"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_produccion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_limite_total_archivos_produccion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_plantilla_ruta"("p_producto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_plantilla_ruta"("p_producto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_plantilla_ruta"("p_producto_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_vencer_presupuestos_expirados"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_vencer_presupuestos_expirados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_vencer_presupuestos_expirados"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_verificar_totales_ordenes"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_verificar_totales_ordenes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verificar_totales_ordenes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generar_numero_pedido"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generar_numero_pedido"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generar_numero_pedido"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_numero_orden"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_numero_orden"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_numero_orden"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_tracking_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_tracking_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_tracking_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_productos_using_ruta"("p_ruta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_role_company_id"("target_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_role_company_id"("target_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_role_company_id"("target_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_target_user_company_id"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_target_user_company_id"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_target_user_company_id"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_pasos_ruta"("p_ruta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_pasos_ruta"("p_ruta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_pasos_ruta"("p_ruta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_company_id"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_company_id"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_id"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."hook_password_verification_with_ip"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_login_attempt"("p_email" "text", "p_ip_address" "text", "p_success" boolean, "p_failure_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_login_attempt"("p_email" "text", "p_ip_address" "text", "p_success" boolean, "p_failure_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_login_attempt"("p_email" "text", "p_ip_address" "text", "p_success" boolean, "p_failure_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_categoria_deactivation_with_dependencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_estacion_deactivation_with_dependencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_grupo_paso_deactivation_with_dependencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_grupo_paso_deactivation_with_dependencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_grupo_paso_deactivation_with_dependencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_paso_deactivation_with_dependencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_paso_deactivation_with_dependencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_paso_deactivation_with_dependencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_team_member_password"("p_user_id" "uuid", "p_new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_team_member_password"("p_user_id" "uuid", "p_new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_team_member_password"("p_user_id" "uuid", "p_new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_client_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_client_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_client_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_provider_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_provider_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_provider_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tracking_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tracking_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tracking_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean, "p_test_ip" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean, "p_test_ip" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_password_verification_hook"("p_user_id" "uuid", "p_password_valid" boolean, "p_test_ip" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_actualizar_estado_liquidacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_actualizar_estado_liquidacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_actualizar_estado_liquidacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_crear_cajas_para_nueva_empresa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_crear_medios_cobro_default"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_crear_medios_cobro_default"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_crear_medios_cobro_default"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_generate_numero_orden"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_generate_numero_orden"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_generate_numero_orden"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_creado_enviado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_enviado"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_enviado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_notify_presupuesto_enviado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_recalcular_tiempos_pausa"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_tiempos_pausa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_tiempos_pausa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot_servicios"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot_servicios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_recalcular_total_ot_servicios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_registrar_cargo_cc_orden_completada"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_registrar_pago_cc"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_registrar_pago_cc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_registrar_pago_cc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_seed_motivos_pausa_new_company"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_whatsapp_presupuesto_aprobado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_global_task_status"("p_global_task_id" "uuid", "p_new_status" "text", "p_user_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_global_task_status"("p_global_task_id" "uuid", "p_new_status" "text", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_global_task_status"("p_global_task_id" "uuid", "p_new_status" "text", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ordenes_items_rutas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ordenes_items_rutas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ordenes_items_rutas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ordenes_trabajo_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ordenes_trabajo_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ordenes_trabajo_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pedidos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pedidos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pedidos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pl_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pl_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pl_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pmr_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pmr_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pmr_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_presupuestos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_presupuestos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_presupuestos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_gran_formato_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_impresion_laser_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_impresion_laser_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_impresion_laser_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_materiales_rigidos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_materiales_rigidos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_materiales_rigidos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_plotter_corte_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_portabanners_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_portabanners_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_portabanners_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_portabanners_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_portabanners_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_portabanners_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_rutas_plantillas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_rutas_plantillas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_rutas_plantillas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_sellos_precios_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_sellos_precios_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_sellos_precios_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_productos_sellos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_productos_sellos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_productos_sellos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rutas_produccion_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_rutas_produccion_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rutas_produccion_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_member_role"("p_user_id" "uuid", "p_new_role" "text", "p_custom_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_member_role"("p_user_id" "uuid", "p_new_role" "text", "p_custom_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_member_role"("p_user_id" "uuid", "p_new_role" "text", "p_custom_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_belongs_to_company"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_belongs_to_company"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_belongs_to_company"("target_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_etapa_paso"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_etapa_paso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_etapa_paso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_rango_precio_laser"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_rango_precio_laser"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_rango_precio_laser"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_material_variantes"("variantes_param" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_material_variantes"("variantes_param" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_material_variantes"("variantes_param" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_material_variantes_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_material_variantes_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_material_variantes_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_precio_mr_combination"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_precio_mr_combination"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_precio_mr_combination"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ruta_completitud"("p_ruta_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."acabados" TO "anon";
GRANT ALL ON TABLE "public"."acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."acabados" TO "service_role";



GRANT ALL ON TABLE "public"."acabados_categorias" TO "anon";
GRANT ALL ON TABLE "public"."acabados_categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."acabados_categorias" TO "service_role";



GRANT ALL ON TABLE "public"."acabados_niveles_precio" TO "anon";
GRANT ALL ON TABLE "public"."acabados_niveles_precio" TO "authenticated";
GRANT ALL ON TABLE "public"."acabados_niveles_precio" TO "service_role";



GRANT ALL ON TABLE "public"."acabados_pasos" TO "anon";
GRANT ALL ON TABLE "public"."acabados_pasos" TO "authenticated";
GRANT ALL ON TABLE "public"."acabados_pasos" TO "service_role";



GRANT ALL ON TABLE "public"."arqueos_cajas" TO "anon";
GRANT ALL ON TABLE "public"."arqueos_cajas" TO "authenticated";
GRANT ALL ON TABLE "public"."arqueos_cajas" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."banks" TO "anon";
GRANT ALL ON TABLE "public"."banks" TO "authenticated";
GRANT ALL ON TABLE "public"."banks" TO "service_role";



GRANT ALL ON TABLE "public"."cajas" TO "anon";
GRANT ALL ON TABLE "public"."cajas" TO "authenticated";
GRANT ALL ON TABLE "public"."cajas" TO "service_role";



GRANT ALL ON TABLE "public"."cajas_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."cajas_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."cajas_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_ordenes" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_ordenes_archivos" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_archivos" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_ordenes_items" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_items" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_items" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_ordenes_pagos" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_ordenes_pagos" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_papeles" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_papeles" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_papeles" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_plastificados" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_plastificados" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_plastificados" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_precios_impresion" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_precios_impresion" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_precios_impresion" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_rangos_anillado" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_rangos_anillado" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_rangos_anillado" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_rangos_precio_impresion" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_rangos_precio_impresion" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_rangos_precio_impresion" TO "service_role";



GRANT ALL ON TABLE "public"."centro_copiado_tamanios_papel" TO "anon";
GRANT ALL ON TABLE "public"."centro_copiado_tamanios_papel" TO "authenticated";
GRANT ALL ON TABLE "public"."centro_copiado_tamanios_papel" TO "service_role";



GRANT ALL ON TABLE "public"."cheques" TO "anon";
GRANT ALL ON TABLE "public"."cheques" TO "authenticated";
GRANT ALL ON TABLE "public"."cheques" TO "service_role";



GRANT ALL ON TABLE "public"."cheques_cartera" TO "anon";
GRANT ALL ON TABLE "public"."cheques_cartera" TO "authenticated";
GRANT ALL ON TABLE "public"."cheques_cartera" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."cliente_registro_intentos" TO "anon";
GRANT ALL ON TABLE "public"."cliente_registro_intentos" TO "authenticated";
GRANT ALL ON TABLE "public"."cliente_registro_intentos" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_business_hours" TO "anon";
GRANT ALL ON TABLE "public"."company_business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."company_business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."company_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."company_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."compras_proveedores" TO "anon";
GRANT ALL ON TABLE "public"."compras_proveedores" TO "authenticated";
GRANT ALL ON TABLE "public"."compras_proveedores" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_corrientes_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_corrientes_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_corrientes_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."custom_roles" TO "anon";
GRANT ALL ON TABLE "public"."custom_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_roles" TO "service_role";



GRANT ALL ON TABLE "public"."egresos" TO "anon";
GRANT ALL ON TABLE "public"."egresos" TO "authenticated";
GRANT ALL ON TABLE "public"."egresos" TO "service_role";



GRANT ALL ON TABLE "public"."estaciones_trabajo" TO "anon";
GRANT ALL ON TABLE "public"."estaciones_trabajo" TO "authenticated";
GRANT ALL ON TABLE "public"."estaciones_trabajo" TO "service_role";



GRANT ALL ON TABLE "public"."facturas_historial" TO "anon";
GRANT ALL ON TABLE "public"."facturas_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."facturas_historial" TO "service_role";



GRANT ALL ON TABLE "public"."facturas_urls_cortas" TO "anon";
GRANT ALL ON TABLE "public"."facturas_urls_cortas" TO "authenticated";
GRANT ALL ON TABLE "public"."facturas_urls_cortas" TO "service_role";



GRANT ALL ON TABLE "public"."ingresos" TO "anon";
GRANT ALL ON TABLE "public"."ingresos" TO "authenticated";
GRANT ALL ON TABLE "public"."ingresos" TO "service_role";



GRANT ALL ON TABLE "public"."liquidaciones" TO "anon";
GRANT ALL ON TABLE "public"."liquidaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."liquidaciones" TO "service_role";



GRANT ALL ON TABLE "public"."liquidaciones_items" TO "anon";
GRANT ALL ON TABLE "public"."liquidaciones_items" TO "authenticated";
GRANT ALL ON TABLE "public"."liquidaciones_items" TO "service_role";



GRANT ALL ON TABLE "public"."liquidaciones_pagos" TO "anon";
GRANT ALL ON TABLE "public"."liquidaciones_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."liquidaciones_pagos" TO "service_role";



GRANT ALL ON TABLE "public"."login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."materiales" TO "anon";
GRANT ALL ON TABLE "public"."materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."materiales" TO "service_role";



GRANT ALL ON TABLE "public"."medios_cobro" TO "anon";
GRANT ALL ON TABLE "public"."medios_cobro" TO "authenticated";
GRANT ALL ON TABLE "public"."medios_cobro" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones_internas" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones_internas" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones_internas" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_items_rutas_pausas" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_items_rutas_pausas" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_items_rutas_pausas" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_compartidos" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_compartidos" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_compartidos" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_items" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_acabados_items" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_historial" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_historial" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_items" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_items" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_items_rutas" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_items_rutas" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_items_rutas" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_links" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_links" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_links" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_pagos" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_pagos" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_compartidos" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_compartidos" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_compartidos" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_items" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_trabajo_servicios_items" TO "service_role";



GRANT ALL ON TABLE "public"."pasos" TO "anon";
GRANT ALL ON TABLE "public"."pasos" TO "authenticated";
GRANT ALL ON TABLE "public"."pasos" TO "service_role";



GRANT ALL ON TABLE "public"."pasos_motivos_pausa" TO "anon";
GRANT ALL ON TABLE "public"."pasos_motivos_pausa" TO "authenticated";
GRANT ALL ON TABLE "public"."pasos_motivos_pausa" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_opciones" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_opciones" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_opciones" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_rutas_resueltas" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_rutas_resueltas" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_rutas_resueltas" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_acabados_compartidos" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_acabados_compartidos" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_acabados_compartidos" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_archivos" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_archivos" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_condiciones_comerciales" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_condiciones_comerciales" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_condiciones_comerciales" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_historial" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_historial" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_items" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_items" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_items" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_servicios_compartidos" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_servicios_compartidos" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_servicios_compartidos" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."productos_acabados_v2" TO "anon";
GRANT ALL ON TABLE "public"."productos_acabados_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_acabados_v2" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato_materiales" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato_materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato_materiales" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_gran_formato_tecnologias" TO "anon";
GRANT ALL ON TABLE "public"."productos_gran_formato_tecnologias" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_gran_formato_tecnologias" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser_materiales" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser_materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser_materiales" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_impresion_laser_tecnologias" TO "anon";
GRANT ALL ON TABLE "public"."productos_impresion_laser_tecnologias" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_impresion_laser_tecnologias" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_rigidos" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_rigidos_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_rigidos_materiales" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_materiales" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_rigidos_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_rigidos_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_rigidos_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_materiales_v2" TO "anon";
GRANT ALL ON TABLE "public"."productos_materiales_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_materiales_v2" TO "service_role";



GRANT ALL ON TABLE "public"."productos_plotter_corte" TO "anon";
GRANT ALL ON TABLE "public"."productos_plotter_corte" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_plotter_corte" TO "service_role";



GRANT ALL ON TABLE "public"."productos_plotter_corte_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_plotter_corte_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_plotter_corte_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_plotter_corte_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_plotter_corte_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_plotter_corte_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_plotter_corte_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_plotter_corte_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_plotter_corte_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_portabanners" TO "anon";
GRANT ALL ON TABLE "public"."productos_portabanners" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_portabanners" TO "service_role";



GRANT ALL ON TABLE "public"."productos_portabanners_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_portabanners_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_portabanners_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_portabanners_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_portabanners_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_portabanners_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_portabanners_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_portabanners_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_portabanners_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_portabanners_tecnologias" TO "anon";
GRANT ALL ON TABLE "public"."productos_portabanners_tecnologias" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_portabanners_tecnologias" TO "service_role";



GRANT ALL ON TABLE "public"."productos_pricing" TO "anon";
GRANT ALL ON TABLE "public"."productos_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."productos_rutas_produccion" TO "anon";
GRANT ALL ON TABLE "public"."productos_rutas_produccion" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_rutas_produccion" TO "service_role";



GRANT ALL ON TABLE "public"."productos_rutas_produccion_backup" TO "anon";
GRANT ALL ON TABLE "public"."productos_rutas_produccion_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_rutas_produccion_backup" TO "service_role";



GRANT ALL ON TABLE "public"."productos_sellos" TO "anon";
GRANT ALL ON TABLE "public"."productos_sellos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_sellos" TO "service_role";



GRANT ALL ON TABLE "public"."productos_sellos_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_sellos_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_sellos_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_servicios_v2" TO "anon";
GRANT ALL ON TABLE "public"."productos_servicios_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_servicios_v2" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios_acabados" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios_acabados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios_acabados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios_materiales" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios_materiales" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios_materiales" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios_precios" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios_precios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios_precios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios_servicios" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."productos_talonarios_tecnologias" TO "anon";
GRANT ALL ON TABLE "public"."productos_talonarios_tecnologias" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_talonarios_tecnologias" TO "service_role";



GRANT ALL ON TABLE "public"."productos_tecnologias_v2" TO "anon";
GRANT ALL ON TABLE "public"."productos_tecnologias_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_tecnologias_v2" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."provinces" TO "anon";
GRANT ALL ON TABLE "public"."provinces" TO "authenticated";
GRANT ALL ON TABLE "public"."provinces" TO "service_role";



GRANT ALL ON TABLE "public"."rangos_precio" TO "anon";
GRANT ALL ON TABLE "public"."rangos_precio" TO "authenticated";
GRANT ALL ON TABLE "public"."rangos_precio" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_executions" TO "anon";
GRANT ALL ON TABLE "public"."recurring_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_executions" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_expenses" TO "anon";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."rutas_produccion" TO "anon";
GRANT ALL ON TABLE "public"."rutas_produccion" TO "authenticated";
GRANT ALL ON TABLE "public"."rutas_produccion" TO "service_role";



GRANT ALL ON TABLE "public"."rutas_produccion_pasos" TO "anon";
GRANT ALL ON TABLE "public"."rutas_produccion_pasos" TO "authenticated";
GRANT ALL ON TABLE "public"."rutas_produccion_pasos" TO "service_role";



GRANT ALL ON TABLE "public"."servicios" TO "anon";
GRANT ALL ON TABLE "public"."servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."servicios" TO "service_role";



GRANT ALL ON TABLE "public"."servicios_categorias" TO "anon";
GRANT ALL ON TABLE "public"."servicios_categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."servicios_categorias" TO "service_role";



GRANT ALL ON TABLE "public"."servicios_niveles_precio" TO "anon";
GRANT ALL ON TABLE "public"."servicios_niveles_precio" TO "authenticated";
GRANT ALL ON TABLE "public"."servicios_niveles_precio" TO "service_role";



GRANT ALL ON TABLE "public"."servicios_pasos" TO "anon";
GRANT ALL ON TABLE "public"."servicios_pasos" TO "authenticated";
GRANT ALL ON TABLE "public"."servicios_pasos" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."tarjetas_consumos" TO "anon";
GRANT ALL ON TABLE "public"."tarjetas_consumos" TO "authenticated";
GRANT ALL ON TABLE "public"."tarjetas_consumos" TO "service_role";



GRANT ALL ON TABLE "public"."tarjetas_credito" TO "anon";
GRANT ALL ON TABLE "public"."tarjetas_credito" TO "authenticated";
GRANT ALL ON TABLE "public"."tarjetas_credito" TO "service_role";



GRANT ALL ON TABLE "public"."tarjetas_resumenes" TO "anon";
GRANT ALL ON TABLE "public"."tarjetas_resumenes" TO "authenticated";
GRANT ALL ON TABLE "public"."tarjetas_resumenes" TO "service_role";



GRANT ALL ON TABLE "public"."tecnologias" TO "anon";
GRANT ALL ON TABLE "public"."tecnologias" TO "authenticated";
GRANT ALL ON TABLE "public"."tecnologias" TO "service_role";



GRANT ALL ON TABLE "public"."tecnologias_tintas_pasos" TO "anon";
GRANT ALL ON TABLE "public"."tecnologias_tintas_pasos" TO "authenticated";
GRANT ALL ON TABLE "public"."tecnologias_tintas_pasos" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_egreso" TO "anon";
GRANT ALL ON TABLE "public"."tipos_egreso" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_egreso" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_ingreso" TO "anon";
GRANT ALL ON TABLE "public"."tipos_ingreso" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_ingreso" TO "service_role";



GRANT ALL ON TABLE "public"."user_ip_restrictions" TO "anon";
GRANT ALL ON TABLE "public"."user_ip_restrictions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ip_restrictions" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."v_actividad_usuarios" TO "anon";
GRANT ALL ON TABLE "public"."v_actividad_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_actividad_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_notificaciones" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






\unrestrict quRwoglp0uNXsVrD8IDI30skyWOQ5BIFXtVG1D2Ru0sZ038s0ZAy5W8bXX8VgME

RESET ALL;
