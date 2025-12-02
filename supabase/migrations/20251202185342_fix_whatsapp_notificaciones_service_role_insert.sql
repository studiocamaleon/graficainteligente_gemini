/*
  # Fix: Permitir INSERT de notificaciones desde Edge Functions
  
  ## Problema
  Las Edge Functions usan SERVICE_ROLE_KEY pero no pueden insertar en whatsapp_notificaciones
  porque solo hay políticas para rol 'authenticated'.
  
  ## Solución
  Agregar política permisiva que permita al service_role insertar notificaciones.
  
  ## Cambios
  - Nueva política INSERT para service_role
  - Permite insertar desde Edge Functions usando SERVICE_ROLE_KEY
*/

-- Crear política para service_role (usado por Edge Functions)
CREATE POLICY "Service role can insert notificaciones"
  ON whatsapp_notificaciones
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON POLICY "Service role can insert notificaciones" ON whatsapp_notificaciones IS
'Permite a Edge Functions insertar notificaciones usando SERVICE_ROLE_KEY';
