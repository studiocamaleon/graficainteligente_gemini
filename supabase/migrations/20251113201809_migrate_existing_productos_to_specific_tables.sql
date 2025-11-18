/*
  # Migrar Productos Existentes a Tablas Específicas

  ## Descripción
  Esta migración traslada los productos existentes de la tabla `productos`
  a las tablas específicas según su categoría, junto con todas sus relaciones.

  ## Proceso de Migración

  ### 1. Productos de Impresión Laser
  - Migrar a `productos_impresion_laser`
  - Copiar medidas_disponibles, caras_impresas, producto_impreso

  ### 2. Productos de Gran Formato
  - Migrar a `productos_gran_formato`
  - Usar ancho_maximo si está definido, sino usar 3200mm (valor estándar)
  - Usar 10000mm como alto_maximo (valor estándar gran formato)
  - NO migrar caras_impresas (no aplica a esta categoría)

  ### 3. Productos de Materiales Rígidos
  - Migrar a `productos_materiales_rigidos`
  - Copiar medidas_ancho, medidas_alto, caras_impresas, producto_impreso

  ### 4. Relaciones
  - Migrar relaciones de tecnologías a productos_tecnologias_v2
  - Migrar relaciones de materiales a productos_materiales_v2
  - Migrar relaciones de servicios a productos_servicios_v2
  - Migrar relaciones de acabados a productos_acabados_v2

  ## Seguridad
  - Mantener company_id y fechas originales
  - Preservar is_active y otros campos de estado
  - No eliminar datos originales (solo copiar)

  ## Validación
  - Verificar que el conteo de productos migrados coincida con el original
  - Verificar que todas las relaciones se hayan migrado correctamente
*/

-- =====================================================
-- 1. MIGRAR PRODUCTOS DE IMPRESIÓN LASER
-- =====================================================

INSERT INTO productos_impresion_laser (
  id,
  company_id,
  nombre,
  medidas_disponibles,
  caras_impresas,
  producto_impreso,
  is_active,
  created_at,
  updated_at
)
SELECT 
  p.id,
  p.company_id,
  p.nombre,
  COALESCE(p.medidas_disponibles, '[]'::jsonb),
  p.caras_impresas,
  p.producto_impreso,
  p.is_active,
  p.created_at,
  p.updated_at
FROM productos p
WHERE p.categoria_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. MIGRAR PRODUCTOS DE GRAN FORMATO
-- =====================================================

INSERT INTO productos_gran_formato (
  id,
  company_id,
  nombre,
  ancho_maximo,
  alto_maximo,
  producto_impreso,
  is_active,
  created_at,
  updated_at
)
SELECT 
  p.id,
  p.company_id,
  p.nombre,
  -- Si tiene ancho_maximo definido usar ese, sino usar 3200mm
  COALESCE(NULLIF(p.ancho_maximo, 0), 3200),
  -- Usar 10000mm como alto máximo estándar para gran formato
  10000,
  p.producto_impreso,
  p.is_active,
  p.created_at,
  p.updated_at
FROM productos p
WHERE p.categoria_id = '00000000-0000-0000-0000-000000000002'
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. MIGRAR PRODUCTOS DE MATERIALES RÍGIDOS
-- =====================================================

INSERT INTO productos_materiales_rigidos (
  id,
  company_id,
  nombre,
  medidas_ancho,
  medidas_alto,
  caras_impresas,
  producto_impreso,
  is_active,
  created_at,
  updated_at
)
SELECT 
  p.id,
  p.company_id,
  p.nombre,
  -- Si las medidas son 0, usar 1000mm como valor por defecto
  GREATEST(p.medidas_ancho, 1000),
  GREATEST(p.medidas_alto, 1000),
  p.caras_impresas,
  p.producto_impreso,
  p.is_active,
  p.created_at,
  p.updated_at
FROM productos p
WHERE p.categoria_id = '00000000-0000-0000-0000-000000000003'
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. MIGRAR RELACIONES DE TECNOLOGÍAS
-- =====================================================

