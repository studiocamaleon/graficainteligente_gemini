/*
  # Agregar fecha_completado a Centro de Copiado

  ## Objetivo
  Mantener coherencia con Órdenes de Trabajo: cuando una orden de Centro de Copiado
  pasa a estado 'finalizada', se establece fecha_completado automáticamente.
  Si se revierte desde 'finalizada'/'entregada' a otro estado, se limpia.
*/

ALTER TABLE public.centro_copiado_ordenes
ADD COLUMN IF NOT EXISTS fecha_completado timestamptz;

COMMENT ON COLUMN public.centro_copiado_ordenes.fecha_completado IS
'Fecha y hora en que la orden pasó a estado finalizada. Se establece automáticamente mediante trigger. Se mantiene al pasar a entregada y se limpia si se revierte a estados anteriores.';

CREATE OR REPLACE FUNCTION public.fn_set_fecha_completado_copiado()
RETURNS TRIGGER AS $$
BEGIN
  -- Caso 1: cambia a 'finalizada' desde otro estado
  IF NEW.estado = 'finalizada'
     AND (OLD.estado IS NULL OR OLD.estado <> 'finalizada') THEN
    IF NEW.fecha_completado IS NULL THEN
      NEW.fecha_completado := now();
    END IF;
  END IF;

  -- Caso 2: deja de ser 'finalizada' o 'entregada' (reversión)
  IF OLD.estado IN ('finalizada', 'entregada')
     AND NEW.estado NOT IN ('finalizada', 'entregada') THEN
    NEW.fecha_completado := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.fn_set_fecha_completado_copiado() IS
'Establece fecha_completado cuando una orden de Centro de Copiado cambia a estado finalizada. Mantiene la fecha al pasar a entregada. Limpia la fecha si se revierte a estados anteriores.';

DROP TRIGGER IF EXISTS trigger_set_fecha_completado_copiado ON public.centro_copiado_ordenes;
CREATE TRIGGER trigger_set_fecha_completado_copiado
  BEFORE UPDATE OF estado ON public.centro_copiado_ordenes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_fecha_completado_copiado();

CREATE INDEX IF NOT EXISTS idx_cc_ordenes_company_estado_fecha_completado
  ON public.centro_copiado_ordenes(company_id, estado, fecha_completado);

