/*
  # Fix: Mover Servicios Globales de Presupuesto a Servicios Adicionales en Orden
  
  ## Problema
  Al convertir un presupuesto que tiene "Servicios Globales" (agregados vía "Aplicar Servicio Masivo"),
  estos se convierten incorrectamente en items de producción (ordenes_trabajo_items),
  generando errores al intentar crear rutas de producción para items que no deberían tenerlas.
  
  ## Solución
  Actualizar `fn_convertir_presupuesto_a_orden` para detectar estos items especiales
  (marcados con `es_servicio_global` o por patrón de nombre legacy) y moverlos a
  la tabla `ordenes_trabajo_servicios`, donde pertenecen.
  
*/

CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
    p_presupuesto_id uuid,
    p_fecha_entrega_estimada timestamp with time zone,
    p_notas_adicionales text DEFAULT NULL::text,
    p_monto_pago numeric DEFAULT NULL::numeric,
    p_medio_cobro_id uuid DEFAULT NULL::uuid,
    p_referencia_pago text DEFAULT NULL::text,
    p_rutas_personalizadas jsonb DEFAULT NULL::jsonb,
    p_requiere_factura boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_presupuesto record;
  v_item record;
  v_cliente_id uuid;
  v_orden_id uuid;
  v_orden_copiado_id uuid;
  v_nuevo_item_id uuid;
  v_tipo_item_orden text;
  v_rutas_item jsonb;
  v_ruta record;
  v_count_sistema integer;
  v_count_personalizado integer;
  v_count_copiado integer;
  v_numero_orden_copiado text;
  v_rutas_generadas integer;
  v_total_copiado numeric := 0;
  v_total_ot numeric := 0;
  v_es_servicio_global boolean;
