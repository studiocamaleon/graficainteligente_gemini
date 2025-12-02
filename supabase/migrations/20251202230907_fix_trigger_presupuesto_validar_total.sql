/*
  # Fix: Validar que presupuesto tenga total antes de enviar notificación
  
  ## Problema
  El trigger se ejecuta AFTER INSERT del presupuesto, pero en ese momento:
  - El presupuesto todavía no tiene items insertados
  - El total es 0
  - El mensaje WhatsApp muestra "Total: $ 0"
  
  ## Causa
  El flujo de creación es:
  1. INSERT presupuesto con total = 0
  2. Trigger se dispara → mensaje con total = 0 ❌
  3. INSERT items
  4. UPDATE presupuesto con total calculado
  
  ## Solución
  Modificar el trigger para que SOLO se dispare cuando:
  - Estado = 'enviado'
  - Total > 0 (tiene items y precio calculado)
  
  ## Cambios
  - Actualizar trigger INSERT para verificar total > 0
  - Actualizar trigger UPDATE para verificar total > 0
*/

-- Función para notificar cuando se crea un presupuesto ya enviado
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_creado_enviado() CASCADE;

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_creado_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  -- Debug: Mostrar que se ejecuta el trigger de INSERT
  RAISE NOTICE '[DEBUG Presupuesto INSERT] Nuevo presupuesto creado';
  RAISE NOTICE '[DEBUG Presupuesto INSERT] Estado: %, Total: %', NEW.estado, NEW.total;

  -- Solo proceder si:
  -- 1. Se creó directamente con estado 'enviado'
  -- 2. Tiene un total mayor a 0 (tiene items con precios)
  IF NEW.estado = 'enviado' AND NEW.total > 0 THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto INSERT] ✅ PRESUPUESTO LISTO PARA ENVIAR';
    RAISE NOTICE '[Notify Presupuesto INSERT] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto INSERT] Total: %', NEW.total;
    RAISE NOTICE '[Notify Presupuesto INSERT] Company ID: %', NEW.company_id;
    RAISE NOTICE '===========================================';

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      RAISE NOTICE '[Notify Presupuesto INSERT] 🚀 Enviando petición HTTP...';
      
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
      -- Si falla el envío HTTP, loguear pero NO fallar la transacción
      RAISE WARNING '[Notify Presupuesto INSERT] ❌ Error enviando notificación HTTP: %', SQLERRM;
      RAISE NOTICE '===========================================';
    END;

    -- Actualizar fecha_enviado si es NULL
    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
      
      RAISE NOTICE '[Notify Presupuesto INSERT] ✅ fecha_enviado actualizada';
    END IF;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto INSERT] ⏭️ No se envía notificación';
    RAISE NOTICE '[DEBUG Presupuesto INSERT] Razón: estado=%s (esperado: enviado), total=%s (esperado: >0)', 
      NEW.estado, NEW.total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'net';

-- Recrear trigger para INSERT
DROP TRIGGER IF EXISTS on_presupuesto_creado_enviado ON presupuestos;

CREATE TRIGGER on_presupuesto_creado_enviado
  AFTER INSERT ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'enviado' AND NEW.total > 0)
  EXECUTE FUNCTION trigger_notify_presupuesto_creado_enviado();

-- También actualizar el trigger de UPDATE
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_enviado() CASCADE;

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
BEGIN
  RAISE NOTICE '[DEBUG Presupuesto UPDATE] Estado cambió de % a %', OLD.estado, NEW.estado;
  RAISE NOTICE '[DEBUG Presupuesto UPDATE] Total: %', NEW.total;

  -- Solo enviar si:
  -- 1. Cambió de no-enviado a enviado
  -- 2. Tiene un total mayor a 0
  IF OLD.estado != 'enviado' AND NEW.estado = 'enviado' AND NEW.total > 0 THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto UPDATE] ✅ PRESUPUESTO LISTO PARA ENVIAR';
    RAISE NOTICE '[Notify Presupuesto UPDATE] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto UPDATE] Total: %', NEW.total;
    RAISE NOTICE '===========================================';

    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

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

      RAISE NOTICE '[Notify Presupuesto UPDATE] ✅ HTTP request enviado con ID: %', v_request_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Notify Presupuesto UPDATE] ❌ Error enviando notificación HTTP: %', SQLERRM;
    END;

    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
    END IF;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto UPDATE] ⏭️ No se envía notificación';
    RAISE NOTICE '[DEBUG Presupuesto UPDATE] Razón: cambio_estado=%s->%s, total=%s', 
      OLD.estado, NEW.estado, NEW.total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'net';

-- Recrear trigger para UPDATE
DROP TRIGGER IF EXISTS on_presupuesto_enviado ON presupuestos;

CREATE TRIGGER on_presupuesto_enviado
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  WHEN (OLD.estado != 'enviado' AND NEW.estado = 'enviado' AND NEW.total > 0)
  EXECUTE FUNCTION trigger_notify_presupuesto_enviado();

COMMENT ON FUNCTION trigger_notify_presupuesto_creado_enviado() IS
'Envía notificación WhatsApp cuando un presupuesto se crea con estado enviado Y tiene total > 0';

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Envía notificación WhatsApp cuando un presupuesto cambia a estado enviado Y tiene total > 0';
