-- Migration: Add Dynamic Step Lookup to Route Generation
-- Date: 2025-12-15
-- Description: Updates fn_generar_ruta_produccion_item to dynamically lookup the specific paso_id
-- for 'tecnologia_tinta' conditions using the tecnologias_tintas_pasos table.
-- This fixes the "Paso sin nombre" issue where the generic route step has no associated paso_id.

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
    v_paso_especifico_id := v_paso_record.paso_id; -- Por defecto mantenemos el ID original

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
      
      -- Tecnología + Tinta (Lógica Dinámica)
      WHEN 'tecnologia_tinta' THEN
        IF v_item_tecnologia_id IS NOT NULL AND v_tinta_codigo IS NOT NULL THEN
             v_incluir_paso := true;
             
             -- Búsqueda dinámica del paso específico
             -- Intentamos buscar en tecnologias_tintas_pasos usando la columna 'tinta' (text)
             -- Si no se encuentra, mantenemos el v_paso_record.paso_id original (que puede ser NULL)
             
             BEGIN
               SELECT paso_id INTO v_paso_especifico_id
               FROM tecnologias_tintas_pasos
               WHERE tecnologia_id = v_item_tecnologia_id::uuid
                 AND tinta = v_tinta_codigo
               LIMIT 1;
               
               -- Si encontramos un ID específico, actualizamos el nombre
               IF v_paso_especifico_id IS NOT NULL THEN
                 SELECT nombre INTO v_paso_nombre FROM pasos WHERE id = v_paso_especifico_id;
               END IF;
             EXCEPTION WHEN OTHERS THEN
               -- Si falla (por ejemplo, si la columna 'tinta' no existe), ignoramos y seguimos
               -- NULL es un valor válido para v_paso_especifico_id en este contexto
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
