/*
  # Fix: Eliminar verificación innecesaria de WhatsApp en trigger de presupuestos
  
  ## Problema
  El trigger verifica campos whatsapp_instance_name y whatsapp_api_key que NO existen
  en la tabla companies, causando que NUNCA se envíen notificaciones.
  
  ## Solución
  - Eliminar la verificación de campos de WhatsApp en companies
  - La verificación de conexión se hace en la Edge Function usando el backend de Render
  - El trigger simplemente llama a la Edge Function siempre
  
  ## Cambios
  - ANTES: Verificaba whatsapp_instance_name y whatsapp_api_key (campos inexistentes)
  - DESPUÉS: Siempre llama a la Edge Function (ella verifica la conexión)
*/

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Solo proceder si el estado cambió a 'enviado'
  IF NEW.estado = 'enviado' AND (OLD.estado IS NULL OR OLD.estado != 'enviado') THEN

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Log del intento
    RAISE LOG '[Notify Presupuesto] Presupuesto enviado detectado: % (company: %)',
      NEW.numero_presupuesto, NEW.company_id;

    -- Hacer petición HTTP asíncrona a la Edge Function
    -- La Edge Function verificará si WhatsApp está conectado
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Trigger-Secret', v_trigger_secret
        ),
        body := jsonb_build_object(
          'presupuesto_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_notificacion', 'presupuesto_listo'
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Presupuesto] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Dispara notificación de WhatsApp cuando un presupuesto cambia a estado enviado. 
La verificación de conexión WhatsApp se hace en la Edge Function.';
