/*
  # Hacer Espesor Opcional en Materiales Rígidos

  ## Descripción
  Esta migración permite que productos de materiales rígidos puedan configurarse
  sin espesores cuando el material base no tiene espesores definidos. Los materiales
  sin espesores podrán tener precios configurados solo por variante.

  ## Cambios Principales

  1. **productos_materiales_rigidos_materiales**
     - Hacer columna `espesor` NULLABLE
     - Actualizar constraint de unicidad para soportar NULL en espesor
     - Ajustar validaciones para permitir espesor NULL

  2. **productos_materiales_rigidos_precios**
     - Hacer columna `espesor` NULLABLE
     - Actualizar constraint de unicidad para soportar NULL en espesor
     - Ajustar validaciones para permitir espesor NULL

  3. **Funciones de Validación**
     - Actualizar `validate_precio_mr_combination` para aceptar espesor NULL
     - Validar que solo se permita NULL cuando el material no aplica espesor

  ## Casos de Uso

  - Material CON espesor: Se requiere especificar el espesor (obligatorio)
  - Material SIN espesor: El espesor será NULL (no aplica)
  - Precios se pueden configurar para ambos casos

  ## Notas de Compatibilidad

  - Los registros existentes con espesores definidos no se ven afectados
  - Los nuevos productos podrán crearse con o sin espesor según el material
  - La visualización mostrará "No aplica" cuando espesor sea NULL
*/

-- =====================================================
-- 1. ACTUALIZAR productos_materiales_rigidos_materiales
-- =====================================================

-- Hacer la columna espesor NULLABLE
ALTER TABLE productos_materiales_rigidos_materiales
ALTER COLUMN espesor DROP NOT NULL;

COMMENT ON COLUMN productos_materiales_rigidos_materiales.espesor IS
  'Espesor individual en mm para esta combinación. NULL cuando el material no aplica espesor.';

-- Eliminar constraint de unicidad que incluye espesor NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_producto_mr_material_variante_espesor'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    DROP CONSTRAINT unique_producto_mr_material_variante_espesor;
  END IF;
END $$;

-- Crear nuevo constraint de unicidad que maneje NULL correctamente
-- Usamos dos constraints: uno para registros con espesor y otro para registros sin espesor
DO $$
BEGIN
  -- Constraint para combinaciones CON espesor (evita duplicados cuando espesor NO es NULL)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_producto_mr_mat_var_esp_not_null'
  ) THEN
    CREATE UNIQUE INDEX unique_producto_mr_mat_var_esp_not_null
    ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id, material_id, variante_nombre, espesor)
    WHERE espesor IS NOT NULL;
  END IF;

  -- Constraint para combinaciones SIN espesor (evita duplicados cuando espesor es NULL)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_producto_mr_mat_var_no_esp'
  ) THEN
    CREATE UNIQUE INDEX unique_producto_mr_mat_var_no_esp
    ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id, material_id, variante_nombre)
    WHERE espesor IS NULL;
  END IF;
END $$;

-- Actualizar constraint de validación para permitir NULL o positivo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_pmr_materiales_espesor_positivo'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_materiales
    DROP CONSTRAINT check_pmr_materiales_espesor_positivo;
  END IF;

  ALTER TABLE productos_materiales_rigidos_materiales
  ADD CONSTRAINT check_pmr_materiales_espesor_positivo
  CHECK (espesor IS NULL OR espesor > 0);
END $$;

-- =====================================================
-- 2. ACTUALIZAR productos_materiales_rigidos_precios
-- =====================================================

-- Hacer la columna espesor NULLABLE
ALTER TABLE productos_materiales_rigidos_precios
ALTER COLUMN espesor DROP NOT NULL;

COMMENT ON COLUMN productos_materiales_rigidos_precios.espesor IS
  'Espesor específico en mm para este precio. NULL cuando el material no aplica espesor.';

-- Eliminar constraint de unicidad anterior
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_por_combinacion_mr'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    DROP CONSTRAINT unique_precio_por_combinacion_mr;
  END IF;
END $$;

