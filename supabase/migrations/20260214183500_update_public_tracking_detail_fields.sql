-- Add rich item detail fields to public tracking payload (OT + Centro de Copiado fallback)

CREATE OR REPLACE FUNCTION public.fn_get_public_order_tracking(p_tracking_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- A) Standard OT tracking
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
      FROM public.company_business_hours cbh
      WHERE cbh.company_id = ot.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', oti.id,
        'producto_nombre', oti.producto_nombre,
        'producto_categoria', oti.producto_categoria,
        'cantidad', oti.cantidad,
        'precio_unitario', COALESCE(oti.precio_unitario_final, 0),
        'precio_total', COALESCE(oti.precio_total, 0),
        'detalle', jsonb_strip_nulls(jsonb_build_object(
          'tipo_item', oti.tipo_item,
          'descripcion', oti.descripcion,
          'configuracion', oti.configuracion
        )),
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
                  FROM public.ordenes_items_rutas_pausas p
                  WHERE p.ruta_id = otir.id
                    AND p.fecha_fin_pausa IS NULL
                  LIMIT 1
                )
              ELSE
                json_build_object('esta_pausado', false)
            END
          ) ORDER BY
            CASE otir.tipo_etapa
              WHEN 'pre_prensa' THEN 1
              WHEN 'principal' THEN 2
              WHEN 'post_prensa' THEN 3
              WHEN 'instalacion' THEN 4
              ELSE 5
            END,
            otir.orden
          )
          FROM public.ordenes_trabajo_items_rutas otir
          WHERE otir.orden_item_id = oti.id
        ), '[]'::json)
      ) ORDER BY oti.created_at)
      FROM public.ordenes_trabajo_items oti
      WHERE oti.orden_id = ot.id
    ), '[]'::json)
  ) INTO v_result
  FROM public.ordenes_trabajo ot
  LEFT JOIN public.clients c ON c.id = ot.cliente_id
  LEFT JOIN public.companies comp ON comp.id = ot.company_id
  WHERE ot.tracking_token = p_tracking_token
    AND ot.tracking_token IS NOT NULL;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- B) Fallback for Centro de Copiado
  SELECT jsonb_build_object(
    'id', cc.id,
    'numero_orden', cc.numero_orden,
    'estado', cc.estado,
    'fecha_creacion', cc.fecha_solicitud,
    'fecha_estimada_entrega', cc.fecha_entrega_estimada,
    'cliente_nombre', COALESCE(c.nombre_fantasia, c.razon_social, 'Cliente'),
    'company_id', cc.company_id,
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
      FROM public.company_business_hours cbh
      WHERE cbh.company_id = cc.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', cci.id,
        'producto_nombre', COALESCE(NULLIF(cci.descripcion, ''), initcap(replace(cci.tipo_item, '_', ' '))),
        'producto_categoria', 'Centro de Copiado',
        'cantidad', COALESCE(cci.cantidad_unidades, 1),
        'precio_unitario', COALESCE(cci.precio_unitario, 0),
        'precio_total', COALESCE(cci.subtotal, 0),
        'detalle', jsonb_strip_nulls(jsonb_build_object(
          'tipo_item', cci.tipo_item,
          'descripcion', cci.descripcion,
          'tipo_tinta', cci.tipo_tinta,
          'cara_impresa', cci.cara_impresa,
          'cantidad_hojas', cci.cantidad_hojas,
          'tipo_anillado', cci.tipo_anillado,
          'tipo_plastificado', cci.tipo_plastificado,
          'con_guillotinado', cci.con_guillotinado,
          'es_ploteo_cad', cci.es_ploteo_cad,
          'ploteo_cad_tipo_papel', cci.ploteo_cad_tipo_papel,
          'ploteo_cad_ancho_rollo', cci.ploteo_cad_ancho_rollo,
          'ploteo_cad_metros_lineales', cci.ploteo_cad_metros_lineales
        )),
        'estado', CASE
          WHEN cc.estado IN ('finalizada', 'entregada') THEN 'finalizado'
          WHEN cc.estado = 'en_proceso' THEN 'en_proceso'
          ELSE 'pendiente'
        END,
        'pasos', '[]'::json
      ) ORDER BY cci.created_at)
      FROM public.centro_copiado_ordenes_items cci
      WHERE cci.orden_copiado_id = cc.id
    ), '[]'::json)
  ) INTO v_result
  FROM public.centro_copiado_ordenes cc
  LEFT JOIN public.clients c ON c.id = cc.cliente_id
  LEFT JOIN public.companies comp ON comp.id = cc.company_id
  WHERE cc.tracking_token = p_tracking_token
    AND cc.tracking_token IS NOT NULL;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_public_order_tracking(text) TO anon, authenticated, service_role;
