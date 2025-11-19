/*
  # Opción A: Normalizar Arquitectura de Tintas
  
  ## Descripción
  Esta migración implementa la arquitectura correcta para el manejo de tintas en el sistema,
  creando una tabla maestra `tintas` y actualizando todas las relaciones para usar foreign keys.
  
  ## Problema Resuelto
  
  ### Arquitectura Anterior (Inconsistente)
  - `tecnologias.tintas`: text[] - Valores directos ['K', 'CMYK']
  - `productos_impresion_laser_tecnologias.tintas`: text[] - Valores directos
  - `productos_impresion_laser_precios.tinta_id`: uuid - Sin FK real
  - `tecnologias_tintas_pasos.tinta`: text - Valores directos
  
  ### Arquitectura Nueva (Normalizada)
  - Nueva tabla `tintas` con ID, código y nombre
  - Todas las tablas usan FK a `tintas.id`
  - Integridad referencial garantizada
  - Facilita agregar nuevas tintas y propiedades
  
  ## Cambios Realizados
  
  1. **Nueva Tabla `tintas`**
     - Catálogo maestro de tintas del sistema
     - ID, código único, nombre descriptivo
  
  2. **Tabla `tecnologias`**
     - Cambiar `tintas` de text[] a uuid[]
  
  3. **Tabla `productos_impresion_laser_tecnologias`**
     - Cambiar `tintas` de text[] a uuid[]
  
  4. **Tabla `productos_impresion_laser_precios`**
     - Agregar FK a tintas.id
  
  5. **Tabla `tecnologias_tintas_pasos`**
     - Cambiar `tinta` de text a `tinta_id` uuid
     - Agregar FK a tintas.id
  
  ## Impacto
  - ✅ Integridad referencial
  - ✅ Consistencia en toda la aplicación
  - ✅ Facilita queries y joins
  - ✅ Previene valores inválidos
  - ⚠️ Requiere actualizar código frontend
*/

-- =====================================================
-- PASO 1: Crear tabla maestra de tintas
-- =====================================================

