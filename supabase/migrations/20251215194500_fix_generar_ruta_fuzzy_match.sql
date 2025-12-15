-- Migration: Fuzzy Match Fallback for Route Generation
-- Date: 2025-12-15
-- Description: Updates fn_generar_ruta_produccion_item to include a fuzzy name matching fallback.
-- This handles cases where the route step condition has an empty/missing technology_id.

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
  v_cond_tech_id text;
BEGIN
  -- Extraer datos de configuración
  v_servicios := COALESCE(p_configuracion->'servicios_seleccionados', '[]'::jsonb);
  v_acabados := COALESCE(p_configuracion->'acabados_seleccionados', '[]'::jsonb);
  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_item_tecnologia_id := p_configuracion->>'tecnologia_id';
  v_tinta_nombre := p_configuracion->>'tinta_nombre';

  ---------------------------------------------------------------------------
  -- 1. BÚSQUEDA FUERTA BRUTA DE LA RUTA
  ---------------------------------------------------------------------------
  
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_impresion_laser WHERE id = p_producto_id; END IF;
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_gran_formato WHERE id = p_producto_id; END IF;
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_materiales_rigidos WHERE id = p_producto_id; END IF;
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_plotter_corte WHERE id = p_producto_id; END IF;
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_portabanners WHERE id = p_producto_id; END IF;
  IF v_ruta_id IS NULL THEN SELECT ruta_produccion_id INTO v_ruta_id FROM productos_sellos WHERE id = p_producto_id; END IF;

  IF v_ruta_id IS NULL THEN
    RETURN 0;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. GENERACIÓN DE PASOS
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

    CASE v_paso_record.tipo_condicion
      
      -- Sin condición
      WHEN 'sin_condicion' THEN
        v_incluir_paso := true;
      
      -- Servicios y Acabados (Lógica estándar)
      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_servicios) as s WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id');
      WHEN 'servicio_con_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_servicios) as s WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id' AND (v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb OR s->>'nivel' = ANY(SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles'))));
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_acabados) as a WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id');
      WHEN 'acabado_con_nivel' THEN
        v_incluir_paso := EXISTS (SELECT 1 FROM jsonb_array_elements(v_acabados) as a WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id' AND (v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb OR a->>'nivel' = ANY(SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles'))));
      
      -- Tecnología + Tinta
      WHEN 'tecnologia_tinta' THEN
        v_cond_tech_id := v_paso_record.configuracion_condicion->>'tecnologia_id';
        
        -- 1. Strict Match: Si la condición tiene ID, debe coincidir
        IF v_cond_tech_id IS NOT NULL AND v_item_tecnologia_id IS NOT NULL THEN
           v_incluir_paso := (v_cond_tech_id = v_item_tecnologia_id);
        
        -- 2. Fuzzy/Empty Match: Si la condición NO tiene ID (está vacía/rota)
        ELSIF v_cond_tech_id IS NULL THEN
           -- Intentar coincidencia inteligente por nombre
           IF v_tecnologia_nombre IS NOT NULL AND v_paso_nombre IS NOT NULL THEN
              -- Normalizar strings (trim, lower, unaccent idealmente pero postgres basico basta con ilike)
              -- Chequear si el nombre de la tecnología está contenido en el nombre del paso O viceversa
              -- E.g. Tech="Impresion UV", Paso="Impresion UV" -> Match
              -- E.g. Tech="UV", Paso="Impresion UV" -> Match
              v_incluir_paso := (v_paso_nombre ILIKE '%' || v_tecnologia_nombre || '%') OR (v_tecnologia_nombre ILIKE '%' || v_paso_nombre || '%');
           ELSE
              -- Si no hay nombres para comparar, por seguridad NO incluir (evitar falsos positivos)
              v_incluir_paso := false;
           END IF;
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
        p_company_id, p_orden_item_id, v_paso_record.etapa, v_paso_record.paso_id, v_paso_nombre, v_paso_record.orden, false, v_paso_record.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
