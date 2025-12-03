/*
  # Fix: Agregar frontend_origin al trigger de presupuestos
  
  ## Problema
  El trigger envía siempre la URL de producción hardcodeada,
  causando que en desarrollo se generen URLs incorrectas.
  
  ## Solución
  Agregar frontend_origin al body del request para que la Edge Function
  use la URL correcta según el entorno.
  
  ## Cambios
  - Actualizar trigger_notify_presupuesto_creado_enviado para incluir frontend_origin
*/

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_creado_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
  v_frontend_url text;
BEGIN
  -- Solo proceder si se creó directamente con estado 'enviado'
  IF NEW.estado = 'enviado' THEN

    -- Obtener URL del frontend desde configuración
    -- Por defecto usar producción
    v_frontend_url := coalesce(
      current_setting('app.frontend_url', true),
      'https://www.graficainteligente.com'
    );

    -- VALORES CONFIGURADOS
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

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
          'tipo_notificacion', 'presupuesto_listo',
          'frontend_origin', v_frontend_url
        )
      ) INTO v_request_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto INSERT] Error enviando notificación HTTP: %', SQLERRM;
    END;

    -- Actualizar fecha_enviado si es NULL
    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_notify_presupuesto_creado_enviado() IS
'Envía notificación WhatsApp cuando un presupuesto se crea directamente con estado enviado';
