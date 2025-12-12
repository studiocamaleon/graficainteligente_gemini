-- Update the trigger function to use the correct default frontend URL (grafica.ar)

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
    -- Por defecto usar producción (URL ACTUALIZADA)
    v_frontend_url := coalesce(
      current_setting('app.frontend_url', true),
      'https://www.grafica.ar'
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
