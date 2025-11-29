/*
  # Fix: Corregir campos de company en función de tracking

  ## Problema
  La función fn_get_public_order_tracking usa nombres de columnas incorrectos:
  - comp.direccion → debe ser comp.address
  - comp.telefono → debe ser comp.contact_phone

  ## Solución
  Actualizar la función con los nombres correctos del esquema de companies.

  Fecha: 2025-11-30
*/

-- Recrear función con nombres correctos
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
    'company_name', comp.name,
    'company_address', comp.address,
    'company_phone', comp.contact_phone,
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
'Obtiene información de seguimiento público de una orden usando tracking_token. V2.1: Corrige nombres de columnas de companies (address, contact_phone). Incluye información completa de pausas activas.';