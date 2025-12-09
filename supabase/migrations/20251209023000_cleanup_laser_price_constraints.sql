/*
  # Limpieza de Constraints en Precios Láser

  ## Descripción
  Esta migración elimina el constraint de unicidad legado `unique_producto_medida_tinta_cantidad_cara`
  que fue creado durante la reversión de tintas pero que conflictua o es redundante
  con la lógica de rangos implementada posteriormente.

  La lógica de rangos utiliza índices parciales:
  - idx_unique_precio_cantidades (para cantidad IS NOT NULL)
  - idx_unique_precio_rangos (para rango_precio_min IS NOT NULL)

  Por lo tanto, el constraint global `unique_producto_medida_tinta_cantidad_cara` debe ser eliminado
  para evitar posibles conflictos con filas que tienen cantidad = NULL.
*/

DO $$
BEGIN
  -- Eliminar constraint legado si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'productos_impresion_laser_precios'
    AND constraint_name = 'unique_producto_medida_tinta_cantidad_cara'
  ) THEN
    ALTER TABLE productos_impresion_laser_precios
    DROP CONSTRAINT unique_producto_medida_tinta_cantidad_cara;
  END IF;

  -- Asegurarse de que el constraint original también esté eliminado (por si acaso)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'productos_impresion_laser_precios'
    AND constraint_name = 'unique_precio_configuracion'
  ) THEN
    ALTER TABLE productos_impresion_laser_precios
    DROP CONSTRAINT unique_precio_configuracion;
  END IF;

END $$;
