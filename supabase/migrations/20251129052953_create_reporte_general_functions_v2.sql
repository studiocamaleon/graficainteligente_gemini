/*
  # Funciones para Reporte General de Ventas

  ## Descripción
  Conjunto completo de funciones SQL para el nuevo reporte "General" que incluye:
  - Análisis por categorías de productos
  - Ventas por día de la semana
  - Análisis de horarios pico (UTC-3 Argentina)
  - Facturación por usuario
  - Tasa de seña y cumplimiento de meta

  ## Nuevas Funciones
  1. fn_reporte_ventas_por_categoria() - Facturación por categorías
  2. fn_reporte_ventas_por_dia_semana() - Ventas por día de la semana
  3. fn_reporte_ventas_por_hora() - Horarios pico de pedidos (UTC-3)
  4. fn_reporte_ventas_por_usuario() - Ranking de usuarios por facturación
  5. fn_reporte_tasa_sena() - Análisis de seña vs meta del 50%

  ## Seguridad
  - Todas las funciones filtran por company_id
  - SECURITY DEFINER para acceso controlado
  - Excluye órdenes canceladas
*/

-- =====================================================
-- FUNCIÓN: Ventas por Categoría
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_categoria(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  categoria_nombre text,
  total_ventas numeric,
  total_ordenes bigint,
  porcentaje numeric,
  ticket_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_trabajo_items_categorias AS (
    SELECT
      COALESCE(oti.producto_categoria, 'Sin Categoría') AS categoria,
      oti.precio_total AS total_item
    FROM ordenes_trabajo ot
    JOIN ordenes_trabajo_items oti ON ot.id = oti.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
  ),
  centro_copiado_categoria AS (
    SELECT
      'Centro de Copiado' AS categoria,
      cc.total AS total_item
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  todas_categorias AS (
    SELECT categoria, total_item FROM ordenes_trabajo_items_categorias
    UNION ALL
    SELECT categoria, total_item FROM centro_copiado_categoria
  ),
  resumen_categorias AS (
    SELECT
      categoria,
      SUM(total_item) AS total_ventas,
      COUNT(*) AS total_ordenes
    FROM todas_categorias
    GROUP BY categoria
  ),
  total_general AS (
    SELECT SUM(total_ventas) AS total FROM resumen_categorias
  )
  SELECT
    rc.categoria,
    rc.total_ventas,
    rc.total_ordenes,
    CASE
      WHEN tg.total > 0 THEN (rc.total_ventas / tg.total * 100)
      ELSE 0
    END AS porcentaje,
    CASE
      WHEN rc.total_ordenes > 0 THEN rc.total_ventas / rc.total_ordenes
      ELSE 0
    END AS ticket_promedio
  FROM resumen_categorias rc
  CROSS JOIN total_general tg
  ORDER BY rc.total_ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_categoria IS 
  'Retorna facturación agrupada por categorías de productos incluyendo centro de copiado';

-- =====================================================
-- FUNCIÓN: Ventas por Día de la Semana
-- =====================================================

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
      EXTRACT(DOW FROM ot.fecha_creacion::date) AS dia,
      ot.total AS monto
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(DOW FROM cc.fecha_solicitud::date) AS dia,
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
  'Retorna análisis de ventas por día de la semana para identificar patrones';

-- =====================================================
-- FUNCIÓN: Ventas por Hora (UTC-3 Argentina)
-- =====================================================

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
      EXTRACT(HOUR FROM (ot.fecha_creacion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
    UNION ALL
    SELECT
      EXTRACT(HOUR FROM (cc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::integer AS hora
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
  ),
  resumen_horas AS (
    SELECT
      hora,
      COUNT(*) AS ordenes
    FROM ordenes_por_hora
    GROUP BY hora
  ),
  total_ordenes AS (
    SELECT SUM(ordenes) AS total FROM resumen_horas
  )
  SELECT
    rh.hora,
    LPAD(rh.hora::text, 2, '0') || ':00 - ' || LPAD((rh.hora + 1)::text, 2, '0') || ':00' AS rango_horario,
    rh.ordenes,
    CASE
      WHEN t.total > 0 THEN (rh.ordenes::numeric / t.total * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_horas rh
  CROSS JOIN total_ordenes t
  ORDER BY rh.hora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_hora IS 
  'Retorna análisis de órdenes por hora del día en zona horaria Argentina (UTC-3) para identificar horarios pico';

-- =====================================================
-- FUNCIÓN: Ventas por Usuario
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_ventas_por_usuario(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  total_ventas numeric,
  total_ordenes bigint,
  ticket_promedio numeric,
  porcentaje numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_por_usuario AS (
    SELECT
      ot.created_by AS usuario,
      ot.total AS monto
    FROM ordenes_trabajo ot
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND ot.created_by IS NOT NULL
    UNION ALL
    SELECT
      cc.created_by AS usuario,
      cc.total AS monto
    FROM centro_copiado_ordenes cc
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.created_by IS NOT NULL
  ),
  resumen_usuarios AS (
    SELECT
      ou.usuario,
      SUM(ou.monto) AS ventas,
      COUNT(*) AS ordenes
    FROM ordenes_por_usuario ou
    GROUP BY ou.usuario
  ),
  total_ventas AS (
    SELECT SUM(ventas) AS total FROM resumen_usuarios
  )
  SELECT
    ru.usuario,
    COALESCE(p.full_name, p.email, 'Usuario Desconocido') AS nombre,
    COALESCE(p.email, '') AS email,
    ru.ventas,
    ru.ordenes,
    CASE
      WHEN ru.ordenes > 0 THEN ru.ventas / ru.ordenes
      ELSE 0
    END AS ticket_promedio,
    CASE
      WHEN tv.total > 0 THEN (ru.ventas / tv.total * 100)
      ELSE 0
    END AS porcentaje
  FROM resumen_usuarios ru
  LEFT JOIN profiles p ON ru.usuario = p.id
  CROSS JOIN total_ventas tv
  ORDER BY ru.ventas DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_ventas_por_usuario IS 
  'Retorna ranking de usuarios por facturación generada en el período';

-- =====================================================
-- FUNCIÓN: Tasa de Seña y Análisis
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reporte_tasa_sena(
  p_company_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE(
  total_ventas numeric,
  total_cobrado numeric,
  saldo_pendiente numeric,
  total_ordenes bigint,
  ordenes_con_sena bigint,
  ordenes_sin_sena bigint,
  tasa_sena_promedio numeric,
  porcentaje_ordenes_con_sena numeric,
  monto_sena_promedio numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_con_pagos AS (
    SELECT
      ot.id AS orden_id,
      ot.total AS total_orden,
      COALESCE(SUM(otp.monto), 0) AS pagado
    FROM ordenes_trabajo ot
    LEFT JOIN ordenes_trabajo_pagos otp ON ot.id = otp.orden_id
    WHERE ot.company_id = p_company_id
      AND ot.fecha_creacion::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND ot.estado NOT IN ('cancelado', 'borrador')
      AND (ot.client_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = ot.client_id 
        AND cl.tiene_cuenta_corriente = true
      ))
    GROUP BY ot.id, ot.total
  ),
  ordenes_copiado_con_pagos AS (
    SELECT
      cc.id AS orden_id,
      cc.total AS total_orden,
      COALESCE(SUM(ccp.monto), 0) AS pagado
    FROM centro_copiado_ordenes cc
    LEFT JOIN centro_copiado_ordenes_pagos ccp ON cc.id = ccp.orden_copiado_id
    WHERE cc.company_id = p_company_id
      AND cc.fecha_solicitud::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cc.estado != 'cancelada'
      AND cc.orden_trabajo_id IS NULL
      AND (cc.client_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients cl 
        WHERE cl.id = cc.client_id 
        AND cl.tiene_cuenta_corriente = true
      ))
    GROUP BY cc.id, cc.total
  ),
  todas_ordenes AS (
    SELECT orden_id, total_orden, pagado FROM ordenes_con_pagos
    UNION ALL
    SELECT orden_id, total_orden, pagado FROM ordenes_copiado_con_pagos
  ),
  analisis_ordenes AS (
    SELECT
      total_orden,
      pagado,
      CASE
        WHEN total_orden > 0 THEN (pagado / total_orden * 100)
        ELSE 0
      END AS tasa_orden,
      CASE WHEN pagado > 0 THEN 1 ELSE 0 END AS tiene_sena
    FROM todas_ordenes
  )
  SELECT
    COALESCE(SUM(total_orden), 0) AS total_ventas,
    COALESCE(SUM(pagado), 0) AS total_cobrado,
    COALESCE(SUM(total_orden - pagado), 0) AS saldo_pendiente,
    COUNT(*)::bigint AS total_ordenes,
    COALESCE(SUM(tiene_sena), 0)::bigint AS ordenes_con_sena,
    (COUNT(*) - COALESCE(SUM(tiene_sena), 0))::bigint AS ordenes_sin_sena,
    COALESCE(AVG(tasa_orden), 0) AS tasa_sena_promedio,
    CASE
      WHEN COUNT(*) > 0 THEN (COALESCE(SUM(tiene_sena), 0)::numeric / COUNT(*) * 100)
      ELSE 0
    END AS porcentaje_ordenes_con_sena,
    CASE
      WHEN COALESCE(SUM(tiene_sena), 0) > 0 
      THEN (SUM(CASE WHEN tiene_sena = 1 THEN pagado ELSE 0 END) / SUM(tiene_sena))
      ELSE 0
    END AS monto_sena_promedio
  FROM analisis_ordenes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reporte_tasa_sena IS 
  'Retorna análisis completo de tasa de seña vs meta del 50%, excluyendo órdenes de cuenta corriente';

-- =====================================================
-- ÍNDICES PARA OPTIMIZAR PERFORMANCE
-- =====================================================

-- Índice para fecha_creacion en ordenes_trabajo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha_creacion_company 
  ON ordenes_trabajo(company_id, fecha_creacion) 
  WHERE estado NOT IN ('cancelado', 'borrador');

-- Índice para created_by en ordenes_trabajo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_created_by_company 
  ON ordenes_trabajo(company_id, created_by) 
  WHERE created_by IS NOT NULL;

-- Índice para fecha_solicitud en centro_copiado_ordenes
CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_fecha_solicitud_company 
  ON centro_copiado_ordenes(company_id, fecha_solicitud) 
  WHERE estado != 'cancelada';

-- Índice para created_by en centro_copiado_ordenes
CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_created_by_company 
  ON centro_copiado_ordenes(company_id, created_by) 
  WHERE created_by IS NOT NULL;

-- Índice para producto_categoria en ordenes_trabajo_items
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_producto_categoria 
  ON ordenes_trabajo_items(producto_categoria) 
  WHERE producto_categoria IS NOT NULL;
