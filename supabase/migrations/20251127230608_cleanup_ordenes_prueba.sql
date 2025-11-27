/*
  # Limpieza de Órdenes de Prueba

  ## Descripción
  Esta migración elimina todas las órdenes de trabajo y órdenes de copiado de prueba
  existentes en el sistema, junto con todos sus datos relacionados.

  ## Advertencia
  Esta operación NO ES REVERSIBLE. Solo ejecutar en entornos donde las órdenes
  actuales son datos de prueba que pueden eliminarse.

  ## Tablas Afectadas
  - whatsapp_notificaciones (notificaciones asociadas a órdenes)
  - liquidaciones_items (referencias a órdenes)
  - ordenes_trabajo y todas sus tablas relacionadas (cascada)
  - centro_copiado_ordenes y sus tablas relacionadas (cascada)

  ## Notas
  - Las relaciones con ON DELETE CASCADE limpiarán automáticamente los datos relacionados
  - Se eliminan primero todas las referencias para evitar errores de FK
  - Los números de orden se mantendrán en su secuencia actual
*/

-- =====================================================
-- 1. ELIMINAR NOTIFICACIONES DE WHATSAPP
-- =====================================================

-- Eliminar notificaciones asociadas a órdenes de trabajo
DELETE FROM whatsapp_notificaciones
WHERE orden_trabajo_id IS NOT NULL;

-- Eliminar notificaciones asociadas a órdenes de copiado
DELETE FROM whatsapp_notificaciones
WHERE orden_copiado_id IS NOT NULL;

-- =====================================================
-- 2. ELIMINAR REFERENCIAS EN LIQUIDACIONES
-- =====================================================

-- Eliminar items de liquidaciones que referencian órdenes de trabajo
DELETE FROM liquidaciones_items
WHERE orden_id IN (SELECT id FROM ordenes_trabajo);

-- =====================================================
-- 3. ELIMINAR TODAS LAS ÓRDENES DE TRABAJO
-- =====================================================

-- Esta operación eliminará en cascada:
-- - ordenes_trabajo_items
-- - ordenes_trabajo_servicios_items
-- - ordenes_trabajo_acabados_items
-- - ordenes_trabajo_pagos
-- - ordenes_trabajo_historial
-- - ordenes_trabajo_archivos
-- - ordenes_trabajo_archivos_produccion
-- - ordenes_trabajo_links
-- - ordenes_trabajo_items_rutas

DELETE FROM ordenes_trabajo;

-- =====================================================
-- 4. ELIMINAR TODAS LAS ÓRDENES DE COPIADO
-- =====================================================

-- Esta operación eliminará en cascada:
-- - centro_copiado_ordenes_items
-- - centro_copiado_ordenes_archivos
-- - centro_copiado_ordenes_pagos

DELETE FROM centro_copiado_ordenes;
