/*
  # Adaptar productos_precios para Relaciones Polimórficas
  
  ## Descripción
  Esta migración adapta la tabla productos_precios para trabajar con el patrón
  polimórfico, permitiendo que apunte a cualquiera de las tres tablas específicas
  de productos: productos_impresion_laser, productos_gran_formato, productos_materiales_rigidos.
  
  ## Cambios Realizados
  
  ### 1. Nuevo Campo producto_tipo
  - `producto_tipo` (text, required): Identifica el tipo de producto
    - Valores: 'laser', 'gran_formato', 'materiales_rigidos'
  
  ### 2. Modificación de producto_id
  - Se elimina la foreign key constraint hacia la tabla productos (que será eliminada)
  - producto_id se mantiene como UUID genérico que apunta a cualquier tabla específica
  
  ### 3. Actualización de Constraints
  - Nuevo constraint para validar producto_tipo
  - Actualización del constraint único para incluir producto_tipo
  
  ### 4. Nuevos Índices
  - Índice compuesto en (producto_tipo, producto_id) para optimizar consultas
  
  ### 5. Actualización de Políticas RLS
  - Las políticas ahora validan según el tipo de producto
  - Verifican que el producto pertenezca a la empresa del usuario autenticado
  
  ## Migración de Datos
  - Todos los precios existentes se marcan automáticamente con su producto_tipo
  - Se identifica el tipo consultando las tablas específicas de productos
*/

-- =====================================================
-- 1. AGREGAR CAMPO producto_tipo
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_precios' AND column_name = 'producto_tipo'
  ) THEN
    ALTER TABLE productos_precios
      ADD COLUMN producto_tipo text;
  END IF;
END $$;

-- =====================================================
-- 2. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Actualizar producto_tipo para productos de impresión laser
UPDATE productos_precios pp
SET producto_tipo = 'laser'
FROM productos_impresion_laser pil
WHERE pp.producto_id = pil.id
  AND pp.producto_tipo IS NULL;

-- Actualizar producto_tipo para productos de gran formato
UPDATE productos_precios pp
SET producto_tipo = 'gran_formato'
FROM productos_gran_formato pgf
WHERE pp.producto_id = pgf.id
  AND pp.producto_tipo IS NULL;

-- Actualizar producto_tipo para productos de materiales rígidos
UPDATE productos_precios pp
SET producto_tipo = 'materiales_rigidos'
FROM productos_materiales_rigidos pmr
WHERE pp.producto_id = pmr.id
  AND pp.producto_tipo IS NULL;

-- =====================================================
-- 3. HACER producto_tipo NOT NULL
-- =====================================================

ALTER TABLE productos_precios
  ALTER COLUMN producto_tipo SET NOT NULL;

-- =====================================================
-- 4. ELIMINAR FOREIGN KEY CONSTRAINT ANTIGUA
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productos_precios_producto_id_fkey'
  ) THEN
    ALTER TABLE productos_precios DROP CONSTRAINT productos_precios_producto_id_fkey;
  END IF;
END $$;

-- =====================================================
-- 5. AGREGAR CONSTRAINT DE VALIDACIÓN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_productos_precios_tipo'
  ) THEN
    ALTER TABLE productos_precios
      ADD CONSTRAINT check_productos_precios_tipo
      CHECK (producto_tipo IN ('laser', 'gran_formato', 'materiales_rigidos'));
  END IF;
END $$;

-- =====================================================
-- 6. ACTUALIZAR CONSTRAINT ÚNICO
-- =====================================================

-- Eliminar constraint anterior
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_combinacion_completa'
  ) THEN
    ALTER TABLE productos_precios DROP CONSTRAINT unique_precio_combinacion_completa;
  END IF;
END $$;

-- Crear nuevo constraint único que incluye producto_tipo
ALTER TABLE productos_precios
  ADD CONSTRAINT unique_precio_combinacion_completa UNIQUE NULLS NOT DISTINCT (
    producto_tipo,
    producto_id,
    tecnologia_id,
    tipo_tinta,
    cara_impresion,
    material_id,
    variante_nombre,
    cantidad,
    rango_min,
    rango_max
  );

-- =====================================================
-- 7. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_precios_tipo_producto
  ON productos_precios(producto_tipo, producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_precios_producto_tipo
  ON productos_precios(producto_tipo);

-- =====================================================
-- 8. ELIMINAR POLÍTICAS RLS ANTIGUAS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own company productos_precios" ON productos_precios;
DROP POLICY IF EXISTS "Users can insert own company productos_precios" ON productos_precios;
DROP POLICY IF EXISTS "Users can update own company productos_precios" ON productos_precios;
DROP POLICY IF EXISTS "Users can delete own company productos_precios" ON productos_precios;

-- =====================================================
-- 9. CREAR NUEVAS POLÍTICAS RLS
-- =====================================================

CREATE POLICY "Users can view own company productos_precios"
  ON productos_precios FOR SELECT
  TO authenticated
  USING (
    (producto_tipo = 'laser' AND producto_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'gran_formato' AND producto_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'materiales_rigidos' AND producto_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ))
  );

CREATE POLICY "Users can insert own company productos_precios"
  ON productos_precios FOR INSERT
  TO authenticated
  WITH CHECK (
    (producto_tipo = 'laser' AND producto_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'gran_formato' AND producto_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'materiales_rigidos' AND producto_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ))
  );

CREATE POLICY "Users can update own company productos_precios"
  ON productos_precios FOR UPDATE
  TO authenticated
  USING (
    (producto_tipo = 'laser' AND producto_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'gran_formato' AND producto_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'materiales_rigidos' AND producto_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ))
  )
  WITH CHECK (
    (producto_tipo = 'laser' AND producto_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'gran_formato' AND producto_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'materiales_rigidos' AND producto_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ))
  );

CREATE POLICY "Users can delete own company productos_precios"
  ON productos_precios FOR DELETE
  TO authenticated
  USING (
    (producto_tipo = 'laser' AND producto_id IN (
      SELECT id FROM productos_impresion_laser
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'gran_formato' AND producto_id IN (
      SELECT id FROM productos_gran_formato
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )) OR
    (producto_tipo = 'materiales_rigidos' AND producto_id IN (
      SELECT id FROM productos_materiales_rigidos
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ))
  );

-- =====================================================
-- 10. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN productos_precios.producto_tipo IS
  'Tipo de producto: laser (productos_impresion_laser), gran_formato (productos_gran_formato), materiales_rigidos (productos_materiales_rigidos)';

COMMENT ON COLUMN productos_precios.producto_id IS
  'ID del producto. Referencia polimórfica a la tabla específica indicada en producto_tipo';
