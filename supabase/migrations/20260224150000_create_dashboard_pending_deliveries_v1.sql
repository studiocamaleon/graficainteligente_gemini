-- Pending deliveries source for Dashboard/Listas para entrega
-- Includes all FINALIZADAS (OT + OC independiente), regardless of debt.

DROP FUNCTION IF EXISTS fn_dashboard_pending_deliveries_v1(UUID);

CREATE OR REPLACE FUNCTION fn_dashboard_pending_deliveries_v1(
  p_company_id uuid
)
RETURNS TABLE (
  orden_id uuid,
  numero_orden text,
  fecha_creacion timestamptz,
  fecha_finalizada timestamptz,
  fecha_entrega_estimada timestamptz,
  cliente_id uuid,
  cliente_nombre text,
  cliente_documento text,
  cliente_whatsapp text,
  tiene_cuenta_corriente boolean,
  tipo_orden text,
  estado text,
  requiere_despacho boolean,
  tracking_token text,
  total_calculado numeric,
  pagado numeric,
  saldo_pendiente numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH pagos_ot AS (
    SELECT
      otp.orden_id,
      COALESCE(SUM(otp.monto), 0)::numeric AS total_pagado
    FROM ordenes_trabajo_pagos otp
    GROUP BY otp.orden_id
  ),
  pagos_oc AS (
    SELECT
      ccop.orden_copiado_id,
      COALESCE(SUM(ccop.monto), 0)::numeric AS total_pagado
    FROM centro_copiado_ordenes_pagos ccop
    GROUP BY ccop.orden_copiado_id
  ),
  oc_vinculadas_ot AS (
    SELECT
      cc.orden_trabajo_id,
      COALESCE(SUM(cc.total), 0)::numeric AS total_oc,
      COALESCE(SUM(COALESCE(poc.total_pagado, 0)), 0)::numeric AS pagado_oc
    FROM centro_copiado_ordenes cc
    LEFT JOIN pagos_oc poc ON poc.orden_copiado_id = cc.id
    WHERE cc.company_id = p_company_id
      AND cc.orden_trabajo_id IS NOT NULL
      AND LOWER(COALESCE(cc.estado, '')) NOT IN ('cancelada', 'cancelado', 'borrador', 'cotizacion')
    GROUP BY cc.orden_trabajo_id
  ),
  ot_finalizadas AS (
    SELECT
      ot.id AS orden_id,
      ot.numero_orden,
      ot.fecha_creacion AS fecha_creacion,
      ot.fecha_completado AS fecha_finalizada,
      ot.fecha_estimada_entrega AS fecha_entrega_estimada,
      ot.cliente_id,
      COALESCE(c.nombre_fantasia, c.razon_social) AS cliente_nombre,
      c.numero_documento AS cliente_documento,
      c.whatsapp AS cliente_whatsapp,
      COALESCE(c.tiene_cuenta_corriente, false) AS tiene_cuenta_corriente,
      'orden_trabajo'::text AS tipo_orden,
      COALESCE(ot.estado, '')::text AS estado,
      COALESCE(ot.requiere_despacho, false) AS requiere_despacho,
      ot.tracking_token::text AS tracking_token,
      GREATEST(
        0,
        (
          COALESCE(ot.subtotal, 0)
          - COALESCE(ot.total_descuentos, 0)
          + COALESCE(ot.subtotal_iva, 0)
          + COALESCE(ov.total_oc, 0)
        )
      )::numeric AS total_calculado,
      (
        COALESCE(pot.total_pagado, 0)
        + COALESCE(ov.pagado_oc, 0)
      )::numeric AS pagado
    FROM ordenes_trabajo ot
    LEFT JOIN pagos_ot pot ON pot.orden_id = ot.id
    LEFT JOIN oc_vinculadas_ot ov ON ov.orden_trabajo_id = ot.id
    LEFT JOIN clients c ON c.id = ot.cliente_id
    WHERE ot.company_id = p_company_id
      AND LOWER(COALESCE(ot.estado, '')) = 'finalizada'
  ),
  oc_finalizadas AS (
    SELECT
      cc.id AS orden_id,
      cc.numero_orden,
      cc.fecha_solicitud AS fecha_creacion,
      cc.fecha_completado AS fecha_finalizada,
      cc.fecha_entrega_estimada::timestamptz AS fecha_entrega_estimada,
      cc.cliente_id,
      COALESCE(c.nombre_fantasia, c.razon_social) AS cliente_nombre,
      c.numero_documento AS cliente_documento,
      c.whatsapp AS cliente_whatsapp,
      COALESCE(c.tiene_cuenta_corriente, false) AS tiene_cuenta_corriente,
      'centro_copiado'::text AS tipo_orden,
      COALESCE(cc.estado, '')::text AS estado,
      false AS requiere_despacho,
      cc.tracking_token::text AS tracking_token,
      GREATEST(0, COALESCE(cc.total, 0))::numeric AS total_calculado,
      COALESCE(poc.total_pagado, 0)::numeric AS pagado
    FROM centro_copiado_ordenes cc
    LEFT JOIN pagos_oc poc ON poc.orden_copiado_id = cc.id
    LEFT JOIN clients c ON c.id = cc.cliente_id
    WHERE cc.company_id = p_company_id
      AND cc.orden_trabajo_id IS NULL
      AND LOWER(COALESCE(cc.estado, '')) = 'finalizada'
  ),
  unificado AS (
    SELECT * FROM ot_finalizadas
    UNION ALL
    SELECT * FROM oc_finalizadas
  )
  SELECT
    u.orden_id,
    u.numero_orden,
    u.fecha_creacion,
    u.fecha_finalizada,
    u.fecha_entrega_estimada,
    u.cliente_id,
    u.cliente_nombre,
    u.cliente_documento,
    u.cliente_whatsapp,
    u.tiene_cuenta_corriente,
    u.tipo_orden,
    u.estado,
    u.requiere_despacho,
    u.tracking_token,
    u.total_calculado,
    u.pagado,
    GREATEST(0, (u.total_calculado - u.pagado))::numeric AS saldo_pendiente
  FROM unificado u
  ORDER BY COALESCE(u.fecha_finalizada, u.fecha_creacion) ASC, u.numero_orden ASC;
$$;

GRANT EXECUTE ON FUNCTION fn_dashboard_pending_deliveries_v1(UUID) TO authenticated;
