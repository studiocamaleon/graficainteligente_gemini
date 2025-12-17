-- Restore notification trigger but fire ON UPDATE of total (when calculation is done)
-- to avoid race conditions (items missing).

CREATE OR REPLACE FUNCTION fn_trigger_whatsapp_nueva_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_tipo_orden text;
  v_request_id bigint;
  v_notification_exists boolean;
BEGIN
  -- Determinar tipo de orden y condiciones
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
    -- Solo notificar si el total es > 0 (indica que se cargaron items/servicios)
    IF NEW.total <= 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
    -- Para OC, el insert ya suele tener total o se actualiza rápido. 
    -- Mantenemos lógica simple o duplicada si es necesario.
  ELSE
    RETURN NEW;
  END IF;

  -- IDEMPOTENCIA: Verificar si ya se envió notificación para esta orden
  SELECT EXISTS (
    SELECT 1 FROM whatsapp_notificaciones 
    WHERE orden_trabajo_id = NEW.id 
    AND tipo_notificacion = 'nueva_orden_trabajo'
  ) INTO v_notification_exists;

  IF v_notification_exists THEN
    RETURN NEW;
  END IF;

  -- Valores hardcodeados
  v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

  -- Log del intento
  RAISE LOG '[Nueva Orden] Orden lista para notificar: % (Total: %, company: %)',
    NEW.id, NEW.total, NEW.company_id;

  -- Hacer petición HTTP asíncrona
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret,
        'Authorization', 'Bearer ' || v_trigger_secret -- Algun functions requieren auth bearer
      ),
      body := jsonb_build_object(
        'orden_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'tipo_orden', v_tipo_orden,
        'tipo', 'nueva_orden_trabajo', -- Parametro esperado por la funcion
        'tipo_notificacion', 'nueva_orden_trabajo'
      )
    ) INTO v_request_id;

    RAISE LOG '[Nueva Orden] HTTP request enviado con ID: %', v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Nueva Orden] Error enviando notificación: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger para Ordenes de Trabajo (ON UPDATE TOTAL)
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_update ON ordenes_trabajo;

CREATE TRIGGER trigger_notify_nueva_orden_update
AFTER UPDATE OF total ON ordenes_trabajo
FOR EACH ROW
WHEN (OLD.total = 0 AND NEW.total > 0)
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();

-- Restaurar Trigger para Centro de Copiado (ON INSERT)
-- (Como no gestionamos OCs puras en este refactor, lo dejamos activo por compatibilidad)
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;

CREATE TRIGGER trigger_notify_nueva_orden_copiado
AFTER INSERT ON centro_copiado_ordenes
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();
