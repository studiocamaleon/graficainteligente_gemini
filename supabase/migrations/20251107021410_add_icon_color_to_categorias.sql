/*
  # Agregar iconos y colores a categorías

  1. Cambios
    - Agrega columna `icon` (text) a la tabla `categorias` para almacenar el nombre del icono de lucide-react
    - Agrega columna `color` (text) a la tabla `categorias` para almacenar el código de color hexadecimal
    - Ambas columnas son opcionales y tienen valores por defecto
    - El icono por defecto es 'Tag' y el color por defecto es '#6B7280' (gray-500)

  2. Notas
    - Las categorías existentes recibirán los valores por defecto
    - Los iconos se almacenan como strings que corresponden a nombres de iconos de lucide-react
    - Los colores se almacenan en formato hexadecimal (#RRGGBB)
*/

-- Agregar columna icon con valor por defecto
ALTER TABLE categorias 
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Tag' NOT NULL;

-- Agregar columna color con valor por defecto
ALTER TABLE categorias 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6B7280' NOT NULL;

-- Crear índice para mejorar consultas por icono (opcional)
CREATE INDEX IF NOT EXISTS idx_categorias_icon ON categorias(icon);
