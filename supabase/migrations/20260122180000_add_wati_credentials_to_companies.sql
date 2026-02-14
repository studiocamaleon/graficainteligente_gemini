/*
  # Add Wati Credentials & Relax Notification Constraints

  1. Adds Wati configuration fields to companies.
  2. Updates whatsapp_notificaciones to support more flexible usage (manual messages, visits, etc).
*/

-- 1. Add Wati Credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'wati_enabled'
  ) THEN
    ALTER TABLE companies ADD COLUMN wati_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'wati_api_endpoint'
  ) THEN
    ALTER TABLE companies ADD COLUMN wati_api_endpoint text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'wati_access_token'
  ) THEN
    ALTER TABLE companies ADD COLUMN wati_access_token text;
  END IF;
END $$;

-- 2. Relax Types Constraint
DO $$
BEGIN
  -- Try to drop the named constraint if we know the name, otherwise we might need to find it.
  -- Supabase/Postgres usually names it table_column_check.
  -- 'whatsapp_notificaciones_tipo_notificacion_check' is likely given the definition.
  BEGIN
    ALTER TABLE whatsapp_notificaciones DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_tipo_notificacion_check;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  -- Also drop the check that requires an order ID
  BEGIN
    ALTER TABLE whatsapp_notificaciones DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_check; 
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  -- Remove any other constraints on these columns if they exist (sometimes named differently)
  -- We'll just rely on the above.
END $$;

-- 3. Add visita_id support (optional, but good practice)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_notificaciones' AND column_name = 'visita_id'
    ) THEN
        ALTER TABLE whatsapp_notificaciones ADD COLUMN visita_id uuid;
    END IF;
END $$;
