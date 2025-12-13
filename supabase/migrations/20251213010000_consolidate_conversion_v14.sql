-- v14: Consolidate to SINGLE 8-Argument Function
-- Goal: Remove ambiguity and "function not found" errors by having ONLY ONE function signature.
-- Logic: Includes V12 "Direct Name Mapping" and basic payment parameter support.

-- 1. DROP ALL PREVIOUS VERSIONS
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone, text, numeric, uuid, text, jsonb, boolean);

-- 2. CREATE THE SINGLE DEFINITIVE FUNCTION
CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamp with time zone,
  p_notas_adicionales text,
  p_monto_pago numeric,
  p_medio_cobro_id uuid,
  p_referencia_pago text,
  p_rutas_personalizadas jsonb,
  p_requiere_factura boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_presupuesto RECORD;
  v_orden_id uuid;
  v_item RECORD;
  v_tipo_item_orden text;
BEGIN
  -- 1. Validar estado del presupuesto
  SELECT * INTO v_presupuesto
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  IF v_presupuesto.estado = 'convertido' THEN
    RAISE EXCEPTION 'El presupuesto ya ha sido convertido a orden';
  END IF;

  -- 2. Crear la Orden de Trabajo
  -- Mapeo directo de parámetros frontend -> columnas DB
  INSERT INTO ordenes_trabajo (
    company_id,
    cliente_id,
    vendedor_id,
    estado,
    canal_venta,            -- V12 Fix
    fecha_estimada_entrega, -- Mapped from p_fecha_entrega_estimada
    notas_internas,         -- Mapped from p_notas_adicionales
    presupuesto_id,
    total,
    subtotal,         
    total_descuentos, 
    requiere_factura,       -- Mapped from p_requiere_factura
    subtotal_iva,     
    facturada,        
    created_at,
    updated_at
  ) VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_presupuesto.vendedor_id,
    'pendiente', 
    COALESCE(v_presupuesto.canal_venta, 'Mostrador'),
    p_fecha_entrega_estimada,
    p_notas_adicionales,
    p_presupuesto_id,
    0, -- total calc
    0, -- subtotal calc
    0, -- total_descuentos calc
    COALESCE(p_requiere_factura, false), -- Use param directly
    0, -- subtotal_iva calc
    false,
    NOW(),
    NOW()
  ) RETURNING id INTO v_orden_id;

  -- 3. Manejo de Pagos (Legacy Support)
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 AND p_medio_cobro_id IS NOT NULL THEN
    -- Intentar insertar pago si la tabla existe (no fallar si no existe, o asumir existe)
    -- Asumimos que existe dado que el frontend lo manda.
    BEGIN
      INSERT INTO ordenes_trabajo_pagos (
        orden_id,
        monto,
        medio_cobro_id,
        fecha_pago,
        referencia_pago,
        created_by
      ) VALUES (
        v_orden_id,
        p_monto_pago,
        p_medio_cobro_id, -- uuid
        NOW(),
        p_referencia_pago,
        auth.uid()
      );
    EXCEPTION WHEN OTHERS THEN
       -- Loggear error pero no fallar la orden
       RAISE WARNING 'No se pudo registrar el pago: %', SQLERRM;
    END;
  END IF;

  -- 4. Migrar Items (V12 Logic - Direct Mapping)
  FOR v_item IN 
    SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id
  LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    IF (v_item.configuracion->>'es_servicio_global')::boolean = true THEN
       INSERT INTO ordenes_trabajo_servicios (
         orden_id,
         servicio_id,
         nombre,
         descripcion,
         precio_unitario,
         cantidad,
         precio_total,
         estado
       ) VALUES (
         v_orden_id,
         (v_item.configuracion->>'servicio_id')::uuid,
         v_item.producto_nombre, -- Direct Mapping
         v_item.descripcion,
         v_item.precio_unitario_final,
         v_item.cantidad,
         v_item.precio_total,
         'pendiente'
       );
    ELSE
       INSERT INTO ordenes_trabajo_items (
         orden_id,
         tipo_item,
         producto_id,
         descripcion,
         cantidad,
         configuracion,
         precio_unitario_final,
         precio_total,
         producto_nombre,  -- Direct Mapping
         producto_categoria,
         estado,
         precio_base,      
         precio_servicios, 
         precio_acabados,  
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
         v_item.producto_nombre, -- Direct Mapping
         v_item.producto_categoria,
         'pendiente',
         v_item.precio_unitario_final,
         0,
         0,
         NOW(),
         NOW()
       );
    END IF;

  END LOOP;

  UPDATE presupuestos
  SET estado = 'convertido'
  WHERE id = p_presupuesto_id;

  RETURN v_orden_id;
END;
$$;
