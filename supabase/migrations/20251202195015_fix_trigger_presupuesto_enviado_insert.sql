/*
  # Fix: Agregar trigger para INSERT de presupuestos
  
  ## Problema Detectado
  Cuando se usa "Guardar y enviar", el presupuesto se crea directamente con estado 'enviado',
  por lo que el trigger actual (que solo funciona en UPDATE) nunca se ejecuta.
  
  Ejemplo:
  - INSERT presupuesto con estado='enviado' → ❌ No se envía WhatsApp
  - UPDATE presupuesto de borrador a enviado → ✅ Sí se envía WhatsApp
  
  ## Solución
  Crear un trigger adicional para INSERT que:
  1. Se ejecute AFTER INSERT
  2. Verifique si el estado es 'enviado'
  3. Llame a la misma función de notificación
  
  ## Cambios
  - Nueva función: trigger_notify_presupuesto_creado_enviado()
  - Nuevo trigger: on_presupuesto_creado_enviado
  - Mantiene trigger existente para UPDATEs
*/

-- Función para notificar cuando se crea un presupuesto ya enviado
CREATE OR REPLACE FUNCTION trigger_notify_presupuesto_creado_enviado()
RETURNS TRIGGER AS $$
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
    RAISE NOTICE '[Notify Presupuesto INSERT] Cliente ID: %', NEW.cliente_id;
    RAISE NOTICE '===========================================';

    -- VALORES CONFIGURADOS DIRECTAMENTE
    v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-presupuesto';
    v_trigger_secret := 'DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=';

    -- Hacer petición HTTP asíncrona a la Edge Function
    BEGIN
      RAISE NOTICE '[Notify Presupuesto INSERT] 🚀 Enviando petición HTTP...';
      RAISE NOTICE '[Notify Presupuesto INSERT] URL: %', v_edge_function_url;
      
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
      RAISE WARNING '[Notify Presupuesto INSERT] Error code: %', SQLSTATE;
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
    RAISE NOTICE '[DEBUG Presupuesto INSERT] ⏭️ No se envía notificación (estado no es enviado)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS on_presupuesto_creado_enviado ON presupuestos;

-- Crear trigger para INSERT
CREATE TRIGGER on_presupuesto_creado_enviado
  AFTER INSERT ON presupuestos
  FOR EACH ROW
  WHEN (NEW.estado = 'enviado')
  EXECUTE FUNCTION trigger_notify_presupuesto_creado_enviado();

-- Comentarios
COMMENT ON FUNCTION trigger_notify_presupuesto_creado_enviado() IS
'Envía notificación WhatsApp cuando un presupuesto se crea directamente con estado enviado (Guardar y enviar)';

COMMENT ON TRIGGER on_presupuesto_creado_enviado ON presupuestos IS
'Notifica al cliente cuando el presupuesto se crea directamente como enviado';
