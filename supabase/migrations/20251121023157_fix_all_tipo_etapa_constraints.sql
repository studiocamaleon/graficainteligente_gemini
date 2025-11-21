/*
  # Corregir todos los constraints de etapa y normalizar valores

  1. Cambios
    - Elimina constraints obsoletos en ambas tablas
    - Normaliza valores en ordenes_trabajo_items_rutas
    - Normaliza valores en rutas_produccion_pasos
    - Agrega constraints correctos con valores normalizados

  2. Valores normalizados
    - 'Pre-prensa' → 'pre_prensa'
    - 'Terminacion' → 'post_prensa'
    - 'Produccion' → 'principal'
*/

-- 1. Eliminar constraints obsoletos
ALTER TABLE ordenes_trabajo_items_rutas
DROP CONSTRAINT IF EXISTS check_tipo_etapa_item_ruta;

ALTER TABLE rutas_produccion_pasos
DROP CONSTRAINT IF EXISTS check_etapa;

ALTER TABLE rutas_produccion_pasos
DROP CONSTRAINT IF EXISTS check_etapa_ruta;

-- 2. Normalizar valores en ordenes_trabajo_items_rutas
UPDATE ordenes_trabajo_items_rutas
SET tipo_etapa = CASE
  WHEN tipo_etapa = 'Pre-prensa' THEN 'pre_prensa'
  WHEN tipo_etapa = 'Terminacion' THEN 'post_prensa'
  WHEN tipo_etapa = 'Produccion' THEN 'principal'
  WHEN LOWER(tipo_etapa) LIKE '%pre%' THEN 'pre_prensa'
  WHEN LOWER(tipo_etapa) LIKE '%terminacion%'
    OR LOWER(tipo_etapa) LIKE '%post%'
    OR LOWER(tipo_etapa) LIKE '%acabado%' THEN 'post_prensa'
  ELSE 'principal'
END;

-- 3. Normalizar valores en rutas_produccion_pasos
UPDATE rutas_produccion_pasos
SET etapa = CASE
  WHEN etapa = 'Pre-prensa' THEN 'pre_prensa'
  WHEN etapa = 'Terminacion' THEN 'post_prensa'
  WHEN etapa = 'Produccion' THEN 'principal'
  WHEN LOWER(etapa) LIKE '%pre%' THEN 'pre_prensa'
  WHEN LOWER(etapa) LIKE '%terminacion%'
    OR LOWER(etapa) LIKE '%post%'
    OR LOWER(etapa) LIKE '%acabado%' THEN 'post_prensa'
  ELSE 'principal'
END;

-- 4. Agregar constraints correctos
ALTER TABLE ordenes_trabajo_items_rutas
ADD CONSTRAINT check_tipo_etapa_item_ruta
CHECK (tipo_etapa IN ('pre_prensa', 'principal', 'post_prensa'));

ALTER TABLE rutas_produccion_pasos
ADD CONSTRAINT check_etapa
CHECK (etapa IN ('pre_prensa', 'principal', 'post_prensa'));
