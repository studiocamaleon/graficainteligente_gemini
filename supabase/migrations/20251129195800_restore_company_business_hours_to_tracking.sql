/*
  # Restaurar company_business_hours a función de tracking público

  ## Problema
  La migración 20251129191431 sobrescribió la función fn_get_public_order_tracking
  eliminando el campo company_business_hours que había sido agregado anteriormente.
  Esto causa que el frontend reciba undefined cuando intenta mostrar los horarios
  de atención de la empresa en el tracking público.

  ## Solución
  Recrear la función fn_get_public_order_tracking manteniendo todos los campos
  actuales (company_name, company_address, company_phone, información de pausas)
  y restaurando el campo company_business_hours.

  ## Cambios
  1. Mantiene todos los campos actuales de la función
  2. Agrega de vuelta company_business_hours con query completo
  3. Incluye información de pausas (cantidad_pausas, pausa_info)
  4. Ordena horarios por day_of_week ascendente

  ## Impacto
  - El tracking público mostrará correctamente los horarios de atención
  - Los clientes sabrán cuándo pueden retirar sus pedidos
  - Mejor experiencia de usuario en el tracking público

  Fecha: 2025-11-29
*/

-- Recrear función con company_business_hours restaurado
DROP FUNCTION IF EXISTS fn_get_public_order_tracking(text);

CREATE OR REPLACE FUNCTION fn_get_public_order_tracking(p_tracking_token text)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ot.id,
    'numero_orden', ot.numero_orden,
    'estado', ot.estado,
    'fecha_creacion', ot.fecha_creacion,
    'fecha_estimada_entrega', ot.fecha_estimada_entrega,
    'cliente_nombre', COALESCE(c.nombre_fantasia, c.razon_social),
    'company_id', ot.company_id,
    'company_name', comp.name,
    'company_address', comp.address,
    'company_phone', comp.contact_phone,
    'company_business_hours', COALESCE((
      SELECT json_agg(json_build_object(
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
      ) ORDER BY cbh.day_of_week)
      FROM company_business_hours cbh
      WHERE cbh.company_id = ot.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', oti.id,
        'producto_nombre', oti.producto_nombre,
        'producto_categoria', oti.producto_categoria,
        'cantidad', oti.cantidad,
        'estado', oti.estado,
        'pasos', COALESCE((
          SELECT json_agg(json_build_object(
            'id', otir.id,
            'paso_nombre', otir.paso_nombre,
            'tipo_etapa', otir.tipo_etapa,
            'orden', otir.orden,
            'estado_paso', otir.estado_paso,
            'fecha_inicio', otir.fecha_inicio,
            'fecha_fin', otir.fecha_fin,
            'cantidad_pausas', otir.cantidad_pausas,
            'pausa_info', CASE
              WHEN otir.estado_paso = 'pausado' THEN
                (
                  SELECT json_build_object(
                    'esta_pausado', true,
                    'categoria_motivo', p.categoria_motivo,
                    'fecha_inicio_pausa', p.fecha_inicio_pausa,
                    'tiempo_pausado_horas', ROUND(
                      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 3600, 1
                    )
                  )
                  FROM ordenes_items_rutas_pausas p
                  WHERE p.ruta_id = otir.id
                  AND p.fecha_fin_pausa IS NULL
                  LIMIT 1
                )
              ELSE
                json_build_object('esta_pausado', false)
            END
          ) ORDER BY otir.orden)
          FROM ordenes_trabajo_items_rutas otir
          WHERE otir.orden_item_id = oti.id
        ), '[]'::json)
      ) ORDER BY oti.created_at)
      FROM ordenes_trabajo_items oti
      WHERE oti.orden_id = ot.id
    ), '[]'::json)
  ) INTO v_result
  FROM ordenes_trabajo ot
  LEFT JOIN clients c ON c.id = ot.cliente_id
  LEFT JOIN companies comp ON comp.id = ot.company_id
  WHERE ot.tracking_token = p_tracking_token
  AND ot.tracking_token IS NOT NULL;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_get_public_order_tracking IS
'Obtiene información de seguimiento público de una orden usando tracking_token.
V3.0: Incluye company_business_hours, información de pausas activas, y todos los campos de company actualizados (name, address, contact_phone).';