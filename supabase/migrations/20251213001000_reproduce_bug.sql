
CREATE OR REPLACE FUNCTION public.fn_reproduce_bug()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_cliente_id uuid;
  v_user_id uuid;
  v_presupuesto_id uuid;
  v_orden_id uuid;
  v_result jsonb;
  v_producto_id uuid;
  v_categoria_id uuid;
BEGIN
  -- 1. Setup Data (Get first company/client/user)
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  SELECT id INTO v_cliente_id FROM clients WHERE company_id = v_company_id LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  -- Create dummy system category
  INSERT INTO categorias (company_id, nombre, color, is_system_category, is_active)
  VALUES (NULL, 'Dummy Category', '#000000', true, true)
  RETURNING id INTO v_categoria_id;

  -- Create dummy product (fulfilling constraints)
  INSERT INTO productos (
    company_id, nombre, categoria_id, is_active,
    medidas_ancho, medidas_alto, tipo_medida, 
    caras_impresas, producto_impreso
  )
  VALUES (
    v_company_id, 'Dummy Product', v_categoria_id, true,
    10, 10, 'medida_unica', 
    '{solo_frente}', false
  )
  RETURNING id INTO v_producto_id;

  INSERT INTO presupuestos (
    company_id, cliente_id, vendedor_id, estado, canal_venta, fecha_validez, numero_presupuesto
  ) VALUES (
    v_company_id, v_cliente_id, v_user_id, 'aprobado', 'Mostrador', NOW() + interval '30 days', 'TEST-BUG-' || floor(random()*1000)::text
  ) RETURNING id INTO v_presupuesto_id;

  -- 3. Insert Problematic Item (Simulation of "Vinilo Estandar")
  INSERT INTO presupuestos_items (
    presupuesto_id,
    tipo_item,
    producto_nombre,
    descripcion,
    cantidad,
    precio_unitario_final,
    precio_total,
    producto_id,
    configuracion
  ) VALUES (
    v_presupuesto_id,
    'producto_sistema',
    'Producto', -- Generic name
    'Descripcion del item',
    1,
    100,
    100,
    v_producto_id,
    '{"categoria": "Gran Formato"}'::jsonb -- Config without name
  );

  -- 4. Convert to Order (Legacy Signature: 8 arguments)
  v_orden_id := fn_convertir_presupuesto_a_orden(
    v_presupuesto_id,
    NOW()::timestamptz, -- fecha_entrega_estimada
    'Test note'::text,  -- notas_adicionales
    NULL::numeric,      -- monto_pago
    NULL::uuid,         -- medio_cobro_id
    NULL::text,         -- referencia_pago
    NULL::jsonb,        -- rutas_personalizadas
    false               -- requiere_factura
  );

  -- 5. Inspect Result
  SELECT jsonb_agg(jsonb_build_object(
    'id', oti.id,
    'tipo_item', oti.tipo_item,
    'producto_id', oti.producto_id,
    'descripcion', oti.descripcion,
    'nombre_real_producto', oti.producto_nombre
  ))
  INTO v_result
  FROM ordenes_trabajo_items AS oti
  WHERE orden_id = v_orden_id;
  
  -- Cleanup (Optional, keep for inspection?)
  -- DELETE FROM ordenes_trabajo_items WHERE orden_id = v_orden_id;
  -- DELETE FROM ordenes_trabajo WHERE id = v_orden_id;
  -- DELETE FROM presupuestos_items WHERE presupuesto_id = v_presupuesto_id;
  -- DELETE FROM presupuestos WHERE id = v_presupuesto_id;

  RETURN v_result;
END;
$$;
