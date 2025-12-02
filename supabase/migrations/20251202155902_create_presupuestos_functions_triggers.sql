/*
  # Funciones y Triggers para Módulo de Presupuestos

  ## Funciones Creadas
  
  1. `fn_generar_numero_presupuesto(p_company_id)` - Genera número auto-incremental
  2. `fn_actualizar_totales_presupuesto()` - Trigger para actualizar totales
  3. `fn_presupuestos_registro_historial()` - Trigger para registrar cambios
  4. `fn_vencer_presupuestos_expirados()` - Job para vencer presupuestos
  5. `update_presupuestos_updated_at()` - Actualizar updated_at

  ## Triggers Creados
  
  - `tr_presupuestos_updated_at` - Actualiza updated_at en cada UPDATE
  - `tr_presupuestos_tracking_token` - Genera tracking_token en INSERT
  - `tr_presupuestos_items_update_totales` - Actualiza totales al modificar items
  - `tr_presupuestos_registro_historial` - Registra cambios en historial
*/

-- ============================================================================
-- FUNCIÓN: Generar número de presupuesto auto-incremental por company
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_generar_numero_presupuesto(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_counter integer;
  v_numero text;
BEGIN
  -- Obtener año actual
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Obtener el contador de presupuestos del año actual para esta company
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero_presupuesto ~ '^PRES-[0-9]{4}-[0-9]+$' 
      THEN CAST(SPLIT_PART(numero_presupuesto, '-', 3) AS integer)
      ELSE 0 
    END
  ), 0) + 1
  INTO v_counter
  FROM presupuestos
  WHERE company_id = p_company_id
    AND numero_presupuesto LIKE 'PRES-' || v_year || '-%';
  
  -- Generar número con formato: PRES-YYYY-NNNN
  v_numero := 'PRES-' || v_year || '-' || LPAD(v_counter::text, 4, '0');
  
  RETURN v_numero;
END;
$$;

-- ============================================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION update_presupuestos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER: Actualizar updated_at en presupuestos
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_updated_at ON presupuestos;
CREATE TRIGGER tr_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION update_presupuestos_updated_at();

-- ============================================================================
-- TRIGGER: Generar tracking_token automáticamente (reutilizamos función existente)
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_tracking_token ON presupuestos;
CREATE TRIGGER tr_presupuestos_tracking_token
  BEFORE INSERT ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION set_tracking_token();

-- ============================================================================
-- FUNCIÓN: Actualizar totales del presupuesto cuando se modifican items
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_actualizar_totales_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_presupuesto_id uuid;
  v_nuevo_subtotal numeric;
  v_nuevo_total numeric;
BEGIN
  -- Determinar el presupuesto_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_presupuesto_id := OLD.presupuesto_id;
  ELSE
    v_presupuesto_id := NEW.presupuesto_id;
  END IF;

  -- Calcular nuevos totales
  SELECT
    COALESCE(SUM(precio_total), 0),
    COALESCE(SUM(precio_total), 0) -- Por ahora igual, después se agregarán descuentos
  INTO v_nuevo_subtotal, v_nuevo_total
  FROM presupuestos_items
  WHERE presupuesto_id = v_presupuesto_id;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    subtotal = v_nuevo_subtotal,
    total = v_nuevo_total - total_descuentos,
    updated_at = now()
  WHERE id = v_presupuesto_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- TRIGGER: Actualizar totales cuando se modifican items
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_items_update_totales ON presupuestos_items;
CREATE TRIGGER tr_presupuestos_items_update_totales
  AFTER INSERT OR UPDATE OR DELETE ON presupuestos_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_totales_presupuesto();

-- ============================================================================
-- FUNCIÓN: Registrar cambios en historial
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_presupuestos_registro_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_accion text;
  v_usuario_id uuid;
  v_detalles jsonb;
BEGIN
  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'creado';
    v_usuario_id := NEW.created_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', NEW.numero_presupuesto,
      'cliente_id', NEW.cliente_id,
      'estado_inicial', NEW.estado
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar tipo de cambio
    IF OLD.estado != NEW.estado THEN
      v_accion := 'cambio_estado';
    ELSE
      v_accion := 'modificado';
    END IF;
    v_usuario_id := NEW.updated_by;
    v_detalles := jsonb_build_object(
      'cambios', jsonb_build_object(
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado,
        'total_anterior', OLD.total,
        'total_nuevo', NEW.total
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'eliminado';
    v_usuario_id := OLD.updated_by;
    v_detalles := jsonb_build_object(
      'numero_presupuesto', OLD.numero_presupuesto,
      'estado_final', OLD.estado
    );
  END IF;

  -- Insertar en historial
  INSERT INTO presupuestos_historial (
    presupuesto_id,
    accion,
    estado_anterior,
    estado_nuevo,
    usuario_id,
    detalles
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_accion,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.estado ELSE NULL END,
    v_usuario_id,
    v_detalles
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- TRIGGER: Registrar en historial
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_registro_historial ON presupuestos;
CREATE TRIGGER tr_presupuestos_registro_historial
  AFTER INSERT OR UPDATE OR DELETE ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION fn_presupuestos_registro_historial();

-- ============================================================================
-- TRIGGER: Actualizar updated_at en items
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_items_updated_at ON presupuestos_items;
CREATE TRIGGER tr_presupuestos_items_updated_at
  BEFORE UPDATE ON presupuestos_items
  FOR EACH ROW
  EXECUTE FUNCTION update_presupuestos_updated_at();

-- ============================================================================
-- TRIGGER: Actualizar updated_at en condiciones
-- ============================================================================
DROP TRIGGER IF EXISTS tr_condiciones_updated_at ON presupuestos_condiciones_comerciales;
CREATE TRIGGER tr_condiciones_updated_at
  BEFORE UPDATE ON presupuestos_condiciones_comerciales
  FOR EACH ROW
  EXECUTE FUNCTION update_presupuestos_updated_at();

-- ============================================================================
-- FUNCIÓN: Vencer presupuestos expirados (para ejecutar en job diario)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_vencer_presupuestos_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Actualizar presupuestos que:
  -- 1. Están en estado 'enviado'
  -- 2. Su fecha_validez ya pasó
  UPDATE presupuestos
  SET
    estado = 'vencido',
    updated_at = now()
  WHERE estado = 'enviado'
    AND fecha_validez IS NOT NULL
    AND fecha_validez < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Presupuestos vencidos: %', v_count;
END;
$$;

-- ============================================================================
-- FUNCIÓN: Generar número de presupuesto al insertar (trigger helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_set_numero_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_presupuesto IS NULL OR NEW.numero_presupuesto = '' THEN
    NEW.numero_presupuesto := fn_generar_numero_presupuesto(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER: Generar número automáticamente si no se proporciona
-- ============================================================================
DROP TRIGGER IF EXISTS tr_presupuestos_numero ON presupuestos;
CREATE TRIGGER tr_presupuestos_numero
  BEFORE INSERT ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_numero_presupuesto();
