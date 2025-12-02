/*
  # Fix: Enviar notificación cuando se actualiza el total del presupuesto
  
  ## Problema
  El flujo de creación de presupuestos es:
  1. INSERT presupuesto con estado='enviado' pero total=0
  2. INSERT items
  3. UPDATE presupuesto con total calculado
  
  Con el trigger actual que verifica `total > 0` en INSERT, nunca se dispara
  porque en el INSERT el total siempre es 0.
  
  ## Solución
  Cambiar la lógica para que el trigger se dispare en el UPDATE cuando:
  - El estado es 'enviado' (ya lo era o acaba de cambiar)
  - El total cambió de 0 a un valor > 0
  - Aún no se ha enviado notificación (fecha_enviado es NULL)
  
  ## Estrategia
  1. Eliminar trigger INSERT (ya no es necesario)
  2. Actualizar trigger UPDATE para detectar cuando se calcula el total
  3. Enviar notificación solo cuando total pasa de 0 a > 0 con estado='enviado'
*/

-- Eliminar trigger INSERT anterior
DROP TRIGGER IF EXISTS on_presupuesto_creado_enviado ON presupuestos;
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_creado_enviado() CASCADE;

-- Actualizar función de trigger UPDATE
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_enviado() CASCADE;

CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_enviado()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_function_url text;
  v_trigger_secret text;
  v_request_id bigint;
  v_debe_enviar boolean := false;
BEGIN
  -- Debug
  RAISE NOTICE '[DEBUG Presupuesto] UPDATE detectado';
  RAISE NOTICE '[DEBUG Presupuesto] OLD: estado=%, total=%, fecha_enviado=%', 
    OLD.estado, OLD.total, OLD.fecha_enviado;
  RAISE NOTICE '[DEBUG Presupuesto] NEW: estado=%, total=%, fecha_enviado=%', 
    NEW.estado, NEW.total, NEW.fecha_enviado;

  -- Determinar si debe enviar notificación
  -- CASO 1: Cambió de borrador a enviado Y tiene total > 0
  IF OLD.estado != 'enviado' AND NEW.estado = 'enviado' AND NEW.total > 0 THEN
    v_debe_enviar := true;
    RAISE NOTICE '[Notify Presupuesto] CASO 1: Cambió a enviado con total';
  END IF;

  -- CASO 2: Ya estaba en enviado, el total cambió de 0 a > 0 (se agregaron items)
  IF OLD.estado = 'enviado' AND NEW.estado = 'enviado' AND 
     OLD.total = 0 AND NEW.total > 0 AND NEW.fecha_enviado IS NULL THEN
    v_debe_enviar := true;
    RAISE NOTICE '[Notify Presupuesto] CASO 2: Total calculado en presupuesto enviado';
  END IF;

  -- Si debe enviar notificación
  IF v_debe_enviar THEN

    RAISE NOTICE '===========================================';
    RAISE NOTICE '[Notify Presupuesto] ✅ ENVIANDO NOTIFICACIÓN';
    RAISE NOTICE '[Notify Presupuesto] Presupuesto: %', NEW.numero_presupuesto;
    RAISE NOTICE '[Notify Presupuesto] Total: %', NEW.total;
    RAISE NOTICE '[Notify Presupuesto] Estado: %', NEW.estado;
    RAISE NOTICE '===========================================';

    -- Configuración
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona
    BEGIN
      RAISE NOTICE '[Notify Presupuesto] 🚀 Enviando petición HTTP...';
      
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
      RAISE WARNING '[Notify Presupuesto] ❌ Error enviando notificación HTTP: %', SQLERRM;
      RAISE NOTICE '===========================================';
    END;

    -- Actualizar fecha_enviado si es NULL
    IF NEW.fecha_enviado IS NULL THEN
      UPDATE presupuestos 
      SET fecha_enviado = now() 
      WHERE id = NEW.id;
      
      RAISE NOTICE '[Notify Presupuesto] ✅ fecha_enviado actualizada';
    END IF;

  ELSE
    RAISE NOTICE '[DEBUG Presupuesto] ⏭️ No se envía notificación';
    RAISE NOTICE '[DEBUG Presupuesto] debe_enviar = false';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'net';

-- Recrear trigger UPDATE (sin condición WHEN, evaluamos dentro de la función)
DROP TRIGGER IF EXISTS on_presupuesto_enviado ON presupuestos;

CREATE TRIGGER on_presupuesto_enviado
  AFTER UPDATE ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_presupuesto_enviado();

COMMENT ON FUNCTION trigger_notify_presupuesto_enviado() IS
'Envía notificación WhatsApp cuando:
1. Presupuesto cambia a estado enviado con total > 0, O
2. Presupuesto ya enviado recibe su total calculado (items agregados)';

COMMENT ON TRIGGER on_presupuesto_enviado ON presupuestos IS
'Notifica al cliente cuando el presupuesto está listo (enviado + total calculado)';
