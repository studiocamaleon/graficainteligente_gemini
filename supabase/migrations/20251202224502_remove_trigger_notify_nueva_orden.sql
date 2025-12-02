/*
  # Eliminar triggers automáticos de nueva orden
  
  ## Problema
  Los triggers `trigger_notify_nueva_orden` y `trigger_notify_nueva_orden_copiado`
  causan notificaciones duplicadas cuando se crean órdenes desde el frontend.
  
  ## Solución
  Eliminar estos triggers. Las notificaciones se manejarán explícitamente a través
  de Edge Function que replica la lógica del frontend.
  
  ## Cambios
  1. Eliminar trigger_notify_nueva_orden de ordenes_trabajo
  2. Eliminar trigger_notify_nueva_orden_copiado de centro_copiado_ordenes
  3. Eliminar función fn_trigger_whatsapp_nueva_orden
  
  ## Nota
  Se mantienen los triggers de orden finalizada y presupuestos que sí deben ser automáticos.
*/

-- Eliminar triggers
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON ordenes_trabajo;
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;

-- Eliminar función
DROP FUNCTION IF EXISTS fn_trigger_whatsapp_nueva_orden() CASCADE;

-- Comentario para claridad
COMMENT ON TRIGGER trigger_notify_orden_finalizada ON ordenes_trabajo IS
'Envía notificación de WhatsApp cuando orden de trabajo se finaliza.
Para nuevas órdenes, las notificaciones se manejan explícitamente via Edge Function.';
