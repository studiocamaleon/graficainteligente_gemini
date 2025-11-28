/*
  # Fix Constraint check_etapa - Agregar "instalacion"

  ## Problema Identificado
  El constraint `check_etapa` en la tabla `rutas_produccion_pasos` solo acepta 3 valores:
  - 'pre_prensa'
  - 'principal'
  - 'post_prensa'

  Pero NO incluye 'instalacion', causando que todos los INSERTs con etapa "instalacion" sean rechazados.

  ## Estado Actual del Constraint
  ```sql
  CHECK ((etapa = ANY (ARRAY['pre_prensa'::text, 'principal'::text, 'post_prensa'::text])))
  ```

  ## Causa Raíz
  Una migración anterior modificó el constraint para usar solo 3 valores en snake_case,
  pero no incluyó 'instalacion', dejando el sistema incompleto.

  ## Solución
  1. Eliminar el constraint actual
  2. Recrear el constraint con los 4 valores en snake_case:
     - 'pre_prensa'
     - 'principal'
     - 'post_prensa'
     - 'instalacion'  ← NUEVO
  3. Actualizar el trigger para generar valores en snake_case consistentes
  4. Migrar cualquier dato existente que use formato capitalizado

  ## Decisión de Diseño: snake_case en DB
  Usar snake_case en base de datos es más consistente con:
  - Convenciones SQL estándar
  - Tipos enumerados en PostgreSQL
  - Facilita queries y comparaciones
  - El frontend puede capitalizar para display

  ## Mapeo de Etapas
  - 'pre_prensa'   → Pre-prensa (display)
  - 'principal'    → Producción (display)
  - 'post_prensa'  → Terminación (display)
  - 'instalacion'  → Instalación (display)
*/

-- =====================================================
-- 1. MIGRAR DATOS EXISTENTES (si los hay)
-- =====================================================

-- Convertir valores capitalizados a snake_case
UPDATE rutas_produccion_pasos
SET etapa = 'pre_prensa',
    updated_at = now()
WHERE etapa IN ('Pre-prensa', 'Pre-Prensa', 'PRE-PRENSA');

UPDATE rutas_produccion_pasos
SET etapa = 'principal',
    updated_at = now()
WHERE etapa IN ('Produccion', 'Producción', 'Principal', 'PRODUCCION');

UPDATE rutas_produccion_pasos
SET etapa = 'post_prensa',
    updated_at = now()
WHERE etapa IN ('Terminacion', 'Terminación', 'Post-prensa', 'TERMINACION');

UPDATE rutas_produccion_pasos
SET etapa = 'instalacion',
    updated_at = now()
WHERE etapa IN ('Instalacion', 'Instalación', 'INSTALACION');

-- =====================================================
-- 2. ELIMINAR CONSTRAINT EXISTENTE
-- =====================================================

ALTER TABLE rutas_produccion_pasos 
DROP CONSTRAINT IF EXISTS check_etapa;

-- =====================================================
-- 3. CREAR NUEVO CONSTRAINT CON 4 VALORES
-- =====================================================

ALTER TABLE rutas_produccion_pasos
ADD CONSTRAINT check_etapa CHECK (
  etapa IN ('pre_prensa', 'principal', 'post_prensa', 'instalacion')
);

-- =====================================================
-- 4. ACTUALIZAR TRIGGER PARA GENERAR SNAKE_CASE
-- =====================================================

DROP TRIGGER IF EXISTS trigger_validar_etapa_paso ON rutas_produccion_pasos;

