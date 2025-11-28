/*
  # Fix Trigger validar_etapa_paso para Soportar "Instalacion"

  ## Problema Identificado
  El trigger `validar_etapa_paso()` estaba convirtiendo TODA etapa desconocida a 'principal',
  incluyendo "Instalacion", causando que los pasos de instalación se guardaran como producción.

  ## Causa Raíz
  La función solo reconocía 3 valores legacy: 'pre_prensa', 'principal', 'post_prensa'
  Cualquier otro valor (incluido "Instalacion") era convertido a 'principal' por defecto.

  ## Solución
  - Actualizar el trigger para reconocer y normalizar correctamente las 4 etapas válidas
  - Usar los valores correctos con capitalización: 'Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion'
  - Agregar manejo específico para "Instalacion" ANTES del fallback

  ## Valores Correctos
  - 'Pre-prensa'   : Preparación de archivos y materiales
  - 'Produccion'   : Proceso de producción principal
  - 'Terminacion'  : Acabados y terminaciones finales
  - 'Instalacion'  : Instalación en sitio (si aplica)

  ## Mapeo Legacy → Nuevo
  - 'pre_prensa'   → 'Pre-prensa'
  - 'principal'    → 'Produccion'
  - 'produccion'   → 'Produccion'
  - 'post_prensa'  → 'Terminacion'
  - 'terminacion'  → 'Terminacion'
  - 'instalacion'  → 'Instalacion'

  ## Impacto
  - ✅ "Instalacion" ahora se guarda correctamente
  - ✅ Los valores legacy se normalizan automáticamente
  - ✅ El constraint de la tabla acepta los 4 valores
  - ✅ Compatibilidad total con el frontend

  ## Testing
  Después de aplicar esta migración:
  1. Intentar agregar un paso con etapa "Instalacion"
  2. Verificar que se guarde como "Instalacion" (no "Produccion")
  3. Confirmar que aparezca en la UI bajo la etapa correcta
*/

-- =====================================================
-- 1. ELIMINAR TRIGGER EXISTENTE
-- =====================================================

DROP TRIGGER IF EXISTS trigger_validar_etapa_paso ON rutas_produccion_pasos;

-- =====================================================
-- 2. CREAR FUNCIÓN CORREGIDA
-- =====================================================

CREATE OR REPLACE FUNCTION validar_etapa_paso()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar etapa en INSERT/UPDATE
  IF NEW.etapa IS NOT NULL THEN

    -- 1. Si ya está en el formato correcto (capitalizado), mantener
    IF NEW.etapa IN ('Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion') THEN
      RETURN NEW;
    END IF;

    -- 2. Si está en formato legacy (snake_case), convertir
    IF LOWER(NEW.etapa) = 'pre_prensa' OR LOWER(NEW.etapa) = 'pre-prensa' THEN
      NEW.etapa := 'Pre-prensa';
      RETURN NEW;
    END IF;

    IF LOWER(NEW.etapa) = 'principal' OR LOWER(NEW.etapa) = 'produccion' THEN
      NEW.etapa := 'Produccion';
      RETURN NEW;
    END IF;

    IF LOWER(NEW.etapa) = 'post_prensa' OR LOWER(NEW.etapa) = 'post-prensa' OR LOWER(NEW.etapa) = 'terminacion' THEN
      NEW.etapa := 'Terminacion';
      RETURN NEW;
    END IF;

    -- 3. ✅ NUEVO: Instalacion (CRÍTICO - verificar ANTES del pattern matching)
    IF LOWER(NEW.etapa) = 'instalacion' THEN
      NEW.etapa := 'Instalacion';
      RETURN NEW;
    END IF;

    -- 4. Pattern matching para variaciones (ORDEN CRÍTICO)

    -- Instalacion (verificar con LIKE para cubrir variaciones)
    IF LOWER(NEW.etapa) LIKE '%instalacion%' THEN
      NEW.etapa := 'Instalacion';
      RETURN NEW;
    END IF;

    -- POST antes de PRE (evitar que 'post_prensa' sea capturado por 'pre')
    IF LOWER(NEW.etapa) LIKE '%post%'
       OR LOWER(NEW.etapa) LIKE '%terminacion%'
       OR LOWER(NEW.etapa) LIKE '%acabado%' THEN
      NEW.etapa := 'Terminacion';
      RETURN NEW;
    END IF;

    -- PRE solo si empieza con pre y NO contiene post
    IF LOWER(NEW.etapa) LIKE 'pre%'
       AND LOWER(NEW.etapa) NOT LIKE '%post%' THEN
      NEW.etapa := 'Pre-prensa';
      RETURN NEW;
    END IF;

    -- Produccion (verificar sin 'impresion' para evitar capturar 'instalacion')
    IF LOWER(NEW.etapa) LIKE '%produccion%' OR LOWER(NEW.etapa) LIKE '%principal%' THEN
      NEW.etapa := 'Produccion';
      RETURN NEW;
    END IF;

    -- 5. ❌ Si llegamos aquí, el valor no es válido - lanzar error
    RAISE EXCEPTION 'Etapa no válida: %. Las etapas válidas son: Pre-prensa, Produccion, Terminacion, Instalacion', NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. APLICAR TRIGGER CORREGIDO
-- =====================================================

CREATE TRIGGER trigger_validar_etapa_paso
  BEFORE INSERT OR UPDATE OF etapa
  ON rutas_produccion_pasos
  FOR EACH ROW
  EXECUTE FUNCTION validar_etapa_paso();

-- =====================================================
-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION validar_etapa_paso() IS
  'Valida y normaliza el valor de la columna etapa en rutas_produccion_pasos.
   Acepta las 4 etapas válidas: Pre-prensa, Produccion, Terminacion, Instalacion.
   Convierte valores legacy (pre_prensa, principal, post_prensa) a los valores correctos.
   IMPORTANTE: Instalacion se maneja ANTES del pattern matching para evitar conversión errónea a Produccion.';

-- =====================================================
-- 5. MIGRAR DATOS EXISTENTES SI ES NECESARIO
-- =====================================================

-- Verificar si hay registros con 'principal' que deberían ser 'Instalacion'
-- (esto no debería pasar ya que el trigger anterior no permitía 'Instalacion',
--  pero lo incluimos por seguridad)

DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- No hay datos para migrar en este caso porque el trigger anterior
  -- convertía 'Instalacion' a 'principal', y no hay forma de distinguir
  -- qué registros 'principal' eran originalmente 'Instalacion'.

  RAISE NOTICE '=== Trigger Actualizado ===';
  RAISE NOTICE 'Función validar_etapa_paso() ha sido corregida';
  RAISE NOTICE 'Ahora soporta correctamente las 4 etapas: Pre-prensa, Produccion, Terminacion, Instalacion';
  RAISE NOTICE 'Los nuevos registros con etapa "Instalacion" se guardarán correctamente';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTA: Los pasos existentes que fueron incorrectamente guardados como "Produccion"';
  RAISE NOTICE '   cuando debían ser "Instalacion" NO pueden ser migrados automáticamente.';
  RAISE NOTICE '   Deberán ser actualizados manualmente si es necesario.';
END $$;