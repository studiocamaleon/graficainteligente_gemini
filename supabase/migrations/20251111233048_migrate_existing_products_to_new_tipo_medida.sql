/*
  # Migrar productos existentes al nuevo sistema de tipo_medida

  1. Cambios
    - Actualizar tipo_medida según unidad_pricing para productos existentes
    - Migrar medidas_ancho a ancho_maximo para productos con pricing MT Lineal
    - Establecer tipo_medida = 'sin_medida' para productos con pricing MT²

  2. Lógica
    - Si unidad_pricing = 'mt_lineal' → tipo_medida = 'ancho_maximo' y migrar medidas_ancho
    - Si unidad_pricing = 'mt2' → tipo_medida = 'sin_medida'
    - Productos con otros tipos de pricing no se modifican
*/

-- Actualizar productos con pricing MT Lineal
UPDATE productos p
SET 
  tipo_medida = 'ancho_maximo',
  ancho_maximo = p.medidas_ancho,
  medidas_ancho = 0,
  medidas_alto = 0
FROM productos_pricing pp
WHERE pp.producto_id = p.id
  AND pp.unidad_pricing = 'mt_lineal'
  AND p.tipo_medida = 'medida_unica'
  AND p.ancho_maximo IS NULL;

-- Actualizar productos con pricing MT²
UPDATE productos p
SET 
  tipo_medida = 'sin_medida',
  medidas_ancho = 0,
  medidas_alto = 0
FROM productos_pricing pp
WHERE pp.producto_id = p.id
  AND pp.unidad_pricing = 'mt2'
  AND p.tipo_medida = 'medida_unica';
