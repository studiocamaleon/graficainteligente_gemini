/*
  # Debug: Agregar logging mejorado al trigger de presupuestos
  
  ## Cambios
  - Agregar RAISE NOTICE para que los mensajes sean visibles en logs
  - Mejorar formato de logs para debugging
  - Mantener funcionalidad existente
*/

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Debug: Mostrar siempre que se ejecuta el trigger
  RAISE NOTICE '[DEBUG Presupuesto] Trigger ejecutándose - Estado actual: %, Estado anterior: %', NEW.estado, OLD.estado;

  -- Solo proceder si el estado cambió a 'enviado'
  IF NEW.estado = 'enviado' AND (OLD IS NULL OR OLD.estado IS NULL OR OLD.estado != 'enviado') THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto] ✅ ESTADO CAMBIADO A ENVIADO';
    RAISE NOTICE '[Notify Presupuesto] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto] Company ID: %', NEW.company_id;
    RAISE NOTICE '[Notify Presupuesto] Presupuesto ID: %', NEW.id;
    RAISE NOTICE '===========================================';

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      RAISE NOTICE '[Notify Presupuesto] 🚀 Enviando petición HTTP...';
      RAISE NOTICE '[Notify Presupuesto] URL: %', v_edge_function_url;
      
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

      RAISE NOTICE '[Notify Presupuesto] ✅ HTTP request enviado con ID: %', v_request_id;
      RAISE NOTICE '===========================================';
      
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto] ❌ Error enviando notificación HTTP: %', SQLERRM;
      RAISE WARNING '[Notify Presupuesto] Error code: %', SQLSTATE;
      RAISE NOTICE '===========================================';
    END;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto] ⏭️ No se envía notificación (estado no es enviado o ya estaba enviado)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Dispara notificación de WhatsApp cuando un presupuesto cambia a estado enviado. 
Versión con logging mejorado para debugging.';
