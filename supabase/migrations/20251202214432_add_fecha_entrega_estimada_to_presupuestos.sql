/*
  # Agregar fecha_entrega_estimada a presupuestos

  ## Problema
  La función fn_convertir_presupuesto_a_orden intenta acceder a 
  v_presupuesto.fecha_entrega_estimada pero esa columna no existe en la tabla presupuestos.

  ## Solución
  Agregar la columna fecha_entrega_estimada a la tabla presupuestos.
  Esta columna es útil para indicar cuándo se espera entregar el trabajo
  si el presupuesto se convierte en orden.

  ## Cambios
  - Agregar columna fecha_entrega_estimada (nullable)
  - Opcional: puede ser NULL si no se especifica fecha de entrega
*/

-- Agregar columna fecha_entrega_estimada
ALTER TABLE presupuestos
ADD COLUMN IF NOT EXISTS fecha_entrega_estimada timestamptz;

-- Agregar comentario
COMMENT ON COLUMN presupuestos.fecha_entrega_estimada IS 
'Fecha estimada de entrega si se convierte en orden de trabajo';
