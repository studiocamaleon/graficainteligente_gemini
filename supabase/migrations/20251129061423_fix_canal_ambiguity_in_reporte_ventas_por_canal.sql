/*
  # Fix: Corrección de ambigüedad en columna "canal"

  ## Descripción
  Corrige el error "column reference 'canal' is ambiguous" (código 42702)
  en la función fn_reporte_ventas_por_canal.

  ## Problema
  PostgreSQL no puede determinar si "canal" se refiere a la columna del CTE
  o a una variable, causando ambigüedad en las líneas del GROUP BY y SELECT.

  ## Solución
  - Agregar alias explícito "opc" al CTE ordenes_por_canal
  - Calificar todas las referencias a columnas con el alias
  - GROUP BY opc.canal en lugar de solo canal
*/

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_canal(
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
    
    -- Órdenes de centro copiado vinculadas: usar canal de la orden de trabajo
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    LEFT JOIN ordenes_trabajo ot ON cc.orden_trabajo_id = ot.id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NOT NULL
    
    UNION ALL
    
    -- Órdenes de centro copiado independientes: usar 'Mostrador' por defecto
    SELECT
      'Mostrador' AS canal,
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

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal de venta real (Mostrador/WhatsApp/Web) - Centro de Copiado usa canal de orden vinculada o Mostrador por defecto - Sin ambigüedad en referencias';
