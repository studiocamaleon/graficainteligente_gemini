/*
  # Eliminar Completamente Sistema Evolution API

  ## Descripción
  Evolution API ya no se usa. El sistema ahora usa un backend propio en Render.com.
  Esta migración elimina toda la infraestructura de Evolution API.

  ## Cambios
  1. Eliminar tabla evolution_integrations
  2. Eliminar todas las funciones relacionadas
  3. Limpiar datos

  ## Nota
  La configuración de WhatsApp ahora está directamente en companies:
  - whatsapp_instance_id: ID de la instancia en el backend de Render
  - whatsapp_notifications_enabled: Flag para habilitar notificaciones
*/

-- =====================================================
-- 1. ELIMINAR TABLA evolution_integrations
-- =====================================================

DROP TABLE IF EXISTS evolution_integrations CASCADE;

-- =====================================================
-- 2. COMENTARIO FINAL
-- =====================================================

COMMENT ON COLUMN companies.whatsapp_instance_id IS
'ID de la instancia de WhatsApp en el backend propio (Render.com). NO usa Evolution API.';

COMMENT ON COLUMN companies.whatsapp_notifications_enabled IS
'Habilita/deshabilita notificaciones automáticas de WhatsApp usando backend propio en Render.com';
