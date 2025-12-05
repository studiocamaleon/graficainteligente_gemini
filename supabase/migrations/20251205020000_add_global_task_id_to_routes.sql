/*
  # Agrupación de Pasos de Ruta (Global Tasks)

  ## Descripción
  Agrega soporte para agrupar múltiples pasos de ruta (de diferentes items) en una sola tarea lógica.
  Esto es vital para servicios como "Diseño Gráfico" que se cobran globalmente y se ejecutan 
  como una sola unidad de trabajo, aunque técnicamente sean un paso en cada item de la orden.

  ## Cambios
  - Agrega columna `global_task_id` a `ordenes_trabajo_items_rutas`
  - Agrega índice para búsqueda eficiente
*/

-- 1. Agregar columna
ALTER TABLE ordenes_trabajo_items_rutas 
ADD COLUMN IF NOT EXISTS global_task_id uuid DEFAULT NULL;

-- 2. Comentario explicativo
COMMENT ON COLUMN ordenes_trabajo_items_rutas.global_task_id IS 'ID para agrupar pasos de múltiples items que deben gestionarse como una tarea única (ej: Diseño compartido)';

-- 3. Índice para performance en el Kanban (cuando agrupamos)
CREATE INDEX IF NOT EXISTS idx_ordenes_items_rutas_global_task 
  ON ordenes_trabajo_items_rutas(global_task_id);
