/*
  # Agregar Campos de WhatsApp a Companies

  ## Descripción
  Agrega campos necesarios para el sistema de notificaciones automáticas de WhatsApp:
  - business_hours: Horarios de atención de la empresa
  - google_review_url: Link personalizado para solicitar reseñas en Google

  ## Cambios
  1. Agregar columna `business_hours` (text, nullable)
  2. Agregar columna `google_review_url` (text, nullable)

  ## Uso
  - business_hours: Se muestra en notificaciones de órdenes finalizadas
  - google_review_url: Link incluido en mensajes de orden finalizada para solicitar reseñas

  ## Seguridad
  - Las políticas RLS existentes ya permiten que super_admin y admin actualicen estos campos
*/

-- =====================================================
-- 1. AGREGAR COLUMNA business_hours
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'business_hours'
  ) THEN
    ALTER TABLE companies ADD COLUMN business_hours text;
  END IF;
END $$;

-- =====================================================
-- 2. AGREGAR COLUMNA google_review_url
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'google_review_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN google_review_url text;
  END IF;
END $$;

-- =====================================================
-- 3. VALIDACIÓN DE URL
-- =====================================================

ALTER TABLE companies
DROP CONSTRAINT IF EXISTS check_google_review_url_format;

ALTER TABLE companies
ADD CONSTRAINT check_google_review_url_format
CHECK (
  google_review_url IS NULL OR
  google_review_url ~ '^https?://'
);

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN companies.business_hours IS
'Horarios de atención de la empresa, se incluyen en notificaciones de WhatsApp de órdenes finalizadas';

COMMENT ON COLUMN companies.google_review_url IS
'Link personalizado de Google Reviews para solicitar opiniones en notificaciones de WhatsApp';
