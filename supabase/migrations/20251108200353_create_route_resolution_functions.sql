/*
  # Funciones para Resolución de Rutas de Producción

  ## Descripción
  Este migration crea todas las funciones necesarias para resolver rutas de
  producción dinámicamente basándose en las opciones seleccionadas por el cliente.

  ## Funciones Creadas

  ### 1. fn_evaluar_condicion_simple
  Evalúa si una condición específica se cumple basándose en las opciones del cliente.
  Input: condicion_config (jsonb), opciones_cliente (jsonb)
  Output: boolean

  ### 2. fn_obtener_paso_de_nivel
  Obtiene el paso asociado a un nivel específico de servicio o acabado.
  Input: tipo ('servicio' | 'acabado'), item_id (uuid), nivel_id (uuid)
  Output: uuid (paso_id)

  ### 3. fn_expandir_grupo_pasos
  Expande un grupo de pasos en sus pasos individuales ordenados.
  Input: grupo_paso_id (uuid)
  Output: TABLE (paso_id uuid, paso_nombre text, orden integer)

  ### 4. fn_resolver_ruta_produccion
  Función principal que resuelve la ruta completa de un producto basándose en opciones.
  Input: producto_id (uuid), opciones_cliente (jsonb)
  Output: TABLE (tipo_etapa, paso_id, grupo_paso_id, paso_nombre, orden, origen_condicion)

  ### 5. fn_validar_plantilla_ruta
  Valida que la configuración de ruta de un producto sea coherente.
  Input: producto_id (uuid)
  Output: TABLE (tipo text, mensaje text)

  ### 6. fn_crear_ruta_resuelta_pedido
  Crea el snapshot de la ruta resuelta para un pedido.
  Input: pedido_id (uuid)
  Output: integer (cantidad de pasos creados)

  ### 7. fn_duplicar_plantilla_ruta
  Copia la configuración de ruta de un producto a otro.
  Input: producto_origen_id (uuid), producto_destino_id (uuid)
  Output: integer (cantidad de plantillas copiadas)
*/

-- =====================================================
-- 1. FUNCIÓN: EVALUAR CONDICIÓN SIMPLE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_evaluar_condicion_simple(
  p_condicion_config jsonb,
  p_opciones_cliente jsonb
)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 2. FUNCIÓN: OBTENER PASO DE NIVEL
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_paso_de_nivel(
  p_tipo text,
  p_item_id uuid,
  p_nivel_id uuid
)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 3. FUNCIÓN: EXPANDIR GRUPO PASOS
-- =====================================================

CREATE OR REPLACE FUNCTION fn_expandir_grupo_pasos(p_grupo_paso_id uuid)
RETURNS TABLE (
  paso_id uuid,
  paso_nombre text,
  orden integer
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 4. FUNCIÓN: RESOLVER RUTA PRODUCCIÓN (PRINCIPAL)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_resolver_ruta_produccion(
  p_producto_id uuid,
  p_opciones_cliente jsonb
)
RETURNS TABLE (
  tipo_etapa text,
  paso_id uuid,
  grupo_paso_id uuid,
  paso_nombre text,
  orden integer,
  origen_condicion jsonb
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. FUNCIÓN: VALIDAR PLANTILLA RUTA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_validar_plantilla_ruta(p_producto_id uuid)
RETURNS TABLE (
  tipo text,
  mensaje text
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 6. FUNCIÓN: CREAR RUTA RESUELTA PEDIDO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_crear_ruta_resuelta_pedido(p_pedido_id uuid)
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FUNCIÓN: DUPLICAR PLANTILLA RUTA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_duplicar_plantilla_ruta(
  p_producto_origen_id uuid,
  p_producto_destino_id uuid
)
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql;
