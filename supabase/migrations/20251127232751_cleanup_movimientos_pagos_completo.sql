/*
  # Limpieza Completa de Movimientos de Pagos y Cuenta Corriente

  ## Descripción
  Limpia todos los registros de pagos y movimientos financieros para dejar
  el sistema en estado limpio, listo para datos de producción.

  ## Tablas a Limpiar

  ### 1. Sistema de Órdenes de Trabajo:
  - `ordenes_trabajo_pagos` - Pagos de órdenes de trabajo
  - `ordenes_trabajo_historial` - Historial (puede tener eventos de pagos)

  ### 2. Sistema de Centro de Copiado:
  - `centro_copiado_ordenes_pagos` - Pagos de órdenes de copiado

  ### 3. Sistema de Cuenta Corriente:
  - `cuentas_corrientes_movimientos` - Movimientos de cuenta corriente
  - `liquidaciones_pagos` - Pagos de liquidaciones
  - `liquidaciones_items` - Items de liquidaciones
  - `liquidaciones` - Liquidaciones

  ### 4. Sistema de Cajas (Tesorería):
  - `cajas_movimientos` - Movimientos de caja

  ## Orden de Eliminación
  Se respeta el orden de dependencias de foreign keys para evitar errores.

  ## Impacto
  - Elimina TODOS los movimientos financieros de prueba
  - Deja las estructuras de tablas intactas
  - Resetea el sistema financiero a estado limpio
  - NO afecta configuraciones (medios de cobro, cajas, etc.)

  ## IMPORTANTE
  Esta es una limpieza de datos de prueba. NO ejecutar en producción.
*/

-- =====================================================
-- LIMPIEZA: Sistema de Liquidaciones
-- =====================================================

-- Primero los pagos de liquidaciones (dependen de liquidaciones)
DELETE FROM liquidaciones_pagos WHERE id IS NOT NULL;

-- Luego los items de liquidaciones (dependen de liquidaciones)
DELETE FROM liquidaciones_items WHERE id IS NOT NULL;

-- Finalmente las liquidaciones
DELETE FROM liquidaciones WHERE id IS NOT NULL;

-- =====================================================
-- LIMPIEZA: Movimientos de Cuenta Corriente
-- =====================================================

-- Eliminar todos los movimientos de cuenta corriente
-- Incluye: cargos, pagos, ajustes, notas de crédito/débito
DELETE FROM cuentas_corrientes_movimientos WHERE id IS NOT NULL;

-- =====================================================
-- LIMPIEZA: Movimientos de Cajas
-- =====================================================

-- Eliminar todos los movimientos de caja
-- Incluye: ingresos, egresos, comisiones
DELETE FROM cajas_movimientos WHERE id IS NOT NULL;

-- =====================================================
-- LIMPIEZA: Pagos de Órdenes
-- =====================================================

-- Pagos de órdenes de centro de copiado
DELETE FROM centro_copiado_ordenes_pagos WHERE id IS NOT NULL;

-- Pagos de órdenes de trabajo
DELETE FROM ordenes_trabajo_pagos WHERE id IS NOT NULL;

-- =====================================================
-- LIMPIEZA: Historial de Órdenes (eventos de pagos)
-- =====================================================

-- Eliminar eventos de historial relacionados con pagos
-- Esto incluye: pago_registrado, pago_editado, pago_eliminado
DELETE FROM ordenes_trabajo_historial
WHERE tipo_evento IN ('pago_registrado', 'pago_editado', 'pago_eliminado');

-- =====================================================
-- RESETEAR SALDOS DE CAJAS A CERO
-- =====================================================

-- Actualizar saldos de todas las cajas a 0
-- Ya que eliminamos todos los movimientos, los saldos deben ser 0
UPDATE cajas
SET 
  saldo_actual = 0,
  updated_at = NOW()
WHERE id IS NOT NULL;

-- =====================================================
-- VERIFICACIÓN POST-LIMPIEZA
-- =====================================================

-- Queries para verificar la limpieza (ejecutar manualmente si necesario)

-- Verificar liquidaciones (debe retornar 0)
-- SELECT COUNT(*) as liquidaciones_count FROM liquidaciones;
-- SELECT COUNT(*) as liquidaciones_items_count FROM liquidaciones_items;
-- SELECT COUNT(*) as liquidaciones_pagos_count FROM liquidaciones_pagos;

-- Verificar movimientos (debe retornar 0)
-- SELECT COUNT(*) as cc_movimientos_count FROM cuentas_corrientes_movimientos;
-- SELECT COUNT(*) as cajas_movimientos_count FROM cajas_movimientos;

-- Verificar pagos (debe retornar 0)
-- SELECT COUNT(*) as pagos_ordenes_trabajo FROM ordenes_trabajo_pagos;
-- SELECT COUNT(*) as pagos_ordenes_copiado FROM centro_copiado_ordenes_pagos;

-- Verificar saldos de cajas (deben estar en 0)
-- SELECT 
--   nombre,
--   saldo_actual,
--   tipo,
--   is_active
-- FROM cajas
-- ORDER BY nombre;

-- =====================================================
-- RESUMEN DE ELIMINACIONES
-- =====================================================

/*
  REGISTROS ELIMINADOS:

  1. ✅ Liquidaciones y sus items/pagos
  2. ✅ Movimientos de cuenta corriente (cargos/pagos/ajustes)
  3. ✅ Movimientos de cajas (ingresos/egresos/comisiones)
  4. ✅ Pagos de órdenes de trabajo
  5. ✅ Pagos de órdenes de copiado
  6. ✅ Eventos de historial relacionados con pagos
  7. ✅ Saldos de cajas reseteados a 0

  LO QUE SE MANTIENE:

  1. ✅ Configuración de medios de cobro
  2. ✅ Configuración de cajas (estructura, nombre, tipo)
  3. ✅ Clientes y proveedores
  4. ✅ Catálogo de productos
  5. ✅ Órdenes de trabajo (sin pagos)
  6. ✅ Órdenes de copiado (sin pagos)
  7. ✅ Rutas de producción
  8. ✅ Items de órdenes
  9. ✅ Archivos adjuntos

  SISTEMA LIMPIO Y LISTO:

  - ✅ Sin movimientos financieros
  - ✅ Sin pagos registrados
  - ✅ Sin liquidaciones pendientes
  - ✅ Todas las cajas con saldo 0
  - ✅ Cuentas corrientes limpias
  - ✅ Estructura completa y funcional

  PRÓXIMOS PASOS RECOMENDADOS:

  1. Verificar conteos de registros (queries arriba)
  2. Verificar saldos de cajas están en 0
  3. Crear nueva orden de trabajo de prueba
  4. Registrar pago de prueba
  5. Verificar:
     - Se crea movimiento en cuenta corriente
     - Se registra movimiento en caja correcta
     - El saldo de caja se actualiza correctamente
  6. Crear liquidación de prueba
  7. Verificar que aparecen órdenes finalizadas/entregadas correctamente
*/