BEGIN
  -- Verificar presupuesto
  SELECT * INTO v_presupuesto
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  IF v_presupuesto.estado != 'aprobado' THEN
    RAISE EXCEPTION 'El presupuesto debe estar aprobado para convertirse en orden';
  END IF;

  IF v_presupuesto.orden_trabajo_id IS NOT NULL OR v_presupuesto.orden_copiado_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este presupuesto ya fue convertido a una orden';
  END IF;

  v_cliente_id := v_presupuesto.cliente_id;

  -- Contar items (aproximado para decisión de escenario, el detalle se maneja en el loop)
  SELECT 
    COUNT(*) FILTER (WHERE tipo_item = 'producto_sistema'),
    COUNT(*) FILTER (WHERE tipo_item = 'item_personalizado'),
    COUNT(*) FILTER (WHERE tipo_item = 'centro_copiado')
  INTO v_count_sistema, v_count_personalizado, v_count_copiado
  FROM presupuestos_items
  WHERE presupuesto_id = p_presupuesto_id;

  -- =====================================================================================
  -- ESCENARIO 1: Solo items de Copiado -> Crear SOLO Orden de Copiado
  -- =====================================================================================
  IF v_count_sistema = 0 AND v_count_personalizado = 0 AND v_count_copiado > 0 THEN
    
    v_numero_orden_copiado := generate_numero_orden_copiado(v_presupuesto.company_id);

    INSERT INTO centro_copiado_ordenes (
      company_id,
      cliente_id,
      numero_orden,
      estado,
      fecha_entrega_estimada,
      origen,
      observaciones,
      total
    ) VALUES (
      v_presupuesto.company_id,
      v_cliente_id,
      v_numero_orden_copiado,
      'pendiente',
      p_fecha_entrega_estimada,
      v_presupuesto.canal_venta,
      COALESCE(p_notas_adicionales, '') || E'\nGenerado desde Presupuesto #' || v_presupuesto.numero_presupuesto,
      0 
    ) RETURNING id INTO v_orden_copiado_id;

    -- Insertar items de copiado
    FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id AND tipo_item = 'centro_copiado' LOOP
      v_total_copiado := v_total_copiado + v_item.precio_total;

      INSERT INTO centro_copiado_ordenes_items (
        orden_copiado_id,
        tipo_item, 
        tamanio_papel_id,
        papel_id,
        tipo_tinta,
        cara_impresa,
        cantidad_hojas,
        cantidad_unidades,
        precio_unitario,
        subtotal,
        descripcion
      ) VALUES (
        v_orden_copiado_id,
        'impresion',
        (v_item.configuracion->>'tamanio_papel_id')::uuid,
        (v_item.configuracion->>'papel_id')::uuid,
        (v_item.configuracion->>'tipo_tinta')::text,
        (v_item.configuracion->>'cara_impresa')::text,
        (v_item.configuracion->>'cantidad_hojas')::integer,
        v_item.cantidad,
        v_item.precio_unitario_final, 
        v_item.precio_total,          
        v_item.descripcion
      );
    END LOOP;

    -- Update Total
    UPDATE centro_copiado_ordenes 
    SET total = v_total_copiado 
    WHERE id = v_orden_copiado_id;

    -- Actualizar presupuesto
    UPDATE presupuestos 
    SET orden_copiado_id = v_orden_copiado_id,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    RETURN v_orden_copiado_id;

  -- =====================================================================================
  -- ESCENARIO 2: Mixto o Solo Sistema -> Crear OT
  -- =====================================================================================
  ELSE
    
    -- CALCULAR TOTALES PARA OT (Excluyendo Copiado)
    -- NOTA: Incluye servicios globales que luego moveremos a la tabla de servicios, el subtotal base es el mismo.
    SELECT COALESCE(SUM(precio_total), 0)
    INTO v_total_ot
    FROM presupuestos_items 
    WHERE presupuesto_id = p_presupuesto_id 
    AND tipo_item != 'centro_copiado';

    -- Crear Orden de Trabajo
    INSERT INTO ordenes_trabajo (
      company_id,
      cliente_id,
      vendedor_id,
      canal_venta,
      numero_orden,
      fecha_estimada_entrega,
      notas_internas,
      subtotal,          
      total_descuentos,  
      total,
      estado,
      created_by,
      requiere_factura
    ) VALUES (
      v_presupuesto.company_id,
      v_presupuesto.cliente_id,
      v_presupuesto.vendedor_id,
      v_presupuesto.canal_venta,
      generate_numero_orden(v_presupuesto.company_id),
      p_fecha_entrega_estimada,
      COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
      v_total_ot, 
      0,          
      v_total_ot, 
      'pendiente',
      auth.uid(),
      p_requiere_factura
    ) RETURNING id INTO v_orden_id;

    -- Si hay items de copiado, crear OC vinculada
    IF v_count_copiado > 0 THEN
       v_numero_orden_copiado := generate_numero_orden_copiado(v_presupuesto.company_id);
       v_total_copiado := 0; 
       
       INSERT INTO centro_copiado_ordenes (
        company_id,
        cliente_id,
        orden_trabajo_id,
        numero_orden,
        estado,
        fecha_entrega_estimada,
        origen,
        observaciones,
        total
      ) VALUES (
        v_presupuesto.company_id,
        v_cliente_id,
        v_orden_id,
        v_numero_orden_copiado,
        'pendiente',
        p_fecha_entrega_estimada,
        v_presupuesto.canal_venta,
        'Generado automáticamente junto con OT #' || v_orden_id,
        0
      ) RETURNING id INTO v_orden_copiado_id;

      -- Insertar items de copiado
      FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id AND tipo_item = 'centro_copiado' LOOP
        v_total_copiado := v_total_copiado + v_item.precio_total;

        INSERT INTO centro_copiado_ordenes_items (
          orden_copiado_id,
          tipo_item, 
          tamanio_papel_id,
          papel_id,
          tipo_tinta,
          cara_impresa,
          cantidad_hojas,
          cantidad_unidades,
          precio_unitario, 
          subtotal,
          descripcion
        ) VALUES (
          v_orden_copiado_id,
          'impresion',
          (v_item.configuracion->>'tamanio_papel_id')::uuid,
          (v_item.configuracion->>'papel_id')::uuid,
          (v_item.configuracion->>'tipo_tinta')::text,
          (v_item.configuracion->>'cara_impresa')::text,
          (v_item.configuracion->>'cantidad_hojas')::integer,
          v_item.cantidad,
          v_item.precio_unitario_final,
          v_item.precio_total,         
          v_item.descripcion
        );
      END LOOP;

      UPDATE centro_copiado_ordenes 
      SET total = v_total_copiado 
      WHERE id = v_orden_copiado_id;
    END IF;

    -- Procesar Items de Sistema y Personalizados para la OT
    FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id AND tipo_item != 'centro_copiado' LOOP
      
      -- Detectar si es Servicio Global (Nuevo Flag OR Legacy Pattern)
      v_es_servicio_global := (v_item.configuracion->>'es_servicio_global' = 'true') 
                           OR (v_item.producto_categoria = 'Servicios' AND v_item.producto_nombre ILIKE '[Servicio]%');

      IF v_es_servicio_global THEN
         -- Insertar en SERVICIOS ADICIONALES
         INSERT INTO ordenes_trabajo_servicios (
            orden_id,
            servicio_id,
            descripcion,
            cantidad,
            precio_unitario,
            subtotal,
            created_by
         ) VALUES (
            v_orden_id,
            NULLIF(v_item.configuracion->>'servicio_id', '')::uuid, -- Puede ser null
            COALESCE(v_item.descripcion, v_item.producto_nombre),
            v_item.cantidad,
            v_item.precio_unitario_final,
            v_item.precio_total,
            auth.uid()
         );
         -- Log para debug
         RAISE NOTICE 'Movido item global a servicios: %', v_item.producto_nombre;

      ELSE
        -- Insertar en ITEMS DE PRODUCCION (comportamiento normal)
        v_tipo_item_orden := CASE
          WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
          WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
          ELSE 'catalogo'
        END;

        INSERT INTO ordenes_trabajo_items (
          orden_id,
          tipo_item,
          producto_id,
          descripcion, 
          cantidad,
          precio_base,
          precio_servicios,
          precio_acabados,
          precio_unitario_final, 
          precio_total,
          configuracion
        ) VALUES (
          v_orden_id,
          v_tipo_item_orden,
          v_item.producto_id,
          COALESCE(v_item.descripcion, v_item.producto_nombre, 'Item de Presupuesto'), 
          v_item.cantidad,
          v_item.precio_base,
          v_item.precio_servicios,
          v_item.precio_acabados,
          v_item.precio_unitario_final, 
          v_item.precio_total,
          COALESCE(v_item.configuracion, '{}'::jsonb)
        ) RETURNING id INTO v_nuevo_item_id;

        -- Generar rutas solo para items de producción
        IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
          BEGIN
            SELECT fn_generar_ruta_produccion_item(
              v_nuevo_item_id,
              v_item.producto_id,
              v_item.producto_categoria,
              COALESCE(v_item.configuracion, '{}'::jsonb),
              v_presupuesto.company_id
            ) INTO v_rutas_generadas;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
          END;

        ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
          v_rutas_item := p_rutas_personalizadas->v_item.id::text;

          IF v_rutas_item IS NOT NULL THEN
            FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
              INSERT INTO ordenes_trabajo_items_rutas (
                orden_item_id,
                company_id,
                tipo_etapa,
                paso_id,
                paso_nombre,
                orden,
                es_modificado
              ) VALUES (
                v_nuevo_item_id,
                v_presupuesto.company_id,
                (v_ruta.value->>'etapa')::text,
                (v_ruta.value->>'paso_id')::uuid,
                (v_ruta.value->>'paso_nombre')::text,
                (v_ruta.value->>'orden')::integer,
                true
              );
            END LOOP;
          END IF;
        END IF;

      END IF; -- Fin check servicio global
    END LOOP;
    
    -- Actualizar presupuesto
    UPDATE presupuestos 
    SET orden_trabajo_id = v_orden_id,
        orden_copiado_id = v_orden_copiado_id,
        estado = 'convertido',
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    RETURN v_orden_id;
  END IF;
END;
$function$;
