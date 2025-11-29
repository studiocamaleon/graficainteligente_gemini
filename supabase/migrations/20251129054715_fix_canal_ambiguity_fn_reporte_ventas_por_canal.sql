/*
  # Fix: Resolver ambigüedad de columna "canal" en fn_reporte_ventas_por_canal

  ## Descripción
  Corrige el error "column reference 'canal' is ambiguous" en la función
  fn_reporte_ventas_por_canal usando nombres de columna únicos en cada CTE.

  ## Cambios
  - Renombrar columnas en CTEs para evitar ambigüedad
  - Calificar todas las referencias de columnas con alias de tabla/CTE
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
    SELECT
      COALESCE(ot.canal_venta, 'Mostrador') AS canal_nombre,
      ot.total AS monto,
      'trabajo' AS tipo_orden
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      'Centro de Copiado' AS canal_nombre,
      cc.total AS monto,
      'copiado' AS tipo_orden
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_canales AS (
    SELECT
      opc.canal_nombre AS canal_resumen,
      SUM(opc.monto) AS ventas,
      COUNT(*) AS ordenes,
      COUNT(CASE WHEN opc.tipo_orden = 'trabajo' THEN 1 END) AS ordenes_trabajo,
      COUNT(CASE WHEN opc.tipo_orden = 'copiado' THEN 1 END) AS ordenes_copiado
    FROM ordenes_por_canal opc
    GROUP BY opc.canal_nombre
  ),
  totales AS (
    SELECT
      SUM(rc.ventas) AS total_ventas,
      SUM(rc.ordenes) AS total_ordenes
    FROM resumen_canales rc
  )
  SELECT
    rc.canal_resumen AS canal,
    rc.ventas AS total_ventas,
    rc.ordenes AS total_ordenes,
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

COMMENT ON FUNCTION fn_reporte_ventas_por_canal IS 'Distribución de ventas por canal de venta sin ambigüedades';
