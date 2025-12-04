/*
  # Agregar soporte para notificaciones de clientes

  1. Actualizaciones
    - Agregar 'nuevo_cliente_registro' al constraint de tipos de notificación
    - Agregar 'cliente' al constraint de tipos de referencia
    - Agregar tipos de notificaciones de presupuestos que ya existen en el código

  2. Seguridad
    - No se modifican las políticas RLS existentes
*/

-- Actualizar constraint de tipos de notificación
ALTER TABLE notificaciones_internas
  DROP CONSTRAINT IF EXISTS notificaciones_internas_tipo_check;

ALTER TABLE notificaciones_internas
  ADD CONSTRAINT notificaciones_internas_tipo_check
  CHECK (tipo IN (
    'pausa_prolongada',
    'paso_completado',
    'orden_finalizada',
    'alerta_produccion',
    'sistema',
    'presupuesto_aprobado',
    'presupuesto_rechazado',
    'presupuesto_por_vencer',
    'presupuesto_vencido',
    'nuevo_cliente_registro'
  ));

-- Actualizar constraint de tipos de referencia
ALTER TABLE notificaciones_internas
  DROP CONSTRAINT IF EXISTS notificaciones_internas_referencia_tipo_check;

ALTER TABLE notificaciones_internas
  ADD CONSTRAINT notificaciones_internas_referencia_tipo_check
  CHECK (referencia_tipo IN (
    'orden_trabajo',
    'orden_item',
    'ruta_paso',
    'pausa',
    'presupuesto',
    'cliente'
  ));