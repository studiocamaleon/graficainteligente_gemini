-- Ensure system categories are present and active
-- This migration reinforces the presence of system categories defined in src/constants/categorias.ts

DO $$
BEGIN
  ---------------------------------------------------------------------------
  -- 1. Impresion Laser
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Impresion Laser', 'Productos de impresión digital laser', '#3B82F6', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 2. Impresion Gran Formato
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000002', NULL, 'Impresion Gran Formato', 'Productos de impresión en gran formato', '#10B981', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 3. Materiales Rigidos
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000003', NULL, 'Materiales Rigidos', 'Productos con materiales rígidos', '#F59E0B', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 4. Plotter de Corte
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000004', NULL, 'Plotter de Corte', 'Productos para plotter de corte', '#EC4899', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 5. Sellos
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000005', NULL, 'Sellos', 'Productos de sellos y accesorios', '#8B5CF6', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 6. Portabanners
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000006', NULL, 'Portabanners', 'Productos de portabanners y expositores', '#06B6D4', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 7. Talonarios
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000007', NULL, 'Talonarios', 'Productos de talonarios y formularios', '#14B8A6', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

  ---------------------------------------------------------------------------
  -- 9. Centro de Copiado
  ---------------------------------------------------------------------------
  INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
  VALUES ('00000000-0000-0000-0000-000000000009', NULL, 'Centro de Copiado', 'Servicios de fotocopias, impresiones y escaneos', '#6366f1', true, true)
  ON CONFLICT (id) DO UPDATE SET 
    is_active = true,
    is_system_category = true,
    company_id = NULL,
    nombre = EXCLUDED.nombre;

END $$;
