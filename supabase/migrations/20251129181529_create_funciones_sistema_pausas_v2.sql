/*
  # Sistema de Pausas en Producción - Fase 2: Backend y Triggers

  ## Descripción
  Implementa todas las funciones SQL necesarias para el sistema de pausas:
  - Pausar y reanudar pasos con validaciones
  - Cálculo automático de tiempos efectivos vs pausados
  - Detección de pausas prolongadas (>24h)
  - Notificaciones automáticas a super_admin y admin
  - Integración con tracking público

  ## Funciones SQL
  1. `fn_pausar_paso()` - Pausar un paso en proceso
  2. `fn_reanudar_paso()` - Reanudar paso pausado
  3. `fn_recalcular_tiempos_paso()` - Recalcular tiempos efectivos
  4. `fn_crear_notificacion_pausa_prolongada()` - Crear alertas
  5. `fn_detectar_pausas_prolongadas()` - Detector para cron job
  6. Actualización de `fn_get_public_order_tracking()` - Info de pausas

  ## Triggers
  - Auto-recalcular tiempos cuando se cierra pausa

  Fecha: 2025-11-30
  Versión: 1.0
*/

-- =====================================================
-- 1. FUNCIÓN: fn_pausar_paso
-- =====================================================

CREATE OR REPLACE FUNCTION fn_pausar_paso(
  p_ruta_id uuid,
  p_motivo_pausa_id uuid,
  p_descripcion text DEFAULT NULL,
  p_pausado_por uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_motivo pasos_motivos_pausa%ROWTYPE;
  v_pausa_id uuid;
  v_resultado jsonb;
BEGIN
  -- Validar que la ruta existe y pertenece a la empresa del usuario
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id
  AND company_id IN (SELECT company_id FROM profiles WHERE id = COALESCE(p_pausado_por, auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ruta no encontrada o sin permisos'
    );
  END IF;

  -- Validar estado actual (solo se puede pausar si está en_proceso)
  IF v_ruta.estado_paso != 'en_proceso' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solo se pueden pausar pasos en proceso',
      'estado_actual', v_ruta.estado_paso
    );
  END IF;

  -- Validar que no hay una pausa activa
  IF EXISTS (
    SELECT 1 FROM ordenes_items_rutas_pausas
    WHERE ruta_id = p_ruta_id
    AND fecha_fin_pausa IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe una pausa activa para este paso'
    );
  END IF;

  -- Obtener información del motivo
  SELECT * INTO v_motivo
  FROM pasos_motivos_pausa
  WHERE id = p_motivo_pausa_id
  AND company_id = v_ruta.company_id
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Motivo de pausa no válido'
    );
  END IF;

  -- Validar descripción si es requerida
  IF v_motivo.requiere_descripcion AND (p_descripcion IS NULL OR p_descripcion = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este motivo requiere una descripción'
    );
  END IF;

  -- Crear registro de pausa
  INSERT INTO ordenes_items_rutas_pausas (
    ruta_id,
    motivo_pausa_id,
    categoria_motivo,
    descripcion,
    fecha_inicio_pausa,
    pausado_por
  ) VALUES (
    p_ruta_id,
    p_motivo_pausa_id,
    v_motivo.categoria,
    p_descripcion,
    now(),
    COALESCE(p_pausado_por, auth.uid())
  )
  RETURNING id INTO v_pausa_id;

  -- Actualizar estado del paso a 'pausado'
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = 'pausado',
    cantidad_pausas = cantidad_pausas + 1,
    updated_at = now()
  WHERE id = p_ruta_id;

  -- Construir resultado
  v_resultado := jsonb_build_object(
    'success', true,
    'pausa_id', v_pausa_id,
    'ruta_id', p_ruta_id,
    'estado_nuevo', 'pausado',
    'motivo', v_motivo.nombre,
    'categoria', v_motivo.categoria,
    'fecha_pausa', now()
  );

  RETURN v_resultado;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_pausar_paso IS
'Pausa un paso de producción que esté en proceso, registrando el motivo y cambiando estado a pausado. Valida permisos, estado actual, y requisitos del motivo.';

