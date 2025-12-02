/*
  # Función para convertir presupuesto a orden de trabajo

  1. Nueva función
    - `fn_convertir_presupuesto_a_orden`
    - Convierte presupuesto aprobado en orden de trabajo
    - Copia items del sistema automáticamente
    - Genera rutas de producción

  2. Validaciones
    - Presupuesto debe estar aprobado
    - No puede estar ya convertido

  3. Retorno
    - ID de la orden creada
*/

-- Función para convertir presupuesto a orden de trabajo
CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamptz DEFAULT NULL,
  p_notas_adicionales text DEFAULT NULL,
  p_copiar_archivos boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden_id uuid;
  v_presupuesto record;
  v_item record;
  v_nuevo_item_id uuid;
  v_fecha_entrega timestamptz;
  v_numero_orden text;
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

  -- Determinar fecha de entrega
  v_fecha_entrega := COALESCE(
    p_fecha_entrega_estimada,
    v_presupuesto.fecha_validez,
    now() + interval '7 days'
  );

  -- Generar número de orden (obtener siguiente número)
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orden FROM '\d+') AS INTEGER)), 0) + 1
  INTO v_numero_orden
  FROM ordenes_trabajo
  WHERE company_id = v_presupuesto.company_id
    AND numero_orden ~ '^ORD-\d{4}-\d+$'
    AND SUBSTRING(numero_orden FROM 5 FOR 4) = TO_CHAR(now(), 'YYYY');

  v_numero_orden := 'ORD-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(v_numero_orden::text, 4, '0');

  -- Crear orden de trabajo
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    numero_orden,
    estado,
    canal,
    prioridad,
    fecha_entrega,
    total,
    saldo_pendiente,
    metodo_pago,
    observaciones,
    created_by,
    presupuesto_id
  )
  VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_numero_orden,
    'pendiente',
    v_presupuesto.canal,
    'media',
    v_fecha_entrega,
    v_presupuesto.total,
    v_presupuesto.total, -- Saldo pendiente = total
    v_presupuesto.metodo_pago,
    CASE
      WHEN p_notas_adicionales IS NOT NULL THEN
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto || E'\n\n' || p_notas_adicionales
      ELSE
        'CONVERTIDO DE PRESUPUESTO #' || v_presupuesto.numero_presupuesto
    END,
    v_presupuesto.created_by,
    p_presupuesto_id
  )
  RETURNING id INTO v_orden_id;

  -- Copiar items del sistema
  FOR v_item IN
    SELECT *
    FROM presupuestos_items
    WHERE presupuesto_id = p_presupuesto_id
      AND tipo_item = 'producto_sistema'
    ORDER BY orden
  LOOP
    -- Insertar item en orden
    INSERT INTO ordenes_trabajo_items (
      orden_trabajo_id,
      producto_id,
      producto_nombre,
      producto_categoria,
      cantidad,
      precio_unitario,
      precio_total,
      estado,
      configuracion
    )
    VALUES (
      v_orden_id,
      v_item.producto_id,
      v_item.producto_nombre,
      v_item.producto_categoria,
      v_item.cantidad,
      v_item.precio_unitario_final,
      v_item.precio_total,
      'pendiente',
      v_item.configuracion
    )
    RETURNING id INTO v_nuevo_item_id;

    -- Generar ruta de producción para el item si tiene producto_id
    IF v_item.producto_id IS NOT NULL THEN
      BEGIN
        PERFORM fn_generar_ruta_produccion_item(v_nuevo_item_id);
      EXCEPTION WHEN OTHERS THEN
        -- Log error pero continuar
        RAISE WARNING 'Error generando ruta para item %: %', v_nuevo_item_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Copiar archivos adjuntos si se solicitó
  IF p_copiar_archivos THEN
    INSERT INTO ordenes_trabajo_archivos (
      orden_trabajo_id,
      nombre_archivo,
      ruta_storage,
      tipo_archivo,
      tamano_bytes,
      uploaded_by
    )
    SELECT
      v_orden_id,
      nombre_archivo,
      ruta_storage,
      tipo_archivo,
      tamano_bytes,
      uploaded_by
    FROM presupuestos_archivos
    WHERE presupuesto_id = p_presupuesto_id;
  END IF;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    estado = 'convertido',
    orden_trabajo_id = v_orden_id,
    updated_at = now()
  WHERE id = p_presupuesto_id;

  -- Retornar ID de la orden creada
  RETURN v_orden_id;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean) IS
  'Convierte un presupuesto aprobado en una orden de trabajo, copiando items del sistema y archivos adjuntos';

-- Grant acceso
GRANT EXECUTE ON FUNCTION fn_convertir_presupuesto_a_orden(uuid, timestamptz, text, boolean) TO authenticated;
