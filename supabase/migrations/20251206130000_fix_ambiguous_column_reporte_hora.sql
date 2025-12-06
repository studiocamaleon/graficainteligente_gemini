/*
  # Fix: Resolver Ambigüedad de Columna en Reporte de Horas

  ## Descripción
  Corrige el error "column reference \"hora\" is ambiguous" en fn_reporte_ventas_por_hora.
  El error ocurre porque el nombre de la columna en el CTE coincide con el nombre del parámetro de salida.
  
  Solución: Renombrar la columna interna en el CTE de 'hora' a 'hora_extract'.
*/

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_hora(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  hora integer,
  rango_horario text,
  total_ordenes bigint,
  porcentaje numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_hora AS (
    SELECT
      EXTRACT(HOUR FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_extract
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(HOUR FROM (cc.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora_extract
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_horas AS (
    SELECT
      hora_extract,
      COUNT(*) AS ordenes
    FROM ordenes_por_hora
    GROUP BY hora_extract
  ),
  total_ordenes AS (
    SELECT SUM(ordenes) AS total FROM resumen_horas
  )
  SELECT
    rh.hora_extract AS hora,
    LPAD(rh.hora_extract::text, 2, '0') || ':00 - ' || LPAD((rh.hora_extract + 1)::text, 2, '0') || ':00' AS rango_horario,
    rh.ordenes,
    CASE
      WHEN t.total > 0 THEN (rh.ordenes::numeric / t.total * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_horas rh
  CROSS JOIN total_ordenes t
  ORDER BY rh.hora_extract;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_hora IS 
  'Retorna análisis de órdenes por hora del día en zona horaria Argentina (UTC-3) corregida';
