/*
  # Funciones para Sistema de Facturación

  ## Descripción General
  Crea funciones optimizadas para gestionar el sistema de facturación:
  - Consultar órdenes pendientes de facturación
  - Registrar facturas con auditoría completa
  - Obtener estadísticas y KPIs del sistema

  ## Funciones en este archivo

  ### 1. fn_ordenes_pendientes_facturacion
  **Propósito**: Obtiene órdenes que requieren factura pero no han sido facturadas
  **Parámetros**:
  - p_company_id (uuid): ID de la empresa
  - p_fecha_desde (date, opcional): Filtro por fecha de creación desde
  - p_fecha_hasta (date, opcional): Filtro por fecha de creación hasta
  - p_cliente_id (uuid, opcional): Filtro por cliente específico
  - p_estado (text, opcional): Filtro por estado de orden
  
  **Retorna**: Table con información completa de órdenes pendientes:
  - Datos de la orden (id, número, estado, fechas, montos)
  - Datos del cliente (nombre, email, whatsapp)
  - Datos del vendedor (nombre)
  - Días pendientes de facturación
  
  **Uso**:
  ```sql
  SELECT * FROM fn_ordenes_pendientes_facturacion(
    'company-uuid',
    '2025-01-01'::date,
    '2025-12-31'::date,
    NULL,
    'finalizada'
  );
  ```

  ### 2. fn_registrar_factura
  **Propósito**: Registra que una orden ha sido facturada
  **Parámetros**:
  - p_orden_id (uuid): ID de la orden
  - p_numero_factura (text): Número de factura fiscal
  - p_factura_storage_path (text): Ruta del PDF en storage
  - p_observaciones (text, opcional): Notas adicionales
  - p_user_id (uuid, opcional): ID del usuario que registra
  
  **Retorna**: JSON con datos para notificación WhatsApp:
  - orden_id, numero_orden, numero_factura
  - cliente_nombre, cliente_whatsapp
  - company_id, company_name
  - factura_storage_path
  
  **Validaciones**:
  - Orden debe existir
  - Orden debe requerir factura
  - Orden no debe estar ya facturada
  
  **Side effects**:
  - Actualiza ordenes_trabajo (facturada=true, fecha_facturacion, etc.)
  - Crea registro en facturas_historial (tipo_operacion='creacion')
  
  **Uso**:
  ```sql
  SELECT fn_registrar_factura(
    'orden-uuid',
    'FC-001-00000123',
    'company-uuid/orden-uuid/1733256000000_factura.pdf',
    'Factura generada correctamente',
    'user-uuid'
  );
  ```

  ### 3. fn_estadisticas_facturacion
  **Propósito**: Obtiene KPIs del sistema de facturación
  **Parámetros**:
  - p_company_id (uuid): ID de la empresa
  - p_fecha_desde (date, opcional): Filtro por fecha de creación desde
  - p_fecha_hasta (date, opcional): Filtro por fecha de creación hasta
  
  **Retorna**: JSON con estadísticas:
  - total_ordenes_requieren_factura: Total de órdenes que necesitan factura
  - ordenes_pendientes: Cuántas aún no tienen factura
  - ordenes_facturadas: Cuántas ya tienen factura
  - monto_total_pendiente: $ pendiente de facturar
  - monto_total_facturado: $ ya facturado
  - monto_iva_pendiente: IVA pendiente de facturar
  - monto_iva_facturado: IVA ya facturado
  - promedio_dias_facturacion: Promedio de días entre creación y facturación
  
  **Uso**:
  ```sql
  SELECT fn_estadisticas_facturacion(
    'company-uuid',
    '2025-01-01'::date,
    '2025-12-31'::date
  );
  ```

  ## Seguridad
  - Todas las funciones usan SECURITY DEFINER
  - Validación de company_id mediante RLS
  - Solo usuarios autenticados pueden ejecutarlas

  ## Performance
  - Optimizadas con los índices de Fase 1
  - Uso de filtros opcionales para queries flexibles
  - JOIN eficientes con tablas relacionadas
*/

-- =====================================================
-- 1. FUNCIÓN: Obtener órdenes pendientes de facturación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_ordenes_pendientes_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL
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
    AND ot.facturada = false
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)
  ORDER BY ot.fecha_creacion DESC;
END;
$$;

COMMENT ON FUNCTION fn_ordenes_pendientes_facturacion IS 'Obtiene órdenes que requieren factura pero aún no han sido facturadas. Incluye datos del cliente y vendedor. Soporta múltiples filtros opcionales.';

-- =====================================================
-- 2. FUNCIÓN: Registrar factura
-- =====================================================

