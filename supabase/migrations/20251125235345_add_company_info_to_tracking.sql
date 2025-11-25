/*
  # Agregar Información de Empresa al Tracking Público

  ## Descripción
  Actualiza la función RPC fn_get_public_order_tracking para incluir información
  de la empresa (dirección y horarios de atención) en la respuesta de tracking público.

  ## Cambios
  1. Agrega campo `company_id` con el ID de la empresa
  2. Agrega campo `company_address` con la dirección completa de la empresa
  3. Agrega campo `company_business_hours` con array de horarios por día

  ## Formato de Horarios
  Los horarios se devuelven como array de objetos con:
  - day_of_week: número del día (0=Domingo, 6=Sábado)
  - day_name: nombre del día en español
  - is_open: booleano indicando si está abierto
  - opening_time_1, closing_time_1: primer rango horario
  - opening_time_2, closing_time_2: segundo rango horario (opcional)

  ## Impacto
  Los clientes verán la dirección real y horarios configurados de la empresa
  en lugar de datos hardcodeados en el tracking público.
*/

-- =====================================================
-- 1. RECREAR FUNCIÓN CON INFORMACIÓN DE EMPRESA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_get_public_order_tracking(
  p_tracking_token VARCHAR(32)
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_company_id UUID;
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

  -- Obtener company_id de la orden
  SELECT company_id INTO v_company_id
  FROM ordenes_trabajo
  WHERE tracking_token = p_tracking_token;

  -- Si no se encuentra la orden
  IF v_company_id IS NULL THEN
    RETURN json_build_object(
      'error', 'Orden no encontrada',
      'message', 'No existe una orden con este token de seguimiento'
    );
  END IF;

  -- Construir respuesta con todos los datos
  SELECT json_build_object(
    'numero_orden', ot.numero_orden,
    'estado', ot.estado,
    'fecha_creacion', ot.fecha_creacion,
    'fecha_estimada_entrega', ot.fecha_estimada_entrega,
    'cliente_nombre', COALESCE(c.nombre_fantasia, 'Cliente'),
    'company_id', ot.company_id,
    'company_address', comp.address,
    'company_business_hours', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'day_of_week', cbh.day_of_week,
          'day_name', CASE cbh.day_of_week
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Lunes'
            WHEN 2 THEN 'Martes'
            WHEN 3 THEN 'Miércoles'
            WHEN 4 THEN 'Jueves'
            WHEN 5 THEN 'Viernes'
            WHEN 6 THEN 'Sábado'
            ELSE 'Desconocido'
          END,
          'is_open', cbh.is_open,
          'opening_time_1', cbh.opening_time_1,
          'closing_time_1', cbh.closing_time_1,
          'opening_time_2', cbh.opening_time_2,
          'closing_time_2', cbh.closing_time_2
        ) ORDER BY cbh.day_of_week
      ), '[]'::json)
      FROM company_business_hours cbh
      WHERE cbh.company_id = ot.company_id
    ),
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
  LEFT JOIN companies comp ON comp.id = ot.company_id
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
Incluye información de la empresa (dirección y horarios de atención).
Los pasos se ordenan por tipo_etapa (pre_prensa, principal, post_prensa) y luego por orden.';