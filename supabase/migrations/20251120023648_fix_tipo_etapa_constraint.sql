/*
  # Corregir constraint de tipo_etapa en ordenes_trabajo_items_rutas

  1. Cambios
    - Eliminar constraint antiguo que usa formato lowercase con guión bajo
    - Crear nuevo constraint que acepta los valores actuales del sistema:
      - Pre-prensa
      - Produccion
      - Terminacion

  2. Notas
    - Los valores con formato título son los que se usan en rutas_produccion_pasos
    - Se mantiene consistencia con el resto del sistema
*/

-- Eliminar el constraint antiguo
ALTER TABLE ordenes_trabajo_items_rutas 
DROP CONSTRAINT IF EXISTS check_tipo_etapa_item_ruta;

-- Crear nuevo constraint con valores correctos
ALTER TABLE ordenes_trabajo_items_rutas
ADD CONSTRAINT check_tipo_etapa_item_ruta 
CHECK (tipo_etapa IN ('Pre-prensa', 'Produccion', 'Terminacion'));

-- Comentario sobre la columna
COMMENT ON COLUMN ordenes_trabajo_items_rutas.tipo_etapa IS 
'Etapa de producción: Pre-prensa, Produccion, o Terminacion';
