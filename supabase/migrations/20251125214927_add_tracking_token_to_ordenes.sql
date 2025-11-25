/*
  # Sistema de Tracking Público de Órdenes de Trabajo

  ## Descripción
  Agrega capacidad de tracking público mediante tokens únicos para que los clientes
  puedan seguir el estado de sus órdenes sin necesidad de autenticación.

  ## Cambios
  1. Nueva columna `tracking_token` en `ordenes_trabajo`
  2. Función para generar tokens únicos y seguros
  3. Trigger para generación automática al crear órdenes
  4. Índice único para búsquedas rápidas
  5. Generación de tokens para órdenes existentes

  ## Formato del Token
  - 32 caracteres alfanuméricos
  - Solo mayúsculas y números (sin caracteres confusos: 0, O, I, 1)
  - Ejemplo: K3H7W9P2R5T8Y4N6M9Q3X7Z2B5D8
  - Probabilidad de colisión: prácticamente cero

  ## Seguridad
  - Token único por orden
  - No expone información sensible
  - Puede ser revocado regenerándolo
  - Rate limiting debe implementarse en Edge Functions
*/

-- =====================================================
-- 1. AGREGAR COLUMNA tracking_token
-- =====================================================

ALTER TABLE ordenes_trabajo
ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(32) UNIQUE;

-- =====================================================
-- 2. FUNCIÓN PARA GENERAR TOKEN ÚNICO
-- =====================================================

CREATE OR REPLACE FUNCTION generate_tracking_token()
RETURNS VARCHAR(32) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(32) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. FUNCIÓN TRIGGER PARA ESTABLECER TOKEN
-- =====================================================

CREATE OR REPLACE FUNCTION set_tracking_token()
RETURNS TRIGGER AS $$
DECLARE
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  new_token VARCHAR(32);
BEGIN
  IF NEW.tracking_token IS NULL THEN
    LOOP
      attempt := attempt + 1;
      new_token := generate_tracking_token();

      PERFORM 1 FROM ordenes_trabajo WHERE tracking_token = new_token;

      IF NOT FOUND THEN
        NEW.tracking_token := new_token;
        EXIT;
      END IF;

      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'No se pudo generar un token único después de % intentos', max_attempts;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. APLICAR TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_set_tracking_token ON ordenes_trabajo;

CREATE TRIGGER trigger_set_tracking_token
  BEFORE INSERT ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION set_tracking_token();

-- =====================================================
-- 5. GENERAR TOKENS PARA ÓRDENES EXISTENTES
-- =====================================================

DO $$
DECLARE
  orden_record RECORD;
  new_token VARCHAR(32);
  token_exists BOOLEAN;
BEGIN
  FOR orden_record IN
    SELECT id FROM ordenes_trabajo WHERE tracking_token IS NULL
  LOOP
    LOOP
      new_token := generate_tracking_token();

      SELECT EXISTS(
        SELECT 1 FROM ordenes_trabajo WHERE tracking_token = new_token
      ) INTO token_exists;

      IF NOT token_exists THEN
        UPDATE ordenes_trabajo
        SET tracking_token = new_token
        WHERE id = orden_record.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- 6. CREAR ÍNDICE ÚNICO
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_tracking_token
ON ordenes_trabajo(tracking_token);

-- =====================================================
-- 7. CONSTRAINT PARA VALIDAR FORMATO
-- =====================================================

ALTER TABLE ordenes_trabajo
ADD CONSTRAINT check_tracking_token_format
CHECK (tracking_token IS NULL OR (
  length(tracking_token) = 32 AND
  tracking_token ~ '^[A-Z0-9]{32}$'
));

-- =====================================================
-- 8. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN ordenes_trabajo.tracking_token IS
'Token único de 32 caracteres para seguimiento público de la orden sin autenticación';

COMMENT ON FUNCTION generate_tracking_token() IS
'Genera un token aleatorio de 32 caracteres alfanuméricos seguros (sin caracteres ambiguos)';

COMMENT ON FUNCTION set_tracking_token() IS
'Trigger function que genera automáticamente un tracking_token único al crear una orden';