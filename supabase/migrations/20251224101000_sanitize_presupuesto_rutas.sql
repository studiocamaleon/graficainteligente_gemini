-- Migración para limpiar datos "sucios" en las rutas de presupuestos
-- Esto corrige el problema de "Instalacion" vs "instalacion" de raíz.

UPDATE presupuestos_items_rutas
SET tipo_etapa = 'instalacion'
WHERE lower(tipo_etapa) IN ('instalacion', 'instalación', 'montaje');

UPDATE presupuestos_items_rutas
SET tipo_etapa = 'pre_prensa'
WHERE lower(tipo_etapa) IN ('pre_prensa', 'preprensa', 'diseño', 'diseno', 'pre-prensa');

UPDATE presupuestos_items_rutas
SET tipo_etapa = 'post_prensa'
WHERE lower(tipo_etapa) IN ('post_prensa', 'postprensa', 'acabados', 'terminacion');

UPDATE presupuestos_items_rutas
SET tipo_etapa = 'principal'
WHERE lower(tipo_etapa) IN ('principal', 'produccion', 'impresion');

-- Asegurarse de que todo lo demás sea lowercase por si acaso
UPDATE presupuestos_items_rutas
SET tipo_etapa = lower(tipo_etapa)
WHERE tipo_etapa != lower(tipo_etapa);
