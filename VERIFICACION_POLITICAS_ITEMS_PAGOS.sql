/*
  # Verificación: Políticas RLS de liquidaciones_items y liquidaciones_pagos

  Este script verifica que todas las políticas RLS estén correctamente aplicadas
  para las tablas liquidaciones_items y liquidaciones_pagos.
*/

-- =====================================================
-- VERIFICACIÓN 1: Políticas de liquidaciones_items
-- =====================================================

SELECT
  policyname,
  cmd as operacion,
  CASE
    WHEN cmd = 'SELECT' THEN '✅ Ya existía'
    WHEN cmd = 'INSERT' THEN '✅ Nueva - Fix #2'
    WHEN cmd = 'UPDATE' THEN '✅ Nueva - Fix #2'
    WHEN cmd = 'DELETE' THEN '✅ Nueva - Fix #2'
  END as estado
FROM pg_policies
WHERE tablename = 'liquidaciones_items'
ORDER BY cmd;

-- Resultado esperado: 4 filas
-- SELECT | ✅ Ya existía
-- INSERT | ✅ Nueva - Fix #2
-- UPDATE | ✅ Nueva - Fix #2
-- DELETE | ✅ Nueva - Fix #2

-- =====================================================
-- VERIFICACIÓN 2: Políticas de liquidaciones_pagos
-- =====================================================

SELECT
  policyname,
  cmd as operacion,
  CASE
    WHEN cmd = 'SELECT' THEN '✅ Ya existía'
    WHEN cmd = 'INSERT' THEN '✅ Nueva - Fix #2'
    WHEN cmd = 'UPDATE' THEN '✅ Nueva - Fix #2'
    WHEN cmd = 'DELETE' THEN '✅ Nueva - Fix #2'
  END as estado
FROM pg_policies
WHERE tablename = 'liquidaciones_pagos'
ORDER BY cmd;

-- Resultado esperado: 4 filas
-- SELECT | ✅ Ya existía
-- INSERT | ✅ Nueva - Fix #2
-- UPDATE | ✅ Nueva - Fix #2
-- DELETE | ✅ Nueva - Fix #2

-- =====================================================
-- VERIFICACIÓN 3: Resumen de Todas las Políticas
-- =====================================================

SELECT
  tablename,
  COUNT(*) as total_politicas,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_ok,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_ok,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_ok,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_ok,
  CASE
    WHEN COUNT(*) = 4 THEN '✅ Completo'
    ELSE '❌ Faltan políticas'
  END as estado
FROM pg_policies
WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
GROUP BY tablename
ORDER BY tablename;

-- Resultado esperado:
-- liquidaciones_items  | 4 | 1 | 1 | 1 | 1 | ✅ Completo
-- liquidaciones_pagos  | 4 | 1 | 1 | 1 | 1 | ✅ Completo

-- =====================================================
-- VERIFICACIÓN 4: Detalle de Políticas con Descripción
-- =====================================================

SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  CASE
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK ✅'
    ELSE 'Sin WITH CHECK'
  END as with_check_status,
  CASE
    WHEN qual IS NOT NULL THEN 'Tiene USING ✅'
    ELSE 'Sin USING'
  END as using_status
FROM pg_policies
WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
ORDER BY tablename, cmd;

-- Verificar que:
-- INSERT policies tienen WITH CHECK ✅
-- UPDATE policies tienen WITH CHECK y USING ✅
-- DELETE policies tienen USING ✅
-- SELECT policies tienen USING ✅

-- =====================================================
-- VERIFICACIÓN 5: Test de Patrón de Seguridad
-- =====================================================

-- Verificar que todas las políticas verifican a través de la liquidación padre
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%liquidacion_id IN%' OR with_check LIKE '%liquidacion_id IN%'
      THEN '✅ Verifica vía padre'
    ELSE '❌ NO verifica vía padre'
  END as patron_seguridad
FROM pg_policies
WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
ORDER BY tablename, cmd;

-- Todas deben mostrar: ✅ Verifica vía padre

-- =====================================================
-- VERIFICACIÓN 6: Comparación con Tabla Principal
-- =====================================================

-- Verificar que liquidaciones también tiene políticas completas
SELECT
  'liquidaciones' as tabla,
  COUNT(*) as total_politicas,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_ok,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_ok,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_ok,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_ok
FROM pg_policies
WHERE tablename = 'liquidaciones'

