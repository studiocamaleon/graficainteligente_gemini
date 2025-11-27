/*
  # Fix: Políticas RLS Faltantes para Tablas de Liquidaciones

  ## Problema
  Las tablas liquidaciones_items y liquidaciones_pagos tienen RLS habilitado
  pero solo tienen políticas de SELECT. Faltan políticas de INSERT, UPDATE y DELETE.

  Error actual: "new row violates row-level security policy for table liquidaciones_items"

  ## Solución
  Agregar políticas completas (INSERT, UPDATE, DELETE) para:
  - liquidaciones_items
  - liquidaciones_pagos

  ## Patrón de Seguridad
  Todas las políticas verifican el acceso a través de la liquidación padre:
  - El usuario debe pertenecer a la misma company_id de la liquidación
  - Consistente con el patrón usado en ordenes_trabajo y tablas relacionadas

  ## Políticas Creadas

  ### liquidaciones_items:
  1. INSERT - Permitir crear items si el usuario tiene acceso a la liquidación
  2. UPDATE - Permitir actualizar items propios
  3. DELETE - Permitir eliminar items propios

  ### liquidaciones_pagos:
  1. INSERT - Permitir asociar pagos a liquidaciones propias
  2. UPDATE - Permitir actualizar pagos asociados
  3. DELETE - Permitir eliminar pagos asociados

  ## Seguridad
  - Mantiene aislamiento por company_id
  - Usuario solo puede manipular items de sus liquidaciones
  - Verificación siempre a través de la tabla padre (liquidaciones)
*/

-- =====================================================
-- POLÍTICAS RLS: liquidaciones_items
-- =====================================================

-- Política de INSERT
CREATE POLICY "Users can insert liquidaciones_items via liquidacion"
  ON liquidaciones_items FOR INSERT
  TO authenticated
  WITH CHECK (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Política de UPDATE
CREATE POLICY "Users can update liquidaciones_items via liquidacion"
  ON liquidaciones_items FOR UPDATE
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Política de DELETE
CREATE POLICY "Users can delete liquidaciones_items via liquidacion"
  ON liquidaciones_items FOR DELETE
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- POLÍTICAS RLS: liquidaciones_pagos
-- =====================================================

-- Política de INSERT
CREATE POLICY "Users can insert liquidaciones_pagos via liquidacion"
  ON liquidaciones_pagos FOR INSERT
  TO authenticated
  WITH CHECK (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Política de UPDATE
CREATE POLICY "Users can update liquidaciones_pagos via liquidacion"
  ON liquidaciones_pagos FOR UPDATE
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Política de DELETE
CREATE POLICY "Users can delete liquidaciones_pagos via liquidacion"
  ON liquidaciones_pagos FOR DELETE
  TO authenticated
  USING (
    liquidacion_id IN (
      SELECT id FROM liquidaciones 
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =====================================================
-- COMENTARIOS DESCRIPTIVOS
-- =====================================================

COMMENT ON POLICY "Users can insert liquidaciones_items via liquidacion" ON liquidaciones_items IS 
  'Permite insertar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';

COMMENT ON POLICY "Users can update liquidaciones_items via liquidacion" ON liquidaciones_items IS 
  'Permite actualizar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';

COMMENT ON POLICY "Users can delete liquidaciones_items via liquidacion" ON liquidaciones_items IS 
  'Permite eliminar items de liquidación si el usuario pertenece a la misma company que la liquidación padre';

COMMENT ON POLICY "Users can insert liquidaciones_pagos via liquidacion" ON liquidaciones_pagos IS 
  'Permite insertar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';

COMMENT ON POLICY "Users can update liquidaciones_pagos via liquidacion" ON liquidaciones_pagos IS 
  'Permite actualizar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';

COMMENT ON POLICY "Users can delete liquidaciones_pagos via liquidacion" ON liquidaciones_pagos IS 
  'Permite eliminar pagos asociados a liquidación si el usuario pertenece a la misma company que la liquidación padre';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

/*
  Para verificar que las políticas están correctamente aplicadas:

  1. Verificar que existen las políticas de INSERT:
  
  SELECT
    schemaname,
    tablename,
    policyname,
    cmd
  FROM pg_policies
  WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
    AND cmd = 'INSERT';

  -- Debe retornar 2 filas (1 por tabla)

  2. Verificar todas las políticas:
  
  SELECT
    tablename,
    policyname,
    cmd
  FROM pg_policies
  WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
  ORDER BY tablename, cmd;

  -- Debe retornar 8 filas (4 por tabla: SELECT, INSERT, UPDATE, DELETE)

  3. Test de creación completa:
  
  -- Crear liquidación (ya funciona con el fix anterior)
  INSERT INTO liquidaciones (cliente_id, ...) VALUES (...);
  
  -- Crear items (debe funcionar ahora)
  INSERT INTO liquidaciones_items (liquidacion_id, orden_id, ...) VALUES (...);
  
  -- Debe ejecutarse sin error 403
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
  PATRÓN DE SEGURIDAD:

  Todas las políticas siguen el mismo patrón:
  1. Verificar que el usuario está autenticado
  2. Verificar que liquidacion_id existe en liquidaciones
  3. Verificar que la liquidación pertenece a la misma company del usuario
  
  Este patrón:
  ✅ Garantiza aislamiento por company_id
  ✅ Permite operaciones dentro de la misma company
  ✅ Previene acceso cruzado entre companies
  ✅ Es consistente con otras tablas del sistema

  OPERACIONES PERMITIDAS:

  Con estas políticas, los usuarios pueden:
  ✅ Crear items de liquidación para sus liquidaciones
  ✅ Actualizar items existentes
  ✅ Eliminar items si es necesario
  ✅ Asociar pagos a sus liquidaciones
  ✅ Actualizar pagos asociados
  ✅ Eliminar pagos asociados

  OPERACIONES BLOQUEADAS:

  Los usuarios NO pueden:
  ❌ Crear items para liquidaciones de otras companies
  ❌ Actualizar items de otras companies
  ❌ Eliminar items de otras companies
  ❌ Asociar pagos a liquidaciones de otras companies

  CASCADA DE PERMISOS:

  liquidaciones (padre)
    ↓ (verifica company_id)
  liquidaciones_items (hijo)
    ↓ (hereda permisos)
  Usuario puede operar

  Si el usuario NO tiene acceso a la liquidación padre,
  automáticamente NO tiene acceso a los items.

  PERFORMANCE:

  Las subconsultas son eficientes porque:
  - liquidacion_id está indexado
  - company_id está indexado
  - Las consultas solo buscan en la misma company
  - Postgres optimiza las subconsultas IN con índices

  MANTENIMIENTO:

  Si en el futuro se necesita:
  - Agregar más tablas relacionadas a liquidaciones
  - Usar el mismo patrón de políticas
  - Verificar acceso a través de la tabla padre
  - Mantener consistencia con el sistema
*/
