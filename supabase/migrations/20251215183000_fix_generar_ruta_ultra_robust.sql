-- Migration: Ultra Robust Route Lookup in fn_generar_ruta_produccion_item
-- Date: 2025-12-15
-- Description: Updates fn_generar_ruta_produccion_item to look for ruta_produccion_id by checking all sub-tables sequentially.
-- This bypasses potential null/incorrect category names from the frontend or database.

CREATE OR REPLACE FUNCTION fn_generar_ruta_produccion_item(
  p_orden_item_id uuid,
  p_producto_id uuid,
  p_categoria text,
  p_configuracion jsonb,
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ruta_id uuid;
  v_paso_record record;
  v_count integer := 0;
  v_paso_nombre text;
  v_incluir_paso boolean;
  v_servicios jsonb;
  v_acabados jsonb;
  v_tecnologia_nombre text;
  v_item_tecnologia_id text;
  v_tinta_nombre text;
BEGIN
  -- Extraer datos de configuración
  v_servicios := COALESCE(p_configuracion->'servicios_seleccionados', '[]'::jsonb);
  v_acabados := COALESCE(p_configuracion->'acabados_seleccionados', '[]'::jsonb);
  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_item_tecnologia_id := p_configuracion->>'tecnologia_id'; -- Try to get ID if available
  v_tinta_nombre := p_configuracion->>'tinta_nombre';

  ---------------------------------------------------------------------------
  -- 1. BÚSQUEDA FUERTA BRUTA DE LA RUTA (Ignorando categoría por seguridad)
  ---------------------------------------------------------------------------
  
  -- Check Impresion Laser
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_impresion_laser WHERE id = p_producto_id;
  END IF;

  -- Check Gran Formato
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_gran_formato WHERE id = p_producto_id;
  END IF;
  
  -- Check Materiales Rigidos
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_materiales_rigidos WHERE id = p_producto_id;
  END IF;

  -- Check Plotter de Corte
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_plotter_corte WHERE id = p_producto_id;
  END IF;

  -- Check Portabanners
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_portabanners WHERE id = p_producto_id;
  END IF;

  -- Check Sellos
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_sellos WHERE id = p_producto_id;
  END IF;


  -- Si no hay ruta asignada, retornar 0
  IF v_ruta_id IS NULL THEN
    RETURN 0;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. GENERACIÓN DE PASOS
  ---------------------------------------------------------------------------
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
    v_paso_nombre := COALESCE(v_paso_record.paso_nombre, 'Paso sin nombre');

    -- Evaluar si incluir el paso según tipo_condicion
    CASE v_paso_record.tipo_condicion
      
      -- Sin condición: siempre incluir
      WHEN 'sin_condicion' THEN
        v_incluir_paso := true;
      
      -- Servicio sin nivel
      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_servicios) as s
          WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        );
      
      -- Servicio con nivel
      WHEN 'servicio_con_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_servicios) as s
          WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
          AND (
            v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb
            OR s->>'nivel' = ANY(
              SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
            )
          )
        );
      
      -- Acabado sin nivel
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        );
      
      -- Acabado con nivel
      WHEN 'acabado_con_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
          AND (
            v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb
            OR a->>'nivel' = ANY(
              SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
            )
          )
        );
      
      -- Tecnología + Tinta
      WHEN 'tecnologia_tinta' THEN
        -- Check if item technology ID matches condition technology ID
        IF v_item_tecnologia_id IS NOT NULL AND v_paso_record.configuracion_condicion->>'tecnologia_id' IS NOT NULL THEN
           v_incluir_paso := (v_item_tecnologia_id = v_paso_record.configuracion_condicion->>'tecnologia_id');
        ELSE 
           -- If cannot assume specific ID match (fallback to logic that allows it if it exists in rule, OR strict?)
           -- Let's make it PERMISSIVE for now if ids are missing, or STRICT?
           -- Given the issue "0 steps", strict is risky. But incorrect steps is bad too.
           -- If config has NO technology info, we shouldn't add tech-specific steps.
           -- Let's stick to: "If it has technology_id in config, match it. If not, don't include."
           v_incluir_paso := false;
           
           -- Check by name as fallback?
           IF v_incluir_paso = false AND v_tecnologia_nombre IS NOT NULL THEN
              -- This is harder because condition stores ID.
              NULL; 
           END IF;
        END IF;

        -- HOTFIX for getting *something*: If the unconditional check fails, check if 'es_obligatorio' overrides it afterwards.
        -- (This is handled below by IF v_paso_record.es_obligatorio THEN ...)
      
      ELSE
        -- Tipo de condición desconocida, incluir si es obligatorio
        v_incluir_paso := v_paso_record.es_obligatorio;
    END CASE;

    -- Si es obligatorio, siempre incluir independientemente de la condición
    -- (Esta es la regla de oro: si es_obligatorio=true en tabla, SIEMPRE va, aunque la condición falle o sea nula)
    IF v_paso_record.es_obligatorio THEN
      v_incluir_paso := true;
    END IF;

    -- Insertar el paso si corresponde
    IF v_incluir_paso THEN
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
        v_paso_record.paso_id,
        v_paso_nombre,
        v_paso_record.orden,
        false,
        v_paso_record.id
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
