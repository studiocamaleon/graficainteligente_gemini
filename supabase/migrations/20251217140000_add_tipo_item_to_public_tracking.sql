/*
  # Update Public Budget Tracking Function
  
  1. Changes
    - Add `tipo_item` field to the items array JSON object.
    
  2. Purpose
    - Enable frontend to distinguish between item types (Standard vs Copy Center)
    - Allow correct rendering of detailed configuration for Copy Center items
*/

CREATE OR REPLACE FUNCTION fn_get_public_presupuesto_tracking(p_tracking_token varchar)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Buscar presupuesto por tracking token
  SELECT jsonb_build_object(
    'id', p.id,
    'numero_presupuesto', p.numero_presupuesto,
    'estado', p.estado,
    'fecha_creacion', p.fecha_creacion,
    'fecha_validez', p.fecha_validez,
    'fecha_enviado', p.fecha_enviado,
    'fecha_respuesta', p.fecha_respuesta,
    'total', p.total,
    'subtotal', p.subtotal,
    'condiciones_comerciales', p.condiciones_comerciales,
    'observaciones_cliente', p.observaciones_cliente,
    'company', jsonb_build_object(
      'name', c.name,
      'razon_social', c.legal_name,
      'logo_url', c.logo_url,
      'telefono', c.contact_phone,
      'email', c.contact_email,
      'direccion', c.address,
      'sitio_web', c.website
    ),
    'cliente', jsonb_build_object(
      'razon_social', cl.razon_social,
      'email', cl.email,
      'whatsapp', cl.whatsapp
    ),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'tipo_item', pi.tipo_item, -- Added: Critical for frontend logic
          'producto_nombre', pi.producto_nombre,
          'producto_categoria', pi.producto_categoria,
          'descripcion', pi.descripcion,
          'configuracion', pi.configuracion,
          'cantidad', pi.cantidad,
          'precio_unitario_final', pi.precio_unitario_final,
          'precio_total', pi.precio_total,
          'tiempo_produccion_dias', pi.tiempo_produccion_dias
        ) ORDER BY pi.created_at
      )
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
    ),
    'orden_trabajo', CASE
      WHEN p.orden_trabajo_id IS NOT NULL THEN
        jsonb_build_object(
          'id', ot.id,
          'numero_orden', ot.numero_orden,
          'estado', ot.estado,
          'fecha_estimada_entrega', ot.fecha_estimada_entrega,
          'tracking_token', ot.tracking_token
        )
      ELSE NULL
    END
  ) INTO v_result
  FROM presupuestos p
  INNER JOIN companies c ON c.id = p.company_id
  LEFT JOIN clients cl ON cl.id = p.cliente_id
  LEFT JOIN ordenes_trabajo ot ON ot.id = p.orden_trabajo_id
  WHERE p.tracking_token = p_tracking_token;

  -- Si no se encontró el presupuesto
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Presupuesto no encontrado',
      'message', 'El token de tracking no es válido o el presupuesto no existe'
    );
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_get_public_presupuesto_tracking(varchar) IS
  'Obtiene información pública de un presupuesto mediante su tracking token. Incluye configuración de productos, tipo de item y nombre de empresa.';

GRANT EXECUTE ON FUNCTION fn_get_public_presupuesto_tracking(varchar) TO anon, authenticated;
