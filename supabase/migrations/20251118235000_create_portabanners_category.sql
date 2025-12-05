/*
  # Crear Categoría Portabanners en el Sistema

  ## Descripción
  Esta migración agrega la categoría de Portabanners a la tabla de categorías del sistema.
  La categoría es necesaria para clasificar y gestionar productos de portabanners y expositores.

  ## Cambios
  1. Inserta la categoría Portabanners con ID fijo en system_categories
     - ID: 00000000-0000-0000-0000-000000000006
     - Nombre: Portabanners
     - Descripción: Productos de portabanners y expositores
     - Color: #06B6D4 (cyan)

  ## Notas
  - La categoría se inserta solo si no existe (INSERT ... ON CONFLICT DO NOTHING)
  - El ID es fijo para mantener consistencia con las constantes del frontend
  - La categoría se marca como activa por defecto
*/

-- Insertar categoría de Portabanners si no existe
INSERT INTO categorias (id, nombre, descripcion, color, is_active, is_system_category, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000006',
  'Portabanners',
  'Productos de portabanners y expositores',
  '#06B6D4',
  true,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
