/*
  # Fix: Mapeo correcto de tipo_item y soporte de rutas personalizadas
  
  ## Problemas identificados
  1. La función no mapea correctamente tipo_item entre presupuestos y ordenes:
     - presupuestos_items: 'producto_sistema' | 'item_personalizado'
     - ordenes_trabajo_items: 'catalogo' | 'personalizado'
  2. Falta el parámetro p_rutas_personalizadas para configurar rutas manuales
  3. No procesa las rutas personalizadas cuando se proporcionan
  
  ## Solución
  1. Agregar mapeo explícito de tipo_item:
     - 'producto_sistema' → 'catalogo'
     - 'item_personalizado' → 'personalizado'
  2. Agregar parámetro p_rutas_personalizadas JSONB
  3. Procesar rutas personalizadas para items personalizados
  4. Mantener generación automática para items de catálogo
  
  ## Cambios
  - DROP y recrear función con firma correcta
  - Agregar lógica de mapeo de tipo_item
  - Agregar procesamiento de rutas personalizadas
  - Actualizar COMMENT con nueva funcionalidad
*/

DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean, numeric, uuid, text);

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
  v_tipo_item_orden text;
  v_rutas_item jsonb;
  v_ruta record;
BEGIN
  -- Obtener datos del presupuesto
  SELECT * INTO v_presupuesto
  FROM presupuestos
  WHERE id = p_presupuesto_id;

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

  v_fecha_entrega := COALESCE(
    p_fecha_entrega_estimada,
    v_presupuesto.fecha_validez,
    now() + interval '7 days'
  );

  -- Crear orden de trabajo
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    numero_orden,
    estado,
    canal_venta,
    vendedor_id,
    fecha_estimada_entrega,
    subtotal,
    total_descuentos,
    total,
    notas_internas,
    created_by,
    presupuesto_id
  )
  VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    NULL,
    'pendiente',
    v_presupuesto.canal_venta,
    v_presupuesto.vendedor_id,
    v_fecha_entrega,
    v_presupuesto.subtotal,
    v_presupuesto.total_descuentos,
    v_presupuesto.total,
    CASE
      WHEN p_notas_adicionales IS NOT NULL THEN
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto || E'\n\n' || p_notas_adicionales
      ELSE
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto ||
        CASE 
          WHEN v_presupuesto.notas_internas IS NOT NULL THEN E'\n\n' || v_presupuesto.notas_internas
          ELSE ''
        END
    END,
    v_presupuesto.created_by,
    p_presupuesto_id
  )
  RETURNING id INTO v_orden_id;

  -- Copiar items del presupuesto CON MAPEO CORRECTO DE tipo_item
  FOR v_item IN
    SELECT *
    FROM presupuestos_items
    WHERE presupuesto_id = p_presupuesto_id
    ORDER BY id
  LOOP
    -- MAPEO CORRECTO: presupuestos → ordenes
    -- 'producto_sistema' → 'catalogo'
    -- 'item_personalizado' → 'personalizado'
    v_tipo_item_orden := CASE v_item.tipo_item
      WHEN 'producto_sistema' THEN 'catalogo'
      WHEN 'item_personalizado' THEN 'personalizado'
      ELSE v_item.tipo_item -- fallback por si acaso
    END;

    INSERT INTO ordenes_trabajo_items (
      orden_id,
      tipo_item,
      producto_id,
      producto_nombre,
      producto_categoria,
      descripcion,
      tiempo_produccion_dias,
      cantidad,
      configuracion,
      precio_base,
      precio_servicios,
      precio_acabados,
      precio_unitario_final,
      precio_total,
      estado
    )
    VALUES (
      v_orden_id,
      v_tipo_item_orden,
      v_item.producto_id,
      v_item.producto_nombre,
      v_item.producto_categoria,
      v_item.descripcion,
      v_item.tiempo_produccion_dias,
      v_item.cantidad,
      v_item.configuracion,
      v_item.precio_base,
      v_item.precio_servicios,
      v_item.precio_acabados,
      v_item.precio_unitario_final,
      v_item.precio_total,
      'pendiente'
    )
    RETURNING id INTO v_nuevo_item_id;

    -- Generar ruta de producción según tipo de item
    IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
      -- Item de catálogo: generar ruta automáticamente
      BEGIN
        v_rutas_generadas := fn_generar_ruta_produccion_item(
          v_nuevo_item_id,
          v_item.producto_id,
          v_item.producto_categoria,
          v_item.configuracion,
          v_presupuesto.company_id
        );
        
        RAISE NOTICE 'Rutas generadas automáticamente para item %: %', v_nuevo_item_id, v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;

    ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
      -- Item personalizado: usar rutas proporcionadas manualmente
      v_rutas_item := p_rutas_personalizadas->v_item.id::text;
      
      IF v_rutas_item IS NOT NULL THEN
        RAISE NOTICE 'Procesando rutas personalizadas para item %', v_nuevo_item_id;
        
        FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item)
        LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            item_id,
            company_id,
            etapa,
            paso_id,
            paso_nombre,
            orden,
            estado
          )
          VALUES (
            v_nuevo_item_id,
            v_presupuesto.company_id,
            (v_ruta.value->>'etapa')::text,
            (v_ruta.value->>'paso_id')::uuid,
            (v_ruta.value->>'paso_nombre')::text,
            (v_ruta.value->>'orden')::integer,
            'pendiente'
          );
        END LOOP;
        
        RAISE NOTICE 'Rutas personalizadas insertadas para item %', v_nuevo_item_id;
      ELSE
        RAISE WARNING 'Item personalizado % sin rutas configuradas', v_nuevo_item_id;
      END IF;
    ELSE
      RAISE NOTICE 'Item % requiere configuración manual de rutas', v_nuevo_item_id;
    END IF;
  END LOOP;

  -- Copiar archivos
  IF p_copiar_archivos THEN
    INSERT INTO ordenes_trabajo_archivos (
      orden_id,
      company_id,
      nombre_archivo,
      nombre_storage,
      tipo_mime,
      tamano_bytes,
      storage_path,
      descripcion,
      uploaded_by
    )
    SELECT
      v_orden_id,
      company_id,
      nombre_archivo,
      nombre_storage,
      tipo_mime,
      tamano_bytes,
      storage_path,
      descripcion,
      uploaded_by
    FROM presupuestos_archivos
    WHERE presupuesto_id = p_presupuesto_id;
  END IF;

  -- Registrar pago inicial si se proporcionó
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 THEN
    INSERT INTO ordenes_trabajo_pagos (
      orden_id,
      company_id,
      medio_cobro_id,
      monto,
      referencia,
      notas,
      registrado_por
    )
    VALUES (
      v_orden_id,
      v_presupuesto.company_id,
      p_medio_cobro_id,
      p_monto_pago,
      p_referencia_pago,
      'Seña registrada al convertir presupuesto #' || v_presupuesto.numero_presupuesto,
      v_presupuesto.created_by
    );
  END IF;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    estado = 'convertido',
    orden_trabajo_id = v_orden_id,
    updated_at = now()
  WHERE id = p_presupuesto_id;

  -- ENVIAR NOTIFICACIÓN WHATSAPP
  BEGIN
    RAISE NOTICE '[Conversión Presupuesto] Enviando notificación WhatsApp para orden %', v_orden_id;

    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret
      ),
      body := jsonb_build_object(
        'orden_id', v_orden_id::text,
        'company_id', v_presupuesto.company_id::text,
        'tipo_notificacion', 'nueva_orden_trabajo'
      )
    ) INTO v_request_id;

    RAISE NOTICE '[Conversión Presupuesto] HTTP request enviado con ID: %', v_request_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Conversión Presupuesto] Error enviando notificación: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden IS
'Convierte presupuesto aprobado en orden de trabajo.
- Mapea correctamente tipo_item entre presupuestos y ordenes
- Genera rutas automáticas para items de catálogo
- Aplica rutas personalizadas para items personalizados
- Envía notificación WhatsApp al cliente';
