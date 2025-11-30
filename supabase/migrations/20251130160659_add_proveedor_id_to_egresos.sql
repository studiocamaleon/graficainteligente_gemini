/*
  # Agregar relación con proveedores en egresos

  ## Cambios
  - Agregar columna `proveedor_id` (FK a `providers`)
  - Mantener `proveedor_nombre` como fallback para registros legacy
  - Crear índice para mejorar performance de queries
  
  ## Seguridad
  - La FK tiene ON DELETE SET NULL para no eliminar egresos si se borra un proveedor
*/

-- Agregar columna proveedor_id
ALTER TABLE egresos 
ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES providers(id) ON DELETE SET NULL;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_egresos_proveedor ON egresos(proveedor_id);

-- Comentario
COMMENT ON COLUMN egresos.proveedor_id IS 'FK al proveedor registrado en el sistema';
COMMENT ON COLUMN egresos.proveedor_nombre IS 'Nombre de proveedor (legacy, usar proveedor_id)';
