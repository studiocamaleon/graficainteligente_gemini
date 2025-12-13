-- v15: Fix Signature Mismatch (Support 7-arg and 8-arg calls)
-- Goal: Add DEFAULT values to optional parameters so the function matches 
-- calls from both `usePresupuestos.ts` (7 args) and `useConvertirPresupuesto.ts` (8 args).

-- 1. DROP PREVIOUS VERSION TO ENSURE CLEAN REPLACE
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(
  uuid, timestamp with time zone, text, numeric, uuid, text, jsonb, boolean
);

-- 2. CREATE FUNCTION WITH DEFAULTS
CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamp with time zone,
  p_notas_adicionales text DEFAULT NULL,
  p_monto_pago numeric DEFAULT NULL,
  p_medio_cobro_id uuid DEFAULT NULL,
  p_referencia_pago text DEFAULT NULL,
  p_rutas_personalizadas jsonb DEFAULT NULL,
  p_requiere_factura boolean DEFAULT false -- <--- The key fix: Default allowed calls missing this param
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
    0, 
    0, 
    0, 
    COALESCE(p_requiere_factura, false),
    0, 
    false,
    NOW(),
    NOW()
  ) RETURNING id INTO v_orden_id;

  -- 3. Manejo de Pagos (Si se envían parámetros)
  IF p_monto_pago IS NOT NULL AND p_monto_pago > 0 AND p_medio_cobro_id IS NOT NULL THEN
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
        p_medio_cobro_id,
        NOW(),
        p_referencia_pago,
        auth.uid()
      );
    EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'No se pudo registrar el pago: %', SQLERRM;
    END;
  END IF;

  -- 4. Migrar Items (Nombre Correcto)
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
         v_item.producto_nombre, 
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
         producto_nombre,
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
         v_item.producto_nombre,
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
