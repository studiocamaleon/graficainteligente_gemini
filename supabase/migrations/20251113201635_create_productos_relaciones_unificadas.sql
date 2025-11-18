/*
  # Crear Tablas de Relaciones Unificadas para Productos Específicos

  ## Descripción
  Esta migración crea tablas de relación que pueden vincularse con cualquiera
  de las tres tablas de productos específicas (laser, gran formato, materiales rígidos).
  
  Usa un patrón polimórfico con campos:
  - producto_tipo: 'laser' | 'gran_formato' | 'materiales_rigidos'
  - producto_id: UUID del producto en la tabla correspondiente

  ## Nuevas Tablas

  ### 1. productos_tecnologias_v2
  Relaciona productos con tecnologías de impresión y sus tintas

  ### 2. productos_materiales_v2
  Relaciona productos con materiales, variantes y espesores

  ### 3. productos_servicios_v2
  Relaciona productos con servicios disponibles

  ### 4. productos_acabados_v2
  Relaciona productos con acabados disponibles

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id
  - Verificación de que el producto pertenece a la empresa del usuario

  ## Índices
  - Índices compuestos en (producto_tipo, producto_id) para optimizar consultas
  - Índices en foreign keys
*/

-- =====================================================
-- 1. PRODUCTOS_TECNOLOGIAS_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_tecnologias_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_tipo text NOT NULL,
  producto_id uuid NOT NULL,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_producto_tipo_tecnologias 
    CHECK (producto_tipo IN ('laser', 'gran_formato', 'materiales_rigidos')),
  UNIQUE(producto_tipo, producto_id, tecnologia_id)
);

ALTER TABLE productos_tecnologias_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_tecnologias_v2"
  ON productos_tecnologias_v2 FOR SELECT
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

CREATE POLICY "Users can insert own company productos_tecnologias_v2"
  ON productos_tecnologias_v2 FOR INSERT
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

CREATE POLICY "Users can update own company productos_tecnologias_v2"
  ON productos_tecnologias_v2 FOR UPDATE
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

CREATE POLICY "Users can delete own company productos_tecnologias_v2"
  ON productos_tecnologias_v2 FOR DELETE
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

CREATE INDEX IF NOT EXISTS idx_productos_tecnologias_v2_producto 
  ON productos_tecnologias_v2(producto_tipo, producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_tecnologias_v2_tecnologia_id 
  ON productos_tecnologias_v2(tecnologia_id);

-- =====================================================
-- 2. PRODUCTOS_MATERIALES_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_tipo text NOT NULL,
  producto_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesores jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_producto_tipo_materiales 
    CHECK (producto_tipo IN ('laser', 'gran_formato', 'materiales_rigidos'))
);

ALTER TABLE productos_materiales_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_materiales_v2"
  ON productos_materiales_v2 FOR SELECT
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

CREATE POLICY "Users can insert own company productos_materiales_v2"
  ON productos_materiales_v2 FOR INSERT
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

CREATE POLICY "Users can update own company productos_materiales_v2"
  ON productos_materiales_v2 FOR UPDATE
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

CREATE POLICY "Users can delete own company productos_materiales_v2"
  ON productos_materiales_v2 FOR DELETE
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

CREATE INDEX IF NOT EXISTS idx_productos_materiales_v2_producto 
  ON productos_materiales_v2(producto_tipo, producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_materiales_v2_material_id 
  ON productos_materiales_v2(material_id);

-- =====================================================
-- 3. PRODUCTOS_SERVICIOS_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_servicios_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_tipo text NOT NULL,
  producto_id uuid NOT NULL,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_producto_tipo_servicios 
    CHECK (producto_tipo IN ('laser', 'gran_formato', 'materiales_rigidos')),
  UNIQUE(producto_tipo, producto_id, servicio_id)
);

ALTER TABLE productos_servicios_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_servicios_v2"
  ON productos_servicios_v2 FOR SELECT
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

CREATE POLICY "Users can insert own company productos_servicios_v2"
  ON productos_servicios_v2 FOR INSERT
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

CREATE POLICY "Users can update own company productos_servicios_v2"
  ON productos_servicios_v2 FOR UPDATE
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

CREATE POLICY "Users can delete own company productos_servicios_v2"
  ON productos_servicios_v2 FOR DELETE
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

CREATE INDEX IF NOT EXISTS idx_productos_servicios_v2_producto 
  ON productos_servicios_v2(producto_tipo, producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_servicios_v2_servicio_id 
  ON productos_servicios_v2(servicio_id);

-- =====================================================
-- 4. PRODUCTOS_ACABADOS_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_acabados_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_tipo text NOT NULL,
  producto_id uuid NOT NULL,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_producto_tipo_acabados 
    CHECK (producto_tipo IN ('laser', 'gran_formato', 'materiales_rigidos')),
  UNIQUE(producto_tipo, producto_id, acabado_id)
);

ALTER TABLE productos_acabados_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_acabados_v2"
  ON productos_acabados_v2 FOR SELECT
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

CREATE POLICY "Users can insert own company productos_acabados_v2"
  ON productos_acabados_v2 FOR INSERT
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

CREATE POLICY "Users can update own company productos_acabados_v2"
  ON productos_acabados_v2 FOR UPDATE
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

CREATE POLICY "Users can delete own company productos_acabados_v2"
  ON productos_acabados_v2 FOR DELETE
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

CREATE INDEX IF NOT EXISTS idx_productos_acabados_v2_producto 
  ON productos_acabados_v2(producto_tipo, producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_acabados_v2_acabado_id 
  ON productos_acabados_v2(acabado_id);

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE productos_tecnologias_v2 IS 
  'Relación polimórfica entre productos (cualquier tipo) y tecnologías de impresión';

COMMENT ON TABLE productos_materiales_v2 IS 
  'Relación polimórfica entre productos (cualquier tipo) y materiales con variantes';

COMMENT ON TABLE productos_servicios_v2 IS 
  'Relación polimórfica entre productos (cualquier tipo) y servicios disponibles';

COMMENT ON TABLE productos_acabados_v2 IS 
  'Relación polimórfica entre productos (cualquier tipo) y acabados disponibles';

COMMENT ON COLUMN productos_tecnologias_v2.producto_tipo IS 
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_materiales_v2.producto_tipo IS 
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_servicios_v2.producto_tipo IS 
  'Tipo de producto: laser, gran_formato, materiales_rigidos';

COMMENT ON COLUMN productos_acabados_v2.producto_tipo IS 
  'Tipo de producto: laser, gran_formato, materiales_rigidos';
