/*
  # Fix: Corregir Zona Horaria en Reporte de Ventas por Día de la Semana

  ## Descripción
  Corrige la función fn_reporte_ventas_por_dia_semana para usar la zona horaria correcta.
  Anteriormente usaba: EXTRACT(DOW FROM ot.fecha_creacion::date)
  Corrección: EXTRACT(DOW FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires'))

  Esto asegura que los pedidos realizados tarde en la noche (ej: viernes 23:00 ARG) no se cuenten como del día siguiente (sábado) por estar en UTC.
*/

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_dia_semana(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  dia_semana integer,
  dia_nombre text,
  total_ventas numeric,
  total_ordenes bigint,
  ticket_promedio numeric,
  porcentaje_ordenes numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_dia AS (
    SELECT
      EXTRACT(DOW FROM (ot.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS dia,
      ot.total AS monto
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(DOW FROM (cc.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS dia,
      cc.total AS monto
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_dias AS (
    SELECT
      dia::integer,
      CASE dia::integer
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
      END AS nombre_dia,
      SUM(monto) AS ventas,
      COUNT(*) AS ordenes
    FROM ordenes_por_dia
    GROUP BY dia
  ),
  total_ordenes AS (
    SELECT SUM(ordenes) AS total FROM resumen_dias
  )
  SELECT
    rd.dia,
    rd.nombre_dia,
    rd.ventas,
    rd.ordenes,
    CASE
      WHEN rd.ordenes > 0 THEN rd.ventas / rd.ordenes
      ELSE 0
    END AS ticket_promedio,
    CASE
      WHEN t.total > 0 THEN (rd.ordenes::numeric / t.total * 100)
      ELSE 0
    END AS porcentaje_ordenes
  FROM resumen_dias rd
  CROSS JOIN total_ordenes t
  ORDER BY rd.dia;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_dia_semana IS 
  'Retorna análisis de ventas por día de la semana corregido para zona horaria Argentina (UTC-3)';
