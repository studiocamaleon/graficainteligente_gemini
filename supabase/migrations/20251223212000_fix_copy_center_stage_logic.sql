/*
  # Fix Copy Center Route Logic and Stage Assignment
  
  This migration updates `fn_generar_ruta_produccion_item` to:
  1. Remove the automatic fallback to 'Ruta Centro de Copiado'.
  2. Allow execution to proceed to dynamic injection even if no standard route is found (for Copy Center).
  3. Correctly fetch and use the assigned `etapa` from the `pasos` table for dynamic steps, instead of hardcoding 'Produccion'.
*/

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
  v_max_orden integer := 0;
  
  -- Dynamic Injection Vars
  v_keys text[] := ARRAY['anillado', 'plastificado', 'guillotinado', 'tipo_tinta'];
  v_key text;
  v_subtipo text;
  v_new_paso_id uuid;
  v_new_paso_nombre text;
  v_new_paso_etapa text;
  v_fallback_pattern text;
  v_config_value jsonb;
BEGIN
  -- Extraer datos de configuración
  v_servicios := COALESCE(p_configuracion->'servicios_seleccionados', '[]'::jsonb);
  v_acabados := COALESCE(p_configuracion->'acabados_seleccionados', '[]'::jsonb);
  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_item_tecnologia_id := p_configuracion->>'tecnologia_id';
  v_tinta_nombre := p_configuracion->>'tinta_nombre';
  v_tinta_codigo := COALESCE(p_configuracion->>'tipo_tinta', p_configuracion->>'tinta');

  ---------------------------------------------------------------------------
  -- 1. IDENTIFICACIÓN DE LA RUTA
  ---------------------------------------------------------------------------
  
  -- MODIFIED: Removed automatic fallback to 'Ruta Centro de Copiado'. 
  -- We now rely on dynamic rules.
  
  -- B. Standard Product Lookup
  IF v_ruta_id IS NULL AND p_producto_id IS NOT NULL THEN
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_impresion_laser WHERE id = p_producto_id; END IF;
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_gran_formato WHERE id = p_producto_id; END IF;
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_materiales_rigidos WHERE id = p_producto_id; END IF;
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_plotter_corte WHERE id = p_producto_id; END IF;
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_portabanners WHERE id = p_producto_id; END IF;
      IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_sellos WHERE id = p_producto_id; END IF;
  END IF;

  -- MODIFIED: Allow continuation if it's Centro de Copiado, even without a specific route
  IF v_ruta_id IS NULL AND NOT (p_categoria ILIKE 'Centro de Copiado' OR p_categoria = 'centro_copiado') THEN
    RETURN 0;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. GENERACIÓN DE PASOS ESTÁNDAR (Si existe ruta base)
  ---------------------------------------------------------------------------
  IF v_ruta_id IS NOT NULL THEN
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
        v_paso_especifico_id := v_paso_record.paso_id;

        -- Track max order
        IF v_paso_record.orden > v_max_orden THEN
            v_max_orden := v_paso_record.orden;
        END IF;

        CASE v_paso_record.tipo_condicion
          WHEN 'sin_condicion' THEN
            v_incluir_paso := true;
          WHEN 'servicio_sin_nivel' THEN
            v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_servicios) as s WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id');
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
                   SELECT paso_id INTO v_paso_especifico_id FROM servicios_niveles_precio
                   WHERE servicio_id = (v_servicio_match->>'servicio_id')::uuid AND nombre = v_nivel_aplicado LIMIT 1;
                 EXCEPTION WHEN OTHERS THEN v_paso_especifico_id := v_paso_record.paso_id; END;
              END IF;
              IF v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
                SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
              END IF;
            END IF;

          WHEN 'acabado_sin_nivel' THEN
            v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_acabados) as a WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id');
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
                   SELECT paso_id INTO v_paso_especifico_id FROM acabados_niveles_precio
                   WHERE acabado_id = (v_acabado_match->>'acabado_id')::uuid AND nombre = v_nivel_aplicado LIMIT 1;
                 EXCEPTION WHEN OTHERS THEN v_paso_especifico_id := v_paso_record.paso_id; END;
              END IF;
              IF v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
                SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
              END IF;
            END IF;
          
          WHEN 'tecnologia_tinta' THEN
            IF v_item_tecnologia_id IS NOT NULL AND v_tinta_codigo IS NOT NULL THEN
                 v_incluir_paso := true;
                 BEGIN
                   SELECT paso_id INTO v_paso_especifico_id FROM tecnologias_tintas_pasos
                   WHERE tecnologia_id = v_item_tecnologia_id::uuid AND tinta = v_tinta_codigo LIMIT 1;
                   IF v_paso_especifico_id IS DISTINCT FROM v_paso_record.paso_id THEN
                     SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
                   END IF;
                 EXCEPTION WHEN OTHERS THEN v_paso_especifico_id := v_paso_record.paso_id; END;
            ELSE
                 v_incluir_paso := false;
            END IF;

          ELSE
            v_incluir_paso := v_paso_record.es_obligatorio;
        END CASE;

        IF v_paso_record.es_obligatorio THEN v_incluir_paso := true; END IF;

        IF v_incluir_paso THEN
          INSERT INTO ordenes_trabajo_items_rutas (
            company_id, orden_item_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado, origen_plantilla_id
          ) VALUES (
            p_company_id, p_orden_item_id, v_paso_record.etapa, v_paso_especifico_id, v_paso_nombre, v_paso_record.orden, false, v_paso_record.id
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
  END IF; -- End of Standard Route Generation

  ---------------------------------------------------------------------------
  -- 3. INYECCIÓN DINÁMICA DE PASOS (Centro de Copiado)
  ---------------------------------------------------------------------------
  -- Claves soportadas: anillado, plastificado, guillotinado, tipo_tinta
  
  IF (p_categoria ILIKE 'Centro de Copiado' OR p_categoria = 'centro_copiado') THEN -- Only run for Copy Center
    FOREACH v_key IN ARRAY v_keys LOOP
      
      IF p_configuracion ? v_key THEN
         v_max_orden := v_max_orden + 1;
         v_subtipo := NULL;
         v_new_paso_id := NULL;
         v_config_value := p_configuracion->v_key;
         
         -- Extract value based on type
         IF jsonb_typeof(v_config_value) = 'string' THEN
             v_subtipo := v_config_value#>>'{}';
         ELSIF jsonb_typeof(v_config_value) = 'object' THEN
             v_subtipo := v_config_value->>'tipo';
         END IF;

         -- 1. BUSCAR EN TABLA CONFIGURACIÓN
         -- Prioridad: 1. Coincidencia exacta (Clave + Valor), 2. Wildcard (Clave + NULL)
         SELECT paso_id INTO v_new_paso_id
         FROM centro_copiado_rutas_configuracion
         WHERE company_id = p_company_id
           AND clave = v_key
           AND (valor = v_subtipo OR valor IS NULL)
         ORDER BY valor NULLS LAST -- 'valor' no nulo (especifico) primero
         LIMIT 1;

         -- 2. SI ENCONTRAMOS CONFIGURACIÓN
         IF v_new_paso_id IS NOT NULL THEN
             -- MODIFIED: Fetch 'etapa' along with 'nombre'
             SELECT nombre, etapa INTO v_new_paso_nombre, v_new_paso_etapa FROM pasos WHERE id = v_new_paso_id;
             
             -- Fallback for empty stage in DB just in case
             IF v_new_paso_etapa IS NULL THEN v_new_paso_etapa := 'Produccion'; END IF;

             INSERT INTO ordenes_trabajo_items_rutas (company_id, orden_item_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado)
             VALUES (p_company_id, p_orden_item_id, v_new_paso_etapa, v_new_paso_id, v_new_paso_nombre, v_max_orden, false);
             v_count := v_count + 1;

         -- 3. FALLBACK (Legacy Logic)
         ELSE
             v_fallback_pattern := NULL;
             CASE v_key
               WHEN 'anillado' THEN v_fallback_pattern := '%Anillado%';
               WHEN 'plastificado' THEN v_fallback_pattern := '%Plastificado%';
               WHEN 'guillotinado' THEN v_fallback_pattern := '%Guillotinado%';
             END CASE;

             IF v_fallback_pattern IS NOT NULL THEN
                 SELECT id, nombre, etapa INTO v_new_paso_id, v_new_paso_nombre, v_new_paso_etapa
                 FROM pasos 
                 WHERE company_id = p_company_id AND nombre ILIKE v_fallback_pattern 
                 LIMIT 1;
                 
                  -- Fallback for empty stage in DB just in case
                 IF v_new_paso_etapa IS NULL THEN v_new_paso_etapa := 'Produccion'; END IF;

                 IF v_new_paso_id IS NOT NULL THEN
                     INSERT INTO ordenes_trabajo_items_rutas (company_id, orden_item_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado)
                     VALUES (p_company_id, p_orden_item_id, v_new_paso_etapa, v_new_paso_id, v_new_paso_nombre, v_max_orden, false);
                     v_count := v_count + 1;
                 END IF;
             END IF;
         END IF;

      END IF;
    END LOOP;
  END IF; -- End of Copy Center Dynamic Logic

  RETURN v_count;
END;
$$;