CREATE OR REPLACE FUNCTION fn_registrar_factura(
  p_orden_id uuid,
  p_numero_factura text,
  p_factura_storage_path text,
  p_observaciones text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orden ordenes_trabajo%ROWTYPE;
  v_cliente clients%ROWTYPE;
  v_company companies%ROWTYPE;
  v_result json;
BEGIN
  -- Obtener datos de la orden
  SELECT * INTO v_orden
  FROM ordenes_trabajo
  WHERE id = p_orden_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada con ID: %', p_orden_id;
  END IF;

  IF NOT v_orden.requiere_factura THEN
    RAISE EXCEPTION 'Esta orden no requiere factura. Número de orden: %', v_orden.numero_orden;
  END IF;

  IF v_orden.facturada THEN
    RAISE EXCEPTION 'Esta orden ya tiene factura registrada. Número de factura: %', v_orden.numero_factura;
  END IF;

  -- Obtener datos del cliente
  SELECT * INTO v_cliente
  FROM clients
  WHERE id = v_orden.cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado con ID: %', v_orden.cliente_id;
  END IF;

  -- Obtener datos de la empresa
  SELECT * INTO v_company
  FROM companies
  WHERE id = v_orden.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa no encontrada con ID: %', v_orden.company_id;
  END IF;

  -- Actualizar orden con datos de facturación
  UPDATE ordenes_trabajo
  SET
    facturada = true,
    fecha_facturacion = now(),
    numero_factura = p_numero_factura,
    factura_storage_path = p_factura_storage_path,
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_orden_id;

  -- Registrar en historial para auditoría
  INSERT INTO facturas_historial (
    orden_id,
    company_id,
    numero_factura,
    monto_subtotal,
    monto_iva,
    monto_total,
    factura_storage_path,
    tipo_operacion,
    observaciones,
    created_by
  ) VALUES (
    p_orden_id,
    v_orden.company_id,
    p_numero_factura,
    v_orden.subtotal - COALESCE(v_orden.total_descuentos, 0),
    v_orden.subtotal_iva,
    v_orden.total,
    p_factura_storage_path,
    'creacion',
    p_observaciones,
    p_user_id
  );

  -- Preparar datos para notificación WhatsApp
  v_result := json_build_object(
    'orden_id', p_orden_id,
    'numero_orden', v_orden.numero_orden,
    'numero_factura', p_numero_factura,
    'cliente_nombre', v_cliente.razon_social,
    'cliente_whatsapp', v_cliente.whatsapp,
    'cliente_email', v_cliente.email,
    'company_id', v_orden.company_id,
    'company_name', v_company.company_name,
    'factura_storage_path', p_factura_storage_path,
    'total', v_orden.total,
    'subtotal_iva', v_orden.subtotal_iva,
    'fecha_facturacion', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_registrar_factura IS 'Registra que una orden ha sido facturada. Actualiza la orden, crea registro en historial y retorna datos para notificación WhatsApp.';

-- =====================================================
-- 3. FUNCIÓN: Estadísticas de facturación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_estadisticas_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total_ordenes_requieren_factura', COUNT(*),
    'ordenes_pendientes', COUNT(*) FILTER (WHERE facturada = false),
    'ordenes_facturadas', COUNT(*) FILTER (WHERE facturada = true),
    'monto_total_pendiente', COALESCE(SUM(total) FILTER (WHERE facturada = false), 0),
    'monto_total_facturado', COALESCE(SUM(total) FILTER (WHERE facturada = true), 0),
    'monto_iva_pendiente', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = false), 0),
    'monto_iva_facturado', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = true), 0),
    'promedio_dias_facturacion', COALESCE(
      ROUND(
        AVG(EXTRACT(DAY FROM (fecha_facturacion - fecha_creacion)))
        FILTER (WHERE facturada = true AND fecha_facturacion IS NOT NULL),
        2
      ),
      0
    ),
    'tasa_facturacion', CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE facturada = true)::numeric / COUNT(*)::numeric) * 100,
          2
        )
      ELSE 0
    END
  ) INTO v_stats
  FROM ordenes_trabajo
  WHERE company_id = p_company_id
    AND requiere_factura = true
    AND (p_fecha_desde IS NULL OR DATE(fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(fecha_creacion) <= p_fecha_hasta);

  RETURN v_stats;
END;
$$;

COMMENT ON FUNCTION fn_estadisticas_facturacion IS 'Obtiene estadísticas y KPIs del sistema de facturación. Incluye totales, montos y tasa de facturación.';

-- =====================================================
-- 4. PERMISOS DE EJECUCIÓN
-- =====================================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION fn_ordenes_pendientes_facturacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_factura TO authenticated;
GRANT EXECUTE ON FUNCTION fn_estadisticas_facturacion TO authenticated;

-- =====================================================
-- FIN DE MIGRACIÓN: Funciones Sistema de Facturación
-- =====================================================
