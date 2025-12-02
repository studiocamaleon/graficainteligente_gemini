/*
  # Agregar notificación WhatsApp cuando presupuesto es aprobado
  
  ## Descripción
  Cuando un cliente aprueba un presupuesto, además de la notificación interna,
  se debe enviar un mensaje de WhatsApp al cliente confirmando la aprobación.
  
  ## Cambios
  - Nuevo trigger que llama a la edge function notify-presupuesto
  - Se activa cuando estado cambia a 'aprobado'
  - Envía tipo de notificación 'presupuesto_aprobado'
*/

-- Función trigger para WhatsApp cuando presupuesto es aprobado
CREATE OR REPLACE FUNCTION trigger_whatsapp_presupuesto_aprobado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Solo proceder si el estado cambió a 'aprobado'
  IF NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado') THEN

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Log del intento
    RAISE LOG '[Notify Presupuesto Aprobado] Presupuesto aprobado detectado: % (company: %)',
      NEW.numero_presupuesto, NEW.company_id;

    -- Hacer petición HTTP asíncrona a la Edge Function
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
          'tipo_notificacion', 'presupuesto_aprobado'
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Presupuesto Aprobado] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto Aprobado] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS on_presupuesto_aprobado_whatsapp ON presupuestos;

-- Crear trigger DESPUÉS del trigger de notificación interna
-- para que se ejecute en este orden:
-- 1. on_presupuesto_aprobado (notificación interna)
-- 2. on_presupuesto_aprobado_whatsapp (WhatsApp al cliente)
CREATE TRIGGER on_presupuesto_aprobado_whatsapp
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'aprobado' AND (OLD.estado IS NULL OR OLD.estado != 'aprobado'))
  EXECUTE FUNCTION trigger_whatsapp_presupuesto_aprobado();

COMMENT ON FUNCTION trigger_whatsapp_presupuesto_aprobado() IS
'Envía notificación WhatsApp al cliente cuando aprueba un presupuesto';

COMMENT ON TRIGGER on_presupuesto_aprobado_whatsapp ON presupuestos IS
'Notifica al cliente via WhatsApp cuando aprueba el presupuesto';
