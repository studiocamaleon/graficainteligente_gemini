/*
  # Cleanup Legacy Notification System
  
  Drops triggers and functions related to the old postgres-based WhatsApp notification system
  to avoid conflicts and duplicated messages with the new Wati integration.
*/

-- 1. Drop Triggers on Ordenes Trabajo
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON ordenes_trabajo;
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_update ON ordenes_trabajo;
DROP TRIGGER IF EXISTS trigger_notify_orden_finalizada ON ordenes_trabajo;

-- 2. Drop Triggers on Centro Copiado Ordenes
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON centro_copiado_ordenes;
DROP TRIGGER IF EXISTS trigger_notify_orden_copiado_finalizada ON centro_copiado_ordenes;

-- 3. Drop Triggers on Presupuestos
DROP TRIGGER IF EXISTS on_presupuesto_enviado ON presupuestos;
DROP TRIGGER IF EXISTS on_presupuesto_creado_enviado ON presupuestos;
DROP TRIGGER IF EXISTS on_presupuesto_aprobado_whatsapp ON presupuestos;

-- 4. Drop Associated Functions
DROP FUNCTION IF EXISTS trigger_notify_nueva_orden_trabajo();
DROP FUNCTION IF EXISTS trigger_notify_nueva_orden_copiado();
DROP FUNCTION IF EXISTS trigger_notify_orden_finalizada();
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_enviado();
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_creado_enviado();
DROP FUNCTION IF EXISTS trigger_notify_presupuesto_aprobado();

-- 5. Drop Helper Functions (if any, be careful not to drop shared ones)
-- We keep generic helpers like sanitizeMessage unless we are sure they are only used here.
-- Assuming most logic was inline or in the main trigger functions.
