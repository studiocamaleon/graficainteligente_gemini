/*
  # Agregar columna notas a tabla cajas

  1. Cambios
    - Agregar columna `notas` (text, nullable) a tabla `cajas`
    - Permite almacenar notas adicionales sobre cada caja

  2. Notas
    - Campo opcional para información adicional
    - No afecta funcionalidad existente
*/

-- Agregar columna notas a la tabla cajas
ALTER TABLE cajas ADD COLUMN IF NOT EXISTS notas text;

-- Agregar comentario para documentación
COMMENT ON COLUMN cajas.notas IS 'Notas adicionales sobre la caja';
