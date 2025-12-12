-- Migration to fix fn_convertir_presupuesto_a_orden (v5)
-- Fixes:
-- 1. Removes invalid 'company_id' from ordenes_trabajo_items insert
-- 2. Removes invalid 'orden' column from ordenes_trabajo_items insert
-- 3. Retains all previous fixes (total calc, status, IDs, etc.)

CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
    p_presupuesto_id uuid,
    p_fecha_entrega_estimada timestamp with time zone,
    p_notas_adicionales text DEFAULT NULL::text,
    p_monto_pago numeric DEFAULT NULL::numeric,
    p_medio_cobro_id uuid DEFAULT NULL::uuid,
    p_referencia_pago text DEFAULT NULL::text,
    p_rutas_personalizadas jsonb DEFAULT NULL::jsonb
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

  -- Contar items
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
      -- Accumulate total
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
      created_by
    ) VALUES (
      v_presupuesto.company_id,
      v_presupuesto.cliente_id,
      v_presupuesto.vendedor_id,
      v_presupuesto.canal_venta,
      generate_numero_orden(v_presupuesto.company_id),
      p_fecha_entrega_estimada,
      COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
      v_presupuesto.subtotal,
      v_presupuesto.total_descuentos,
      v_presupuesto.total,
      'pendiente',
      auth.uid()
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
        -- Accumulate total
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
    END IF;

    -- Procesar Items de Sistema y Personalizados para la OT
    FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id AND tipo_item != 'centro_copiado' LOOP
      
      v_tipo_item_orden := CASE
        WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
        WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
        ELSE 'catalogo'
      END;

      INSERT INTO ordenes_trabajo_items (
        orden_id,
        -- company_id removed 
        tipo_item,
        producto_id,
        producto_nombre,
        descripcion,
        categoria,
        cantidad,
        unidad_medida,
        precio_unitario, 
        subtotal,
        descuento,
        total,
        configuracion
        -- orden removed
      ) VALUES (
        v_orden_id,
        -- value removed
        v_tipo_item_orden,
        v_item.producto_id,
        v_item.producto_nombre,
        v_item.descripcion,
        v_item.categoria,
        v_item.cantidad,
        v_item.unidad_medida,
        v_item.precio_unitario_final, 
        v_item.subtotal,
        v_item.descuento,
        v_item.total,
        COALESCE(v_item.configuracion, '{}'::jsonb)
        -- value removed
      ) RETURNING id INTO v_nuevo_item_id;

      -- Generar rutas
      IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
        BEGIN
          SELECT fn_generar_ruta_produccion_item(
            v_nuevo_item_id,
            v_item.producto_id,
            COALESCE(v_item.configuracion, '{}'::jsonb)
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
