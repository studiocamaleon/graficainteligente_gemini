/*
  # Función RPC para Obtener Datos de Tracking Público

  ## Descripción
  Función pública que retorna todos los datos necesarios para mostrar el tracking
  de una orden mediante su token, sin requerir autenticación.

  ## Parámetros
  - `p_tracking_token`: Token único de 32 caracteres de la orden

  ## Retorna
  JSON con estructura:
  {
    "numero_orden": "ORD-2024-001",
    "estado": "en_proceso",
    "fecha_creacion": "2024-01-15T10:30:00Z",
    "fecha_estimada_entrega": "2024-01-20T18:00:00Z",
    "cliente_nombre": "Cliente S.A.",
    "items": [
      {
        "id": "uuid",
        "producto_nombre": "Tarjetas",
        "cantidad": 500,
        "estado": "en_proceso",
        "pasos": [
          {
            "id": "uuid",
            "paso_nombre": "Pre-prensa",
            "tipo_etapa": "pre_prensa",
            "orden": 1,
            "estado_paso": "completado",
            "fecha_inicio": "2024-01-15T11:00:00Z",
            "fecha_fin": "2024-01-15T12:00:00Z",
            "comentario_vendedor": "..."
          }
        ]
      }
    ]
  }

  ## Seguridad
  - Solo lectura (SELECT)
  - No expone precios ni información financiera
  - No expone notas internas sensibles
  - Accesible para usuarios anónimos (anon)
  - SECURITY DEFINER para acceso controlado
*/

-- =====================================================
-- 1. CREAR FUNCIÓN RPC
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
              ) ORDER BY otir.orden
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
-- 2. OTORGAR PERMISOS A USUARIOS ANÓNIMOS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_get_public_order_tracking TO anon;
GRANT EXECUTE ON FUNCTION fn_get_public_order_tracking TO authenticated;

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION fn_get_public_order_tracking IS
'Función pública que retorna datos de tracking de una orden mediante su token único, accesible sin autenticación';