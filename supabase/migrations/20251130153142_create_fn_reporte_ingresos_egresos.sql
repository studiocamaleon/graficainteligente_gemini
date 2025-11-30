/*
  # Crear función para reporte de ingresos y egresos

  ## Descripción
  Crea una función que retorna los ingresos (cobros) y egresos por período,
  agrupados por día, semana o mes según la granularidad especificada.

  ## Datos calculados
  - Ingresos: suma de todos los movimientos de tipo 'ingreso' en cajas
  - Egresos: suma de todos los movimientos de tipo 'egreso' en cajas
  - Balance neto: ingresos - egresos
  - Agrupación configurable: día, semana o mes

  ## Parámetros
  - p_company_id: ID de la compañía
  - p_fecha_inicio: Fecha de inicio del período
  - p_fecha_fin: Fecha fin del período
  - p_granularidad: 'dia', 'semana' o 'mes'

  ## Retorna
  - fecha: fecha del período
  - periodo_label: etiqueta legible del período
  - ingresos: total de ingresos
  - egresos: total de egresos
  - balance: ingresos - egresos
*/

CREATE OR REPLACE FUNCTION fn_reporte_ingresos_egresos(
  p_company_id UUID,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_granularidad TEXT DEFAULT 'dia'
)
RETURNS TABLE (
  fecha DATE,
  periodo_label TEXT,
  ingresos NUMERIC,
  egresos NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH periodos AS (
    SELECT
      CASE
        WHEN p_granularidad = 'dia' THEN
          generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval)::date
        WHEN p_granularidad = 'semana' THEN
          generate_series(
            date_trunc('week', p_fecha_inicio::timestamp),
            date_trunc('week', p_fecha_fin::timestamp),
            '1 week'::interval
          )::date
        WHEN p_granularidad = 'mes' THEN
          generate_series(
            date_trunc('month', p_fecha_inicio::timestamp),
            date_trunc('month', p_fecha_fin::timestamp),
            '1 month'::interval
          )::date
        ELSE
          generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval)::date
      END AS periodo_fecha
  ),
  movimientos_agrupados AS (
    SELECT
      CASE
        WHEN p_granularidad = 'dia' THEN m.fecha::date
        WHEN p_granularidad = 'semana' THEN date_trunc('week', m.fecha::timestamp)::date
        WHEN p_granularidad = 'mes' THEN date_trunc('month', m.fecha::timestamp)::date
        ELSE m.fecha::date
      END AS periodo,
      SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
      SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
    FROM cajas_movimientos m
    INNER JOIN cajas c ON c.id = m.caja_id
    WHERE c.company_id = p_company_id
      AND m.fecha::date >= p_fecha_inicio
      AND m.fecha::date <= p_fecha_fin
    GROUP BY periodo
  )
  SELECT
    p.periodo_fecha AS fecha,
    CASE
      WHEN p_granularidad = 'dia' THEN
        to_char(p.periodo_fecha, 'DD/MM')
      WHEN p_granularidad = 'semana' THEN
        'Sem ' || to_char(p.periodo_fecha, 'WW')
      WHEN p_granularidad = 'mes' THEN
        to_char(p.periodo_fecha, 'Mon YYYY')
      ELSE
        to_char(p.periodo_fecha, 'DD/MM/YYYY')
    END AS periodo_label,
    COALESCE(m.total_ingresos, 0) AS ingresos,
    COALESCE(m.total_egresos, 0) AS egresos,
    COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
  FROM periodos p
  LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
  ORDER BY p.periodo_fecha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fn_reporte_ingresos_egresos TO authenticated;

-- Add comment
COMMENT ON FUNCTION fn_reporte_ingresos_egresos IS 
'Genera un reporte de ingresos y egresos agrupados por día, semana o mes';
