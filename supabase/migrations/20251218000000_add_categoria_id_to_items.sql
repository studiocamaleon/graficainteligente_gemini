
-- Agregar columna categoria_id a ordenes_trabajo_items
ALTER TABLE ordenes_trabajo_items 
ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES categorias(id) ON DELETE SET NULL;

-- Agregar columna categoria_id a presupuestos_items
ALTER TABLE presupuestos_items 
ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES categorias(id) ON DELETE SET NULL;

-- Comentario para auditoría
COMMENT ON COLUMN ordenes_trabajo_items.categoria_id IS 'Referencia a la categoría del producto para facilitar la hidratación en el wizard';
COMMENT ON COLUMN presupuestos_items.categoria_id IS 'Referencia a la categoría del producto para facilitar la hidratación en el wizard';

-- Actualizar función de conversión para incluir categoria_id
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
    p_fecha_prometida,
    p_notas,
    p_presupuesto_id,
    0,
    0,
    0,
    false,
    0,
    false,
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
         categoria_id,
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
         v_item.categoria_id,
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
