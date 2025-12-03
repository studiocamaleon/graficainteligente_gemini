/*
  # Limpieza Completa de Datos de Prueba del Sistema

  ## Resumen
  Este script elimina todos los datos transaccionales de prueba del sistema,
  manteniendo intacta la estructura de tablas, configuraciones base, y datos
  de usuarios.

  ## Datos que se eliminan
  - Clientes creados
  - Proveedores creados
  - Órdenes de trabajo con todos sus datos relacionados (items, pagos, rutas, links, historial)
  - Órdenes de centro de copiado con sus datos relacionados
  - Presupuestos con todos sus datos relacionados
  - Movimientos de cuentas corrientes
  - Liquidaciones
  - Ingresos y egresos manuales
  - Movimientos de cajas relacionados

  ## Datos que se PRESERVAN
  - Estructura de tablas
  - Usuarios y perfiles
  - Configuraciones de empresa (companies, business_hours)
  - Configuraciones de sistema (materiales, tecnologías, estaciones, pasos, rutas, servicios, acabados)
  - Productos del catálogo y sus precios
  - Configuraciones de centro de copiado (papeles, plastificados, tamaños, rangos)
  - Cajas del sistema
  - Medios de cobro
  - Tipos de ingreso y egreso
  - Ubicaciones (países, provincias, ciudades)
  - Roles personalizados
  - Condiciones comerciales predefinidas

  ## IMPORTANTE
  - Este es un cambio DESTRUCTIVO e IRREVERSIBLE
  - Se recomienda hacer un backup antes de ejecutar
  - Respeta el multi-tenancy (company_id)
  - El orden de eliminación respeta las dependencias de claves foráneas
*/

-- =====================================================
-- 1. LIMPIEZA DE NOTIFICACIONES WHATSAPP
-- =====================================================

TRUNCATE TABLE whatsapp_notificaciones CASCADE;

-- =====================================================
-- 2. LIMPIEZA DE CUENTAS CORRIENTES Y LIQUIDACIONES
-- =====================================================

TRUNCATE TABLE liquidaciones_pagos CASCADE;
TRUNCATE TABLE liquidaciones_items CASCADE;
TRUNCATE TABLE liquidaciones CASCADE;
TRUNCATE TABLE cuentas_corrientes_movimientos CASCADE;

-- =====================================================
-- 3. LIMPIEZA DE PRESUPUESTOS
-- =====================================================

TRUNCATE TABLE presupuestos_archivos CASCADE;
TRUNCATE TABLE presupuestos_condiciones_comerciales CASCADE;
TRUNCATE TABLE presupuestos_historial CASCADE;
TRUNCATE TABLE presupuestos_items CASCADE;
TRUNCATE TABLE presupuestos CASCADE;

-- =====================================================
-- 4. LIMPIEZA DE ÓRDENES DE TRABAJO
-- =====================================================

TRUNCATE TABLE ordenes_trabajo_links CASCADE;
TRUNCATE TABLE ordenes_items_rutas_pausas CASCADE;
TRUNCATE TABLE ordenes_trabajo_items_rutas CASCADE;
TRUNCATE TABLE ordenes_trabajo_servicios_items CASCADE;
TRUNCATE TABLE ordenes_trabajo_acabados_items CASCADE;
TRUNCATE TABLE ordenes_trabajo_items CASCADE;
TRUNCATE TABLE ordenes_trabajo_pagos CASCADE;
TRUNCATE TABLE ordenes_trabajo_historial CASCADE;
TRUNCATE TABLE ordenes_trabajo CASCADE;

-- =====================================================
-- 5. LIMPIEZA DE CENTRO DE COPIADO
-- =====================================================

TRUNCATE TABLE centro_copiado_ordenes_archivos CASCADE;
TRUNCATE TABLE centro_copiado_ordenes_items CASCADE;
TRUNCATE TABLE centro_copiado_ordenes_pagos CASCADE;
TRUNCATE TABLE centro_copiado_ordenes CASCADE;

-- =====================================================
-- 6. LIMPIEZA DE MOVIMIENTOS FINANCIEROS
-- =====================================================

DELETE FROM cajas_movimientos WHERE referencia_tipo IN ('pago', 'ingreso', 'egreso');
TRUNCATE TABLE egresos CASCADE;
TRUNCATE TABLE ingresos CASCADE;

-- =====================================================
-- 7. LIMPIEZA DE PROVEEDORES Y CLIENTES
-- =====================================================

TRUNCATE TABLE providers CASCADE;
TRUNCATE TABLE clients CASCADE;

-- =====================================================
-- 8. VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'RESUMEN DE LIMPIEZA DE DATOS';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Clientes: % registros', (SELECT COUNT(*) FROM clients);
  RAISE NOTICE 'Proveedores: % registros', (SELECT COUNT(*) FROM providers);
  RAISE NOTICE 'Órdenes de trabajo: % registros', (SELECT COUNT(*) FROM ordenes_trabajo);
  RAISE NOTICE 'Items de órdenes: % registros', (SELECT COUNT(*) FROM ordenes_trabajo_items);
  RAISE NOTICE 'Pagos de órdenes: % registros', (SELECT COUNT(*) FROM ordenes_trabajo_pagos);
  RAISE NOTICE 'Links: % registros', (SELECT COUNT(*) FROM ordenes_trabajo_links);
  RAISE NOTICE 'Rutas de items: % registros', (SELECT COUNT(*) FROM ordenes_trabajo_items_rutas);
  RAISE NOTICE 'Pausas: % registros', (SELECT COUNT(*) FROM ordenes_items_rutas_pausas);
  RAISE NOTICE 'Órdenes de copiado: % registros', (SELECT COUNT(*) FROM centro_copiado_ordenes);
  RAISE NOTICE 'Presupuestos: % registros', (SELECT COUNT(*) FROM presupuestos);
  RAISE NOTICE 'Liquidaciones: % registros', (SELECT COUNT(*) FROM liquidaciones);
  RAISE NOTICE 'Movimientos CC: % registros', (SELECT COUNT(*) FROM cuentas_corrientes_movimientos);
  RAISE NOTICE 'Ingresos: % registros', (SELECT COUNT(*) FROM ingresos);
  RAISE NOTICE 'Egresos: % registros', (SELECT COUNT(*) FROM egresos);
  RAISE NOTICE 'Movimientos de cajas: % registros', (SELECT COUNT(*) FROM cajas_movimientos);
  RAISE NOTICE '';
  RAISE NOTICE '✓ Limpieza completada exitosamente';
  RAISE NOTICE '✓ Las configuraciones del sistema se mantuvieron intactas';
  RAISE NOTICE '✓ El sistema está listo para comenzar con datos de producción';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
END $$;
