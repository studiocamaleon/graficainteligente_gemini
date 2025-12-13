-- v10: Cleanup and Final Name Resolution Priority
-- Goal: Drop ambiguity and set correct priority (Catalog > Description)

DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.fn_convertir_presupuesto_a_orden(uuid, timestamp with time zone);

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
  v_rutas jsonb;
  v_ruta_item jsonb;
  v_pasos jsonb;
  v_configuracion jsonb;
  v_final_name text;
  v_nombre_catalogo text;
  v_cliente_id uuid;
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
    prioridad,
    fecha_prometida,
    notas,
    origen_tipo,
    origen_id,
    total
  ) VALUES (
    v_presupuesto.company_id,
    v_presupuesto.cliente_id,
    v_presupuesto.vendedor_id,
    'pendiente', -- Estado inicial
    'normal',
    p_fecha_prometida,
    p_notas,
    'presupuesto',
    p_presupuesto_id,
    0
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

    -- ==================================================================================
    -- ESTRATEGIA DE RESOLUCION DE NOMBRE (V10)
    -- ==================================================================================
    v_final_name := NULL;

    -- 1. Intentar desde Configuración
    v_final_name := COALESCE(
        v_item.configuracion->>'producto_nombre',
        v_item.configuracion->>'nombre_producto',
        v_item.configuracion->>'nombre'
    );

    -- 2. Intentar desde columna producto_nombre (si no es 'Producto')
    IF v_final_name IS NULL OR v_final_name ILIKE 'Producto' THEN
        IF v_item.producto_nombre IS NOT NULL AND TRIM(v_item.producto_nombre) != '' AND v_item.producto_nombre NOT ILIKE 'Producto' THEN
            v_final_name := v_item.producto_nombre;
        END IF;
    END IF;

    -- 3. Intentar desde CATALOGO (Productos) usando ID [PRIORIDAD ALTA]
    IF (v_final_name IS NULL OR v_final_name ILIKE 'Producto') AND v_item.producto_id IS NOT NULL THEN
        SELECT nombre INTO v_nombre_catalogo
        FROM productos
        WHERE id = v_item.producto_id;

        IF v_nombre_catalogo IS NOT NULL THEN
           v_final_name := v_nombre_catalogo;
        END IF;
    END IF;

    -- 4. Intentar desde columna descripcion [FALLBACK]
    IF v_final_name IS NULL OR v_final_name ILIKE 'Producto' THEN
        IF v_item.descripcion IS NOT NULL AND LENGTH(v_item.descripcion) < 100 AND v_item.descripcion NOT ILIKE 'Producto' THEN
           v_final_name := v_item.descripcion;
        END IF;
    END IF;

    -- 5. Fallback Final
    IF v_final_name IS NULL OR v_final_name ILIKE 'Producto' THEN
        v_final_name := 'Item de Presupuesto (Sin Nombre)';
    END IF;
    -- ==================================================================================


    -- Insertar Item
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
         v_final_name,
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
         medidas,
         configuracion,
         archivos_adjuntos,
         rutas_produccion,
         precio_unitario,
         precio_total,
         estado
       ) VALUES (
         v_orden_id,
         v_tipo_item_orden::text,
         v_item.producto_id,
         v_final_name,
         v_item.cantidad,
         CASE 
           WHEN v_item.configuracion->>'medida_ancho' IS NOT NULL THEN 
             jsonb_build_object('ancho', v_item.configuracion->'medida_ancho', 'alto', v_item.configuracion->'medida_alto')
           ELSE '{}'::jsonb
         END,
         v_item.configuracion,
         '[]'::jsonb,
         v_item.rutas_generadas,
         v_item.precio_unitario_final,
         v_item.precio_total,
         'pendiente'
       );
    END IF;

  END LOOP;

  UPDATE presupuestos
  SET estado = 'convertido'
  WHERE id = p_presupuesto_id;

  RETURN v_orden_id;
END;
$$;
