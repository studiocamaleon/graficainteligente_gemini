/*
  # Force Update: Reporte Ventas por Canal - Usar campo origen correctamente

  ## Descripción
  Fuerza la actualización de la función `fn_reporte_ventas_por_canal` para asegurar
  que use el campo `origen` de las órdenes de centro copiado en lugar de hardcodear
  'Mostrador'.

  ## Cambios
  - Recrea la función para asegurar que esté actualizada en la base de datos
  - Para órdenes de copiado independientes: usa el campo `origen` (Web, WhatsApp, Mostrador, App Mobile)
  - Para órdenes de copiado vinculadas: usa primero el canal de la orden de trabajo, luego el origen

  ## Impacto
  - Los reportes mostrarán correctamente las ventas por canal real
  - Las órdenes desde la app móvil aparecerán en el canal "App Mobile"
  - Las órdenes desde WhatsApp aparecerán en el canal "WhatsApp"
*/

-- Eliminar la función existente para forzar recreación
DROP FUNCTION IF EXISTS fn_reporte_ventas_por_canal(uuid, date, date);

-- Recrear la función con la lógica correcta
CREATE FUNCTION fn_reporte_ventas_por_canal(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  canal text,
  total_ventas numeric,
  total_ordenes bigint,
  ordenes_trabajo bigint,
  ordenes_copiado bigint,
  porcentaje_ventas numeric,
  porcentaje_ordenes numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_canal AS (
    -- Órdenes de trabajo con su canal
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')

    UNION ALL

    -- Órdenes de centro copiado vinculadas: priorizar canal de orden trabajo, luego origen de copiado
    SELECT
      COALESCE(ot.canal_venta, cc.origen, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    LEFT JOIN ordenes_trabajo ot ON cc.orden_trabajo_id = ot.id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NOT NULL

    UNION ALL

    -- Órdenes de centro copiado independientes: USAR CAMPO ORIGEN DIRECTAMENTE
    SELECT
      COALESCE(cc.origen, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
  ),
  resumen_canales AS (
    SELECT
      opc.canal,
      SUM(opc.monto) AS ventas,
      COUNT(*) AS ordenes,
      COUNT(CASE WHEN opc.tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
      COUNT(CASE WHEN opc.tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
    FROM ordenes_por_canal opc
    GROUP BY opc.canal
  ),
  totales AS (
    SELECT
      SUM(rc.ventas) AS total_ventas,
      SUM(rc.ordenes) AS total_ordenes
    FROM resumen_canales rc
  )
  SELECT
    rc.canal,
    rc.ventas,
    rc.ordenes,
    rc.ordenes_trabajo,
    rc.ordenes_copiado,
    CASE
      WHEN t.total_ventas > 0 THEN (rc.ventas / t.total_ventas * 100)
      ELSE 0
    END AS porcentaje_ventas,
    CASE
      WHEN t.total_ordenes > 0 THEN (rc.ordenes::numeric / t.total_ordenes * 100)
      ELSE 0
    END AS porcentaje_ordenes,
    CASE
      WHEN rc.ordenes > 0 THEN rc.ventas / rc.ordenes
      ELSE 0
    END AS ticket_promedio
  FROM resumen_canales rc
  CROSS JOIN totales t
  ORDER BY rc.ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal real (Web/WhatsApp/Mostrador/App Mobile) - Usa campo origen de órdenes de copiado';
