/*
  # Función para obtener presupuestos pendientes de cotizar
  
  1. Función
    - fn_presupuestos_pendientes_cotizar(uuid): Cuenta presupuestos en borrador con items sin precio
  
  2. Métrica
    - Retorna cantidad de presupuestos que tienen items pendientes de cotización
    - Solo considera presupuestos en estado 'borrador'
    - Útil para dashboard y métricas
  
  3. Performance
    - Usa índices existentes
    - Filtro eficiente por company_id y estado
    - Usa función fn_presupuesto_tiene_items_sin_precio
*/

-- ============================================================================
-- Función: Contar presupuestos pendientes de cotizar
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_presupuestos_pendientes_cotizar(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Contar presupuestos en borrador que tienen items sin precio
  SELECT COUNT(*)
  INTO v_count
  FROM presupuestos p
  WHERE p.company_id = p_company_id
    AND p.estado = 'borrador'
    AND EXISTS (
      SELECT 1
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================================================
-- Función: Obtener detalles de presupuestos pendientes de cotizar
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_presupuestos_pendientes_cotizar_detalles(p_company_id uuid)
RETURNS TABLE (
  presupuesto_id uuid,
  numero_presupuesto text,
  cliente_nombre text,
  items_pendientes integer,
  items_totales integer,
  fecha_creacion timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.numero_presupuesto,
    COALESCE(c.nombre_fantasia, c.razon_social) as cliente_nombre,
    (
      SELECT COUNT(*)::integer
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    ) as items_pendientes,
    (
      SELECT COUNT(*)::integer
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
    ) as items_totales,
    p.fecha_creacion
  FROM presupuestos p
  INNER JOIN clients c ON c.id = p.cliente_id
  WHERE p.company_id = p_company_id
    AND p.estado = 'borrador'
    AND EXISTS (
      SELECT 1
      FROM presupuestos_items pi
      WHERE pi.presupuesto_id = p.id
        AND (pi.precio_unitario_final IS NULL OR pi.precio_total IS NULL)
    )
  ORDER BY p.fecha_creacion DESC;
END;
$$;

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON FUNCTION fn_presupuestos_pendientes_cotizar IS 
  'Retorna la cantidad de presupuestos en estado borrador que tienen items sin precio asignado';

COMMENT ON FUNCTION fn_presupuestos_pendientes_cotizar_detalles IS 
  'Retorna detalles de presupuestos pendientes de cotizar para dashboard';
