-- v25: Fix Budget FK Update Logic
-- Goal: Fix FK error by updating the correct column in 'presupuestos'.
-- Issue: 'orden_trabajo_id' has FK to 'ordenes_trabajo', but we were trying to save a 'centro_copiado_ordenes' ID there.
-- Solution: Use 'orden_copiado_id' column for Copy Center orders.

CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamp with time zone,
  p_notas_adicionales text DEFAULT NULL,
  p_monto_pago numeric DEFAULT NULL,
  p_medio_cobro_id uuid DEFAULT NULL,
  p_referencia_pago text DEFAULT NULL,
  p_rutas_personalizadas jsonb DEFAULT NULL,
  p_requiere_factura boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_presupuesto RECORD;
  v_orden_id uuid;            
  v_ot_id uuid;               
  v_cc_id uuid;               
  v_item RECORD;
  v_tipo_item_orden text;
  v_nuevo_item_id uuid;
  v_rutas_item jsonb;
  v_ruta RECORD;
  v_calculated_iva numeric;
  
  v_count_cc_items integer := 0;
  v_count_other_items integer := 0;
  v_is_pure_cc boolean := false;
  v_origen text;
BEGIN
  -- 1. Validar estado
  SELECT * INTO v_presupuesto FROM presupuestos WHERE id = p_presupuesto_id;
  IF v_presupuesto.estado = 'convertido' THEN
    RAISE EXCEPTION 'El presupuesto ya ha sido convertido a orden';
  END IF;

  -- 2. Clasificar Items
  SELECT 
    count(*) FILTER (WHERE tipo_item = 'centro_copiado'),
    count(*) FILTER (WHERE tipo_item != 'centro_copiado' AND (configuracion->>'es_servicio_global')::boolean IS NOT TRUE)
  INTO v_count_cc_items, v_count_other_items
  FROM presupuestos_items 
  WHERE presupuesto_id = p_presupuesto_id;

  IF v_count_cc_items > 0 AND v_count_other_items = 0 THEN
     v_is_pure_cc := true;
  END IF;

  v_calculated_iva := COALESCE(v_presupuesto.total, 0) - (COALESCE(v_presupuesto.subtotal, 0) - COALESCE(v_presupuesto.total_descuentos, 0));
  IF v_calculated_iva < 0 THEN v_calculated_iva := 0; END IF;
  
  v_origen := COALESCE(v_presupuesto.canal_venta, 'Mostrador');

  -- ==================================================================================
  -- BRANCH A: PURE COPY CENTER
  -- ==================================================================================
  IF v_is_pure_cc THEN
     
     INSERT INTO centro_copiado_ordenes (
       company_id, cliente_id, orden_trabajo_id, numero_orden, estado, fecha_solicitud,
       fecha_entrega_estimada, total, observaciones, origen, requiere_factura, canal_venta,
       created_at, updated_at, created_by
     ) VALUES (
       v_presupuesto.company_id, v_presupuesto.cliente_id, NULL, 
       generate_numero_orden(v_presupuesto.company_id), 
       'pendiente', NOW(), p_fecha_entrega_estimada, v_presupuesto.total,
       COALESCE(p_notas_adicionales, v_presupuesto.notas_internas), v_origen,
       COALESCE(p_requiere_factura, false), v_origen, NOW(), NOW(), auth.uid()
     ) RETURNING id INTO v_cc_id;

     v_orden_id := v_cc_id; 

     FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id LOOP
       INSERT INTO centro_copiado_ordenes_items (
         orden_copiado_id, tipo_item, tamanio_papel_id, papel_id, tipo_tinta, cara_impresa,
         cantidad_hojas, tipo_anillado, tipo_plastificado, cantidad_unidades,
         precio_unitario, subtotal, descripcion, created_at, updated_at
       ) VALUES (
         v_cc_id, 'impresion', 
         (v_item.configuracion->>'tamanio_papel_id')::uuid, (v_item.configuracion->>'papel_id')::uuid,
         v_item.configuracion->>'tipo_tinta', v_item.configuracion->>'cara_impresa',
         (v_item.configuracion->>'cantidad_hojas')::integer, v_item.configuracion->>'tipo_anillado',
         v_item.configuracion->>'tipo_plastificado', v_item.cantidad, v_item.precio_unitario_final,
         v_item.precio_total, v_item.descripcion, NOW(), NOW()
       );
     END LOOP;

     INSERT INTO centro_copiado_ordenes_archivos (
        orden_copiado_id, company_id, nombre_archivo, nombre_storage, tipo_mime, 
        tamano_bytes, storage_path, uploaded_by
     )
     SELECT v_cc_id, company_id, nombre_archivo, nombre_storage, tipo_mime, 
            tamano_bytes, storage_path, uploaded_by 
     FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;
     
     -- CORRECT UPDATE: Update orden_copiado_id, LEAVE orden_trabajo_id NULL
     UPDATE presupuestos 
     SET estado = 'convertido', 
         orden_copiado_id = v_cc_id, 
         orden_trabajo_id = NULL,
         updated_at = NOW() 
     WHERE id = p_presupuesto_id;

  -- ==================================================================================
  -- BRANCH B: STANDARD OR MIXED
  -- ==================================================================================
  ELSE
     INSERT INTO ordenes_trabajo (
       company_id, cliente_id, vendedor_id, estado, canal_venta, fecha_estimada_entrega,
       notas_internas, presupuesto_id, total, subtotal, total_descuentos, requiere_factura,
       subtotal_iva, facturada, numero_orden, created_at, updated_at, created_by
     ) VALUES (
       v_presupuesto.company_id, v_presupuesto.cliente_id, v_presupuesto.vendedor_id, 'pendiente', 
       v_origen, p_fecha_entrega_estimada,
       COALESCE(p_notas_adicionales, v_presupuesto.notas_internas), p_presupuesto_id,
       v_presupuesto.total, v_presupuesto.subtotal, v_presupuesto.total_descuentos,
       COALESCE(p_requiere_factura, false), v_calculated_iva, false,
       generate_numero_orden(v_presupuesto.company_id), NOW(), NOW(), auth.uid()
     ) RETURNING id INTO v_ot_id;

     v_orden_id := v_ot_id;

     IF v_count_cc_items > 0 THEN
        INSERT INTO centro_copiado_ordenes (
          company_id, cliente_id, orden_trabajo_id, numero_orden, estado,
          fecha_solicitud, fecha_entrega_estimada, total, observaciones, origen,
          requiere_factura, canal_venta, created_at, updated_at, created_by
        ) VALUES (
          v_presupuesto.company_id, v_presupuesto.cliente_id, v_ot_id, 
          (SELECT numero_orden FROM ordenes_trabajo WHERE id = v_ot_id), 
          'pendiente', NOW(), p_fecha_entrega_estimada, v_presupuesto.total,
          COALESCE(p_notas_adicionales, v_presupuesto.notas_internas), v_origen,
          COALESCE(p_requiere_factura, false), v_origen, NOW(), NOW(), auth.uid()
        ) RETURNING id INTO v_cc_id;
     END IF;

     FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id LOOP
        IF v_item.tipo_item = 'centro_copiado' THEN
             IF v_cc_id IS NOT NULL THEN
                 INSERT INTO centro_copiado_ordenes_items (
                   orden_copiado_id, tipo_item, tamanio_papel_id, papel_id, tipo_tinta, cara_impresa,
                   cantidad_hojas, tipo_anillado, tipo_plastificado, cantidad_unidades,
                   precio_unitario, subtotal, descripcion, created_at, updated_at
                 ) VALUES (
                   v_cc_id, 'impresion', 
                   (v_item.configuracion->>'tamanio_papel_id')::uuid, (v_item.configuracion->>'papel_id')::uuid,
                   v_item.configuracion->>'tipo_tinta', v_item.configuracion->>'cara_impresa',
                   (v_item.configuracion->>'cantidad_hojas')::integer, v_item.configuracion->>'tipo_anillado',
                   v_item.configuracion->>'tipo_plastificado', v_item.cantidad, v_item.precio_unitario_final,
                   v_item.precio_total, v_item.descripcion, NOW(), NOW()
                 );
             END IF;
             INSERT INTO ordenes_trabajo_items (
               orden_id, tipo_item, producto_id, descripcion, cantidad, configuracion,
               precio_unitario_final, precio_total, producto_nombre, producto_categoria,
               estado, precio_base, precio_servicios, precio_acabados, tiempo_produccion_dias,
               created_at, updated_at
             ) VALUES (
               v_ot_id, 'personalizado', NULL, v_item.descripcion, v_item.cantidad, v_item.configuracion,
               v_item.precio_unitario_final, v_item.precio_total, v_item.producto_nombre, v_item.producto_categoria,
               'pendiente', v_item.precio_unitario_final, v_item.precio_servicios,
               v_item.precio_acabados, v_item.tiempo_produccion_dias, NOW(), NOW()
             );
        ELSE
           IF v_item.configuracion->>'es_servicio_global' = 'true' THEN
               INSERT INTO ordenes_trabajo_servicios (
                 orden_id, servicio_id, descripcion, precio_unitario, cantidad, subtotal
               ) VALUES (
                 v_ot_id, (v_item.configuracion->>'servicio_id')::uuid,
                 CASE WHEN v_item.descripcion IS NULL OR v_item.descripcion = '' THEN v_item.producto_nombre ELSE v_item.producto_nombre || E'\n' || v_item.descripcion END,
                 v_item.precio_unitario_final, v_item.cantidad, v_item.precio_total
               );
           ELSE
               IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN v_tipo_item_orden := 'catalogo'; ELSE v_tipo_item_orden := 'personalizado'; END IF;
               INSERT INTO ordenes_trabajo_items (
                 orden_id, tipo_item, producto_id, descripcion, cantidad, configuracion,
                 precio_unitario_final, precio_total, producto_nombre, producto_categoria,
                 estado, precio_base, precio_servicios, precio_acabados, tiempo_produccion_dias,
                 created_at, updated_at
               ) VALUES (
                 v_ot_id, v_tipo_item_orden, v_item.producto_id, v_item.descripcion, v_item.cantidad, v_item.configuracion,
                 v_item.precio_unitario_final, v_item.precio_total, v_item.producto_nombre, v_item.producto_categoria,
                 'pendiente', v_item.precio_unitario_final, v_item.precio_servicios,
                 v_item.precio_acabados, v_item.tiempo_produccion_dias, NOW(), NOW()
               ) RETURNING id INTO v_nuevo_item_id;
               IF v_tipo_item_orden = 'catalogo' THEN
                  PERFORM fn_generar_ruta_produccion_item(v_nuevo_item_id, v_item.producto_id, v_item.producto_categoria, v_item.configuracion, v_presupuesto.company_id);
               ELSIF p_rutas_personalizadas IS NOT NULL THEN
                  v_rutas_item := p_rutas_personalizadas->v_item.id::text;
                  IF v_rutas_item IS NOT NULL THEN
                    FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
                      INSERT INTO ordenes_trabajo_items_rutas (orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado)
                      VALUES (v_nuevo_item_id, v_presupuesto.company_id, (v_ruta.value->>'etapa')::text, (v_ruta.value->>'paso_id')::uuid, (v_ruta.value->>'paso_nombre')::text, (v_ruta.value->>'orden')::integer, true);
                    END LOOP;
                  END IF;
               END IF;
           END IF;
        END IF;
     END LOOP;

     INSERT INTO ordenes_trabajo_archivos (orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime, tamano_bytes, storage_path, descripcion, uploaded_by)
     SELECT v_ot_id, company_id, nombre_archivo, nombre_storage, tipo_mime, tamano_bytes, storage_path, descripcion, uploaded_by FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;

     -- CORRECT UPDATE: Set orden_trabajo_id, and optionally orden_copiado_id if we want
     UPDATE presupuestos 
     SET estado = 'convertido', 
         orden_trabajo_id = v_ot_id, 
         orden_copiado_id = v_cc_id, -- Can set this too if mixed
         updated_at = NOW() 
     WHERE id = p_presupuesto_id;
     
     IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 AND p_medio_cobro_id IS NOT NULL THEN
        INSERT INTO ordenes_trabajo_pagos (orden_id, medio_cobro_id, monto, referencia_pago, notas, fecha_pago, created_by) 
        VALUES (v_ot_id, p_medio_cobro_id, p_monto_pago, p_referencia_pago, 'Pago inicial', CURRENT_DATE, auth.uid());
     END IF;

  END IF;

  PERFORM net.http_post(
    url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdnFwYWZnZ3ZjYnpydmJrZWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAzNDczMDIsImV4cCI6MjA0NTkyMzMwMn0.1iy_TgFZTwYIvdDPZAJ2_B8pjp0QfhsXlXb0n20KO7M'),
    body := jsonb_build_object('orden_id', v_orden_id::text, 'company_id', v_presupuesto.company_id::text, 'tipo', 'nueva_orden_trabajo', 'orden_tipo', 'trabajo')
  );

  RETURN v_orden_id;
END;
$$;
