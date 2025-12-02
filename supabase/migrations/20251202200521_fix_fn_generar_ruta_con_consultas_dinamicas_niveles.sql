/*
  # Fix: Agregar consultas dinámicas a tablas de niveles
  
  ## Problema
  La función fn_generar_ruta_produccion_item no consulta las tablas:
  - servicios_niveles_precio
  - acabados_niveles_precio  
  - tecnologias_tintas_pasos
  
  Por eso, cuando mapeo_niveles está vacío o es {}, no puede determinar
  qué paso usar según el nivel seleccionado.
  
  ## Solución
  Replicar la lógica de generateProductionRoutes.ts del frontend:
  1. Si mapeo_niveles tiene valores, usarlos
  2. Si mapeo_niveles está vacío, consultar dinámicamente las tablas de niveles
  3. Esto permite que los pasos condicionales se generen correctamente
  
  ## Cambios
  - Para servicio_con_nivel: consultar servicios_niveles_precio
  - Para acabado_con_nivel: consultar acabados_niveles_precio
  - Para tecnologia_tinta: consultar tecnologias_tintas_pasos
  - Mantener compatibilidad con mapeos manuales existentes
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
    v_paso_id_especifico := v_paso_record.paso_id; -- Por defecto usar el configurado
    v_paso_nombre := COALESCE(v_paso_record.paso_nombre, 'Paso sin nombre');

    RAISE NOTICE '[Generar Ruta] Evaluando paso: %, Tipo: %', 
      v_paso_nombre, v_paso_record.tipo_condicion;

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

      -- Servicio con nivel: MEJORADO con consulta dinámica
      WHEN 'servicio_con_nivel' THEN
        -- Buscar servicio en configuración
        SELECT s->>'servicio_id', COALESCE(s->>'nivel', s->>'nivel_nombre')
        INTO v_servicio_id, v_nivel_nombre
        FROM jsonb_array_elements(v_servicios) as s
        WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        LIMIT 1;

        IF v_servicio_id IS NOT NULL THEN
          v_incluir_paso := true;

          -- 1. Intentar con mapeo manual primero
          IF v_paso_record.configuracion_condicion->'mapeo_niveles' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_niveles' != '{}'::jsonb 
             AND v_nivel_nombre IS NOT NULL THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_niveles'->>v_nivel_nombre)::uuid;
            RAISE NOTICE '[Generar Ruta] Usando mapeo manual: nivel=%, paso=%', v_nivel_nombre, v_paso_id_especifico;
          END IF;

          -- 2. Si no hay mapeo o no encontró en mapeo, consultar BD dinámicamente
          IF v_paso_id_especifico IS NULL AND v_nivel_nombre IS NOT NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM servicios_niveles_precio
            WHERE servicio_id = v_servicio_id
              AND nombre = v_nivel_nombre
            LIMIT 1;

            RAISE NOTICE '[Generar Ruta] Consulta dinámica servicios_niveles_precio: nivel=%, paso=%', 
              v_nivel_nombre, v_paso_id_especifico;
          END IF;
        END IF;

      -- Acabado sin nivel: incluir si el item tiene ese acabado
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        );

      -- Acabado con nivel: similar a servicio_con_nivel
      WHEN 'acabado_con_nivel' THEN
        SELECT a->>'acabado_id', COALESCE(a->>'nivel', a->>'nivel_nombre')
        INTO v_acabado_id, v_nivel_nombre
        FROM jsonb_array_elements(v_acabados) as a
        WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        LIMIT 1;

        IF v_acabado_id IS NOT NULL THEN
          v_incluir_paso := true;

          -- 1. Intentar con mapeo manual primero
          IF v_paso_record.configuracion_condicion->'mapeo_niveles' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_niveles' != '{}'::jsonb 
             AND v_nivel_nombre IS NOT NULL THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_niveles'->>v_nivel_nombre)::uuid;
            RAISE NOTICE '[Generar Ruta] Usando mapeo manual acabado: nivel=%, paso=%', v_nivel_nombre, v_paso_id_especifico;
          END IF;

          -- 2. Si no hay mapeo, consultar BD dinámicamente
          IF v_paso_id_especifico IS NULL AND v_nivel_nombre IS NOT NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM acabados_niveles_precio
            WHERE acabado_id = v_acabado_id
              AND nombre = v_nivel_nombre
            LIMIT 1;

            RAISE NOTICE '[Generar Ruta] Consulta dinámica acabados_niveles_precio: nivel=%, paso=%', 
              v_nivel_nombre, v_paso_id_especifico;
          END IF;
        END IF;

      -- Tecnología + Tinta: consultar dinámicamente
      WHEN 'tecnologia_tinta' THEN
        IF v_tecnologia_id IS NOT NULL AND v_tinta_codigo IS NOT NULL THEN
          v_incluir_paso := true;

          -- 1. Intentar con mapeo manual primero
          IF v_paso_record.configuracion_condicion->'mapeo_tintas' IS NOT NULL 
             AND v_paso_record.configuracion_condicion->'mapeo_tintas' != '{}'::jsonb THEN
            
            v_paso_id_especifico := (v_paso_record.configuracion_condicion->'mapeo_tintas'->>v_tinta_codigo)::uuid;
            RAISE NOTICE '[Generar Ruta] Usando mapeo manual tinta: tinta=%, paso=%', v_tinta_codigo, v_paso_id_especifico;
          END IF;

          -- 2. Si no hay mapeo, consultar BD dinámicamente
          IF v_paso_id_especifico IS NULL THEN
            SELECT paso_id INTO v_paso_id_especifico
            FROM tecnologias_tintas_pasos
            WHERE tecnologia_id = v_tecnologia_id
              AND tinta = v_tinta_codigo
            LIMIT 1;

            RAISE NOTICE '[Generar Ruta] Consulta dinámica tecnologias_tintas_pasos: tinta=%, paso=%', 
              v_tinta_codigo, v_paso_id_especifico;
          END IF;
        END IF;

      ELSE
        v_incluir_paso := v_paso_record.es_obligatorio;
    END CASE;

    -- Si es obligatorio, siempre incluir
    IF v_paso_record.es_obligatorio THEN
      v_incluir_paso := true;
      RAISE NOTICE '[Generar Ruta] ✅ Forzado por obligatorio';
    END IF;

    -- Solo insertar si:
    -- 1. El paso debe incluirse
    -- 2. Tiene un paso_id válido
    IF v_incluir_paso AND v_paso_id_especifico IS NOT NULL THEN
      -- Obtener nombre real del paso si es diferente
      IF v_paso_id_especifico != v_paso_record.paso_id THEN
        SELECT nombre INTO v_paso_nombre
        FROM pasos
        WHERE id = v_paso_id_especifico;
        
        v_paso_nombre := COALESCE(v_paso_nombre, 'Paso sin nombre');
      END IF;

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
      IF v_incluir_paso AND v_paso_id_especifico IS NULL THEN
        RAISE NOTICE '[Generar Ruta] ⏭️ Paso NO insertado (paso_id NULL): %', v_paso_nombre;
      ELSE
        RAISE NOTICE '[Generar Ruta] ⏭️ Paso NO insertado (condición no cumplida): %', v_paso_nombre;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '[Generar Ruta] ✅ Total pasos generados: %', v_count;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_generar_ruta_produccion_item IS
'Genera rutas de producción con consultas dinámicas a tablas de niveles.
Replica la lógica de generateProductionRoutes.ts del frontend.
Soporta mapeos manuales y consultas dinámicas a:
- servicios_niveles_precio
- acabados_niveles_precio
- tecnologias_tintas_pasos';
