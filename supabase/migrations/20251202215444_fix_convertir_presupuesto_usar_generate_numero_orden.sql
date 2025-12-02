/*
  # Fix: Usar función generate_numero_orden en conversión de presupuesto

  ## Problema
  La función fn_convertir_presupuesto_a_orden intenta calcular el numero_orden
  haciendo CAST a integer de valores como "GI-000001", causando error:
  "invalid input syntax for type integer: 'GI-000001'"

  ## Solución
  Usar la función existente generate_numero_orden(company_id) que ya maneja
  correctamente el formato de números de orden.

  ## Cambios
  - Reemplazar el cálculo manual de numero_orden
  - Usar generate_numero_orden(company_id)
*/

DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean, numeric, uuid, text, jsonb);

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
      RAISE EXCEPTION 'Debe especificar un medio de cobro al registrar un pago';
    END IF;
  END IF;

  -- Calcular fecha de entrega
  v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, v_presupuesto.fecha_entrega_estimada);

  -- Crear la orden de trabajo usando generate_numero_orden
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
  )
  VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_presupuesto.vendedor_id,
    v_presupuesto.canal_venta,
    generate_numero_orden(v_presupuesto.company_id),
    v_fecha_entrega,
    COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
    v_presupuesto.subtotal,
    v_presupuesto.total_descuentos,
    v_presupuesto.total,
    'confirmado',
    auth.uid()
  )
  RETURNING id INTO v_orden_id;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    orden_trabajo_id = v_orden_id,
    estado = 'convertido',
    updated_at = now()
  WHERE id = p_presupuesto_id;

  -- Copiar items
  FOR v_item IN
    SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id ORDER BY orden
  LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    INSERT INTO ordenes_trabajo_items (
      orden_id,
      company_id,
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
      configuracion,
      orden
    )
    VALUES (
      v_orden_id,
      v_presupuesto.company_id,
      v_tipo_item_orden,
      v_item.producto_id,
      v_item.producto_nombre,
      v_item.descripcion,
      v_item.categoria,
      v_item.cantidad,
      v_item.unidad_medida,
      v_item.precio_unitario,
      v_item.subtotal,
      v_item.descuento,
      v_item.total,
      v_item.configuracion,
      v_item.orden
    )
    RETURNING id INTO v_nuevo_item_id;

    -- Generar rutas
    IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
      BEGIN
        SELECT fn_generar_ruta_produccion_item(
          v_nuevo_item_id,
          v_item.producto_id,
          v_item.configuracion
        ) INTO v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;

    ELSIF v_item.tipo_item = 'item_personalizado' AND p_rutas_personalizadas IS NOT NULL THEN
      v_rutas_item := p_rutas_personalizadas->v_item.id::text;

      IF v_rutas_item IS NOT NULL THEN
        FOR v_ruta IN SELECT * FROM jsonb_array_elements(v_rutas_item)
        LOOP
          INSERT INTO ordenes_trabajo_items_rutas (
            orden_item_id,
            company_id,
            tipo_etapa,
            paso_id,
            paso_nombre,
            orden,
            es_modificado
          )
          VALUES (
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

  -- Registrar pago inicial
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
      'Pago inicial al convertir presupuesto',
      auth.uid()
    );
  END IF;

  -- Notificación WhatsApp
  BEGIN
    SELECT edge_function_url, trigger_secret
    INTO v_edge_function_url, v_trigger_secret
    FROM evolution_integrations
    WHERE company_id = v_presupuesto.company_id
    AND estado_conexion = 'conectado'
    LIMIT 1;

    IF v_edge_function_url IS NOT NULL THEN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', COALESCE(v_trigger_secret, '')
        ),
        body := jsonb_build_object(
          'orden_id', v_orden_id::text,
          'company_id', v_presupuesto.company_id::text,
          'tipo_orden', 'trabajo',
          'tipo_notificacion', 'nueva_orden_trabajo'
        )
      ) INTO v_request_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error enviando notificación WhatsApp: %', SQLERRM;
  END;

  RETURN v_orden_id;
END;
$$;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden IS
'Convierte un presupuesto aprobado en una orden de trabajo.
Usa generate_numero_orden para generar el número correcto.
Copia items, archivos, y procesa rutas automáticas o manuales.';
