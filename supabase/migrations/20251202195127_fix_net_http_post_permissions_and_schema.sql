/*
  # Fix: Permisos y esquema para net.http_post
  
  ## Problema
  El trigger puede estar fallando porque:
  1. La función no tiene acceso al esquema 'net'
  2. Los permisos de SECURITY DEFINER no incluyen acceso a net
  
  ## Solución
  - Agregar explícitamente 'net' al search_path
  - Asegurar que la función tenga permisos correctos
  - Hacer el http_post más robusto con manejo de errores
*/

-- Recrear función con search_path explícito que incluya 'net'
CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'  -- Agregar 'net' explícitamente
AS $$
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
      
      -- Llamar a net.http_post con esquema explícito
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
$$;

-- Recrear función de INSERT con mismo fix
CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_creado_enviado()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'  -- Agregar 'net' explícitamente
AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Debug: Mostrar que se ejecuta el trigger de INSERT
  RAISE NOTICE '[DEBUG Presupuesto INSERT] Nuevo presupuesto creado con estado: %', NEW.estado;

  -- Solo proceder si se creó directamente con estado 'enviado'
  IF NEW.estado = 'enviado' THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto INSERT] ✅ PRESUPUESTO CREADO DIRECTAMENTE COMO ENVIADO';
    RAISE NOTICE '[Notify Presupuesto INSERT] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto INSERT] Company ID: %', NEW.company_id;
    RAISE NOTICE '[Notify Presupuesto INSERT] Presupuesto ID: %', NEW.id;
    RAISE NOTICE '===========================================';

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      RAISE NOTICE '[Notify Presupuesto INSERT] 🚀 Enviando petición HTTP...';
      
      -- Llamar a net.http_post con esquema explícito
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

      RAISE NOTICE '[Notify Presupuesto INSERT] ✅ HTTP request enviado con ID: %', v_request_id;
      RAISE NOTICE '===========================================';
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Notify Presupuesto INSERT] ❌ Error enviando notificación HTTP: %', SQLERRM;
      RAISE WARNING '[Notify Presupuesto INSERT] Error code: %', SQLSTATE;
      RAISE NOTICE '===========================================';
    END;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto INSERT] ⏭️ No se envía notificación (estado no es enviado)';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Dispara notificación WhatsApp en UPDATE. Incluye net en search_path para http_post.';

COMMENT ON FUNCTION trigger_notify_presupuesto_creado_enviado() IS
'Dispara notificación WhatsApp en INSERT. Incluye net en search_path para http_post.';
