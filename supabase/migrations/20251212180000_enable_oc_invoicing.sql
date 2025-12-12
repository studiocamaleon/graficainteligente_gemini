-- Migration to enable independent Copy Orders in Invoices Module

-- 1. Add factura_storage_path to centro_copiado_ordenes
ALTER TABLE centro_copiado_ordenes 
ADD COLUMN IF NOT EXISTS factura_storage_path text;

-- 2. Drop strict Foreign Key on facturas_historial for orden_id to allow both OT and OC IDs
-- We keep the column but drop the constraint enforcing it must be an ordenes_trabajo ID
ALTER TABLE facturas_historial
DROP CONSTRAINT IF EXISTS facturas_historial_orden_id_fkey;

-- 3. Update fn_ordenes_pendientes_facturacion to include independent OCs
CREATE OR REPLACE FUNCTION fn_ordenes_pendientes_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_estado_facturacion text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_email text,
  cliente_whatsapp text,
  vendedor_id uuid,
  vendedor_nombre text,
  estado text,
  fecha_creacion timestamptz,
  fecha_estimada_entrega timestamptz,
  subtotal numeric,
  subtotal_iva numeric,
  total numeric,
  dias_pendiente integer,
  facturada boolean,
  numero_factura text,
  factura_storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- 1. Ordenes de Trabajo (Lógica existente)
  SELECT
    ot.id,
    ot.numero_orden,
    ot.cliente_id,
    c.razon_social as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    ot.vendedor_id,
    p.full_name as vendedor_nombre,
    ot.estado::text,
    ot.fecha_creacion,
    ot.fecha_estimada_entrega,
    ot.subtotal,
    ot.subtotal_iva,
    ot.total,
    EXTRACT(DAY FROM (now() - ot.fecha_creacion))::integer as dias_pendiente,
    ot.facturada,
    ot.numero_factura,
    ot.factura_storage_path
  FROM ordenes_trabajo ot
  INNER JOIN clients c ON c.id = ot.cliente_id
  INNER JOIN profiles p ON p.id = ot.vendedor_id
  WHERE ot.company_id = p_company_id
    AND ot.requiere_factura = true
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND ot.facturada = false)
      OR (p_estado_facturacion = 'facturada' AND ot.facturada = true)
    )
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)

  UNION ALL

  -- 2. Ordenes de Copiado Independientes (Nueva lógica)
  SELECT
    oc.id,
    oc.numero_orden,
    oc.cliente_id,
    c.nombre_fantasia as cliente_nombre, -- Usamos nombre_fantasia para clientes de copiado comúnmente, o fallback
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    oc.created_by as vendedor_id,
    p.full_name as vendedor_nombre,
    oc.estado::text,
    oc.created_at as fecha_creacion,
    oc.fecha_entrega_estimada::timestamptz,
    -- Calcular subtotal restando IVA si aplica.
    -- Total en OC ya incluye IVA si requiere_factura=true.
    -- Subtotal = Total / 1.21
    ROUND((oc.total / 1.21)::numeric, 2) as subtotal,
    (oc.total - ROUND((oc.total / 1.21)::numeric, 2)) as subtotal_iva,
    oc.total,
    EXTRACT(DAY FROM (now() - oc.created_at))::integer as dias_pendiente,
    (oc.numero_factura IS NOT NULL) as facturada, -- booleano derivado
    oc.numero_factura,
    oc.factura_storage_path
  FROM centro_copiado_ordenes oc
  LEFT JOIN clients c ON c.id = oc.cliente_id
  LEFT JOIN profiles p ON p.id = oc.created_by
  WHERE oc.company_id = p_company_id
    AND oc.requiere_factura = true
    AND oc.orden_trabajo_id IS NULL -- SOLO INDEPENDIENTES
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND oc.numero_factura IS NULL)
      OR (p_estado_facturacion = 'facturada' AND oc.numero_factura IS NOT NULL)
    )
    AND (p_fecha_desde IS NULL OR DATE(oc.created_at) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(oc.created_at) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR oc.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR oc.estado::text = p_estado)
  
  ORDER BY fecha_creacion DESC;
END;
$$;


