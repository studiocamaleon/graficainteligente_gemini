
-- Inspect the last 10 items added to detailed budgets
SELECT 
  id, 
  created_at, 
  producto_nombre, 
  descripcion, 
  tipo_item,
  configuracion,
  producto_id
FROM presupuestos_items 
ORDER BY created_at DESC 
LIMIT 10;
