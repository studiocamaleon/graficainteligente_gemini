/*
  # Fix EXTRACT Function Error in fn_obtener_detalle_por_cobrar

  ## Descripción
  Corrige el error en el cálculo de días transcurridos.
  EXTRACT(DAY FROM ...) no puede operar sobre integers.

  ## Problema
  La resta CURRENT_DATE - fecha::date retorna un integer directamente,
  no un interval. EXTRACT espera un interval.

  ## Solución
  Remover EXTRACT y usar directamente el resultado de la resta,
  que ya es un integer representando días.

  ## Error Original
  ```
  function pg_catalog.extract(unknown, integer) does not exist
  ```
*/

-- =====================================================
-- FUNCIÓN: Obtener detalle de órdenes por cobrar (CORREGIDA)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_detalle_por_cobrar(
  p_company_id uuid,
  p_tipo_cliente text DEFAULT NULL
)
RETURNS TABLE (
  orden_id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  tiene_cuenta_corriente boolean,
  total numeric,
  pagado numeric,
  saldo_pendiente numeric,
  dias_transcurridos integer,
  estado text
) AS $$
BEGIN
  RETURN QUERY
  WITH pagos_por_orden AS (
    SELECT 
      otp.orden_id,
      COALESCE(SUM(otp.monto), 0) as total_pagado
    FROM ordenes_trabajo_pagos otp
    GROUP BY otp.orden_id
  )
  SELECT 
    ot.id as orden_id,
    ot.numero_orden,
    ot.fecha_creacion,
    ot.cliente_id,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    c.numero_documento as cliente_documento,
    COALESCE(c.tiene_cuenta_corriente, false) as tiene_cuenta_corriente,
    ot.total,
    COALESCE(p.total_pagado, 0) as pagado,
    (ot.total - COALESCE(p.total_pagado, 0)) as saldo_pendiente,
    (CURRENT_DATE - ot.fecha_creacion::date)::integer as dias_transcurridos,
    ot.estado
  FROM ordenes_trabajo ot
  LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id
  LEFT JOIN clients c ON ot.cliente_id = c.id
  WHERE ot.company_id = p_company_id
    AND ot.estado NOT IN ('cancelado')
    AND (ot.total - COALESCE(p.total_pagado, 0)) > 0
    AND (
      p_tipo_cliente IS NULL OR
      (p_tipo_cliente = 'cc' AND c.tiene_cuenta_corriente = true) OR
      (p_tipo_cliente = 'sin_cc' AND (c.tiene_cuenta_corriente = false OR c.tiene_cuenta_corriente IS NULL))
    )
  ORDER BY ot.fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;