-- 4. Update fn_registrar_factura to handle OCs
CREATE OR REPLACE FUNCTION fn_registrar_factura(
  p_orden_id uuid,
  p_numero_factura text,
  p_factura_storage_path text,
  p_observaciones text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tipo text; -- 'ot' o 'oc'
  v_orden_ot ordenes_trabajo%ROWTYPE;
  v_orden_oc centro_copiado_ordenes%ROWTYPE;
  v_cliente clients%ROWTYPE;
  v_company companies%ROWTYPE;
  v_result json;
  v_subtotal numeric;
  v_iva numeric;
  v_total numeric;
  v_company_id uuid;
  v_numero_orden text;
  v_cliente_id uuid;
BEGIN
  -- Determinar tipo de orden buscando primero en OT
  SELECT * INTO v_orden_ot FROM ordenes_trabajo WHERE id = p_orden_id;
  
  IF FOUND THEN
    v_tipo := 'ot';
    v_company_id := v_orden_ot.company_id;
    v_numero_orden := v_orden_ot.numero_orden;
    v_cliente_id := v_orden_ot.cliente_id;
    v_total := v_orden_ot.total;
    v_iva := v_orden_ot.subtotal_iva;
    v_subtotal := v_orden_ot.subtotal - COALESCE(v_orden_ot.total_descuentos, 0);

    IF NOT v_orden_ot.requiere_factura THEN
      RAISE EXCEPTION 'Esta orden no requiere factura. Número: %', v_numero_orden;
    END IF;
    IF v_orden_ot.facturada THEN
      RAISE EXCEPTION 'Esta orden ya tiene factura. Número: %', v_orden_ot.numero_factura;
    END IF;

    -- Update OT
    UPDATE ordenes_trabajo
    SET facturada = true,
        fecha_facturacion = now(),
        numero_factura = p_numero_factura,
        factura_storage_path = p_factura_storage_path,
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_orden_id;

  ELSE
    -- Buscar en Centro Copiado
    SELECT * INTO v_orden_oc FROM centro_copiado_ordenes WHERE id = p_orden_id;
    
    IF FOUND THEN
      v_tipo := 'oc';
      v_company_id := v_orden_oc.company_id;
      v_numero_orden := v_orden_oc.numero_orden;
      v_cliente_id := v_orden_oc.cliente_id;
      v_total := v_orden_oc.total;
      -- Cálculo inverso simple para OC
      v_subtotal := ROUND((v_orden_oc.total / 1.21)::numeric, 2);
      v_iva := v_total - v_subtotal;

      IF NOT v_orden_oc.requiere_factura THEN
         RAISE EXCEPTION 'Esta orden de copiado no requiere factura. Número: %', v_numero_orden;
      END IF;
      IF v_orden_oc.numero_factura IS NOT NULL THEN
         RAISE EXCEPTION 'Esta orden de copiado ya tiene factura. Número: %', v_orden_oc.numero_factura;
      END IF;

      -- Update OC
      UPDATE centro_copiado_ordenes
      SET numero_factura = p_numero_factura,
          factura_storage_path = p_factura_storage_path,
          updated_at = now()
      WHERE id = p_orden_id;
      
    ELSE
      RAISE EXCEPTION 'Orden no encontrada con ID: %', p_orden_id;
    END IF;
  END IF;

  -- Common logic: Get Company & Client info
  SELECT * INTO v_company FROM companies WHERE id = v_company_id;
  SELECT * INTO v_cliente FROM clients WHERE id = v_cliente_id;

  -- Insert History
  INSERT INTO facturas_historial (
    orden_id,
    company_id,
    numero_factura,
    monto_subtotal,
    monto_iva,
    monto_total,
    factura_storage_path,
    tipo_operacion,
    observaciones,
    created_by
  ) VALUES (
    p_orden_id,
    v_company_id,
    p_numero_factura,
    v_subtotal,
    v_iva,
    v_total,
    p_factura_storage_path,
    'creacion',
    p_observaciones,
    p_user_id
  );

  -- Return Result
  v_result := json_build_object(
    'orden_id', p_orden_id,
    'numero_orden', v_numero_orden,
    'numero_factura', p_numero_factura,
    'cliente_nombre', v_cliente.razon_social, -- fallback to razonsocial if exists
    'cliente_whatsapp', v_cliente.whatsapp,
    'cliente_email', v_cliente.email,
    'company_id', v_company_id,
    'company_name', v_company.name,
    'factura_storage_path', p_factura_storage_path,
    'total', v_total,
    'subtotal_iva', v_iva,
    'fecha_facturacion', now()
  );

  RETURN v_result;

END;
$$;
