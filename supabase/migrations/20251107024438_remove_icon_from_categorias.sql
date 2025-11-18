/*
  # Eliminar campo de icono de categorías

  1. Cambios en la tabla categorias
    - Se elimina la columna `icon` ya que las categorías solo usarán colores como identificador visual
    - Se asegura que la columna `color` sea NOT NULL para garantizar que todas las categorías tengan un color
    - Se verifica que todas las categorías existentes tengan un color válido antes de aplicar restricciones

  2. Notas
    - Este cambio simplifica la gestión de categorías
    - Las categorías se identificarán visualmente solo por su color
    - Se mantiene la columna de nombre y descripción para identificación textual
*/

-- Primero, aseguramos que todas las categorías tengan un color válido
-- Si alguna categoría no tiene color, le asignamos un color predeterminado
UPDATE categorias 
SET color = '#6B7280' 
WHERE color IS NULL OR color = '';

-- Ahora hacemos que la columna color sea NOT NULL
ALTER TABLE categorias 
ALTER COLUMN color SET NOT NULL;

-- Agregamos una restricción para verificar que el color tenga formato hexadecimal válido
ALTER TABLE categorias 
DROP CONSTRAINT IF EXISTS categorias_color_format;

ALTER TABLE categorias 
ADD CONSTRAINT categorias_color_format 
CHECK (color ~* '^#[0-9A-F]{6}$');

-- Finalmente, eliminamos la columna icon
ALTER TABLE categorias 
DROP COLUMN IF EXISTS icon;
