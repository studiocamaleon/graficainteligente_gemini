-- Migration v9: Fix Tax Logic with Conditional 'requiere_factura'
-- DESCRIPTION:
-- 1. Adds 'requiere_factura' column to ordenes_trabajo if missing.
-- 2. Updates total calculation function to apply 21% VAT ONLY if requiere_factura is TRUE.
-- 3. Adds trigger to update total when requiere_factura changes.
-- 4. Updates conversion function to pass Net prices and set the invoice flag.

-- 1. Add Column
ALTER TABLE public.ordenes_trabajo 
ADD COLUMN IF NOT EXISTS requiere_factura boolean DEFAULT false;

-- 2. Update Calculation Function
CREATE OR REPLACE FUNCTION public.fn_calcular_total_consolidado_orden(p_orden_trabajo_id uuid)
 RETURNS TABLE(subtotal_items numeric, subtotal_ordenes_copiado numeric, subtotal_total numeric, descuentos numeric, subtotal_con_descuentos numeric, iva numeric, total_final numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_subtotal_ot numeric;
  v_descuentos_ot numeric;
  v_requiere_factura boolean;
  v_subtotal_oc numeric;
  v_subtotal_combinado numeric;
  v_subtotal_con_desc numeric;
  v_iva_calculado numeric;
  v_total_calculado numeric;
BEGIN
  -- Obtener subtotal, descuentos Y configuracion de factura de la orden de trabajo
  SELECT
    COALESCE(ot.subtotal, 0),
    COALESCE(ot.total_descuentos, 0),
    COALESCE(ot.requiere_factura, false)
  INTO v_subtotal_ot, v_descuentos_ot, v_requiere_factura
  FROM ordenes_trabajo ot
  WHERE ot.id = p_orden_trabajo_id;

  -- Si no existe la orden, retornar ceros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Obtener total de la orden de copiado asociada (si existe)
  SELECT COALESCE(oc.total, 0)
  INTO v_subtotal_oc
  FROM centro_copiado_ordenes oc
  WHERE oc.orden_trabajo_id = p_orden_trabajo_id
  AND oc.estado != 'cancelada';

  -- Si no hay OC asociada, usar 0
  v_subtotal_oc := COALESCE(v_subtotal_oc, 0);

  -- Calcular subtotal combinado
  v_subtotal_combinado := v_subtotal_ot + v_subtotal_oc;

  -- Aplicar descuentos sobre el total combinado
  v_subtotal_con_desc := v_subtotal_combinado - v_descuentos_ot;

  -- Calcular IVA (21%) SOLO SI requiere_factura es TRUE
  IF v_requiere_factura THEN
      v_iva_calculado := v_subtotal_con_desc * 0.21;
  ELSE
      v_iva_calculado := 0;
  END IF;

  -- Total final
  v_total_calculado := v_subtotal_con_desc + v_iva_calculado;

  -- Retornar todos los valores calculados
  RETURN QUERY SELECT
    v_subtotal_ot,
    v_subtotal_oc,
    v_subtotal_combinado,
    v_descuentos_ot,
    v_subtotal_con_desc,
    v_iva_calculado,
    v_total_calculado;
END;
$function$;

-- 3. Add Trigger for Recalculation on Flag Change
-- We reuse the valid logic from fn_actualizar_total_orden_trabajo but called from OT trigger context
CREATE OR REPLACE FUNCTION fn_trigger_recalcular_total_por_factura()
RETURNS TRIGGER AS $$
DECLARE
  v_totales RECORD;
BEGIN
  -- Recalculate if requiere_factura changed
  IF OLD.requiere_factura IS DISTINCT FROM NEW.requiere_factura THEN
      SELECT * INTO v_totales
      FROM fn_calcular_total_consolidado_orden(NEW.id);
      
      -- Update total directly. 
      -- NOTE: We must avoid infinite recursion. This trigger should be AFTER UPDATE.
      -- However, updating the row inside AFTER UPDATE can trigger it again. 
      -- But we condition on 'requiere_factura' change. Updating 'total' won't trigger this again.
      
      UPDATE ordenes_trabajo
      SET total = v_totales.total_final,
          updated_at = now()
      WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalcular_total_por_factura ON ordenes_trabajo;
CREATE TRIGGER trg_recalcular_total_por_factura
AFTER UPDATE OF requiere_factura ON ordenes_trabajo
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_recalcular_total_por_factura();

-- 4. Update Conversion Function
CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
    p_presupuesto_id uuid,
    p_fecha_entrega_estimada timestamp with time zone,
    p_notas_adicionales text DEFAULT NULL::text,
    p_monto_pago numeric DEFAULT NULL::numeric,
    p_medio_cobro_id uuid DEFAULT NULL::uuid,
    p_referencia_pago text DEFAULT NULL::text,
    p_rutas_personalizadas jsonb DEFAULT NULL::jsonb,
    p_requiere_factura boolean DEFAULT false
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
  v_total_ot numeric := 0;
  -- v_tax_divisor numeric := 1.21; -- REMOVED: Prices are NET, tax is added by trigger if needed.
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
      -- Accumulate total (Prices are stored as is - NET)
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
        v_item.precio_unitario_final, -- RAW NET
        v_item.precio_total,          -- RAW NET
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
    
    -- CALCULAR TOTALES PARA OT (Excluyendo Copiado)
    SELECT COALESCE(SUM(precio_total), 0)
    INTO v_total_ot
    FROM presupuestos_items 
    WHERE presupuesto_id = p_presupuesto_id 
    AND tipo_item != 'centro_copiado';

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
      created_by,
      requiere_factura -- SET NEW FLAG
    ) VALUES (
      v_presupuesto.company_id,
      v_presupuesto.cliente_id,
      v_presupuesto.vendedor_id,
      v_presupuesto.canal_venta,
      generate_numero_orden(v_presupuesto.company_id),
      p_fecha_entrega_estimada,
      COALESCE(p_notas_adicionales, v_presupuesto.notas_internas),
      v_total_ot, -- Insert RAW NET
      0,          
      v_total_ot, -- Insert RAW NET (Trigger will apply tax if flag is true)
      'pendiente',
      auth.uid(),
      p_requiere_factura -- Flag passed from UI
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
        -- Accumulate NET total
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
          v_item.precio_unitario_final, -- RAW NET
          v_item.precio_total,          -- RAW NET
          v_item.descripcion
        );
      END LOOP;

       -- Update Total (NET)
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
        tipo_item,
        producto_id,
        descripcion, 
        cantidad,
        precio_base,
        precio_servicios,
        precio_acabados,
        precio_unitario_final, 
        precio_total,
        configuracion
      ) VALUES (
        v_orden_id,
        v_tipo_item_orden,
        v_item.producto_id,
        COALESCE(v_item.descripcion, v_item.producto_nombre, 'Item de Presupuesto'), 
        v_item.cantidad,
        v_item.precio_base, -- RAW NET
        v_item.precio_servicios,
        v_item.precio_acabados,
        v_item.precio_unitario_final, 
        v_item.precio_total,
        COALESCE(v_item.configuracion, '{}'::jsonb)
      ) RETURNING id INTO v_nuevo_item_id;

      -- Generar rutas (5 args call)
      IF v_item.tipo_item = 'producto_sistema' AND v_item.producto_id IS NOT NULL THEN
        BEGIN
          SELECT fn_generar_ruta_produccion_item(
            v_nuevo_item_id,
            v_item.producto_id,
            v_item.producto_categoria, -- Param 3
            COALESCE(v_item.configuracion, '{}'::jsonb), -- Param 4
            v_presupuesto.company_id -- Param 5
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

    -- Force Update Trigger to run and apply tax if needed
    -- (Though the AFTER INSERT trigger on Items usually updates subtotal, which triggers Order update)
    -- We can manually call 'fn_actualizar_total_orden_trabajo' via an update if strict necessary.
    -- But since we set 'requiere_factura' in INSERT, subsequent item insertions will trigger recalculations respecting it.
    
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
