/*
  # Fix: Mejorar evaluación de condiciones en generación de rutas
  
  ## Problema
  Los pasos condicionales con paso_id = NULL no se están insertando porque:
  1. Algunos pasos en rutas_produccion_pasos tienen paso_id = NULL
  2. La función salta estos pasos incluso si la condición se cumple
  3. El mapeo_niveles puede estar vacío, haciendo que nunca se incluya el paso
  
  ## Solución
  1. Solo intentar insertar pasos que tengan paso_id válido
  2. Cuando tipo_condicion = 'servicio_con_nivel':
     - Si mapeo_niveles está vacío, incluir el paso si el servicio coincide (cualquier nivel)
     - Si mapeo_niveles tiene valores, verificar que el nivel esté en el mapeo
  3. Agregar logs detallados para debugging
  
  ## Mejoras
  - Mejor manejo de servicios con nivel cuando mapeo_niveles está vacío
  - Logs más detallados para identificar por qué se incluye/excluye un paso
  - Validación de paso_id antes de insertar
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

  v_tecnologia_nombre := p_configuracion->>'tecnologia_nombre';
  v_tinta_nombre := p_configuracion->>'tinta_nombre';

  RAISE NOTICE '[Generar Ruta] Item: %, Categoria: %', p_orden_item_id, p_categoria;
  RAISE NOTICE '[Generar Ruta] Servicios: %', v_servicios;
  RAISE NOTICE '[Generar Ruta] Acabados: %', v_acabados;

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

    WHEN 'Talonarios' THEN
      SELECT ruta_produccion_id INTO v_ruta_id 
      FROM productos_talonarios 
      WHERE id = p_producto_id;

    ELSE
      RAISE NOTICE '[Generar Ruta] ⚠️ Categoría no reconocida: %', p_categoria;
      RETURN 0;
  END CASE;

  -- Si no hay ruta asignada, retornar 0
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
    v_paso_nombre := COALESCE(v_paso_record.paso_nombre, 'Paso sin nombre');

    RAISE NOTICE '[Generar Ruta] Evaluando paso: %, Tipo: %, Obligatorio: %', 
      v_paso_nombre, v_paso_record.tipo_condicion, v_paso_record.es_obligatorio;

    -- ❌ SALTAR si paso_id es NULL (paso no configurado correctamente)
    IF v_paso_record.paso_id IS NULL THEN
      RAISE NOTICE '[Generar Ruta] ⚠️ SALTANDO - paso_id es NULL';
      CONTINUE;
    END IF;

    -- Evaluar si incluir el paso según tipo_condicion
    CASE v_paso_record.tipo_condicion

      -- Sin condición: siempre incluir
      WHEN 'sin_condicion' THEN
        v_incluir_paso := true;
        RAISE NOTICE '[Generar Ruta] ✅ Incluir (sin condición)';

      -- Servicio sin nivel: incluir si el item tiene ese servicio
      WHEN 'servicio_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_servicios) as s
          WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
        );
        RAISE NOTICE '[Generar Ruta] Servicio sin nivel: %', v_incluir_paso;

      -- Servicio con nivel: MEJORADO
      WHEN 'servicio_con_nivel' THEN
        -- Si mapeo_niveles está vacío o es {}, incluir si el servicio coincide (cualquier nivel)
        IF v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb 
           OR v_paso_record.configuracion_condicion->'mapeo_niveles' IS NULL THEN
          v_incluir_paso := EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(v_servicios) as s
            WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
          );
          RAISE NOTICE '[Generar Ruta] Servicio con nivel (mapeo vacío, cualquier nivel): %', v_incluir_paso;
        ELSE
          -- Si hay mapeo, verificar que el nivel esté en el mapeo
          v_incluir_paso := EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(v_servicios) as s
            WHERE s->>'servicio_id' = v_paso_record.configuracion_condicion->>'servicio_id'
              AND (
                s->>'nivel' = ANY(
                  SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
                )
                OR s->>'nivel_nombre' = ANY(
                  SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
                )
              )
          );
          RAISE NOTICE '[Generar Ruta] Servicio con nivel (con mapeo): %', v_incluir_paso;
        END IF;

      -- Acabado sin nivel: incluir si el item tiene ese acabado
      WHEN 'acabado_sin_nivel' THEN
        v_incluir_paso := EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(v_acabados) as a
          WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
        );
        RAISE NOTICE '[Generar Ruta] Acabado sin nivel: %', v_incluir_paso;

      -- Acabado con nivel: similar mejora
      WHEN 'acabado_con_nivel' THEN
        IF v_paso_record.configuracion_condicion->'mapeo_niveles' = '{}'::jsonb 
           OR v_paso_record.configuracion_condicion->'mapeo_niveles' IS NULL THEN
          v_incluir_paso := EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(v_acabados) as a
            WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
          );
          RAISE NOTICE '[Generar Ruta] Acabado con nivel (mapeo vacío): %', v_incluir_paso;
        ELSE
          v_incluir_paso := EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(v_acabados) as a
            WHERE a->>'acabado_id' = v_paso_record.configuracion_condicion->>'acabado_id'
              AND (
                a->>'nivel' = ANY(
                  SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
                )
                OR a->>'nivel_nombre' = ANY(
                  SELECT jsonb_object_keys(v_paso_record.configuracion_condicion->'mapeo_niveles')
                )
              )
          );
          RAISE NOTICE '[Generar Ruta] Acabado con nivel (con mapeo): %', v_incluir_paso;
        END IF;

      -- Tecnología + Tinta
      WHEN 'tecnologia_tinta' THEN
        v_incluir_paso := (
          v_paso_record.configuracion_condicion->>'tecnologia_id' IS NOT NULL
        );
        RAISE NOTICE '[Generar Ruta] Tecnología/Tinta: %', v_incluir_paso;

      ELSE
        -- Tipo de condición desconocida, incluir si es obligatorio
        v_incluir_paso := v_paso_record.es_obligatorio;
        RAISE NOTICE '[Generar Ruta] ⚠️ Tipo condición desconocida';
    END CASE;

    -- Si es obligatorio, siempre incluir
    IF v_paso_record.es_obligatorio THEN
      v_incluir_paso := true;
      RAISE NOTICE '[Generar Ruta] ✅ Forzado por obligatorio';
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
      RAISE NOTICE '[Generar Ruta] ✅ Paso insertado: %', v_paso_nombre;
    ELSE
      RAISE NOTICE '[Generar Ruta] ⏭️ Paso NO insertado: %', v_paso_nombre;
    END IF;
  END LOOP;

  RAISE NOTICE '[Generar Ruta] ✅ Total pasos generados: %', v_count;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_generar_ruta_produccion_item IS
'Genera rutas de producción evaluando condiciones. 
Versión mejorada: cuando mapeo_niveles está vacío, incluye el paso si el servicio/acabado coincide (cualquier nivel).
Saltar pasos con paso_id NULL (no configurados).';
