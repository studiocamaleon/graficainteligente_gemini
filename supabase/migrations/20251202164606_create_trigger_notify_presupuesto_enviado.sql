/*
  # Trigger para notificaciones de presupuestos

  1. Nueva función trigger
    - `trigger_notify_presupuesto_enviado`
    - Detecta cuando un presupuesto cambia a estado 'enviado'
    - Llama a edge function para enviar WhatsApp

  2. Trigger
    - Se ejecuta AFTER UPDATE
    - Solo cuando cambia el estado a 'enviado'
    - Envía notificación al cliente
*/

-- Función para notificar presupuesto enviado
CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid;
  v_whatsapp_instance text;
  v_whatsapp_api_key text;
  v_edge_function_url text;
  v_supabase_anon_key text;
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

      -- URL de la edge function (ajustar según ambiente)
      v_edge_function_url := current_setting('app.supabase_url', true) || '/functions/v1/notify-presupuesto';
      v_supabase_anon_key := current_setting('app.supabase_anon_key', true);

      -- Llamar a edge function de forma asíncrona usando pg_net
      PERFORM net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'presupuesto_id', NEW.id,
          'tipo_notificacion', 'presupuesto_listo'
        )
      );

      -- Log para debugging
      RAISE NOTICE 'Notificación de presupuesto enviado programada: %', NEW.numero_presupuesto;

    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS on_presupuesto_enviado ON presupuestos;

-- Crear trigger
CREATE TRIGGER on_presupuesto_enviado
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'enviado' AND (OLD.estado IS NULL OR OLD.estado != 'enviado'))
  EXECUTE FUNCTION trigger_notify_presupuesto_enviado();

-- Comentarios
COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
  'Envía notificación WhatsApp cuando un presupuesto se marca como enviado';

COMMENT ON TRIGGER on_presupuesto_enviado ON presupuestos IS
  'Notifica al cliente cuando el presupuesto está listo';
