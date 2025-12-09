-- Restaurar constraint único para productos con cantidad fija (legacy/fixed)
-- Esto es necesario para que la operación UPSERT del frontend funcione correctamente
-- al detectar conflictos en estas columnas específicas.

DO $$
BEGIN
  -- Verificar si el constraint ya existe para evitar errores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'productos_impresion_laser_precios'
    AND constraint_name = 'unique_producto_medida_tinta_cantidad_cara'
  ) THEN
    ALTER TABLE productos_impresion_laser_precios
    ADD CONSTRAINT unique_producto_medida_tinta_cantidad_cara 
    UNIQUE(producto_laser_id, medida_ancho, medida_alto, tinta, cantidad, cara_impresa);
  END IF;
END $$;
