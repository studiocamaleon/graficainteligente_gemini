/*
  # Actualizar función de conversión para soportar rutas personalizadas
  
  ## Cambios
  1. DROP de la función anterior
  2. Recrear con parámetro adicional p_rutas_personalizadas
  3. Lógica para insertar rutas manuales en items personalizados
*/

-- Drop función anterior especificando todos los parámetros
DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean, numeric, uuid, text);

-- Crear nueva versión con parámetro adicional
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
  v_request_id bigint;
  v_edge_function_url text;
  v_trigger_secret text;
  v_ruta_manual record;
  v_rutas_item jsonb;
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
      RAISE EXCEPTION 'Debe especificar un medio de cobro para registrar el pago';
    END IF;
  END IF;

  v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, v_presupuesto.fecha_validez, now() + interval '7 days');

  -- Crear orden de trabajo
  INSERT INTO ordenes_trabajo (
    company_id, cliente_id, numero_orden, estado, canal_venta, vendedor_id,
    fecha_estimada_entrega, subtotal, total_descuentos, total, notas_internas,
    created_by, presupuesto_id
  )
  VALUES (
    v_presupuesto.company_id, v_presupuesto.cliente_id, NULL, 'pendiente',
    v_presupuesto.canal_venta, v_presupuesto.vendedor_id, v_fecha_entrega,
    v_presupuesto.subtotal, v_presupuesto.total_descuentos, v_presupuesto.total,
    CASE
      WHEN p_notas_adicionales IS NOT NULL THEN
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto || E'\\n\\n' || p_notas_adicionales
      ELSE
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto ||
        CASE WHEN v_presupuesto.notas_internas IS NOT NULL THEN E'\\n\\n' || v_presupuesto.notas_internas ELSE '' END
    END,
    v_presupuesto.created_by, p_presupuesto_id
  )
  RETURNING id INTO v_orden_id;

  -- Copiar items del presupuesto
  FOR v_item IN SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id ORDER BY id
  LOOP
    INSERT INTO ordenes_trabajo_items (
      orden_id, tipo_item, producto_id, producto_nombre, producto_categoria,
      descripcion, tiempo_produccion_dias, cantidad, configuracion,
      precio_base, precio_servicios, precio_acabados, precio_unitario_final,
      precio_total, estado
    )
    VALUES (
      v_orden_id,
      CASE WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado' ELSE 'catalogo' END,
      v_item.producto_id, v_item.producto_nombre, v_item.producto_categoria,
      v_item.descripcion, v_item.tiempo_produccion_dias, v_item.cantidad,
      v_item.configuracion, v_item.precio_base, v_item.precio_servicios,
      v_item.precio_acabados, v_item.precio_unitario_final, v_item.precio_total,
      'pendiente'
    )
    RETURNING id INTO v_nuevo_item_id;

    -- Generar rutas según tipo de item
    IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
      BEGIN
        v_rutas_generadas := fn_generar_ruta_produccion_item(
          v_nuevo_item_id, v_item.producto_id, v_item.producto_categoria,
          v_item.configuracion, v_presupuesto.company_id
        );
        RAISE NOTICE 'Rutas generadas para item catálogo %: %', v_nuevo_item_id, v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generando ruta: %', SQLERRM;
      END;
      
    ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
      v_rutas_item := p_rutas_personalizadas->v_item.id::text;
      
      IF v_rutas_item IS NOT NULL THEN
        FOR v_ruta_manual IN 
          SELECT 
            (r->>'etapa')::text as etapa,
            (r->>'paso_id')::uuid as paso_id,
            (r->>'paso_nombre')::text as paso_nombre,
            (r->>'orden')::integer as orden
          FROM jsonb_array_elements(v_rutas_item) as r
        LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            company_id, orden_item_id, tipo_etapa, paso_id, paso_nombre,
            orden, es_modificado, origen_plantilla_id, estado_paso
          )
          VALUES (
            v_presupuesto.company_id, v_nuevo_item_id, v_ruta_manual.etapa,
            v_ruta_manual.paso_id, v_ruta_manual.paso_nombre, v_ruta_manual.orden,
            true, NULL, 'pendiente'
          );
        END LOOP;
        RAISE NOTICE 'Rutas manuales insertadas para item %', v_nuevo_item_id;
      END IF;
    END IF;
  END LOOP;

  -- Copiar archivos
  IF p_copiar_archivos THEN
    INSERT INTO ordenes_trabajo_archivos (
      orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
      tamano_bytes, storage_path, descripcion, uploaded_by
    )
    SELECT v_orden_id, company_id, nombre_archivo, nombre_storage, tipo_mime,
           tamano_bytes, storage_path, descripcion, uploaded_by
    FROM presupuestos_archivos WHERE presupuesto_id = p_presupuesto_id;
  END IF;

  -- Registrar pago inicial
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 THEN
    INSERT INTO ordenes_trabajo_pagos (
      orden_id, company_id, medio_cobro_id, monto, referencia, notas, registrado_por
    )
    VALUES (
      v_orden_id, v_presupuesto.company_id, p_medio_cobro_id, p_monto_pago,
      p_referencia_pago, 'Seña registrada al convertir presupuesto #' || v_presupuesto.numero_presupuesto,
      v_presupuesto.created_by
    );
  END IF;

  -- Actualizar presupuesto
  UPDATE presupuestos SET estado = 'convertido', orden_trabajo_id = v_orden_id, updated_at = now()
  WHERE id = p_presupuesto_id;

  -- Enviar notificación WhatsApp
  BEGIN
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Trigger-Secret', v_trigger_secret),
      body := jsonb_build_object('orden_id', v_orden_id::text, 'company_id', v_presupuesto.company_id::text, 'tipo_notificacion', 'nueva_orden_trabajo')
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error enviando notificación: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden IS
'Convierte presupuesto aprobado en orden. Soporta items personalizados con rutas manuales y envía WhatsApp.';
