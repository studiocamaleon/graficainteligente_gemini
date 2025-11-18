/*
  # Eliminar Campo Ancho Máximo de Productos de Gran Formato

  ## Descripción
  Esta migración elimina el campo ancho_maximo de la tabla productos y actualiza
  el tipo_medida para que los productos de Gran Formato usen 'medida_unica' en lugar 
  de 'ancho_maximo'.

  ## Cambios en la Tabla productos

  ### Campos Eliminados
  - `ancho_maximo` (numeric): Ya no es necesario, se usará medidas_ancho y medidas_alto

  ### Actualizaciones
  - El tipo_medida 'ancho_maximo' se elimina del check constraint
  - Los productos de Gran Formato existentes se actualizan a tipo_medida = 'medida_unica'
  - Se preservan los valores de ancho_maximo en medidas_ancho
  - medidas_alto se establece igual a medidas_ancho para Gran Formato

  ## Impacto
  - Los productos de Gran Formato ahora usan medidas_ancho y medidas_alto como cualquier 
    producto estándar
  - El precio seguirá calculándose por m² según la configuración de pricing
*/

-- =====================================================
-- 1. ELIMINAR CONSTRAINTS PRIMERO
-- =====================================================

-- Eliminar constraint de medida_unica_positivas
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_medida_unica_positivas;

-- Eliminar constraint de ancho_maximo positivo
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_ancho_maximo_positivo;

-- Eliminar constraint de medidas_multiples para recrearla
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_medidas_multiples_not_empty;

-- Eliminar constraint de tipo_medida para recrearla
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_tipo_medida;

-- =====================================================
-- 2. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Actualizar productos de Gran Formato:
-- - Cambiar tipo_medida a 'medida_unica'
-- - Copiar ancho_maximo a medidas_ancho
-- - Establecer medidas_alto igual a medidas_ancho (para tener un valor válido)
UPDATE productos
SET tipo_medida = 'medida_unica',
    medidas_ancho = ancho_maximo,
    medidas_alto = ancho_maximo  -- Usar el mismo valor para tener medidas válidas
WHERE tipo_medida = 'ancho_maximo' AND ancho_maximo IS NOT NULL;

-- =====================================================
-- 3. ELIMINAR COLUMNA ancho_maximo
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productos' AND column_name = 'ancho_maximo'
  ) THEN
    ALTER TABLE productos DROP COLUMN ancho_maximo;
  END IF;
END $$;

-- =====================================================
-- 4. RECREAR CONSTRAINTS ACTUALIZADAS
-- =====================================================

-- Constraint: tipo_medida solo puede ser 'medida_unica' o 'medidas_multiples'
ALTER TABLE productos 
ADD CONSTRAINT check_tipo_medida 
CHECK (tipo_medida IN ('medida_unica', 'medidas_multiples'));

-- Constraint: Para medida_unica, ancho y alto deben ser positivos
ALTER TABLE productos 
ADD CONSTRAINT check_medida_unica_positivas 
CHECK (
  tipo_medida != 'medida_unica' OR 
  (medidas_ancho > 0 AND medidas_alto > 0)
);

-- Constraint: Para medidas_multiples, medidas_disponibles debe tener al menos una medida
ALTER TABLE productos 
ADD CONSTRAINT check_medidas_multiples_not_empty 
CHECK (
  tipo_medida != 'medidas_multiples' OR 
  (medidas_disponibles IS NOT NULL AND jsonb_array_length(medidas_disponibles) > 0)
);

-- =====================================================
-- 5. ACTUALIZAR COMENTARIOS
-- =====================================================

COMMENT ON COLUMN productos.tipo_medida IS 'Tipo de configuración de medidas: medida_unica (default y Gran Formato), medidas_multiples (Impresión Laser)';
COMMENT ON COLUMN productos.medidas_ancho IS 'Ancho en mm. Para Gran Formato: ancho máximo de trabajo. Para Materiales Rígidos: ancho de placa';
COMMENT ON COLUMN productos.medidas_alto IS 'Alto en mm. Para Gran Formato: alto de trabajo. Para Materiales Rígidos: alto de placa';
COMMENT ON COLUMN productos.medidas_disponibles IS 'Array de combinaciones {ancho, alto} para tipo_medida = medidas_multiples (Impresión Laser)';
