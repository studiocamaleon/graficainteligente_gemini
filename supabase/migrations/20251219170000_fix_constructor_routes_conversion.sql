-- Migration: Fix Constructor Route Generation in Conversion
-- Date: 2025-12-19
-- Description: Updates fn_generar_ruta_produccion_item to look for ruta_produccion_id 
-- in the item configuration (Constructor) and productos_personalizados table.

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
  v_tinta_codigo text;
  v_paso_especifico_id uuid;
  v_servicio_match jsonb;
  v_acabado_match jsonb;
  v_nivel_aplicado text;
  v_mapeo_niveles jsonb;
BEGIN
  -- Extraer datos de configuración
  v_servicios := COALESCE(p_configuracion->'servicios_seleccionados', '[]'::jsonb);
  v_acabados := COALESCE(p_configuracion->'acabados_seleccionados', '[]'::jsonb);
  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_item_tecnologia_id := p_configuracion->>'tecnologia_id';
  v_tinta_nombre := p_configuracion->>'tinta_nombre';
  -- Intentar obtener el código de tinta (puede estar como tipo_tinta o tinta)
  v_tinta_codigo := COALESCE(p_configuracion->>'tipo_tinta', p_configuracion->>'tinta');

  ---------------------------------------------------------------------------
  -- 1. BÚSQUEDA DE LA RUTA (Prioridad: Config -> Personalizados -> Categorías)
  ---------------------------------------------------------------------------
  
  -- A. Buscar en configuración (Items del Constructor/Wizard)
  IF v_ruta_id IS NULL AND p_configuracion->>'ruta_produccion_id' IS NOT NULL THEN
    BEGIN
      v_ruta_id := (p_configuracion->>'ruta_produccion_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_ruta_id := NULL;
    END;
  END IF;

  -- B. Buscar en productos_personalizados (Si el ID apunta a un producto construido)
  IF v_ruta_id IS NULL AND p_producto_id IS NOT NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_personalizados WHERE id = p_producto_id;
  END IF;

  -- C. Búsqueda por tablas de categorías (Legacy / Catálogo Estándar)
  IF v_ruta_id IS NULL AND p_producto_id IS NOT NULL THEN
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_impresion_laser WHERE id = p_producto_id; END IF;
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_gran_formato WHERE id = p_producto_id; END IF;
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_materiales_rigidos WHERE id = p_producto_id; END IF;
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_plotter_corte WHERE id = p_producto_id; END IF;
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_portabanners WHERE id = p_producto_id; END IF;
    IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_sellos WHERE id = p_producto_id; END IF;
  END IF;

  -- Si no hay ruta, no podemos generar pasos
  IF v_ruta_id IS NULL THEN
    RETURN 0;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. GENERACIÓN DE PASOS (Rutas dinámicas)
  ---------------------------------------------------------------------------
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
    v_paso_especifico_id := v_paso_record.paso_id; -- Por defecto mantenemos el ID original

    CASE v_paso_record.tipo_condicion
      
      -- Sin condición
      WHEN 'sin_condicion' THEN
        v_incluir_paso := true;
      
      -- Servicio Sin Nivel
      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_servicios) as s WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id');
      
      -- Servicio Con Nivel (DINÁMICO)
      WHEN 'servicio_con_nivel' THEN
        SELECT s INTO v_servicio_match
        FROM jsonb_array_elements(v_servicios) as s 
        WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id' 
          AND (v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb OR s->>'nivel' = ANY(SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')));
        
        IF v_servicio_match IS NOT NULL THEN
          v_incluir_paso := true;
          v_nivel_aplicado := v_servicio_match->>'nivel';
          v_mapeo_niveles := v_paso_record.configuracion_condicion->'mapeo_niveles';

          IF v_nivel_aplicado IS NOT NULL AND v_mapeo_niveles ? v_nivel_aplicado THEN
             v_paso_especifico_id := (v_mapeo_niveles->>v_nivel_aplicado)::uuid;
          ELSE
             BEGIN
               SELECT paso_id INTO v_paso_especifico_id
               FROM servicios_niveles_precio
               WHERE servicio_id = (v_servicio_match->>'servicio_id')::uuid
                 AND nombre = v_nivel_aplicado
               LIMIT 1;
             EXCEPTION WHEN OTHERS THEN
               v_paso_especifico_id := v_paso_record.paso_id;
             END;
          END IF;
          
           IF v_paso_especifico_id IS NOT NULL AND v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
             SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
           END IF;
        END IF;

      -- Acabado Sin Nivel
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_acabados) as a WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id');
      
      -- Acabado Con Nivel (DINÁMICO)
      WHEN 'acabado_con_nivel' THEN
        SELECT a INTO v_acabado_match
        FROM jsonb_array_elements(v_acabados) as a
        WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id' 
          AND (v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb OR a->>'nivel' = ANY(SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')));
        
        IF v_acabado_match IS NOT NULL THEN
          v_incluir_paso := true;
          v_nivel_aplicado := v_acabado_match->>'nivel';
          v_mapeo_niveles := v_paso_record.configuracion_condicion->'mapeo_niveles';

          IF v_nivel_aplicado IS NOT NULL AND v_mapeo_niveles ? v_nivel_aplicado THEN
             v_paso_especifico_id := (v_mapeo_niveles->>v_nivel_aplicado)::uuid;
          ELSE
             BEGIN
               SELECT paso_id INTO v_paso_especifico_id
               FROM acabados_niveles_precio
               WHERE acabado_id = (v_acabado_match->>'acabado_id')::uuid
                 AND nombre = v_nivel_aplicado
               LIMIT 1;
             EXCEPTION WHEN OTHERS THEN
               v_paso_especifico_id := v_paso_record.paso_id;
             END;
          END IF;

           IF v_paso_especifico_id IS NOT NULL AND v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
             SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
           END IF;
        END IF;
      
      -- Tecnología + Tinta (Lógica Dinámica)
      WHEN 'tecnologia_tinta' THEN
        IF v_item_tecnologia_id IS NOT NULL AND v_tinta_codigo IS NOT NULL THEN
             v_incluir_paso := true;
             
             BEGIN
               SELECT paso_id INTO v_paso_especifico_id
               FROM tecnologias_tintas_pasos
               WHERE tecnologia_id = v_item_tecnologia_id::uuid
                 AND tinta = v_tinta_codigo
               LIMIT 1;
               
               IF v_paso_especifico_id IS NOT NULL AND v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
                 SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
               END IF;
             EXCEPTION WHEN OTHERS THEN
               v_paso_especifico_id := v_paso_record.paso_id;
             END;
        ELSE
             v_incluir_paso := false;
        END IF;

      ELSE
        v_incluir_paso := v_paso_record.es_obligatorio;
    END CASE;

    IF v_paso_record.es_obligatorio THEN
      v_incluir_paso := true;
    END IF;

    IF v_incluir_paso THEN
      INSERT INTO ordenes_trabajo_items_rutas (
        company_id, orden_item_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado, origen_plantilla_id
      ) VALUES (
        p_company_id, p_orden_item_id, v_paso_record.etapa, v_paso_especifico_id, v_paso_nombre, v_paso_record.orden, false, v_paso_record.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
