/*
  # Corregir función fn_reporte_ingresos_egresos

  ## Problema
  La función tenía un error SQL: "set-returning functions are not allowed in CASE"
  No se puede usar generate_series dentro de un CASE statement.

  ## Solución
  Reescribir la función usando CTEs separados para cada granularidad
  y luego usar un condicional para retornar el resultado correcto.

  ## Cambios
  - DROP de la función anterior
  - Recrear con lógica corregida usando CTEs independientes
  - Mantener la misma firma y comportamiento esperado
*/

-- Eliminar función anterior
DROP FUNCTION IF EXISTS fn_reporte_ingresos_egresos(UUID, DATE, DATE, TEXT);

-- Recrear función con sintaxis corregida
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
  -- Validar granularidad
  IF p_granularidad NOT IN ('dia', 'semana', 'mes') THEN
    p_granularidad := 'dia';
  END IF;

  -- Generar períodos y calcular movimientos según granularidad
  IF p_granularidad = 'dia' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval)::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        m.fecha::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY m.fecha::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      to_char(p.periodo_fecha, 'DD/MM') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;

  ELSIF p_granularidad = 'semana' THEN
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('week', p_fecha_inicio::timestamp),
        date_trunc('week', p_fecha_fin::timestamp),
        '1 week'::interval
      )::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        date_trunc('week', m.fecha::timestamp)::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY date_trunc('week', m.fecha::timestamp)::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      'Sem ' || to_char(p.periodo_fecha, 'WW') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;

  ELSE -- mes
    RETURN QUERY
    WITH periodos AS (
      SELECT generate_series(
        date_trunc('month', p_fecha_inicio::timestamp),
        date_trunc('month', p_fecha_fin::timestamp),
        '1 month'::interval
      )::date AS periodo_fecha
    ),
    movimientos_agrupados AS (
      SELECT
        date_trunc('month', m.fecha::timestamp)::date AS periodo,
        SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN m.tipo_movimiento = 'egreso' THEN m.monto ELSE 0 END) AS total_egresos
      FROM cajas_movimientos m
      INNER JOIN cajas c ON c.id = m.caja_id
      WHERE c.company_id = p_company_id
        AND m.fecha::date >= p_fecha_inicio
        AND m.fecha::date <= p_fecha_fin
      GROUP BY date_trunc('month', m.fecha::timestamp)::date
    )
    SELECT
      p.periodo_fecha AS fecha,
      to_char(p.periodo_fecha, 'Mon YYYY') AS periodo_label,
      COALESCE(m.total_ingresos, 0) AS ingresos,
      COALESCE(m.total_egresos, 0) AS egresos,
      COALESCE(m.total_ingresos, 0) - COALESCE(m.total_egresos, 0) AS balance
    FROM periodos p
    LEFT JOIN movimientos_agrupados m ON m.periodo = p.periodo_fecha
    ORDER BY p.periodo_fecha;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fn_reporte_ingresos_egresos TO authenticated;

-- Add comment
COMMENT ON FUNCTION fn_reporte_ingresos_egresos IS 
'Genera un reporte de ingresos y egresos agrupados por día, semana o mes';
