/*
  # Crear Categoría Plotter de Corte

  ## Descripción
  Esta migración agrega la categoría "Plotter de Corte" al sistema como categoría del sistema,
  disponible para todas las empresas.

  ## Nueva Categoría
  - ID: 00000000-0000-0000-0000-000000000004
  - Nombre: Plotter de Corte
  - Descripción: Productos para plotter de corte
  - Color: #EC4899 (rosa)
  - Es categoría del sistema (is_system_category = true)

  ## Seguridad
  - La categoría es de solo lectura para usuarios normales
  - Solo puede ser modificada mediante migraciones
  - Visible para todas las empresas del sistema
*/

-- =====================================================
-- INSERTAR CATEGORÍA PLOTTER DE CORTE
-- =====================================================

INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  NULL,
  'Plotter de Corte',
  'Productos para plotter de corte',
  '#EC4899',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;