/*
  # Corregir Tipo de Dato del Campo Tintas

  ## Descripción
  Esta migración corrige el tipo de dato del campo `tintas` en la tabla 
  `productos_impresion_laser_tecnologias` de `uuid[]` a `text[]` para que 
  coincida con cómo se almacenan las tintas en la tabla `tecnologias`.

  ## Problema Resuelto
  - El campo `tintas` estaba definido como `uuid[]` pero el código de la aplicación 
    envía un array de strings con los nombres de las tintas (ej: ["CMYK", "RGB"])
  - Esto causaba el error: "invalid input syntax for type uuid: \"CMYK\""
  - La tabla `tecnologias` almacena las tintas como `text[]`, por lo que debemos 
    mantener la consistencia

  ## Cambios Realizados
  1. Modificar el tipo de dato del campo `tintas` de `uuid[]` a `text[]`
  2. Mantener el valor por defecto como array vacío
  3. El campo sigue siendo NOT NULL para garantizar integridad

  ## Impacto
  - Permite la inserción y actualización correcta de productos de impresión láser
  - Mantiene consistencia con el esquema de la tabla `tecnologias`
  - No requiere cambios en el código de la aplicación
*/

-- Modificar el tipo de dato del campo tintas de uuid[] a text[]
ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas TYPE text[] USING tintas::text[];

-- Asegurar que el valor por defecto sea correcto
ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas SET DEFAULT ARRAY[]::text[];

-- Actualizar el comentario de la tabla para reflejar el cambio
COMMENT ON COLUMN productos_impresion_laser_tecnologias.tintas IS 
  'Array de nombres de tintas seleccionadas (ej: ["CMYK", "RGB"]). Los valores deben coincidir con las tintas disponibles en la tecnología correspondiente.';
