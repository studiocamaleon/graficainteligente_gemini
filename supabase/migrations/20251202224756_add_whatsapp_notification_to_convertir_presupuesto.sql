/*
  # Agregar notificación WhatsApp al convertir presupuesto (Edge Function)
  
  ## Problema
  Cuando se convierte un presupuesto a orden, no se envía notificación WhatsApp
  usando la misma lógica y formato que cuando se crea una orden desde el frontend.
  
  ## Solución
  Después de crear la orden exitosamente, llamar a la Edge Function
  'enviar-notificacion-orden' que usa la misma lógica de generación de mensajes.
  
  ## Cambios
  - Agregar llamada HTTP a Edge Function después de crear orden
  - Llamada asíncrona que no bloquea la transacción
  - Usa SUPABASE_URL y SUPABASE_ANON_KEY del ambiente
*/

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamptz DEFAULT NULL,
  p_notas_adicionales text DEFAULT NULL,
  p_copiar_archivos boolean DEFAULT true,
  p_monto_pago numeric DEFAULT NULL,
  p_medio_cobro_id uuid DEFAULT NULL,
  p_referencia_pago text DEFAULT NULL,
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
  v_ruta record;
  v_request_id bigint;
  v_edge_function_url text;
BEGIN
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

  INSERT INTO ordenes_trabajo (
    company_id, cliente_id, vendedor_id, canal_venta, numero_orden,
    fecha_estimada_entrega, notas_internas, subtotal, total_descuentos, total,
    estado, created_by
  )
  VALUES (
    v_presupuesto.company_id, v_presupuesto.cliente_id, v_presupuesto.vendedor_id,
    v_presupuesto.canal_venta, generate_numero_orden(v_presupuesto.company_id),
    v_fecha_entrega, COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
    v_presupuesto.subtotal, v_presupuesto.total_descuentos, v_presupuesto.total,
    'pendiente', auth.uid()
  )
  RETURNING id INTO v_orden_id;

  UPDATE presupuestos
  SET orden_trabajo_id = v_orden_id, estado = 'convertido', updated_at = now()
  WHERE id = p_presupuesto_id;

  FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    INSERT INTO ordenes_trabajo_items (
      orden_id, tipo_item, producto_id, producto_nombre, producto_categoria,
      descripcion, cantidad, configuracion, precio_base, precio_servicios,
      precio_acabados, precio_unitario_final, precio_total, tiempo_produccion_dias
    )
    VALUES (
      v_orden_id, v_tipo_item_orden, v_item.producto_id, v_item.producto_nombre,
      v_item.producto_categoria, v_item.descripcion, v_item.cantidad,
      v_item.configuracion, v_item.precio_base, v_item.precio_servicios,
      v_item.precio_acabados, v_item.precio_unitario_final, v_item.precio_total,
      v_item.tiempo_produccion_dias
    )
    RETURNING id INTO v_nuevo_item_id;

    IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
      BEGIN
        SELECT fn_generar_ruta_produccion_item(v_nuevo_item_id, v_item.producto_id, v_item.configuracion) 
        INTO v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;
    ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
      v_rutas_item := p_rutas_personalizadas->v_item.id::text;
      IF v_rutas_item IS NOT NULL THEN
        FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado
          )
          VALUES (
            v_nuevo_item_id, v_presupuesto.company_id,
            (v_ruta.value->>'etapa')::text, (v_ruta.value->>'paso_id')::uuid,
            (v_ruta.value->>'paso_nombre')::text, (v_ruta.value->>'orden')::integer,
            true
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  IF p_copiar_archivos THEN
    INSERT INTO ordenes_trabajo_archivos (
      orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
    )
    SELECT v_orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
    FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;
  END IF;

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

  -- Enviar notificación WhatsApp vía Edge Function (asíncrono, no bloqueante)
  BEGIN
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';
    
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdnFwYWZnZ3ZjYnpydmJrZWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAzNDczMDIsImV4cCI6MjA0NTkyMzMwMn0.1iy_TgFZTwYIvdDPZAJ2_B8pjp0QfhsXlXb0n20KO7M'
      ),
      body := jsonb_build_object(
        'orden_id', v_orden_id::text,
        'company_id', v_presupuesto.company_id::text,
        'tipo', 'nueva_orden_trabajo',
        'orden_tipo', 'trabajo'
      )
    ) INTO v_request_id;
    
    RAISE LOG '[Conversión] Notificación WhatsApp enviada con request ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Conversión] Error enviando notificación WhatsApp: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden IS
'Convierte presupuesto aprobado a orden de trabajo.
Envía notificación WhatsApp automáticamente usando Edge Function centralizada.';
