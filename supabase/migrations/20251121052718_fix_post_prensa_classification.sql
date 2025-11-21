/*
  # Corrección de clasificación incorrecta de etapas post_prensa

  **Problema:**
  La migración anterior utilizaba LIKE '%pre%' que capturaba incorrectamente post_prensa
  porque contiene la subcadena pre. Esto causó que pasos de terminación aparecieran
  en la sección de pre-prensa.

  **Solución:**
  1. Corregir el orden de verificaciones: verificar post ANTES de pre
  2. Agregar condición adicional: verificar que NO contenga post al buscar pre
  3. Corregir pasos mal clasificados basándose en el nombre del paso

  **Tablas afectadas:**
  - rutas_produccion_pasos - Pasos de rutas de producción
  - ordenes_trabajo_items_rutas - Rutas de items en órdenes (si existen)

  **Impacto:**
  - Corrige clasificaciones incorrectas existentes
  - Asegura que pasos de terminación aparezcan en la sección correcta
*/

-- =====================================================
-- 1. CORREGIR rutas_produccion_pasos
-- =====================================================

-- Paso 1.1: Normalizar valores con lógica correcta
UPDATE rutas_produccion_pasos
SET etapa = CASE
  -- Primero verificar valores exactos (ya normalizados)
  WHEN etapa = 'pre_prensa' THEN 'pre_prensa'
  WHEN etapa = 'principal' THEN 'principal'
  WHEN etapa = 'post_prensa' THEN 'post_prensa'

  -- Mapeo de valores legacy exactos
  WHEN etapa = 'Pre-prensa' THEN 'pre_prensa'
  WHEN etapa = 'Produccion' THEN 'principal'
  WHEN etapa = 'Terminacion' THEN 'post_prensa'

  -- POST antes de PRE (orden crítico)
  WHEN LOWER(etapa) LIKE '%post%'
    OR LOWER(etapa) LIKE '%terminacion%'
    OR LOWER(etapa) LIKE '%acabado%' THEN 'post_prensa'

  -- PRE solo si empieza con pre y NO contiene post
  WHEN LOWER(etapa) LIKE 'pre%'
    AND LOWER(etapa) NOT LIKE '%post%' THEN 'pre_prensa'

  -- Default a principal
  ELSE 'principal'
END;

-- Paso 1.2: Corregir pasos específicos mal clasificados basándose en el nombre del paso
UPDATE rutas_produccion_pasos rpp
SET etapa = 'post_prensa'
FROM pasos p
WHERE rpp.paso_id = p.id
  AND rpp.etapa = 'pre_prensa'
  AND (
    LOWER(p.nombre) LIKE '%post%'
    OR LOWER(p.nombre) LIKE '%terminacion%'
    OR LOWER(p.nombre) LIKE '%acabado%'
    OR LOWER(p.nombre) LIKE '%encuadernado%'
    OR LOWER(p.nombre) LIKE '%laminado%'
    OR LOWER(p.nombre) LIKE '%plastificado%'
    OR LOWER(p.nombre) LIKE '%barniz%'
    OR LOWER(p.nombre) LIKE '%corte final%'
    OR LOWER(p.nombre) LIKE '%empaque%'
    OR LOWER(p.nombre) LIKE '%embalaje%'
  );

-- =====================================================
-- 2. CORREGIR ordenes_trabajo_items_rutas (si existen registros)
-- =====================================================

-- Paso 2.1: Normalizar valores con lógica correcta
UPDATE ordenes_trabajo_items_rutas
SET tipo_etapa = CASE
  -- Primero verificar valores exactos (ya normalizados)
  WHEN tipo_etapa = 'pre_prensa' THEN 'pre_prensa'
  WHEN tipo_etapa = 'principal' THEN 'principal'
  WHEN tipo_etapa = 'post_prensa' THEN 'post_prensa'

  -- Mapeo de valores legacy exactos
  WHEN tipo_etapa = 'Pre-prensa' THEN 'pre_prensa'
  WHEN tipo_etapa = 'Produccion' THEN 'principal'
  WHEN tipo_etapa = 'Terminacion' THEN 'post_prensa'

  -- POST antes de PRE (orden crítico)
  WHEN LOWER(tipo_etapa) LIKE '%post%'
    OR LOWER(tipo_etapa) LIKE '%terminacion%'
    OR LOWER(tipo_etapa) LIKE '%acabado%' THEN 'post_prensa'

  -- PRE solo si empieza con pre y NO contiene post
  WHEN LOWER(tipo_etapa) LIKE 'pre%'
    AND LOWER(tipo_etapa) NOT LIKE '%post%' THEN 'pre_prensa'

  -- Default a principal
  ELSE 'principal'
END
WHERE tipo_etapa IS NOT NULL;

-- Paso 2.2: Corregir basándose en el nombre del paso
UPDATE ordenes_trabajo_items_rutas oir
SET tipo_etapa = 'post_prensa'
FROM pasos p
WHERE oir.paso_id = p.id
  AND oir.tipo_etapa = 'pre_prensa'
  AND (
    LOWER(p.nombre) LIKE '%post%'
    OR LOWER(p.nombre) LIKE '%terminacion%'
    OR LOWER(p.nombre) LIKE '%acabado%'
    OR LOWER(p.nombre) LIKE '%encuadernado%'
    OR LOWER(p.nombre) LIKE '%laminado%'
    OR LOWER(p.nombre) LIKE '%plastificado%'
    OR LOWER(p.nombre) LIKE '%barniz%'
    OR LOWER(p.nombre) LIKE '%corte final%'
    OR LOWER(p.nombre) LIKE '%empaque%'
    OR LOWER(p.nombre) LIKE '%embalaje%'
  );

-- =====================================================
-- 3. CREAR FUNCIÓN DE VALIDACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION validar_etapa_paso()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar etapa en INSERT/UPDATE
  IF NEW.etapa IS NOT NULL THEN
    -- Si ya está normalizado, mantener
    IF NEW.etapa IN ('pre_prensa', 'principal', 'post_prensa') THEN
      RETURN NEW;
    END IF;

    -- POST antes de PRE (orden crítico)
    IF LOWER(NEW.etapa) LIKE '%post%'
       OR LOWER(NEW.etapa) LIKE '%terminacion%'
       OR LOWER(NEW.etapa) LIKE '%acabado%' THEN
      NEW.etapa := 'post_prensa';
      RETURN NEW;
    END IF;

    -- PRE solo si empieza con pre y NO contiene post
    IF LOWER(NEW.etapa) LIKE 'pre%'
       AND LOWER(NEW.etapa) NOT LIKE '%post%' THEN
      NEW.etapa := 'pre_prensa';
      RETURN NEW;
    END IF;

    -- Default a principal
    NEW.etapa := 'principal';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a rutas_produccion_pasos
DROP TRIGGER IF EXISTS trigger_validar_etapa_paso ON rutas_produccion_pasos;
CREATE TRIGGER trigger_validar_etapa_paso
  BEFORE INSERT OR UPDATE OF etapa
  ON rutas_produccion_pasos
  FOR EACH ROW
  EXECUTE FUNCTION validar_etapa_paso();