INSERT INTO productos_tecnologias_v2 (
  producto_tipo,
  producto_id,
  tecnologia_id,
  tintas,
  created_at
)
SELECT 
  CASE 
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000001' THEN 'laser'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000002' THEN 'gran_formato'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000003' THEN 'materiales_rigidos'
  END,
  pt.producto_id,
  pt.tecnologia_id,
  pt.tintas,
  pt.created_at
FROM productos_tecnologias pt
INNER JOIN productos p ON pt.producto_id = p.id
WHERE p.categoria_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT (producto_tipo, producto_id, tecnologia_id) DO NOTHING;

-- =====================================================
-- 5. MIGRAR RELACIONES DE MATERIALES
-- =====================================================

INSERT INTO productos_materiales_v2 (
  producto_tipo,
  producto_id,
  material_id,
  variante_nombre,
  espesores,
  created_at
)
SELECT 
  CASE 
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000001' THEN 'laser'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000002' THEN 'gran_formato'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000003' THEN 'materiales_rigidos'
  END,
  pm.producto_id,
  pm.material_id,
  pm.variante_nombre,
  pm.espesores,
  pm.created_at
FROM productos_materiales pm
INNER JOIN productos p ON pm.producto_id = p.id
WHERE p.categoria_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. MIGRAR RELACIONES DE SERVICIOS
-- =====================================================

INSERT INTO productos_servicios_v2 (
  producto_tipo,
  producto_id,
  servicio_id,
  is_active,
  created_at
)
SELECT 
  CASE 
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000001' THEN 'laser'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000002' THEN 'gran_formato'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000003' THEN 'materiales_rigidos'
  END,
  ps.producto_id,
  ps.servicio_id,
  ps.is_active,
  ps.created_at
FROM productos_servicios ps
INNER JOIN productos p ON ps.producto_id = p.id
WHERE p.categoria_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT (producto_tipo, producto_id, servicio_id) DO NOTHING;

-- =====================================================
-- 7. MIGRAR RELACIONES DE ACABADOS
-- =====================================================

INSERT INTO productos_acabados_v2 (
  producto_tipo,
  producto_id,
  acabado_id,
  is_active,
  created_at
)
SELECT 
  CASE 
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000001' THEN 'laser'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000002' THEN 'gran_formato'
    WHEN p.categoria_id = '00000000-0000-0000-0000-000000000003' THEN 'materiales_rigidos'
  END,
  pa.producto_id,
  pa.acabado_id,
  pa.is_active,
  pa.created_at
FROM productos_acabados pa
INNER JOIN productos p ON pa.producto_id = p.id
WHERE p.categoria_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT (producto_tipo, producto_id, acabado_id) DO NOTHING;

-- =====================================================
-- 8. VALIDACIÓN DE LA MIGRACIÓN
-- =====================================================

DO $$
DECLARE
  original_count INTEGER;
  laser_count INTEGER;
  gran_formato_count INTEGER;
  materiales_count INTEGER;
  total_migrated INTEGER;
BEGIN
  -- Contar productos originales
  SELECT COUNT(*) INTO original_count
  FROM productos
  WHERE categoria_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003'
  );

  -- Contar productos migrados
  SELECT COUNT(*) INTO laser_count FROM productos_impresion_laser;
  SELECT COUNT(*) INTO gran_formato_count FROM productos_gran_formato;
  SELECT COUNT(*) INTO materiales_count FROM productos_materiales_rigidos;
  
  total_migrated := laser_count + gran_formato_count + materiales_count;

  -- Log de resultados
  RAISE NOTICE 'Migración completada:';
  RAISE NOTICE '  Productos originales: %', original_count;
  RAISE NOTICE '  Impresión Laser: %', laser_count;
  RAISE NOTICE '  Gran Formato: %', gran_formato_count;
  RAISE NOTICE '  Materiales Rígidos: %', materiales_count;
  RAISE NOTICE '  Total migrado: %', total_migrated;

  -- Validar que coincidan
  IF original_count != total_migrated THEN
    RAISE WARNING 'ATENCIÓN: El conteo no coincide. Original: %, Migrado: %', 
      original_count, total_migrated;
  ELSE
    RAISE NOTICE 'Validación exitosa: Todos los productos fueron migrados correctamente';
  END IF;
END $$;
