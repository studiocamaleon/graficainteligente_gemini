/*
  # Agregar campo ancho_maximo a productos

  1. Cambios
    - Agregar columna `ancho_maximo` a la tabla `productos`
    - Este campo se usará para productos con pricing por MT Lineal
    - Es opcional (nullable) porque solo aplica a ciertos tipos de productos

  2. Notas
    - Los productos existentes no se verán afectados
    - El campo almacena el ancho máximo en centímetros (cm)
*/

-- Agregar columna ancho_maximo
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS ancho_maximo numeric DEFAULT NULL;

-- Agregar comentario para documentación
COMMENT ON COLUMN productos.ancho_maximo IS 'Ancho máximo en cm para productos con pricing por MT Lineal';