UNION ALL

SELECT
  'liquidaciones_items' as tabla,
  COUNT(*) as total_politicas,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_ok,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_ok,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_ok,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_ok
FROM pg_policies
WHERE tablename = 'liquidaciones_items'

UNION ALL

SELECT
  'liquidaciones_pagos' as tabla,
  COUNT(*) as total_politicas,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_ok,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_ok,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_ok,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_ok
FROM pg_policies
WHERE tablename = 'liquidaciones_pagos';

-- Todas las tablas deben tener al menos INSERT y SELECT

-- =====================================================
-- VERIFICACIÓN 7: Test Funcional (Simulación)
-- =====================================================

/*
  IMPORTANTE: Este test NO ejecuta nada, solo muestra el flujo esperado

  Flujo de creación de liquidación:

  1. Frontend ejecuta:
     INSERT INTO liquidaciones (...) VALUES (...);
     → Trigger completa company_id y numero_liquidacion
     → Política RLS verifica company_id
     → ✅ ÉXITO

  2. Frontend ejecuta:
     INSERT INTO liquidaciones_items (liquidacion_id, ...) VALUES (...);
     → Política RLS verifica liquidacion_id existe y pertenece a user company
     → ✅ ÉXITO

  3. Resultado:
     ✅ Liquidación creada con items
     ✅ Sin errores 403
*/

-- =====================================================
-- VERIFICACIÓN 8: Comentarios de Políticas
-- =====================================================

SELECT
  n.nspname as schema,
  c.relname as tabla,
  p.polname as politica,
  pg_catalog.obj_description(p.oid, 'pg_policy') as descripcion
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname IN ('liquidaciones_items', 'liquidaciones_pagos')
ORDER BY c.relname, p.polname;

-- Todas las políticas nuevas deben tener descripción

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================

/*
  ✅ SISTEMA CORRECTO SI:

  1. liquidaciones_items tiene 4 políticas (SELECT, INSERT, UPDATE, DELETE)
  2. liquidaciones_pagos tiene 4 políticas (SELECT, INSERT, UPDATE, DELETE)
  3. Todas las políticas verifican a través de liquidacion_id
  4. INSERT policies tienen WITH CHECK
  5. UPDATE policies tienen WITH CHECK y USING
  6. DELETE policies tienen USING
  7. Todas verifican company_id a través de la tabla padre
  8. Todas tienen comentarios descriptivos

  ❌ PROBLEMAS SI:

  1. Faltan políticas (< 4 por tabla)
  2. Políticas sin WITH CHECK o USING donde corresponde
  3. Políticas que NO verifican vía liquidacion_id
  4. Sin comentarios descriptivos

  📋 PRÓXIMOS PASOS:

  Si todas las verificaciones pasan:
  1. ✅ Políticas correctamente aplicadas
  2. Probar crear liquidación desde la UI
  3. Verificar que se crea sin errores
  4. Confirmar que items se crean correctamente
*/

-- =====================================================
-- QUERY FINAL: Validación Completa
-- =====================================================

WITH policy_check AS (
  SELECT
    tablename,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE cmd = 'SELECT') as has_select,
    COUNT(*) FILTER (WHERE cmd = 'INSERT') as has_insert,
    COUNT(*) FILTER (WHERE cmd = 'UPDATE') as has_update,
    COUNT(*) FILTER (WHERE cmd = 'DELETE') as has_delete
  FROM pg_policies
  WHERE tablename IN ('liquidaciones_items', 'liquidaciones_pagos')
  GROUP BY tablename
)
SELECT
  tablename,
  total,
  CASE
    WHEN has_select = 1 AND has_insert = 1 AND has_update = 1 AND has_delete = 1
      THEN '✅ TODAS LAS POLÍTICAS OK'
    ELSE '❌ FALTAN POLÍTICAS'
  END as estado,
  CASE
    WHEN has_select = 0 THEN '❌ Falta SELECT'
    WHEN has_insert = 0 THEN '❌ Falta INSERT'
    WHEN has_update = 0 THEN '❌ Falta UPDATE'
    WHEN has_delete = 0 THEN '❌ Falta DELETE'
    ELSE '✅ Todas presentes'
  END as detalle
FROM policy_check
ORDER BY tablename;

-- Resultado esperado: 2 filas, ambas con "✅ TODAS LAS POLÍTICAS OK"
