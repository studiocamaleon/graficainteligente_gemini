/*
  # Script de Verificación Post-Limpieza de Movimientos

  Ejecuta estas queries para verificar que todos los movimientos
  financieros fueron eliminados correctamente.

  ## Uso
  1. Copia y pega cada query en el SQL Editor de Supabase
  2. Verifica que los conteos sean 0
  3. Verifica que los saldos de cajas sean 0
*/

-- =====================================================
-- VERIFICACIÓN 1: Liquidaciones
-- =====================================================

-- Debe retornar: liquidaciones_count = 0
SELECT COUNT(*) as liquidaciones_count FROM liquidaciones;

-- Debe retornar: liquidaciones_items_count = 0
SELECT COUNT(*) as liquidaciones_items_count FROM liquidaciones_items;

-- Debe retornar: liquidaciones_pagos_count = 0
SELECT COUNT(*) as liquidaciones_pagos_count FROM liquidaciones_pagos;

-- =====================================================
-- VERIFICACIÓN 2: Movimientos de Cuenta Corriente
-- =====================================================

-- Debe retornar: cc_movimientos_count = 0
SELECT COUNT(*) as cc_movimientos_count FROM cuentas_corrientes_movimientos;

-- Verificar por tipo de movimiento (todos deben ser 0)
SELECT
  tipo_movimiento,
  COUNT(*) as cantidad
FROM cuentas_corrientes_movimientos
GROUP BY tipo_movimiento;

-- =====================================================
-- VERIFICACIÓN 3: Movimientos de Cajas
-- =====================================================

-- Debe retornar: cajas_movimientos_count = 0
SELECT COUNT(*) as cajas_movimientos_count FROM cajas_movimientos;

-- Verificar por tipo de movimiento (todos deben ser 0)
SELECT
  tipo_movimiento,
  COUNT(*) as cantidad
FROM cajas_movimientos
GROUP BY tipo_movimiento;

-- =====================================================
-- VERIFICACIÓN 4: Pagos de Órdenes
-- =====================================================

-- Debe retornar: pagos_ordenes_trabajo = 0
SELECT COUNT(*) as pagos_ordenes_trabajo FROM ordenes_trabajo_pagos;

-- Debe retornar: pagos_ordenes_copiado = 0
SELECT COUNT(*) as pagos_ordenes_copiado FROM centro_copiado_ordenes_pagos;

-- =====================================================
-- VERIFICACIÓN 5: Historial de Pagos
-- =====================================================

-- Debe retornar 0 (eventos de pagos eliminados)
SELECT COUNT(*) as historial_pagos_count
FROM ordenes_trabajo_historial
WHERE tipo_evento IN ('pago_registrado', 'pago_editado', 'pago_eliminado');

-- =====================================================
-- VERIFICACIÓN 6: Saldos de Cajas
-- =====================================================

-- TODOS los saldos deben estar en 0
SELECT
  nombre,
  tipo,
  saldo_actual,
  moneda,
  is_active,
  CASE
    WHEN saldo_actual = 0 THEN '✅ OK'
    ELSE '❌ ERROR: Saldo no es 0'
  END as estado_saldo
FROM cajas
ORDER BY nombre;

-- Verificar que NO hay cajas con saldo diferente de 0
SELECT
  COUNT(*) as cajas_con_saldo_incorrecto
FROM cajas
WHERE saldo_actual != 0;

-- =====================================================
-- VERIFICACIÓN 7: Resumen General
-- =====================================================

SELECT
  'Liquidaciones' as tabla,
  COUNT(*) as cantidad_registros
FROM liquidaciones
UNION ALL
SELECT
  'Liquidaciones Items',
  COUNT(*)
FROM liquidaciones_items
UNION ALL
SELECT
  'Liquidaciones Pagos',
  COUNT(*)
FROM liquidaciones_pagos
UNION ALL
SELECT
  'CC Movimientos',
  COUNT(*)
FROM cuentas_corrientes_movimientos
UNION ALL
SELECT
  'Cajas Movimientos',
  COUNT(*)
FROM cajas_movimientos
UNION ALL
SELECT
  'Pagos Órdenes Trabajo',
  COUNT(*)
FROM ordenes_trabajo_pagos
UNION ALL
SELECT
  'Pagos Órdenes Copiado',
  COUNT(*)
FROM centro_copiado_ordenes_pagos
UNION ALL
SELECT
  'Historial Pagos',
  COUNT(*)
FROM ordenes_trabajo_historial
WHERE tipo_evento IN ('pago_registrado', 'pago_editado', 'pago_eliminado');

-- =====================================================
-- VERIFICACIÓN 8: Estado de Configuraciones
-- =====================================================

-- Verificar que las CONFIGURACIONES se mantienen intactas

-- Medios de Cobro (deben existir registros)
SELECT
  'Medios de Cobro' as configuracion,
  COUNT(*) as cantidad,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Configuración intacta'
    ELSE '⚠️ Sin configuración'
  END as estado
FROM medios_cobro;

-- Cajas (deben existir registros)
SELECT
  'Cajas' as configuracion,
  COUNT(*) as cantidad,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Configuración intacta'
    ELSE '⚠️ Sin configuración'
  END as estado
FROM cajas;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================

/*
  ✅ SISTEMA LIMPIO SI:

  1. Todos los conteos de movimientos son 0:
     - Liquidaciones: 0
     - Movimientos CC: 0
     - Movimientos Cajas: 0
     - Pagos: 0
     - Historial Pagos: 0

  2. Todos los saldos de cajas son 0:
     - saldo_actual = 0 para TODAS las cajas

  3. Las configuraciones existen:
     - Medios de Cobro: > 0 registros
     - Cajas: > 0 registros

  ❌ PROBLEMA SI:

  1. Algún conteo de movimientos es > 0
  2. Alguna caja tiene saldo_actual != 0
  3. No existen medios de cobro o cajas configuradas

  📋 PRÓXIMOS PASOS:

  Si todas las verificaciones pasan:
  1. ✅ Sistema limpio y listo
  2. Crear orden de prueba
  3. Registrar pago
  4. Verificar que se registren movimientos correctamente
*/
