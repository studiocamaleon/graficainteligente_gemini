/*
  # Fix: Trigger de Notificación de Presupuestos con Valores Hardcodeados
  
  ## Descripción
  Actualiza la función trigger_notify_presupuesto_enviado() para usar valores
  hardcodeados en lugar de current_setting() (que requiere configuración especial).
  
  ## Cambios
  - URL de Edge Function: https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto
  - Token secreto: DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=
  - Elimina dependencia de current_setting()
  - Usa pg_net para llamadas HTTP asíncronas
  
  ## Notas
  - Notifica cuando el estado cambia a 'enviado'
  - Solo si WhatsApp está configurado en la empresa
  - No bloquea la transacción principal
*/

-- =====================================================
-- ACTUALIZAR FUNCIÓN CON VALORES HARDCODEADOS
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_whatsapp_instance text;
  v_whatsapp_api_key text;
  v_request_id bigint;
BEGIN
  -- Solo proceder si el estado cambió a 'enviado'
  IF NEW.estado = 'enviado' AND (OLD.estado IS NULL OR OLD.estado != 'enviado') THEN

    -- Obtener configuración de WhatsApp de la empresa
    SELECT
      whatsapp_instance_name,
      whatsapp_api_key
    INTO
      v_whatsapp_instance,
      v_whatsapp_api_key
    FROM companies
    WHERE id = NEW.company_id;

    -- Solo notificar si WhatsApp está configurado
    IF v_whatsapp_instance IS NOT NULL AND v_whatsapp_api_key IS NOT NULL THEN

      -- VALORES CONFIGURADOS DIRECTAMENTE
      v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
      v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

      -- Log del intento
      RAISE LOG '[Notify Presupuesto] Presupuesto enviado detectado: % (company: %)',
        NEW.numero_presupuesto, NEW.company_id;

      -- Hacer petición HTTP asíncrona a la Edge Function
      -- Usamos pg_net para no bloquear la transacción
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

    ELSE
      RAISE LOG '[Notify Presupuesto] WhatsApp no configurado para company: %', NEW.company_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Dispara notificación de WhatsApp cuando un presupuesto cambia a estado enviado. Usa valores hardcodeados para URL y token.';
