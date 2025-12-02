/*
  # Fix: Constraint de whatsapp_notificaciones no permite presupuestos
  
  ## Problema
  El constraint whatsapp_notificaciones_check solo permite:
  - orden_trabajo_id OR orden_copiado_id
  
  Pero NO permite presupuesto_id, causando que fallen todos los INSERT de notificaciones de presupuestos.
  
  ## Solución
  - Eliminar el constraint viejo
  - Crear nuevo constraint que incluya presupuesto_id
  - Validar que al menos UNO de los tres IDs esté presente
  - Validar que NO haya múltiples IDs al mismo tiempo (exclusividad)
  
  ## Cambios
  ANTES: (orden_trabajo OR orden_copiado) solamente
  DESPUÉS: (orden_trabajo OR orden_copiado OR presupuesto) con exclusividad
*/

-- Eliminar el constraint viejo que no contempla presupuestos
ALTER TABLE whatsapp_notificaciones
DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_check;

-- Crear nuevo constraint que incluye presupuestos
-- Debe haber exactamente UNO de los tres IDs (exclusividad mutua)
ALTER TABLE whatsapp_notificaciones
ADD CONSTRAINT whatsapp_notificaciones_check_referencia 
CHECK (
  (
    (orden_trabajo_id IS NOT NULL AND orden_copiado_id IS NULL AND presupuesto_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NOT NULL AND presupuesto_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NULL AND presupuesto_id IS NOT NULL)
  )
);

COMMENT ON CONSTRAINT whatsapp_notificaciones_check_referencia ON whatsapp_notificaciones IS
'Asegura que cada notificación esté asociada a exactamente UNA entidad: orden_trabajo, orden_copiado O presupuesto';