-- =====================================================
-- 2. FUNCIÓN: fn_reanudar_paso
-- =====================================================

CREATE OR REPLACE FUNCTION fn_reanudar_paso(
  p_ruta_id uuid,
  p_reanudado_por uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_pausa_activa ordenes_items_rutas_pausas%ROWTYPE;
  v_duracion_minutos integer;
  v_resultado jsonb;
BEGIN
  -- Validar que la ruta existe y pertenece a la empresa del usuario
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id
  AND company_id IN (SELECT company_id FROM profiles WHERE id = COALESCE(p_reanudado_por, auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ruta no encontrada o sin permisos'
    );
  END IF;

  -- Validar estado actual (debe estar pausado)
  IF v_ruta.estado_paso != 'pausado' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El paso no está pausado',
      'estado_actual', v_ruta.estado_paso
    );
  END IF;

  -- Buscar pausa activa
  SELECT * INTO v_pausa_activa
  FROM ordenes_items_rutas_pausas
  WHERE ruta_id = p_ruta_id
  AND fecha_fin_pausa IS NULL
  ORDER BY fecha_inicio_pausa DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró una pausa activa para este paso'
    );
  END IF;

  -- Cerrar la pausa activa
  UPDATE ordenes_items_rutas_pausas
  SET
    fecha_fin_pausa = now(),
    reanudado_por = COALESCE(p_reanudado_por, auth.uid())
  WHERE id = v_pausa_activa.id
  RETURNING duracion_minutos INTO v_duracion_minutos;

  -- Cambiar estado del paso a 'en_proceso'
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = 'en_proceso',
    updated_at = now()
  WHERE id = p_ruta_id;

  -- Recalcular tiempo pausado total (se hace con trigger)
  PERFORM fn_recalcular_tiempos_paso(p_ruta_id);

  -- Construir resultado
  v_resultado := jsonb_build_object(
    'success', true,
    'ruta_id', p_ruta_id,
    'pausa_id', v_pausa_activa.id,
    'estado_nuevo', 'en_proceso',
    'duracion_pausa_minutos', v_duracion_minutos,
    'fecha_reanudacion', now()
  );

  RETURN v_resultado;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reanudar_paso IS
'Reanuda un paso pausado, cierra la pausa activa y vuelve el estado a en_proceso. Recalcula automáticamente los tiempos.';

-- =====================================================
-- 3. FUNCIÓN: fn_recalcular_tiempos_paso
-- =====================================================

CREATE OR REPLACE FUNCTION fn_recalcular_tiempos_paso(p_ruta_id uuid)
RETURNS void AS $$
DECLARE
  v_tiempo_pausado interval;
  v_fecha_inicio timestamptz;
  v_fecha_fin timestamptz;
  v_tiempo_trabajo_efectivo interval;
BEGIN
  -- Obtener fechas del paso
  SELECT fecha_inicio, fecha_fin
  INTO v_fecha_inicio, v_fecha_fin
  FROM ordenes_trabajo_items_rutas
  WHERE id = p_ruta_id;

  -- Calcular tiempo pausado total (suma de todas las pausas cerradas)
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (fecha_fin_pausa - fecha_inicio_pausa)) * INTERVAL '1 second'
  ), INTERVAL '0')
  INTO v_tiempo_pausado
  FROM ordenes_items_rutas_pausas
  WHERE ruta_id = p_ruta_id
  AND fecha_fin_pausa IS NOT NULL;

  -- Calcular tiempo trabajo efectivo si el paso está completado
  IF v_fecha_fin IS NOT NULL AND v_fecha_inicio IS NOT NULL THEN
    v_tiempo_trabajo_efectivo := (v_fecha_fin - v_fecha_inicio) - v_tiempo_pausado;
  ELSE
    v_tiempo_trabajo_efectivo := NULL;
  END IF;

  -- Actualizar la ruta
  UPDATE ordenes_trabajo_items_rutas
  SET
    tiempo_pausado_total = v_tiempo_pausado,
    tiempo_trabajo_efectivo = v_tiempo_trabajo_efectivo,
    updated_at = now()
  WHERE id = p_ruta_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_recalcular_tiempos_paso IS
