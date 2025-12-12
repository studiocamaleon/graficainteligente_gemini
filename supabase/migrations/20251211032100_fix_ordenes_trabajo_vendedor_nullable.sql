/*
  # Hacer opcional el vendedor en órdenes de trabajo

  ## Problema
  La tabla `ordenes_trabajo` requiere `vendedor_id` (NOT NULL).
  Para órdenes de auto-servicio (App/Web) creadas por invitados, no existe un vendedor humano asociado.

  ## Solución
  Permitir que `vendedor_id` sea NULL, lo que semánticamente indica "Venta Web / Sin Vendedor".
*/

ALTER TABLE ordenes_trabajo 
ALTER COLUMN vendedor_id DROP NOT NULL;
