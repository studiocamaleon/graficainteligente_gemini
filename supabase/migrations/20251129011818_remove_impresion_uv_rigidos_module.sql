/*
  # Eliminación del Módulo Impresión UV sobre Rígidos

  Este módulo se elimina del sistema por decisión del usuario.

  1. Tablas a Eliminar
    - `productos_impresion_uv_rigidos_precios_impresion`: Precios de impresión por m²
    - `productos_impresion_uv_rigidos_materiales`: Materiales disponibles para UV
    - `productos_impresion_uv_rigidos`: Tabla principal de productos UV

  2. Categoría a Eliminar
    - Categoría "Impresión UV sobre Rígidos" del sistema

  3. Orden de Eliminación
    - Primero las tablas dependientes (precios, materiales)
    - Luego la tabla principal (productos)
    - Finalmente la categoría
*/

-- Eliminar tabla de precios de impresión
DROP TABLE IF EXISTS productos_impresion_uv_rigidos_precios_impresion CASCADE;

-- Eliminar tabla de materiales
DROP TABLE IF EXISTS productos_impresion_uv_rigidos_materiales CASCADE;

-- Eliminar tabla principal de productos UV Rígidos
DROP TABLE IF EXISTS productos_impresion_uv_rigidos CASCADE;

-- Eliminar la categoría "Impresión UV sobre Rígidos"
DELETE FROM categorias
WHERE nombre = 'Impresión UV sobre Rígidos'
AND is_system_category = true;