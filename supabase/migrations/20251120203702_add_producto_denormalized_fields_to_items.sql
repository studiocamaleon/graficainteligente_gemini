/*
  # Agregar Campos Denormalizados de Producto a Items de Orden

  1. Cambios en Tabla
    - Agregar columna `producto_nombre` (TEXT) a `ordenes_trabajo_items`
    - Agregar columna `producto_categoria` (TEXT) a `ordenes_trabajo_items`
    - Ambos campos son NOT NULL para nuevos registros

  2. Motivo
    - La tabla `productos` ya no existe como tabla unificada
    - Cada categoría tiene su propia tabla (productos_impresion_laser, productos_gran_formato, etc.)
    - Denormalizar estos datos evita JOINs complejos y garantiza histórico confiable
    - Los items de orden son documentos históricos que deben mantener snapshot del momento

  3. Migración Segura
    - Se agregan columnas como nullable primero
    - Después de poblar datos existentes (si los hay), se pueden hacer NOT NULL
    - Para esta implementación inicial, permitimos NULL para datos legacy
*/

-- Agregar columnas para datos denormalizados del producto
ALTER TABLE ordenes_trabajo_items 
  ADD COLUMN IF NOT EXISTS producto_nombre TEXT,
  ADD COLUMN IF NOT EXISTS producto_categoria TEXT;

-- Crear índices para mejorar performance de queries de reporting
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_producto_nombre 
  ON ordenes_trabajo_items(producto_nombre);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_producto_categoria 
  ON ordenes_trabajo_items(producto_categoria);

-- Comentarios para documentación
COMMENT ON COLUMN ordenes_trabajo_items.producto_nombre IS 
  'Nombre del producto al momento de crear la orden (snapshot histórico)';

COMMENT ON COLUMN ordenes_trabajo_items.producto_categoria IS 
  'Categoría del producto al momento de crear la orden (snapshot histórico)';
