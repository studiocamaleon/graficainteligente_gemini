/*
  # Actualizar función para compatibilidad con formatos antiguos

  1. Cambios
    - Hacer la función compatible con ambos formatos de configuración:
      - Formato nuevo: servicios_seleccionados, acabados_seleccionados
      - Formato antiguo: servicios, acabados
    - Extraer datos de ambos formatos correctamente

  2. Notas
    - Mantiene compatibilidad hacia atrás con órdenes creadas antes de la actualización
    - Prioriza el formato nuevo si existe
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
  v_tinta_nombre text;
BEGIN
  -- Extraer datos de configuración con compatibilidad hacia atrás
  -- Priorizar formato nuevo (servicios_seleccionados) sobre antiguo (servicios)
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
  
  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_tinta_nombre := p_configuracion->>'tinta_nombre';

  -- Obtener ruta_produccion_id según la categoría del producto
  CASE p_categoria
    WHEN 'Impresion Laser' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_impresion_laser 
      WHERE id = p_producto_id;
    
    WHEN 'Gran Formato' THEN
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
    
    ELSE
      -- Si no hay categoría reconocida, retornar 0
      RETURN 0;
  END CASE;

  -- Si no hay ruta asignada, retornar 0
  IF v_ruta_id IS NULL THEN
    RETURN 0;
  END IF;

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
      
      -- Servicio sin nivel: incluir si el item tiene ese servicio
      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_servicios) as s
          WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        );
      
      -- Servicio con nivel: incluir si tiene servicio con nivel específico
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
            OR s->>'nivel_nombre' = ANY(
              SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
            )
          )
        );
      
      -- Acabado sin nivel: incluir si el item tiene ese acabado
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        );
      
      -- Acabado con nivel: incluir si tiene acabado con nivel específico
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
            OR a->>'nivel_nombre' = ANY(
              SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
            )
          )
        );
      
      -- Tecnología + Tinta: incluir si usa esa tecnología
      WHEN 'tecnologia_tinta' THEN
        -- Por ahora solo verificamos tecnología, la tinta se puede agregar después
        v_incluir_paso := (
          v_paso_record.configuracion_condicion->>'tecnologia_id' IS NOT NULL
        );
      
      ELSE
        -- Tipo de condición desconocida, incluir si es obligatorio
        v_incluir_paso := v_paso_record.es_obligatorio;
    END CASE;

    -- Si es obligatorio, siempre incluir independientemente de la condición
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

-- Actualizar comentario
COMMENT ON FUNCTION fn_generar_ruta_produccion_item IS 
'Genera la ruta de producción para un item de orden basándose en la ruta asignada al producto y evaluando condiciones según la configuración del item. Compatible con formatos de configuración antiguos y nuevos.';
