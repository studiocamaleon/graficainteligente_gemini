-- v12: Final Fix for Budget Conversion
-- Goal: Correctly map columns based on verified schema.
-- Key Fix: Map presupuestos_items.producto_nombre -> ordenes_trabajo_items.producto_nombre DIRECTLY.

-- 1. Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone, text, numeric, uuid, text, jsonb, boolean);

-- 2. Create the Correct Function
CREATE OR REPLACE FUNCTION public.fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_prometida timestamp with time zone,
  p_notas text DEFAULT NULL::text
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
  -- Mapeo verificado:
  -- fecha_prometida -> fecha_estimada_entrega
  -- p_notas -> notas_internas
  -- canal_venta -> canal_venta
  -- presupuesto_id -> presupuesto_id
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
    subtotal,         -- Required column (numeric)
    total_descuentos, -- Required column (numeric)
    requiere_factura, -- Required column (boolean)
    subtotal_iva,     -- Required column (numeric)
    facturada,        -- Required column (boolean)
    created_at,
    updated_at
  ) VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_presupuesto.vendedor_id,
    'pendiente', 
    COALESCE(v_presupuesto.canal_venta, 'Mostrador'), -- Fallback just in case
    p_fecha_prometida,
    p_notas,
    p_presupuesto_id,
    0, -- total (placeholder, should be calc)
    0, -- subtotal
    0, -- total_descuentos
    false, -- requiere_factura default
    0, -- subtotal_iva
    false, -- facturada
    NOW(),
    NOW()
  ) RETURNING id INTO v_orden_id;

  -- 3. Migrar Items
  FOR v_item IN 
    SELECT * FROM presupuestos_items WHERE presupuesto_id = p_presupuesto_id
  LOOP
    v_tipo_item_orden := CASE
      WHEN v_item.tipo_item = 'producto_sistema' THEN 'catalogo'
      WHEN v_item.tipo_item = 'item_personalizado' THEN 'personalizado'
      ELSE 'catalogo'
    END;

    -- Insertar Item
    -- Mapeo verificado:
    -- v_item.producto_nombre -> producto_nombre (DIRECTO)
    -- v_item.descripcion -> descripcion
    -- NO EXISTE: medidas, archivos_adjuntos, rutas_produccion en ordenes_trabajo_items
    -- REQUIRED: precio_base, precio_servicios, precio_acabados
    
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
         v_item.producto_nombre, -- Usar nombre directo aka "Servicio X"
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
         producto_nombre,  -- <--- CRITICAL FIX
         producto_categoria,
         estado,
         precio_base,      -- Required default
         precio_servicios, -- Required default
         precio_acabados,  -- Required default
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
         v_item.producto_nombre, -- DIRECT MAPPING
         v_item.producto_categoria,
         'pendiente',
         v_item.precio_unitario_final, -- Assuming base is total unit for now
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