-- Crear nuevos constraints de unicidad que manejen NULL correctamente
DO $$
BEGIN
  -- Constraint para precios CON espesor
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_mr_combo_not_null'
  ) THEN
    CREATE UNIQUE INDEX unique_precio_mr_combo_not_null
    ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id, material_id, variante_nombre, espesor)
    WHERE espesor IS NOT NULL;
  END IF;

  -- Constraint para precios SIN espesor
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_precio_mr_combo_null'
  ) THEN
    CREATE UNIQUE INDEX unique_precio_mr_combo_null
    ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id, material_id, variante_nombre)
    WHERE espesor IS NULL;
  END IF;
END $$;

-- Actualizar constraint de validación para permitir NULL o positivo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_pmr_precios_espesor_positivo'
  ) THEN
    ALTER TABLE productos_materiales_rigidos_precios
    DROP CONSTRAINT check_pmr_precios_espesor_positivo;
  END IF;

  ALTER TABLE productos_materiales_rigidos_precios
  ADD CONSTRAINT check_pmr_precios_espesor_positivo
  CHECK (espesor IS NULL OR espesor > 0);
END $$;

-- =====================================================
-- 3. ACTUALIZAR FUNCIÓN DE VALIDACIÓN
-- =====================================================

-- Actualizar función de validación para soportar espesor NULL
CREATE OR REPLACE FUNCTION validate_precio_mr_combination()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que existe una entrada en productos_materiales_rigidos_materiales
  -- con la misma combinación de producto, material, variante y espesor (incluyendo NULL)
  IF NOT EXISTS (
    SELECT 1 FROM productos_materiales_rigidos_materiales
    WHERE producto_materiales_rigidos_id = NEW.producto_materiales_rigidos_id
    AND material_id = NEW.material_id
    AND variante_nombre = NEW.variante_nombre
    AND (
      (NEW.espesor IS NULL AND espesor IS NULL) OR
      (NEW.espesor IS NOT NULL AND espesor = NEW.espesor)
    )
  ) THEN
    IF NEW.espesor IS NULL THEN
      RAISE EXCEPTION 'No existe una combinación de material-variante válida (sin espesor) para este precio. Producto: %, Material: %, Variante: %',
        NEW.producto_materiales_rigidos_id, NEW.material_id, NEW.variante_nombre;
    ELSE
      RAISE EXCEPTION 'No existe una combinación de material-variante-espesor válida para este precio. Producto: %, Material: %, Variante: %, Espesor: %mm',
        NEW.producto_materiales_rigidos_id, NEW.material_id, NEW.variante_nombre, NEW.espesor;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_precio_mr_combination IS
  'Valida que existe una combinación válida de material-variante-espesor (o sin espesor) antes de crear/actualizar un precio';

-- =====================================================
-- 4. ACTUALIZAR ÍNDICES
-- =====================================================

-- Eliminar índice anterior que no manejaba NULL correctamente
DROP INDEX IF EXISTS idx_pmr_materiales_combinacion_completa;
DROP INDEX IF EXISTS idx_pmr_precios_combinacion_completa;

-- Crear nuevos índices optimizados que manejen NULL
CREATE INDEX IF NOT EXISTS idx_pmr_materiales_combo_with_esp
ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id, material_id, variante_nombre, espesor)
WHERE espesor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pmr_materiales_combo_without_esp
ON productos_materiales_rigidos_materiales(producto_materiales_rigidos_id, material_id, variante_nombre)
WHERE espesor IS NULL;

CREATE INDEX IF NOT EXISTS idx_pmr_precios_combo_with_esp
ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id, material_id, variante_nombre, espesor)
WHERE espesor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pmr_precios_combo_without_esp
ON productos_materiales_rigidos_precios(company_id, producto_materiales_rigidos_id, material_id, variante_nombre)
WHERE espesor IS NULL;

-- =====================================================
-- 5. COMENTARIOS FINALES
-- =====================================================

COMMENT ON TABLE productos_materiales_rigidos_materiales IS
  'Relación entre productos de materiales rígidos y materiales. Cada registro representa una combinación única de variante y espesor (o sin espesor si el material no lo requiere).';

COMMENT ON TABLE productos_materiales_rigidos_precios IS
  'Precios de productos de materiales rígidos. Cada registro representa el precio para una combinación específica de producto, material, variante y espesor (o sin espesor según el material).';