CREATE OR REPLACE FUNCTION validar_etapa_paso()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar etapa a snake_case en INSERT/UPDATE
  IF NEW.etapa IS NOT NULL THEN

    -- 1. Si ya está en snake_case correcto, mantener
    IF NEW.etapa IN ('pre_prensa', 'principal', 'post_prensa', 'instalacion') THEN
      RETURN NEW;
    END IF;

    -- 2. Convertir variaciones a valores correctos
    -- Pre-prensa
    IF LOWER(NEW.etapa) IN ('pre_prensa', 'pre-prensa', 'preprensa', 'pre prensa') THEN
      NEW.etapa := 'pre_prensa';
      RETURN NEW;
    END IF;

    -- Principal/Producción
    IF LOWER(NEW.etapa) IN ('principal', 'produccion', 'producción') THEN
      NEW.etapa := 'principal';
      RETURN NEW;
    END IF;

    -- Post-prensa/Terminación
    IF LOWER(NEW.etapa) IN ('post_prensa', 'post-prensa', 'postprensa', 'post prensa', 'terminacion', 'terminación') THEN
      NEW.etapa := 'post_prensa';
      RETURN NEW;
    END IF;

    -- ✅ NUEVO: Instalación (CRÍTICO)
    IF LOWER(NEW.etapa) IN ('instalacion', 'instalación') THEN
      NEW.etapa := 'instalacion';
      RETURN NEW;
    END IF;

    -- 3. Pattern matching para variaciones (orden crítico)
    
    -- Instalacion primero (antes de otros patterns)
    IF LOWER(NEW.etapa) LIKE '%instalac%' THEN
      NEW.etapa := 'instalacion';
      RETURN NEW;
    END IF;

    -- Post antes de Pre (evitar captura incorrecta)
    IF LOWER(NEW.etapa) LIKE '%post%' OR LOWER(NEW.etapa) LIKE '%terminac%' THEN
      NEW.etapa := 'post_prensa';
      RETURN NEW;
    END IF;

    -- Pre solo si empieza con pre
    IF LOWER(NEW.etapa) LIKE 'pre%' THEN
      NEW.etapa := 'pre_prensa';
      RETURN NEW;
    END IF;

    -- Principal/Producción
    IF LOWER(NEW.etapa) LIKE '%producc%' OR LOWER(NEW.etapa) LIKE '%principal%' THEN
      NEW.etapa := 'principal';
      RETURN NEW;
    END IF;

    -- 4. Si no coincide con nada, lanzar error descriptivo
    RAISE EXCEPTION 'Etapa no válida: %. Las etapas válidas son: pre_prensa, principal, post_prensa, instalacion', NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. APLICAR TRIGGER
-- =====================================================

CREATE TRIGGER trigger_validar_etapa_paso
  BEFORE INSERT OR UPDATE OF etapa
  ON rutas_produccion_pasos
  FOR EACH ROW
  EXECUTE FUNCTION validar_etapa_paso();

-- =====================================================
-- 6. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON CONSTRAINT check_etapa ON rutas_produccion_pasos IS
  'Valida que etapa sea uno de los 4 valores válidos en snake_case: pre_prensa, principal, post_prensa, instalacion';

COMMENT ON FUNCTION validar_etapa_paso() IS
  'Normaliza el valor de etapa a snake_case antes de INSERT/UPDATE.
   Acepta variaciones (capitalizado, con espacios, con guiones) y las convierte al formato correcto.
   Valores válidos: pre_prensa, principal, post_prensa, instalacion';

-- =====================================================
-- 7. VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
  v_total_pasos INTEGER;
  v_pre_prensa INTEGER;
  v_principal INTEGER;
  v_post_prensa INTEGER;
  v_instalacion INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_pasos FROM rutas_produccion_pasos;
  SELECT COUNT(*) INTO v_pre_prensa FROM rutas_produccion_pasos WHERE etapa = 'pre_prensa';
  SELECT COUNT(*) INTO v_principal FROM rutas_produccion_pasos WHERE etapa = 'principal';
  SELECT COUNT(*) INTO v_post_prensa FROM rutas_produccion_pasos WHERE etapa = 'post_prensa';
  SELECT COUNT(*) INTO v_instalacion FROM rutas_produccion_pasos WHERE etapa = 'instalacion';

  RAISE NOTICE '=== Constraint y Trigger Actualizados ===';
  RAISE NOTICE 'Total de pasos en rutas: %', v_total_pasos;
  RAISE NOTICE 'Distribución por etapa:';
  RAISE NOTICE '  - pre_prensa: %', v_pre_prensa;
  RAISE NOTICE '  - principal: %', v_principal;
  RAISE NOTICE '  - post_prensa: %', v_post_prensa;
  RAISE NOTICE '  - instalacion: %', v_instalacion;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Constraint actualizado: Acepta 4 valores en snake_case';
  RAISE NOTICE '✅ Trigger actualizado: Normaliza automáticamente a snake_case';
  RAISE NOTICE '✅ "instalacion" ahora está incluido y funcionará correctamente';
END $$;
