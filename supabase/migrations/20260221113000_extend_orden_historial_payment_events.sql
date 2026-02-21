-- Extiende tipos de eventos del historial de OT para diferenciar pagos editados/eliminados
-- y corrige registros históricos previamente guardados como "modificacion".

ALTER TABLE public.ordenes_trabajo_historial
  DROP CONSTRAINT IF EXISTS check_tipo_evento;

ALTER TABLE public.ordenes_trabajo_historial
  ADD CONSTRAINT check_tipo_evento CHECK (
    tipo_evento IN (
      'creacion',
      'modificacion',
      'cambio_estado',
      'pago_registrado',
      'pago_editado',
      'pago_eliminado',
      'nota_agregada',
      'item_agregado',
      'item_modificado',
      'item_eliminado',
      'cotizacion_enviada',
      'orden_confirmada',
      'orden_cancelada'
    )
  );

-- Backfill de eventos viejos para mejorar trazabilidad sin perder historial.
UPDATE public.ordenes_trabajo_historial
SET tipo_evento = 'pago_editado'
WHERE tipo_evento = 'modificacion'
  AND descripcion = 'Pago actualizado';

UPDATE public.ordenes_trabajo_historial
SET tipo_evento = 'pago_eliminado'
WHERE tipo_evento = 'modificacion'
  AND descripcion = 'Pago eliminado';

-- Índice compuesto para consultas de auditoría por orden/evento recientes.
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_historial_orden_evento_created
  ON public.ordenes_trabajo_historial (orden_id, tipo_evento, created_at DESC);
