-- Función para actualizar el estado de todas las tareas asociadas a un global_task_id
-- Esto permite completar, iniciar o pausar masivamente tareas idénticas agrupadas.

CREATE OR REPLACE FUNCTION update_global_task_status(
  p_global_task_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Validar inputs
  IF p_new_status NOT IN ('pendiente', 'en_proceso', 'completado', 'omitido') THEN
    RAISE EXCEPTION 'Estado inválido: %. Los estados permitidos son: pendiente, en_proceso, completado, omitido', p_new_status;
  END IF;

  IF p_global_task_id IS NULL THEN
    RAISE EXCEPTION 'El global_task_id no puede ser nulo';
  END IF;

  -- 2. Actualizar registros
  UPDATE ordenes_trabajo_items_rutas
  SET
    estado_paso = p_new_status,
    responsable_id = p_user_id,
    updated_at = now(),
    -- Lógica de tiempos
    fecha_inicio = CASE
      WHEN p_new_status = 'en_proceso' AND fecha_inicio IS NULL THEN now()
      WHEN p_new_status = 'pendiente' THEN NULL -- Reset si vuelve a pendiente
      ELSE fecha_inicio
    END,
    fecha_fin = CASE
      WHEN p_new_status IN ('completado', 'omitido') THEN now()
      WHEN p_new_status IN ('pendiente', 'en_proceso') THEN NULL -- Reset si se reabre
      ELSE fecha_fin
    END,
    -- Concatenar notas si existen, o reemplazarlas? 
    -- Para operaciones masivas, mejor reemplazar o agregar con timestamp. 
    -- Aquí reemplazamos si se provee nueva nota.
    notas = COALESCE(p_notes, notas)
  WHERE
    global_task_id = p_global_task_id;

  -- 3. Feedback (opcional en logs)
  RAISE NOTICE 'Actualizadas tareas con global_task_id % al estado % por usuario %', p_global_task_id, p_new_status, p_user_id;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION update_global_task_status(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_task_status(uuid, text, uuid, text) TO service_role;
