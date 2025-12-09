/*
  # Backfill de Categorías de Tecnología

  ## Descripción
  Esta migración asigna automáticamente la `categoria_id` para las tecnologías existentes
  basándose en la lógica implícita que usaba el sistema anteriormente:

  1. **Láser**: Se asigna la categoría Impresión Láser si:
     - Tiene el ID heredado específico.
     - O su nombre contiene "laser" o "láser" (case insensitive).

  2. **Gran Formato**: Se asigna la categoría Gran Formato a cualquier tecnología
     que quede sin categoría (comportamiento por defecto anterior).

  ## Objetivo
  Asegurar que los clientes existentes no pierdan visibilidad de sus tecnologías
  al actualizarse el sistema a la nueva lógica de categorías explícitas.
*/

DO $$
DECLARE
    -- IDs de Categorías del Sistema (ver src/constants/categorias.ts)
    CAT_LASER UUID := '00000000-0000-0000-0000-000000000001';
    CAT_GRAN_FORMATO UUID := '00000000-0000-0000-0000-000000000002';
    
    -- ID Legado de tecnología Láser (hardcoded en versiones previas)
    LEGACY_LASER_ID UUID := 'd1f9452e-dda9-4419-966c-a7f4a4f98e07';
BEGIN
    -- 1. Migrar Tecnologías Láser (por ID legado o por Nombre)
    UPDATE tecnologias
    SET categoria_id = CAT_LASER
    WHERE categoria_id IS NULL
    AND (
        id = LEGACY_LASER_ID
        OR nombre ILIKE '%laser%'
        OR nombre ILIKE '%láser%'
    );

    -- 2. Migrar el resto a Gran Formato (Comportamiento por defecto anterior)
    -- El sistema anterior mostraba "todo lo que no es láser" en Gran Formato.
    UPDATE tecnologias
    SET categoria_id = CAT_GRAN_FORMATO
    WHERE categoria_id IS NULL;
    
END $$;