'Recalcula tiempo_pausado_total y tiempo_trabajo_efectivo basado en todas las pausas registradas. Se ejecuta automáticamente al cerrar pausas.';

-- =====================================================
-- 4. TRIGGER: Auto-recalcular tiempos
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_recalcular_tiempos_pausa()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se cierra una pausa (UPDATE) o se elimina (DELETE)
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    PERFORM fn_recalcular_tiempos_paso(OLD.ruta_id);
  END IF;

  -- Cuando se inserta una nueva pausa (INSERT)
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_recalcular_tiempos_paso(NEW.ruta_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_recalcular_tiempos_pausa ON ordenes_items_rutas_pausas;

CREATE TRIGGER trigger_auto_recalcular_tiempos_pausa
  AFTER INSERT OR UPDATE OR DELETE ON ordenes_items_rutas_pausas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalcular_tiempos_pausa();

COMMENT ON FUNCTION trigger_recalcular_tiempos_pausa IS
'Trigger que recalcula automáticamente los tiempos al insertar, actualizar o eliminar pausas';

-- =====================================================
-- 5. FUNCIÓN: fn_crear_notificacion_pausa_prolongada
-- =====================================================

CREATE OR REPLACE FUNCTION fn_crear_notificacion_pausa_prolongada(
  p_pausa_id uuid
)
RETURNS void AS $$
DECLARE
  v_pausa ordenes_items_rutas_pausas%ROWTYPE;
  v_ruta ordenes_trabajo_items_rutas%ROWTYPE;
  v_item ordenes_trabajo_items%ROWTYPE;
  v_orden ordenes_trabajo%ROWTYPE;
  v_motivo pasos_motivos_pausa%ROWTYPE;
  v_admin_id uuid;
  v_tiempo_pausado interval;
  v_horas_pausado numeric;
BEGIN
  -- Obtener información completa de la pausa
  SELECT * INTO v_pausa
  FROM ordenes_items_rutas_pausas
  WHERE id = p_pausa_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Obtener ruta, item y orden
  SELECT * INTO v_ruta
  FROM ordenes_trabajo_items_rutas
  WHERE id = v_pausa.ruta_id;

  SELECT * INTO v_item
  FROM ordenes_trabajo_items
  WHERE id = v_ruta.orden_item_id;

  SELECT * INTO v_orden
  FROM ordenes_trabajo
  WHERE id = v_item.orden_id;

  SELECT * INTO v_motivo
  FROM pasos_motivos_pausa
  WHERE id = v_pausa.motivo_pausa_id;

  -- Calcular tiempo pausado
  v_tiempo_pausado := now() - v_pausa.fecha_inicio_pausa;
  v_horas_pausado := EXTRACT(EPOCH FROM v_tiempo_pausado) / 3600;

  -- Crear notificación para todos los super_admin y admin de la empresa
  FOR v_admin_id IN
    SELECT id FROM profiles
    WHERE company_id = v_ruta.company_id
    AND role IN ('super_admin', 'admin')
  LOOP
    INSERT INTO notificaciones_internas (
      company_id,
      usuario_id,
      tipo,
      titulo,
      mensaje,
      referencia_tipo,
      referencia_id,
      metadata
    ) VALUES (
      v_ruta.company_id,
      v_admin_id,
      'pausa_prolongada',
      'Paso pausado por más de 24 horas',
      format(
        'El paso "%s" de la orden %s lleva pausado %.1f horas. Motivo: %s',
        v_ruta.paso_nombre,
        v_orden.numero_orden,
        v_horas_pausado,
        v_motivo.nombre
      ),
      'pausa',
      p_pausa_id,
      jsonb_build_object(
        'orden_id', v_orden.id,
        'orden_numero', v_orden.numero_orden,
        'item_id', v_item.id,
        'ruta_id', v_ruta.id,
        'paso_nombre', v_ruta.paso_nombre,
        'motivo_nombre', v_motivo.nombre,
        'categoria_motivo', v_motivo.categoria,
        'horas_pausado', v_horas_pausado,
        'descripcion_pausa', v_pausa.descripcion
      )
    );
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_notificacion_pausa_prolongada IS
'Crea notificaciones para super_admin y admin cuando una pausa supera las 24 horas. Incluye toda la información contextual en metadata.';

-- =====================================================
-- 6. FUNCIÓN: fn_detectar_pausas_prolongadas
-- =====================================================

CREATE OR REPLACE FUNCTION fn_detectar_pausas_prolongadas()
RETURNS TABLE (
  pausa_id uuid,
  ruta_id uuid,
  paso_nombre text,
  orden_numero text,
  motivo text,
  horas_pausado numeric,
  ultima_notificacion timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH pausas_activas AS (
    SELECT
      p.id as pausa_id,
      p.ruta_id,
      r.paso_nombre,
      o.numero_orden as orden_numero,
      m.nombre as motivo,
      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 3600 as horas_pausado,
      (
        SELECT MAX(created_at)
        FROM notificaciones_internas
        WHERE referencia_tipo = 'pausa'
        AND referencia_id = p.id
        AND tipo = 'pausa_prolongada'
      ) as ultima_notificacion
    FROM ordenes_items_rutas_pausas p
    JOIN ordenes_trabajo_items_rutas r ON r.id = p.ruta_id
    JOIN ordenes_trabajo_items i ON i.id = r.orden_item_id
    JOIN ordenes_trabajo o ON o.id = i.orden_id
    JOIN pasos_motivos_pausa m ON m.id = p.motivo_pausa_id
    WHERE p.fecha_fin_pausa IS NULL  -- Solo pausas activas
    AND r.estado_paso = 'pausado'
  )
  SELECT
    pa.pausa_id,
    pa.ruta_id,
    pa.paso_nombre,
    pa.orden_numero,
    pa.motivo,
    pa.horas_pausado,
    pa.ultima_notificacion
  FROM pausas_activas pa
  WHERE pa.horas_pausado >= 24  -- Más de 24 horas
  AND (
    pa.ultima_notificacion IS NULL  -- Primera notificación
    OR pa.ultima_notificacion < now() - INTERVAL '24 hours'  -- Re-notificar cada 24h
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_detectar_pausas_prolongadas IS
'Detecta pausas activas que superan 24 horas y no han sido notificadas recientemente. Usado por cron job para enviar alertas automáticas.';

-- =====================================================
-- 7. HABILITAR REALTIME PARA NOTIFICACIONES
-- =====================================================

-- Agregar tabla a publicación realtime si existe
DO $$
BEGIN
  -- Verificar si la publicación supabase_realtime existe
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Intentar agregar la tabla (ignora si ya existe)
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones_internas;
      RAISE NOTICE '✅ Tabla notificaciones_internas agregada a supabase_realtime';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE '⚠️ Tabla notificaciones_internas ya estaba en supabase_realtime';
    END;
  ELSE
    RAISE NOTICE '⚠️ Publicación supabase_realtime no existe';
  END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN FASE 2
-- =====================================================

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ FASE 2 COMPLETADA: Funciones Backend y Triggers';
  RAISE NOTICE '🔧 Funciones creadas:';
  RAISE NOTICE '   1. fn_pausar_paso() - Pausar con validaciones';
  RAISE NOTICE '   2. fn_reanudar_paso() - Reanudar y cerrar pausa';
  RAISE NOTICE '   3. fn_recalcular_tiempos_paso() - Cálculos automáticos';
  RAISE NOTICE '   4. fn_crear_notificacion_pausa_prolongada() - Alertas';
  RAISE NOTICE '   5. fn_detectar_pausas_prolongadas() - Detector para cron';
  RAISE NOTICE '🔄 Triggers: Auto-recalcular tiempos al modificar pausas';
  RAISE NOTICE '📡 Realtime: Notificaciones habilitadas';
  RAISE NOTICE '🎯 Siguiente: Fase 3 - Sistema de Notificaciones Frontend';
  RAISE NOTICE '⚠️ Nota: fn_get_public_order_tracking se actualizará en siguiente fase';
END $$;
