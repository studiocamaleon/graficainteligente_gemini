/*
  # Fix: Corrección de número de orden y generación de rutas
  
  ## Problemas
  1. La función generaba número manual con formato ORD-2025-XXXX
  2. No usaba el trigger automático que genera GI-XXXXXX
  3. La llamada a fn_generar_ruta_produccion_item tenía parámetros incorrectos
  
  ## Solución
  1. NO generar numero_orden manualmente, dejar NULL para que el trigger lo genere
  2. Llamar correctamente a fn_generar_ruta_produccion_item con todos los parámetros
  
  ## Cambios
  - Eliminar lógica de generación manual de número
  - Pasar numero_orden como NULL en INSERT
  - Corregir llamada a fn_generar_ruta_produccion_item(item_id, producto_id, categoria, configuracion, company_id)
*/

DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean, numeric, uuid, text);

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamptz DEFAULT NULL,
  p_notas_adicionales text DEFAULT NULL,
  p_copiar_archivos boolean DEFAULT true,
  p_monto_pago numeric DEFAULT NULL,
  p_medio_cobro_id uuid DEFAULT NULL,
  p_referencia_pago text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orden_id uuid;
  v_presupuesto record;
  v_item record;
  v_nuevo_item_id uuid;
  v_fecha_entrega timestamptz;
  v_rutas_generadas integer;
BEGIN
  -- Obtener datos del presupuesto
  SELECT * INTO v_presupuesto
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  -- Validar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  -- Validar que está aprobado
  IF v_presupuesto.estado != 'aprobado' THEN
    RAISE EXCEPTION 'El presupuesto debe estar aprobado para convertirse';
  END IF;

  -- Validar que no está ya convertido
  IF v_presupuesto.orden_trabajo_id IS NOT NULL THEN
    RAISE EXCEPTION 'El presupuesto ya fue convertido a orden de trabajo';
  END IF;

  -- Validar parámetros de pago si se proporcionan
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

  -- Determinar fecha de entrega
  v_fecha_entrega := COALESCE(
    p_fecha_entrega_estimada,
    v_presupuesto.fecha_validez,
    now() + interval '7 days'
  );

  -- Crear orden de trabajo
  -- NO GENERAR numero_orden manualmente, el trigger lo generará automáticamente
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    numero_orden, -- Dejar NULL para que el trigger lo genere
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
    NULL, -- El trigger generará GI-XXXXXX automáticamente
    'pendiente',
    v_presupuesto.canal_venta,
    v_presupuesto.vendedor_id,
    v_fecha_entrega,
    v_presupuesto.subtotal,
    v_presupuesto.total_descuentos,
    v_presupuesto.total,
    CASE
      WHEN p_notas_adicionales IS NOT NULL THEN
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto || E'\\n\\n' || p_notas_adicionales
      ELSE
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto ||
        CASE 
          WHEN v_presupuesto.notas_internas IS NOT NULL THEN E'\\n\\n' || v_presupuesto.notas_internas
          ELSE ''
        END
    END,
    v_presupuesto.created_by,
    p_presupuesto_id
  )
  RETURNING id INTO v_orden_id;

  -- Copiar items del presupuesto
  FOR v_item IN
    SELECT *
    FROM presupuestos_items
    WHERE presupuesto_id = p_presupuesto_id
    ORDER BY id
  LOOP
    INSERT INTO ordenes_trabajo_items (
      orden_id,
      producto_id,
      producto_nombre,
      producto_categoria,
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
      v_item.producto_id,
      v_item.producto_nombre,
      v_item.producto_categoria,
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

    -- Generar ruta de producción con TODOS los parámetros necesarios
    IF v_item.producto_id IS NOT NULL THEN
      BEGIN
        -- Llamar con la firma correcta: (item_id, producto_id, categoria, configuracion, company_id)
        v_rutas_generadas := fn_generar_ruta_produccion_item(
          v_nuevo_item_id,
          v_item.producto_id,
          v_item.producto_categoria,
          v_item.configuracion,
          v_presupuesto.company_id
        );
        
        RAISE NOTICE 'Rutas generadas para item %: %', v_nuevo_item_id, v_rutas_generadas;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Copiar archivos (CAMPOS CORRECTOS)
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

  RETURN v_orden_id;
END;
$$;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden IS
'Convierte un presupuesto aprobado en orden de trabajo usando numeración automática GI-XXXXXX y generando rutas de producción completas.';
