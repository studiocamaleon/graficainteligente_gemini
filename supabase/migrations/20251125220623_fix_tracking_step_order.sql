/*
  # Corregir Orden de Pasos en Tracking Público

  ## Descripción
  Actualiza la función RPC fn_get_public_order_tracking para ordenar los pasos
  correctamente por tipo_etapa (pre_prensa → principal → post_prensa) y luego por orden.

  ## Problema
  Actualmente solo ordena por `orden`, lo que resulta en pasos desordenados cuando
  diferentes etapas tienen el mismo número de orden.

  ## Solución
  Usar CASE en ORDER BY para priorizar tipo_etapa antes que orden:
  - pre_prensa = 1
  - principal = 2
  - post_prensa = 3

  ## Impacto
  Los pasos ahora aparecerán en la secuencia correcta de producción en la vista
  de tracking público.
*/

-- =====================================================
-- 1. RECREAR FUNCIÓN CON ORDEN CORRECTO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_get_public_order_tracking(
  p_tracking_token VARCHAR(32)
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validar formato del token
  IF p_tracking_token IS NULL OR
     length(p_tracking_token) != 32 OR
     p_tracking_token !~ '^[A-Z0-9]{32}$' THEN
    RETURN json_build_object(
      'error', 'Token inválido',
      'message', 'El token debe tener 32 caracteres alfanuméricos'
    );
  END IF;

  -- Construir respuesta con todos los datos
  SELECT json_build_object(
    'numero_orden', ot.numero_orden,
    'estado', ot.estado,
    'fecha_creacion', ot.fecha_creacion,
    'fecha_estimada_entrega', ot.fecha_estimada_entrega,
    'cliente_nombre', COALESCE(c.nombre_fantasia, 'Cliente'),
    'items', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', oti.id,
          'producto_nombre', oti.producto_nombre,
          'producto_categoria', oti.producto_categoria,
          'cantidad', oti.cantidad,
          'estado', oti.estado,
          'pasos', (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', otir.id,
                'paso_nombre', otir.paso_nombre,
                'tipo_etapa', otir.tipo_etapa,
                'orden', otir.orden,
                'estado_paso', otir.estado_paso,
                'fecha_inicio', otir.fecha_inicio,
                'fecha_fin', otir.fecha_fin,
                'comentario_vendedor', otir.comentario_vendedor
              ) ORDER BY 
                -- Primero por tipo de etapa (pre_prensa, principal, post_prensa)
                CASE otir.tipo_etapa
                  WHEN 'pre_prensa' THEN 1
                  WHEN 'principal' THEN 2
                  WHEN 'post_prensa' THEN 3
                  ELSE 4
                END,
                -- Luego por orden dentro de cada etapa
                otir.orden
            ), '[]'::json)
            FROM ordenes_trabajo_items_rutas otir
            WHERE otir.orden_item_id = oti.id
          )
        ) ORDER BY oti.created_at
      ), '[]'::json)
      FROM ordenes_trabajo_items oti
      WHERE oti.orden_id = ot.id
    )
  ) INTO v_result
  FROM ordenes_trabajo ot
  LEFT JOIN clients c ON c.id = ot.cliente_id
  WHERE ot.tracking_token = p_tracking_token;

  -- Si no se encuentra la orden
  IF v_result IS NULL THEN
    RETURN json_build_object(
      'error', 'Orden no encontrada',
      'message', 'No existe una orden con este token de seguimiento'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_get_public_order_tracking IS
'Función pública que retorna datos de tracking de una orden mediante su token único. 
Los pasos se ordenan por tipo_etapa (pre_prensa, principal, post_prensa) y luego por orden.';