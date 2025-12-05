-- Renombrar la empresa genérica a algo más amigable
UPDATE companies 
SET 
  name = 'Gráfica Inteligente (Dev)', 
  slug = 'grafica-inteligente-dev'
WHERE 
  name = 'Empresa Default' AND slug = 'default-company';