CREATE TABLE IF NOT EXISTS tintas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_tinta_codigo_por_company UNIQUE (company_id, codigo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tintas_company ON tintas(company_id);
CREATE INDEX IF NOT EXISTS idx_tintas_codigo ON tintas(codigo);
CREATE INDEX IF NOT EXISTS idx_tintas_activo ON tintas(activo) WHERE activo = true;

-- RLS
ALTER TABLE tintas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tintas from their company"
  ON tintas FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert tintas in their company"
  ON tintas FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update tintas in their company"
  ON tintas FOR UPDATE
  TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete tintas in their company"
  ON tintas FOR DELETE
  TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

COMMENT ON TABLE tintas IS 
  'Tabla maestra de tintas disponibles en el sistema para tecnologías de impresión';

COMMENT ON COLUMN tintas.codigo IS 
  'Código único de la tinta (K, CMYK, CMYK+W, etc.)';

-- =====================================================
-- PASO 2: Insertar tintas existentes
-- =====================================================

INSERT INTO tintas (company_id, codigo, nombre, descripcion)
SELECT DISTINCT
  c.id as company_id,
  tinta_codigo,
  CASE tinta_codigo
    WHEN 'K' THEN 'Negro (K)'
    WHEN 'CMYK' THEN 'Cuatricromía (CMYK)'
    WHEN 'CMYK+W' THEN 'CMYK + Blanco'
    WHEN 'CMYK+V' THEN 'CMYK + Barniz'
    WHEN 'CMYK+W+V' THEN 'CMYK + Blanco + Barniz'
    ELSE tinta_codigo
  END as nombre,
  'Tinta importada del sistema anterior' as descripcion
FROM companies c
CROSS JOIN (
  SELECT DISTINCT unnest(tintas) as tinta_codigo
  FROM tecnologias
  WHERE tintas IS NOT NULL AND array_length(tintas, 1) > 0
  
  UNION
  
  SELECT DISTINCT tinta as tinta_codigo
  FROM tecnologias_tintas_pasos
  
  UNION
  
  SELECT DISTINCT unnest(tintas) as tinta_codigo
  FROM productos_impresion_laser_tecnologias
  WHERE tintas IS NOT NULL AND array_length(tintas, 1) > 0
) tintas_existentes
ON CONFLICT (company_id, codigo) DO NOTHING;

-- =====================================================
-- PASO 3: Actualizar tecnologias_tintas_pasos
-- =====================================================

ALTER TABLE tecnologias_tintas_pasos 
  ADD COLUMN IF NOT EXISTS tinta_id uuid;

-- Migrar datos
UPDATE tecnologias_tintas_pasos ttp
SET tinta_id = (
  SELECT t.id
  FROM tintas t
  JOIN tecnologias tec ON tec.company_id = t.company_id
  WHERE t.codigo = ttp.tinta
    AND tec.id = ttp.tecnologia_id
  LIMIT 1
)
WHERE tinta_id IS NULL AND tinta IS NOT NULL;

-- NOT NULL y FK
ALTER TABLE tecnologias_tintas_pasos 
  ALTER COLUMN tinta_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_tecnologias_tintas_pasos_tinta'
  ) THEN
    ALTER TABLE tecnologias_tintas_pasos
      ADD CONSTRAINT fk_tecnologias_tintas_pasos_tinta
      FOREIGN KEY (tinta_id) REFERENCES tintas(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_pasos_tinta 
  ON tecnologias_tintas_pasos(tinta_id);

-- Eliminar columna vieja
ALTER TABLE tecnologias_tintas_pasos DROP COLUMN IF EXISTS tinta CASCADE;

COMMENT ON COLUMN tecnologias_tintas_pasos.tinta_id IS
  'ID de la tinta (FK a tintas.id)';

-- =====================================================
-- PASO 4: Actualizar tecnologias.tintas
-- =====================================================

ALTER TABLE tecnologias 
  ADD COLUMN IF NOT EXISTS tintas_ids uuid[];

-- Migrar datos
UPDATE tecnologias tec
SET tintas_ids = (
  SELECT array_agg(t.id ORDER BY idx)
  FROM unnest(tec.tintas) WITH ORDINALITY AS u(codigo, idx)
  JOIN tintas t ON t.codigo = u.codigo AND t.company_id = tec.company_id
)
WHERE tintas IS NOT NULL 
  AND array_length(tintas, 1) > 0
  AND tintas_ids IS NULL;

-- Reemplazar columna
ALTER TABLE tecnologias DROP COLUMN IF EXISTS tintas CASCADE;
ALTER TABLE tecnologias RENAME COLUMN tintas_ids TO tintas;

ALTER TABLE tecnologias 
  ALTER COLUMN tintas SET DEFAULT ARRAY[]::uuid[];

ALTER TABLE tecnologias 
  ALTER COLUMN tintas SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tecnologias_tintas_gin 
  ON tecnologias USING GIN (tintas);

COMMENT ON COLUMN tecnologias.tintas IS 
  'Array de IDs de tintas disponibles para esta tecnología (FK a tintas.id)';

-- =====================================================
-- PASO 5: Actualizar productos_impresion_laser_tecnologias
-- =====================================================

ALTER TABLE productos_impresion_laser_tecnologias 
  ADD COLUMN IF NOT EXISTS tintas_ids uuid[];

-- Migrar datos (obtener company_id a través de producto_laser_id)
UPDATE productos_impresion_laser_tecnologias plt
SET tintas_ids = (
  SELECT array_agg(t.id ORDER BY idx)
  FROM unnest(plt.tintas) WITH ORDINALITY AS u(codigo, idx)
  JOIN productos_impresion_laser pl ON pl.id = plt.producto_laser_id
  JOIN tintas t ON t.codigo = u.codigo AND t.company_id = pl.company_id
)
WHERE tintas IS NOT NULL 
  AND array_length(tintas, 1) > 0
  AND tintas_ids IS NULL;

-- Reemplazar columna
ALTER TABLE productos_impresion_laser_tecnologias 
  DROP COLUMN IF EXISTS tintas CASCADE;
  
ALTER TABLE productos_impresion_laser_tecnologias 
  RENAME COLUMN tintas_ids TO tintas;

ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas SET DEFAULT ARRAY[]::uuid[];

ALTER TABLE productos_impresion_laser_tecnologias 
  ALTER COLUMN tintas SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pl_tecnologias_tintas_gin 
  ON productos_impresion_laser_tecnologias USING GIN (tintas);

COMMENT ON COLUMN productos_impresion_laser_tecnologias.tintas IS 
  'Array de IDs de tintas seleccionadas para este producto (FK a tintas.id)';

-- =====================================================
-- PASO 6: Actualizar productos_impresion_laser_precios
-- =====================================================

-- Limpiar datos inválidos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM productos_impresion_laser_precios plp
    WHERE NOT EXISTS (
      SELECT 1 FROM tintas t 
      WHERE t.id = plp.tinta_id
    )
  ) THEN
    DELETE FROM productos_impresion_laser_precios
    WHERE NOT EXISTS (
      SELECT 1 FROM tintas t 
      WHERE t.id = tinta_id
    );
    
    RAISE NOTICE 'Se eliminaron precios con tinta_id inválido';
  END IF;
