/*
  # Agregar Relación de Categoría a Tecnologías

  ## Descripción
  Agrega la columna `categoria_id` a la tabla `tecnologias` para establecer una relación explícita
  entre una tecnología y una categoría del sistema (ej: Impresión Láser, Gran Formato).

  Esto permite filtrar tecnologías de manera robusta en los módulos de producto,
  reemplazando la lógica frágil basada en nombres o IDs hardcodeados.

  ## Cambios
  1. Agregar columna `categoria_id` (uuid, nullable inicialmente)
  2. Crear índice para búsquedas rápidas
  3. Agregar comentario explicativo
*/

DO $$
BEGIN
  -- 1. Agregar columna categoria_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tecnologias'
    AND column_name = 'categoria_id'
  ) THEN
    ALTER TABLE tecnologias
    ADD COLUMN categoria_id uuid NULL;
  END IF;

  -- 2. Crear índice para búsquedas rápidas
  CREATE INDEX IF NOT EXISTS idx_tecnologias_categoria_id
  ON tecnologias(categoria_id);

  -- 3. Documentar la columna
  COMMENT ON COLUMN tecnologias.categoria_id IS
    'ID de la Categoría del Sistema (CATEGORIAS_SISTEMA) a la que pertenece esta tecnología. Usado para filtrado en módulos.';

END $$;
