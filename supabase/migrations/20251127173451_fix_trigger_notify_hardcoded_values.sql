/*
  # Fix: Actualizar Trigger con Valores Hardcodeados

  ## Descripción
  Actualiza la función fn_trigger_whatsapp_orden_finalizada() para usar valores
  hardcodeados en lugar de variables de base de datos (que requieren permisos de superusuario).

  ## Cambios
  - URL de Edge Function: https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada
  - Token secreto: DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=
  - Elimina dependencia de current_setting()
  
  ## Notas
  - Este cambio permite que el sistema funcione sin permisos de superusuario
  - Si se cambia el proyecto o el token, se debe actualizar esta función
*/

-- =====================================================
-- ACTUALIZAR FUNCIÓN CON VALORES CORRECTOS
-- =====================================================

CREATE OR REPLACE FUNCTION fn_trigger_whatsapp_orden_finalizada()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_tipo_orden text;
  v_request_id bigint;
BEGIN
  -- Solo procesar si el estado cambió a "finalizada"
  IF NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN

    -- Determinar tipo de orden basándose en la tabla
    IF TG_TABLE_NAME = 'ordenes_trabajo' THEN
      v_tipo_orden := 'trabajo';
    ELSIF TG_TABLE_NAME = 'centro_copiado_ordenes' THEN
      v_tipo_orden := 'copiado';
    ELSE
      -- Tabla no reconocida, salir
      RETURN NEW;
    END IF;

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Log del intento
    RAISE LOG '[Notify Trigger] Orden finalizada detectada: % (company: %, tipo: %)',
      NEW.id, NEW.company_id, v_tipo_orden;

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
          'orden_id', NEW.id::text,
          'company_id', NEW.company_id::text,
          'tipo_orden', v_tipo_orden
        )
      ) INTO v_request_id;

      RAISE LOG '[Notify Trigger] HTTP request enviado con ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Trigger] Error enviando notificación HTTP: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_trigger_whatsapp_orden_finalizada() IS
'Dispara notificación de WhatsApp cuando una orden cambia a estado finalizada. Usa valores hardcodeados para URL y token.';
