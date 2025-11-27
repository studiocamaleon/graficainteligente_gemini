/*
  # Script de Verificación: Fix Liquidaciones RLS

  Ejecuta estas queries para verificar que el fix está correctamente aplicado.
*/

-- =====================================================
-- VERIFICACIÓN 1: Trigger Existe
-- =====================================================

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_complete_liquidacion';

-- Resultado esperado:
-- trigger_name: trigger_auto_complete_liquidacion
-- event_manipulation: INSERT
-- event_object_table: liquidaciones
-- action_timing: BEFORE
-- action_statement: EXECUTE FUNCTION fn_auto_complete_liquidacion()

-- =====================================================
-- VERIFICACIÓN 2: Función Existe
-- =====================================================

SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'fn_auto_complete_liquidacion';

-- Resultado esperado:
-- routine_name: fn_auto_complete_liquidacion
-- routine_type: FUNCTION
-- security_type: DEFINER

-- =====================================================
-- VERIFICACIÓN 3: Política RLS Actualizada
-- =====================================================

SELECT
  policyname,
  permissive,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'liquidaciones'
  AND cmd = 'INSERT';

-- Resultado esperado:
-- policyname: Users can insert own company liquidaciones
-- permissive: PERMISSIVE
-- cmd: INSERT
-- with_check: (company_id = ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))

-- =====================================================
-- VERIFICACIÓN 4: Función Generadora de Números
-- =====================================================

-- Test de la función (reemplaza con tu company_id real)
-- SELECT fn_generar_numero_liquidacion('tu-company-id-uuid');

-- Resultado esperado: LIQ-000001 (o el siguiente número disponible)

-- =====================================================
-- VERIFICACIÓN 5: Test del Trigger (CUIDADO: Inserta datos)
-- =====================================================

/*
  ⚠️ IMPORTANTE: Este test INSERTA una liquidación de prueba.
  Solo ejecutar si quieres probar el sistema.

  Reemplaza los UUIDs con valores reales de tu sistema:
  - cliente_id: UUID de un cliente existente

  El trigger debe auto-completar:
  - company_id
  - numero_liquidacion
  - created_by
*/

-- Paso 1: Obtener un cliente existente para usar en el test
SELECT id, nombre_fantasia
FROM clients
LIMIT 1;

-- Paso 2: Crear liquidación de prueba (COMENTADO por seguridad)
/*
INSERT INTO liquidaciones (
  cliente_id,              -- ⚠️ Reemplazar con cliente_id real
  fecha_emision,
  fecha_vencimiento,
  estado,
  subtotal_ordenes,
  total_general,
  saldo_pendiente
) VALUES (
  '00000000-0000-0000-0000-000000000000',  -- ⚠️ CAMBIAR ESTE UUID
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'pendiente',
  1000.00,
  1000.00,
  1000.00
) RETURNING
  id,
  company_id,           -- Debe tener valor auto-completado ✅
  numero_liquidacion,   -- Debe ser LIQ-XXXXXX ✅
  cliente_id,
  created_by,           -- Debe ser tu usuario ✅
  created_at;
*/

-- Paso 3: Si ejecutaste el INSERT, verifica la liquidación creada
/*
SELECT
  id,
  company_id,
  numero_liquidacion,
  cliente_id,
  fecha_emision,
  fecha_vencimiento,
  estado,
  total_general,
  created_by,
  created_at
FROM liquidaciones
ORDER BY created_at DESC
LIMIT 1;
*/

-- Paso 4: Si ejecutaste el INSERT, limpia la liquidación de prueba
/*
DELETE FROM liquidaciones
WHERE numero_liquidacion LIKE 'LIQ-%'
  AND total_general = 1000.00
  AND estado = 'pendiente'
ORDER BY created_at DESC
LIMIT 1;
*/

-- =====================================================
-- VERIFICACIÓN 6: Verificar Liquidaciones Existentes
-- =====================================================

-- Ver últimas 5 liquidaciones
SELECT
  l.id,
  l.company_id,
  l.numero_liquidacion,
  c.nombre_fantasia as cliente,
  l.fecha_emision,
  l.estado,
  l.total_general,
  l.saldo_pendiente,
  p.full_name as creado_por,
  l.created_at
FROM liquidaciones l
JOIN clients c ON l.cliente_id = c.id
LEFT JOIN profiles p ON l.created_by = p.id
ORDER BY l.created_at DESC
LIMIT 5;

-- =====================================================
-- VERIFICACIÓN 7: Validar Integridad de Datos
-- =====================================================

-- Verificar que NO hay liquidaciones con company_id NULL
SELECT COUNT(*) as liquidaciones_sin_company
FROM liquidaciones
WHERE company_id IS NULL;

-- Debe retornar: 0

-- Verificar que NO hay liquidaciones con numero_liquidacion NULL
SELECT COUNT(*) as liquidaciones_sin_numero
FROM liquidaciones
WHERE numero_liquidacion IS NULL OR numero_liquidacion = '';

-- Debe retornar: 0

-- Verificar formato de números de liquidación
SELECT
  numero_liquidacion,
  CASE
    WHEN numero_liquidacion ~ '^LIQ-[0-9]+$' THEN '✅ Formato correcto'
    ELSE '❌ Formato incorrecto'
  END as validacion_formato
FROM liquidaciones
ORDER BY created_at DESC
LIMIT 10;

-- Todos deben mostrar: ✅ Formato correcto

-- =====================================================
-- VERIFICACIÓN 8: Test de Performance
-- =====================================================

-- Verificar tiempo de ejecución del trigger
EXPLAIN ANALYZE
SELECT fn_auto_complete_liquidacion();

-- El tiempo debe ser < 10ms

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================

/*
  ✅ SISTEMA CORRECTO SI:

  1. Trigger existe y está activo
  2. Función existe con SECURITY DEFINER
  3. Política RLS actualizada (sin restricción de roles)
  4. Función generadora de números funciona
  5. Liquidaciones existentes tienen:
     - company_id válido (no NULL)
     - numero_liquidacion con formato LIQ-XXXXXX
     - created_by registrado
  6. Conteos de NULL son 0
  7. Formatos son correctos

  ❌ PROBLEMAS SI:

  1. Trigger no existe
  2. Función no existe
  3. Política RLS incorrecta
  4. Liquidaciones con company_id NULL
  5. Liquidaciones con numero_liquidacion NULL o mal formato
  6. Performance > 50ms

  📋 PRÓXIMOS PASOS:

  Si todas las verificaciones pasan:
  1. ✅ Sistema listo para usar
  2. Probar crear liquidación desde la UI
  3. Verificar que se crea correctamente
  4. Confirmar que número se genera automáticamente
*/
