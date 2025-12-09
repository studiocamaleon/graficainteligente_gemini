/*
  # Fix: Agregar columnas de WhatsApp a Companies

  ## Descripción
  Agrega las columnas faltantes necesarias para el sistema de notificaciones:
  - whatsapp_notifications_enabled: boolean para habilitar el sistema
  - whatsapp_instance_id: ID de instancia para el backend de WhatsApp

  ## Motivo
  Estas columnas se referenciaban en código y comentarios pero nunca se crearon explícitamente,
  causando errores 500 en la Edge Function de auto-registro.
*/

DO $$
BEGIN
  -- Agregar whatsapp_notifications_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'whatsapp_notifications_enabled'
  ) THEN
    ALTER TABLE companies 
    ADD COLUMN whatsapp_notifications_enabled boolean DEFAULT false;
  END IF;

  -- Agregar whatsapp_instance_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'whatsapp_instance_id'
  ) THEN
    ALTER TABLE companies 
    ADD COLUMN whatsapp_instance_id text;
  END IF;
END $$;
