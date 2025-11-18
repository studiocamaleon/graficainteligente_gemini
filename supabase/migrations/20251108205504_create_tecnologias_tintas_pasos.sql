/*
  # Sistema de Configuración de Pasos por Tecnología y Tintas

  ## Descripción
  Este migration crea el sistema para configurar qué paso de producción se debe ejecutar
  para cada combinación única de tecnología + tipo de tinta. Esta configuración actúa como
  un catálogo maestro que luego será utilizado en las rutas de producción condicionales
  de los productos.

  ## Casos de Uso
  - Configurar "Tecnología UV + Tinta CMYK" → "Paso: Impresión UV CMYK"
  - Configurar "Tecnología UV + Tinta CMYK+W" → "Paso: Impresión UV CMYK+W"
  - Al crear un pedido, según la tinta elegida, se ejecuta el paso correspondiente

  ## Nueva Tabla

  ### tecnologias_tintas_pasos
  Almacena la relación entre cada tecnología, tipo de tinta y el paso de producción asociado.

  **Campos:**
  - `id` (uuid, primary key) - Identificador único
  - `tecnologia_id` (uuid, foreign key) - Referencia a la tecnología
  - `tinta` (text, required) - Tipo de tinta: K, CMYK, CMYK+W, CMYK+V, CMYK+W+V
  - `paso_id` (uuid, nullable, foreign key) - Referencia a paso individual
  - `grupo_paso_id` (uuid, nullable, foreign key) - Referencia a grupo de pasos
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  **Constraints:**
  - UNIQUE(tecnologia_id, tinta) - Cada combinación es única
  - CHECK paso_id O grupo_paso_id - Solo uno debe estar presente
  - CHECK tinta - Valor debe ser uno de los tipos válidos

  ## Seguridad
  - RLS habilitado en la tabla
  - Políticas restrictivas por company_id del usuario autenticado
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índice compuesto en (tecnologia_id, tinta) para búsquedas rápidas
  - Índice en paso_id para optimizar joins
  - Índice en grupo_paso_id para optimizar joins

  ## Funciones Auxiliares
  - Función para verificar completitud de configuraciones de una tecnología
*/

-- =====================================================
-- TABLA: tecnologias_tintas_pasos
-- =====================================================

CREATE TABLE IF NOT EXISTS tecnologias_tintas_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE CASCADE,
  tinta text NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraint: Cada combinación tecnología + tinta debe ser única
  CONSTRAINT unique_tecnologia_tinta UNIQUE(tecnologia_id, tinta),

  -- Constraint: Solo puede tener paso_id O grupo_paso_id, no ambos
  CONSTRAINT check_paso_o_grupo_tecnologia_tinta CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  ),

  -- Constraint: El tipo de tinta debe ser válido
  CONSTRAINT check_tinta_valida CHECK (
    tinta IN ('K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V')
  )
);

-- =====================================================
-- SEGURIDAD: Row Level Security
-- =====================================================

ALTER TABLE tecnologias_tintas_pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company tecnologias_tintas_pasos"
  ON tecnologias_tintas_pasos FOR SELECT
  TO authenticated
  USING (
    tecnologia_id IN (
      SELECT id FROM tecnologias
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own company tecnologias_tintas_pasos"
  ON tecnologias_tintas_pasos FOR INSERT
  TO authenticated
  WITH CHECK (
    tecnologia_id IN (
      SELECT id FROM tecnologias
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own company tecnologias_tintas_pasos"
  ON tecnologias_tintas_pasos FOR UPDATE
  TO authenticated
  USING (
    tecnologia_id IN (
      SELECT id FROM tecnologias
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    tecnologia_id IN (
      SELECT id FROM tecnologias
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own company tecnologias_tintas_pasos"
  ON tecnologias_tintas_pasos FOR DELETE
  TO authenticated
  USING (
    tecnologia_id IN (
      SELECT id FROM tecnologias
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índice compuesto principal para búsquedas por tecnología y tinta
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_tecnologia_tinta
  ON tecnologias_tintas_pasos(tecnologia_id, tinta);

-- Índice para optimizar joins con pasos
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_paso_id
  ON tecnologias_tintas_pasos(paso_id)
  WHERE paso_id IS NOT NULL;

-- Índice para optimizar joins con grupos de pasos
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_grupo_paso_id
  ON tecnologias_tintas_pasos(grupo_paso_id)
  WHERE grupo_paso_id IS NOT NULL;

-- Índice en tecnologia_id para operaciones de bulk
CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_tecnologia_id
  ON tecnologias_tintas_pasos(tecnologia_id);

-- =====================================================
-- FUNCIÓN: Verificar Completitud de Configuraciones
-- =====================================================

CREATE OR REPLACE FUNCTION check_tecnologia_tintas_completitud(p_tecnologia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tintas_esperadas text[];
  v_tintas_configuradas text[];
BEGIN
  -- Obtener las tintas configuradas para la tecnología
  SELECT tintas INTO v_tintas_esperadas
  FROM tecnologias
  WHERE id = p_tecnologia_id;

  -- Si no existe la tecnología, retornar false
  IF v_tintas_esperadas IS NULL THEN
    RETURN false;
  END IF;

  -- Si no hay tintas configuradas, retornar false
  IF array_length(v_tintas_esperadas, 1) IS NULL OR array_length(v_tintas_esperadas, 1) = 0 THEN
    RETURN false;
  END IF;

  -- Obtener las tintas que ya tienen paso asignado
  SELECT array_agg(tinta) INTO v_tintas_configuradas
  FROM tecnologias_tintas_pasos
  WHERE tecnologia_id = p_tecnologia_id;

  -- Si no hay configuraciones, retornar false
  IF v_tintas_configuradas IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar que todas las tintas esperadas estén configuradas
  -- Retorna true solo si ambos arrays contienen los mismos elementos
  RETURN (
    SELECT COUNT(*) = array_length(v_tintas_esperadas, 1)
    FROM unnest(v_tintas_esperadas) AS tinta
    WHERE tinta = ANY(v_tintas_configuradas)
  );
END;
$$;

-- =====================================================
-- COMENTARIOS EN LA BASE DE DATOS
-- =====================================================

COMMENT ON TABLE tecnologias_tintas_pasos IS
  'Almacena la configuración de qué paso de producción se ejecuta para cada combinación de tecnología + tipo de tinta. Esta configuración es utilizada en las rutas de producción condicionales de productos.';

COMMENT ON COLUMN tecnologias_tintas_pasos.tecnologia_id IS
  'Referencia a la tecnología (ej: UV, Offset, Digital)';

COMMENT ON COLUMN tecnologias_tintas_pasos.tinta IS
  'Tipo de tinta: K, CMYK, CMYK+W, CMYK+V, o CMYK+W+V';

COMMENT ON COLUMN tecnologias_tintas_pasos.paso_id IS
  'Paso individual de producción a ejecutar cuando se use esta combinación tecnología + tinta';

COMMENT ON COLUMN tecnologias_tintas_pasos.grupo_paso_id IS
  'Grupo de pasos de producción a ejecutar cuando se use esta combinación tecnología + tinta';

COMMENT ON FUNCTION check_tecnologia_tintas_completitud IS
  'Verifica si todas las tintas de una tecnología tienen un paso de producción asignado. Retorna true solo si está completa.';
