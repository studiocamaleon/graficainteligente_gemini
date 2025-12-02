/*
  # Fix: Usar valores hardcodeados en trigger de nueva orden

  ## Problema
  El trigger intenta obtener edge_function_url de evolution_integrations
  pero esa columna no existe. El sistema usa valores hardcodeados.

  ## Solución
  Actualizar la función para usar los mismos valores hardcodeados
  que usa fn_trigger_whatsapp_orden_finalizada.
*/

DROP FUNCTION IF EXISTS fn_trigger_whatsapp_nueva_orden() CASCADE;

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
BEGIN
  -- Determinar tipo de orden
  IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
    v_tipo_orden := 'trabajo';
  ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
    v_tipo_orden := 'copiado';
  ELSE
    RETURN NEW;
  END IF;

  -- Valores hardcodeados (igual que fn_trigger_whatsapp_orden_finalizada)
  v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada';
  v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

  -- Log del intento
  RAISE LOG '[Nueva Orden] Orden creada: % (company: %, tipo: %)',
    NEW.id, NEW.company_id, v_tipo_orden;

  -- Hacer petición HTTP asíncrona
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret
      ),
      body := jsonb_build_object(
        'orden_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'tipo_orden', v_tipo_orden,
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

-- Recrear triggers
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON ordenes_trabajo;
CREATE TRIGGER trigger_notify_nueva_orden
AFTER INSERT ON ordenes_trabajo
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();

DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;
CREATE TRIGGER trigger_notify_nueva_orden_copiado
AFTER INSERT ON centro_copiado_ordenes
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_whatsapp_nueva_orden();

COMMENT ON FUNCTION fn_trigger_whatsapp_nueva_orden() IS
'Dispara notificación WhatsApp cuando se crea nueva orden. Usa valores hardcodeados.';