END $$;

-- Agregar FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_pl_precios_tinta'
  ) THEN
    ALTER TABLE productos_impresion_laser_precios
      ADD CONSTRAINT fk_pl_precios_tinta
      FOREIGN KEY (tinta_id) REFERENCES tintas(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pl_precios_tinta 
  ON productos_impresion_laser_precios(tinta_id);

COMMENT ON COLUMN productos_impresion_laser_precios.tinta_id IS 
  'ID de la tinta seleccionada (FK a tintas.id)';

-- =====================================================
-- PASO 7: Función helper
-- =====================================================

CREATE OR REPLACE FUNCTION get_tintas_info(tinta_ids uuid[])
RETURNS TABLE (
  id uuid,
  codigo text,
  nombre text
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.codigo, t.nombre
  FROM tintas t
  WHERE t.id = ANY(tinta_ids)
    AND t.activo = true
  ORDER BY array_position(tinta_ids, t.id);
END;
$$;

COMMENT ON FUNCTION get_tintas_info(uuid[]) IS 
  'Función helper para obtener información de tintas dado un array de IDs';

-- =====================================================
-- PASO 8: Validación de tintas
-- =====================================================

CREATE OR REPLACE FUNCTION validar_tintas_tecnologia()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tintas IS NOT NULL AND array_length(NEW.tintas, 1) > 0 THEN
    IF NOT (
      SELECT bool_and(EXISTS(SELECT 1 FROM tintas WHERE id = tinta_id))
      FROM unnest(NEW.tintas) AS tinta_id
    ) THEN
      RAISE EXCEPTION 'Una o más tintas no existen en la tabla tintas';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_tintas_tecnologia ON tecnologias;
CREATE TRIGGER trg_validar_tintas_tecnologia
  BEFORE INSERT OR UPDATE ON tecnologias
  FOR EACH ROW
  EXECUTE FUNCTION validar_tintas_tecnologia();

DROP TRIGGER IF EXISTS trg_validar_tintas_pl_tecnologia ON productos_impresion_laser_tecnologias;
CREATE TRIGGER trg_validar_tintas_pl_tecnologia
  BEFORE INSERT OR UPDATE ON productos_impresion_laser_tecnologias
  FOR EACH ROW
  EXECUTE FUNCTION validar_tintas_tecnologia();
