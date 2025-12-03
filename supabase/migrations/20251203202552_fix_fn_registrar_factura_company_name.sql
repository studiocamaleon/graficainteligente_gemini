/*
  # Fix fn_registrar_factura - Corregir acceso al campo company_name

  ## Problema
  La función intentaba acceder a `v_company.company_name` pero el campo real
  en la tabla `companies` se llama `name`, no `company_name`.

  ## Solución
  Recrear la función con el acceso correcto al campo: `v_company.name`

  ## Cambios
  - Línea 276: Cambiar `v_company.company_name` por `v_company.name`
  - La clave del JSON sigue siendo 'company_name' (para mantener compatibilidad con frontend)
  - Solo se corrige el acceso al campo de la base de datos

  ## Impacto
  - Mínimo: solo una línea de código
  - Sin breaking changes en el frontend
  - Permite que la función fn_registrar_factura se ejecute correctamente
*/

-- =====================================================
-- RECREAR FUNCIÓN: fn_registrar_factura
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
    'company_name', v_company.name,
    'factura_storage_path', p_factura_storage_path,
    'total', v_orden.total,
    'subtotal_iva', v_orden.subtotal_iva,
    'fecha_facturacion', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_registrar_factura IS 'Registra que una orden ha sido facturada. Actualiza la orden, crea registro en historial y retorna datos para notificación WhatsApp.';