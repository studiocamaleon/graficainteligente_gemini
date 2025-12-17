-- Drop triggers that cause race conditions (firing before items are inserted)
-- We will handle notifications manually from the frontend/API after full insertion.

DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON ordenes_trabajo;
DROP FUNCTION IF EXISTS fn_trigger_whatsapp_nueva_orden CASCADE;

DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;
