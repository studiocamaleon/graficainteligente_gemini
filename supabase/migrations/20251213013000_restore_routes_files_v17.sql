-- v17: Full Restoration of Logic (Routes + Files + Notifications)
-- Goal: Restore ALL functionality lost during rewrite, while keeping the Fixes.
-- Features restoring:
-- 1. Route Generation (Catalog & Custom).
-- 2. File Copying.
-- 3. WhatsApp Notification.
-- 4. Payment Recording (Full logic).

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
  v_item RECORD;
  v_tipo_item_orden text;
  v_nuevo_item_id uuid;
  v_rutas_generadas integer;
  v_rutas_item jsonb;
  v_ruta RECORD;
  v_request_id bigint;
  v_edge_function_url text;
BEGIN
  -- 1. Validar estado del presupuesto
  SELECT * INTO v_presupuesto
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  IF v_presupuesto.estado = 'convertido' THEN
    RAISE EXCEPTION 'El presupuesto ya ha sido convertido a orden';
  END IF;

  -- 2. Crear la Orden de Trabajo
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    vendedor_id,
    estado,
    canal_venta,
    fecha_estimada_entrega,
    notas_internas,
    presupuesto_id,
    total,
    subtotal,         
    total_descuentos, 
    requiere_factura,
    subtotal_iva,     
    facturada,
    numero_orden,        -- Re-added: generate_numero_orden
    created_at,
    updated_at,
    created_by           -- Re-added
  ) VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_presupuesto.vendedor_id,
    'pendiente', 
    COALESCE(v_presupuesto.canal_venta, 'Mostrador'),
    p_fecha_entrega_estimada,
    COALESCE(p_notas_adicionales, v_presupuesto.notas_internas), -- Fallback logic restored
    p_presupuesto_id,
    v_presupuesto.total,           -- Restored: Copy totals
    v_presupuesto.subtotal,        -- Restored: Copy totals
    v_presupuesto.total_descuentos,-- Restored: Copy totals
    COALESCE(p_requiere_factura, false),
    v_presupuesto.subtotal_iva,    -- Restored: Copy totals
    false,
    generate_numero_orden(v_presupuesto.company_id), -- Restored
    NOW(),
    NOW(),
    auth.uid()
  ) RETURNING id INTO v_orden_id;

  -- 3. Manejo de Pagos (Restored robust logic)
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 AND p_medio_cobro_id IS NOT NULL THEN
    BEGIN
      INSERT INTO ordenes_trabajo_pagos (
        orden_id,
        medio_cobro_id,
        monto,
        referencia_pago,
        notas,
        fecha_pago,
        created_by
      ) VALUES (
        v_orden_id,
        p_medio_cobro_id,
        p_monto_pago,
        p_referencia_pago,
        'Pago inicial al convertir presupuesto',
        CURRENT_DATE,
        auth.uid()
      );
    EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'No se pudo registrar el pago: %', SQLERRM;
    END;
  END IF;

  -- 4. Migrar Items
  FOR v_item IN 
    SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id
  LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    IF (v_item.configuracion->>'es_servicio_global')::boolean = true THEN
       -- Servicio Global
       INSERT INTO ordenes_trabajo_servicios (
         orden_id,
         servicio_id,
         descripcion,     
         precio_unitario,
         cantidad,
         subtotal
       ) VALUES (
         v_orden_id,
         (v_item.configuracion->>'servicio_id')::uuid,
         -- Fix V16: Combine Name + Desc
         CASE 
            WHEN v_item.descripcion IS NULL OR v_item.descripcion = '' THEN v_item.producto_nombre
            ELSE v_item.producto_nombre || E'\n' || v_item.descripcion
         END,
         v_item.precio_unitario_final,
         v_item.cantidad,
         v_item.precio_total
       );
    ELSE
       -- Item Normal (Genera ID para rutas)
       INSERT INTO ordenes_trabajo_items (
         orden_id,
         tipo_item,
         producto_id,
         descripcion,
         cantidad,
         configuracion,
         precio_unitario_final,
         precio_total,
         producto_nombre, -- Fix V12: Direct Map
         producto_categoria,
         estado,
         precio_base,      
         precio_servicios, 
         precio_acabados, 
         tiempo_produccion_dias, -- Restored
         created_at,
         updated_at
       ) VALUES (
         v_orden_id,
         v_tipo_item_orden::text,
         v_item.producto_id,
         v_item.descripcion,
         v_item.cantidad,
         v_item.configuracion,
         v_item.precio_unitario_final,
         v_item.precio_total,
         v_item.producto_nombre, -- Direct Map
         v_item.producto_categoria,
         'pendiente',
         v_item.precio_unitario_final,
         v_item.precio_servicios, -- Restored
         v_item.precio_acabados,  -- Restored
         v_item.tiempo_produccion_dias, -- Restored
         NOW(),
         NOW()
       ) RETURNING id INTO v_nuevo_item_id;

       -- 5. Generar Rutas (RESTORED LOGIC)
       -- A) Catalog Products
       IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
          BEGIN
            SELECT fn_generar_ruta_produccion_item(
              v_nuevo_item_id,              
              v_item.producto_id,            
              v_item.producto_categoria,     
              v_item.configuracion,          
              v_presupuesto.company_id       
            ) INTO v_rutas_generadas;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error generando rutas para item %: %', v_nuevo_item_id, SQLERRM;
          END;
          
       -- B) Custom Products with Manual Routes
       ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
          v_rutas_item := p_rutas_personalizadas->v_item.id::text;
          IF v_rutas_item IS NOT NULL THEN
            FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item) LOOP
              -- Check if table ordenes_trabajo_items_rutas matches this insert structure
              INSERT INTO ordenes_trabajo_items_rutas (
                orden_item_id, company_id, tipo_etapa, paso_id, paso_nombre, orden, es_modificado
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

    END IF;
  END LOOP;

  -- 6. Copiar Archivos (RESTORED)
  INSERT INTO ordenes_trabajo_archivos (
      orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
  )
  SELECT v_orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
  FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;

  -- 7. Actualizar Estado
  UPDATE presupuestos
  SET estado = 'convertido', orden_trabajo_id = v_orden_id, updated_at = NOW()
  WHERE id = p_presupuesto_id;

  -- 8. WhatsApp Notification (RESTORED but tolerant to failure)
  BEGIN
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';
    PERFORM net.http_post(
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
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error enviando notificación WhatsApp: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;
