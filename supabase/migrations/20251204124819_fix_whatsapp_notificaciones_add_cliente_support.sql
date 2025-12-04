/*
  # Fix: Agregar soporte para notificaciones de clientes en whatsapp_notificaciones

  ## Problema
  La tabla whatsapp_notificaciones solo soporta notificaciones asociadas a órdenes o presupuestos,
  pero las notificaciones de clientes (auto-registro, aprobación, rechazo) no tienen estas referencias.

  Esto causa que TODOS los INSERTs de notificaciones de clientes fallen porque violan el constraint
  que requiere obligatoriamente una de estas referencias.

  ## Solución
  1. Agregar columna cliente_id para referenciar clientes
  2. Modificar constraint de referencias para permitir cliente_id
  3. Agregar nuevos tipos de notificación relacionados a clientes
  4. Crear índice en cliente_id
  5. Actualizar RLS policies

  ## Nuevos Tipos de Notificación
  - auto_registro_cliente: Cuando un cliente se registra por primera vez
  - cliente_aprobado: Cuando se aprueba un cliente pendiente
  - cliente_rechazado: Cuando se rechaza un cliente pendiente
  - factura_disponible: Cuando se registra una factura

  ## Cambios
  ANTES: Solo orden_trabajo_id, orden_copiado_id, presupuesto_id
  DESPUÉS: + cliente_id con constraint actualizado
*/

-- =====================================================
-- 1. AGREGAR COLUMNA cliente_id
-- =====================================================

ALTER TABLE whatsapp_notificaciones
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN whatsapp_notificaciones.cliente_id IS
  'Cliente relacionado con la notificación (para notificaciones de registro, aprobación, rechazo)';

-- =====================================================
-- 2. MODIFICAR CONSTRAINT DE REFERENCIAS
-- =====================================================

-- Eliminar constraint anterior que solo contempla órdenes y presupuestos
ALTER TABLE whatsapp_notificaciones
DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_check_referencia;

-- Crear nuevo constraint que incluye cliente_id
-- Debe haber exactamente UNO de los cuatro IDs (exclusividad mutua)
ALTER TABLE whatsapp_notificaciones
ADD CONSTRAINT whatsapp_notificaciones_check_referencia
CHECK (
  (
    (orden_trabajo_id IS NOT NULL AND orden_copiado_id IS NULL AND presupuesto_id IS NULL AND cliente_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NOT NULL AND presupuesto_id IS NULL AND cliente_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NULL AND presupuesto_id IS NOT NULL AND cliente_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NULL AND presupuesto_id IS NULL AND cliente_id IS NOT NULL)
  )
);

COMMENT ON CONSTRAINT whatsapp_notificaciones_check_referencia ON whatsapp_notificaciones IS
'Asegura que cada notificación esté asociada a exactamente UNA entidad: orden_trabajo, orden_copiado, presupuesto O cliente';

-- =====================================================
-- 3. AGREGAR NUEVOS TIPOS DE NOTIFICACIÓN
-- =====================================================

-- Eliminar constraint de tipo_notificacion anterior
ALTER TABLE whatsapp_notificaciones
DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_tipo_notificacion_check;

-- Crear nuevo constraint con tipos extendidos
ALTER TABLE whatsapp_notificaciones
ADD CONSTRAINT whatsapp_notificaciones_tipo_notificacion_check
CHECK (tipo_notificacion IN (
  'nueva_orden_trabajo',
  'nueva_orden_copiado',
  'orden_finalizada',
  'presupuesto_enviado',
  'presupuesto_aprobado',
  'auto_registro_cliente',
  'cliente_aprobado',
  'cliente_rechazado',
  'factura_disponible'
));

COMMENT ON CONSTRAINT whatsapp_notificaciones_tipo_notificacion_check ON whatsapp_notificaciones IS
'Tipos de notificación permitidos: órdenes, presupuestos, clientes y facturas';

-- =====================================================
-- 4. CREAR ÍNDICE EN cliente_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_cliente_id
  ON whatsapp_notificaciones(cliente_id)
  WHERE cliente_id IS NOT NULL;

COMMENT ON INDEX idx_whatsapp_notificaciones_cliente_id IS
  'Índice para búsquedas rápidas de notificaciones por cliente';

-- =====================================================
-- 5. ACTUALIZAR RLS POLICIES
-- =====================================================

-- Las políticas existentes ya permiten SELECT/INSERT basado en company_id
-- No necesitamos modificarlas porque cliente_id está en la misma company

-- Comentarios finales
COMMENT ON TABLE whatsapp_notificaciones IS
'Registro de todas las notificaciones enviadas por WhatsApp: órdenes, presupuestos, clientes y facturas';
