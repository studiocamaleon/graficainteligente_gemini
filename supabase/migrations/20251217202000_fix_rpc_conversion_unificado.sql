-- =====================================================
-- FINAL FIX V2: Standardized conversion function
-- Uses ALPHABETICAL parameter order to ensure perfect matching with PostgREST/Supabase.
-- Created with fresh timestamp to ensure application via supabase db push.
-- =====================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT oid::regprocedure as sig 
              FROM pg_proc 
              WHERE proname = 'fn_convertir_presupuesto_a_orden') 
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_orden(
  p_copiar_archivos boolean DEFAULT true,
  p_fecha_entrega_estimada timestamptz DEFAULT NULL,
  p_medio_cobro_id uuid DEFAULT NULL,
  p_monto_pago numeric DEFAULT NULL,
  p_notas_adicionales text DEFAULT NULL,
  p_presupuesto_id uuid DEFAULT NULL,
  p_referencia_pago text DEFAULT NULL,
  p_requiere_factura boolean DEFAULT false,
  p_rutas_personalizadas jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_orden_id uuid;
  v_presupuesto record;
  v_item record;
  v_nuevo_item_id uuid;
  v_fecha_entrega timestamptz;
  v_rutas_generadas integer;
  v_tipo_item_orden text;
  v_rutas_item jsonb;
  v_ruta_db record;
  v_ruta_json record;
  v_request_id bigint;
  v_edge_function_url text;
  v_config_url text;
  v_trigger_secret text;
  v_has_db_routes boolean;
BEGIN
  -- 1. Obtener y Validar Presupuesto
  SELECT * INTO v_presupuesto FROM presupuestos WHERE id = p_presupuesto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  IF v_presupuesto.estado != 'aprobado' THEN
    RAISE EXCEPTION 'El presupuesto debe estar aprobado para convertirse';
  END IF;

  IF v_presupuesto.orden_trabajo_id IS NOT NULL THEN
    RAISE EXCEPTION 'El presupuesto ya fue convertido a orden de trabajo';
  END IF;

  -- 2. Validar Pago Inicial
  IF p_monto_pago IS NOT NULL THEN
    IF p_monto_pago <= 0 THEN
      RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
    END IF;
    IF p_monto_pago > v_presupuesto.total THEN
      RAISE EXCEPTION 'El monto del pago no puede ser mayor al total del presupuesto';
    END IF;
    IF p_medio_cobro_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar un medio de cobro al registrar un pago';
    END IF;
  END IF;

  v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, v_presupuesto.fecha_entrega_estimada);

  -- 3. Crear Orden de Trabajo (ÚNICA)
  INSERT INTO ordenes_trabajo (
    company_id, cliente_id, vendedor_id, canal_venta, numero_orden,
    fecha_estimada_entrega, notas_internas, subtotal, total_descuentos, total,
    estado, requiere_factura, created_by
  )
  VALUES (
    v_presupuesto.company_id, v_presupuesto.cliente_id, v_presupuesto.vendedor_id,
    v_presupuesto.canal_venta, generate_numero_orden(v_presupuesto.company_id),
    v_fecha_entrega, COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
    v_presupuesto.subtotal, v_presupuesto.total_descuentos, v_presupuesto.total,
    'pendiente', COALESCE(p_requiere_factura, false), auth.uid()
  )
  RETURNING id INTO v_orden_id;

  -- 4. Actualizar estado del Presupuesto
  UPDATE presupuestos
  SET orden_trabajo_id = v_orden_id, estado = 'convertido', updated_at = now()
  WHERE id = p_presupuesto_id;

  -- 5. Copiar Items (Iteración Unificada)
  FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id LOOP
    
    -- Mapear tipos de items de presupuesto a tipos de items de orden según constraints
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'centro_copiado' THEN 'centro_copiado'
      WHEN v_item.producto_categoria = 'Centro de Copiado' THEN 'centro_copiado'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      WHEN v_item.producto_id IS NULL THEN 'personalizado'
      ELSE 'catalogo'
    END;

    INSERT INTO ordenes_trabajo_items (
      orden_id, tipo_item, producto_id, producto_nombre, producto_categoria,
      descripcion, cantidad, configuracion, precio_base, precio_servicios,
      precio_acabados, precio_unitario_final, precio_total, tiempo_produccion_dias
    )
    VALUES (
      v_orden_id,
      v_tipo_item_orden, 
      v_item.producto_id, 
      v_item.producto_nombre,
      v_item.producto_categoria,
      v_item.descripcion,
      v_item.cantidad,
      COALESCE(v_item.configuracion, '{}'::jsonb), 
      COALESCE(v_item.precio_base, 0),
      COALESCE(v_item.precio_servicios, 0),
      COALESCE(v_item.precio_acabados, 0),
      v_item.precio_unitario_final,
      v_item.precio_total,
      COALESCE(v_item.tiempo_produccion_dias, 0)
    )
    RETURNING id INTO v_nuevo_item_id;

    -- 6. Manejo de Rutas de Producción
    v_has_db_routes := false;
    
    FOR v_ruta_db IN SELECT * FROM presupuestos_items_rutas WHERE presupuesto_item_id = v_item.id ORDER BY orden LOOP
      INSERT INTO ordenes_trabajo_items_rutas (
        orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado, comentario_vendedor
      )
      VALUES (
        v_nuevo_item_id, v_presupuesto.company_id,
        v_ruta_db.tipo_etapa, v_ruta_db.paso_id,
        v_ruta_db.paso_nombre, v_ruta_db.orden,
        v_ruta_db.es_modificado, v_ruta_db.comentario_vendedor
      );
      v_has_db_routes := true;
    END LOOP;

    IF NOT v_has_db_routes AND p_rutas_personalizadas IS NOT NULL AND (p_rutas_personalizadas->v_item.id::text) IS NOT NULL THEN
        v_rutas_item := p_rutas_personalizadas->v_item.id::text;
        FOR v_ruta_json IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado, comentario_vendedor
          )
          VALUES (
            v_nuevo_item_id, v_presupuesto.company_id,
            (v_ruta_json.value->>'etapa')::text, (v_ruta_json.value->>'paso_id')::uuid,
            (v_ruta_json.value->>'paso_nombre')::text, (v_ruta_json.value->>'orden')::integer,
            true, (v_ruta_json.value->>'comentario_vendedor')::text
          );
          v_has_db_routes := true;
        END LOOP;
    END IF;

    IF NOT v_has_db_routes THEN
         BEGIN
           SELECT fn_generar_ruta_produccion_item(
             v_nuevo_item_id, 
             v_item.producto_id, 
             CASE WHEN v_item.tipo_item = 'centro_copiado' THEN 'Centro de Copiado' ELSE v_item.producto_categoria END,
             COALESCE(v_item.configuracion, '{}'::jsonb),
             v_presupuesto.company_id
           ) INTO v_rutas_generadas;
         EXCEPTION WHEN OTHERS THEN
           RAISE WARNING 'Error generando ruta automática para item %: %', v_nuevo_item_id, SQLERRM;
         END;
    END IF;

  END LOOP;

  -- 7. Copiar Archivos
  IF p_copiar_archivos THEN
    INSERT INTO ordenes_trabajo_archivos (
      orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
    )
    SELECT v_orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
    FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;
  END IF;

  -- 8. Registrar Pago Inicial
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 THEN
    INSERT INTO ordenes_trabajo_pagos (
      orden_id, medio_cobro_id, monto, referencia_pago,
      notas, fecha_pago, created_by
    )
    VALUES (
      v_orden_id, p_medio_cobro_id, p_monto_pago, p_referencia_pago,
      'Pago inicial al convertir presupuesto', CURRENT_DATE, auth.uid()
    );
  END IF;

  -- 9. Notificación
  v_config_url := current_setting('app.edge_function_url', true);
  IF v_config_url IS NOT NULL AND v_config_url != '' THEN
     v_edge_function_url := v_config_url;
  ELSE
     v_edge_function_url := 'https://velbpmbndvovczruzkzg.supabase.co/functions/v1/enviar-notificacion-orden';
  END IF;
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret,
        'Authorization', 'Bearer ' || v_trigger_secret
      ),
      body := jsonb_build_object(
        'orden_id', v_orden_id::text,
        'company_id', v_presupuesto.company_id::text,
        'tipo', 'nueva_orden_trabajo',
        'orden_tipo', 'trabajo', 
        'origen', 'presupuesto'
      )
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Conversión Presupuesto] Error enviando notificación: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;
