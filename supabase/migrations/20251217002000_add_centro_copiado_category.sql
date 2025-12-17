-- Add 'Centro de Copiado' system category
-- ID: 00000000-0000-0000-0000-000000000009

INSERT INTO categorias (id, company_id, nombre, descripcion, color, is_system_category, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000009',
    NULL,
    'Centro de Copiado',
    'Servicios de fotocopias, impresiones y escaneos',
    '#6366f1', -- Indigo
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;
