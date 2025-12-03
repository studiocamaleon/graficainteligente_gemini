/*
  # Fix: Filtros de Estado de Facturación

  ## Descripción
  Actualiza la función `fn_ordenes_pendientes_facturacion` para permitir filtrar
  por estado de facturación (pendiente, facturada, o todas).

  ## Cambios
  1. Elimina la función anterior con 5 parámetros
  2. Crea nueva versión con parámetro adicional `p_estado_facturacion`
  3. Hace que el filtro `facturada = false` sea condicional:
     - 'pendiente': solo órdenes no facturadas (comportamiento anterior)
     - 'facturada': solo órdenes ya facturadas
     - NULL o vacío: todas las órdenes (sin filtrar por estado de facturación)

  ## Uso
  ```sql
  -- Ver todas las órdenes
  SELECT * FROM fn_ordenes_pendientes_facturacion('company-uuid', NULL, NULL, NULL, NULL, NULL);

  -- Ver solo pendientes (comportamiento anterior por defecto)
  SELECT * FROM fn_ordenes_pendientes_facturacion('company-uuid', NULL, NULL, NULL, NULL, 'pendiente');

  -- Ver solo facturadas
  SELECT * FROM fn_ordenes_pendientes_facturacion('company-uuid', NULL, NULL, NULL, NULL, 'facturada');
  ```

  ## Beneficios
  - Permite ver todas las órdenes cuando sea necesario
  - Mantiene compatibilidad con comportamiento anterior
  - Mejora flexibilidad del módulo de facturación
*/

-- =====================================================
-- Eliminar función anterior (5 parámetros)
-- =====================================================

DROP FUNCTION IF EXISTS fn_ordenes_pendientes_facturacion(uuid, date, date, uuid, text);

-- =====================================================
-- Crear nueva versión con 6 parámetros
-- =====================================================

CREATE OR REPLACE FUNCTION fn_ordenes_pendientes_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_estado_facturacion text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_email text,
  cliente_whatsapp text,
  vendedor_id uuid,
  vendedor_nombre text,
  estado text,
  fecha_creacion timestamptz,
  fecha_estimada_entrega timestamptz,
  subtotal numeric,
  subtotal_iva numeric,
  total numeric,
  dias_pendiente integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.cliente_id,
    c.razon_social as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    ot.vendedor_id,
    p.full_name as vendedor_nombre,
    ot.estado,
    ot.fecha_creacion,
    ot.fecha_estimada_entrega,
    ot.subtotal,
    ot.subtotal_iva,
    ot.total,
    EXTRACT(DAY FROM (now() - ot.fecha_creacion))::integer as dias_pendiente
  FROM ordenes_trabajo ot
  INNER JOIN clients c ON c.id = ot.cliente_id
  INNER JOIN profiles p ON p.id = ot.vendedor_id
  WHERE ot.company_id = p_company_id
    AND ot.requiere_factura = true
    -- Filtro condicional por estado de facturación
    AND (
      p_estado_facturacion IS NULL
      OR p_estado_facturacion = ''
      OR (p_estado_facturacion = 'pendiente' AND ot.facturada = false)
      OR (p_estado_facturacion = 'facturada' AND ot.facturada = true)
    )
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)
  ORDER BY ot.fecha_creacion DESC;
END;
$$;

COMMENT ON FUNCTION fn_ordenes_pendientes_facturacion IS 'Obtiene órdenes que requieren factura, con filtro opcional por estado de facturación. Incluye datos del cliente y vendedor. Soporta múltiples filtros opcionales.';

-- =====================================================
-- Otorgar permisos
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_ordenes_pendientes_facturacion TO authenticated;

-- =====================================================
-- FIN DE MIGRACIÓN: Fix Filtros Facturación
-- =====================================================
