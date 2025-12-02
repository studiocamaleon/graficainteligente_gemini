/*
  # Corregir Orden de Pasos en Tracking Público (con Instalación)

  ## Problema
  La migración 20251129195800 sobrescribió la función fn_get_public_order_tracking
  eliminando el ordenamiento correcto por tipo_etapa que existía en 20251125220623.

  Actualmente solo ordena por `orden` (línea 106), causando que pasos de diferentes
  etapas se mezclen cuando tienen el mismo número de orden.

  ## Causa
  El ORDER BY solo usa `otir.orden` sin considerar `tipo_etapa`, resultando en:
  - Terminación (post_prensa) aparece antes que Producción (principal)
  - Instalación aparece en posición incorrecta
  - Secuencia confusa para el cliente en tracking público

  ## Solución
  Recrear la función manteniendo TODOS los campos actuales y agregando
  ordenamiento correcto por tipo_etapa (4 etapas + instalación) seguido de orden.

  ## Orden Correcto de Etapas
  1. pre_prensa (Pre-Prensa)
  2. principal (Producción)
  3. post_prensa (Terminación)
  4. instalacion (Instalación) ← Agregada recientemente

  ## Cambios
  - Mantiene: company_business_hours, company fields, pausas info
  - Único cambio: ORDER BY con CASE para tipo_etapa + orden
  - Soporte completo para las 4 etapas

  ## Impacto
  - Pasos se muestran en secuencia lógica de producción
  - Mejor UX para clientes en tracking público
  - Consistente con orden usado en el resto del sistema

  Fecha: 2025-12-02
*/

-- =====================================================
-- 1. RECREAR FUNCIÓN CON ORDEN CORRECTO
-- =====================================================

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
          ) ORDER BY
            -- CRÍTICO: Ordenar primero por tipo_etapa, luego por orden
            -- Esto asegura que los pasos aparezcan en la secuencia correcta de producción
            CASE otir.tipo_etapa
              WHEN 'pre_prensa' THEN 1
              WHEN 'principal' THEN 2
              WHEN 'post_prensa' THEN 3
              WHEN 'instalacion' THEN 4
              ELSE 5
            END,
            otir.orden
          )
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

-- =====================================================
-- 2. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION fn_get_public_order_tracking IS
'Obtiene información de seguimiento público de una orden usando tracking_token.
V4.0: Mantiene company_business_hours, información de pausas, y AGREGA ordenamiento correcto por tipo_etapa (pre_prensa → principal → post_prensa → instalacion) seguido de orden.

IMPORTANTE: Al actualizar esta función en el futuro, SIEMPRE mantener el ORDER BY con CASE por tipo_etapa.
El orden correcto es crítico para la UX del cliente en el tracking público.';

-- =====================================================
-- 3. VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Función fn_get_public_order_tracking Actualizada ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ordenamiento corregido por tipo_etapa + orden';
  RAISE NOTICE '✅ Secuencia correcta: Pre-Prensa → Producción → Terminación → Instalación';
  RAISE NOTICE '✅ Mantiene todos los campos actuales (company_business_hours, pausas, etc)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Orden de etapas implementado:';
  RAISE NOTICE '   1. pre_prensa (Pre-Prensa)';
  RAISE NOTICE '   2. principal (Producción)';
  RAISE NOTICE '   3. post_prensa (Terminación)';
  RAISE NOTICE '   4. instalacion (Instalación)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Futuras actualizaciones de esta función DEBEN';
  RAISE NOTICE '    mantener el ORDER BY con CASE por tipo_etapa para UX correcta.';
  RAISE NOTICE '';
END $$;
