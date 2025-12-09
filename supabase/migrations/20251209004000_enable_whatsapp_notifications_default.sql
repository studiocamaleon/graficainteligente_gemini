/*
  # Fix: Habilitar notificaciones por defecto

  ## Descripción
  Cambia el valor por defecto de whatsapp_notifications_enabled a TRUE
  y actualiza todas las empresas existentes para que lo tengan activado.

  ## Motivo
  Para mejorar la experiencia de usuario ("Si está conectado, debería funcionar"),
  activamos la feature flag por defecto.
*/

-- 1. Cambiar el default a TRUE
ALTER TABLE companies 
ALTER COLUMN whatsapp_notifications_enabled SET DEFAULT true;

-- 2. Activar para todas las empresas existentes
UPDATE companies 
SET whatsapp_notifications_enabled = true;
