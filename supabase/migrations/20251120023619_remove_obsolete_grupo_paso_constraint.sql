/*
  # Eliminar constraint obsoleto de grupo_paso

  1. Cambios
    - Eliminar constraint check_paso_o_grupo que requiere paso_id o grupo_paso_id
    - Este constraint es obsoleto porque:
      - grupo_paso_id ya no se usa en el sistema
      - Los pasos en rutas pueden ser condicionales sin paso_id específico
      - Se permite flexibilidad en la definición de rutas

  2. Notas
    - grupo_paso_id se mantiene en la tabla por compatibilidad pero no se usa
    - Los pasos pueden tener solo paso_nombre sin paso_id
*/

-- Eliminar el constraint obsoleto
ALTER TABLE ordenes_trabajo_items_rutas 
DROP CONSTRAINT IF EXISTS check_paso_o_grupo;

-- Comentario sobre la tabla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ordenes_trabajo_items_rutas' 
    AND column_name = 'grupo_paso_id'
  ) THEN
    COMMENT ON COLUMN ordenes_trabajo_items_rutas.grupo_paso_id IS 
    'Campo obsoleto mantenido por compatibilidad. Ya no se usa en el sistema actual.';
  END IF;
END $$;
