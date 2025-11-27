/*
  # Corregir Función fn_sugerir_ordenes_para_liquidacion

  ## Descripción
  Esta migración corrige la función fn_sugerir_ordenes_para_liquidacion para
  usar el campo fecha_completado que ahora existe en la tabla ordenes_trabajo.

  ## Cambios Realizados
  - Reemplaza referencias a fecha_completado inexistente con el campo real
  - Agrega validación de NOT NULL para fecha_completado
  - Corrige referencia de 'notas' a 'notas_internas' (nombre correcto)
  - Agrega alias explícitos para mayor claridad

  ## Comportamiento
  La función retorna órdenes de trabajo que:
  - Pertenecen al cliente especificado
  - Están en estado 'completado'
  - Tienen fecha_completado establecida (no NULL)
  - Su fecha_completado está dentro del rango especificado
  - No han sido incluidas en ninguna liquidación previa

  ## Uso
  SELECT * FROM fn_sugerir_ordenes_para_liquidacion(
    'uuid-del-cliente',
    '2024-01-01',
    '2024-12-31'
  );
*/

-- =====================================================
-- RECREAR FUNCIÓN fn_sugerir_ordenes_para_liquidacion
-- =====================================================

CREATE OR REPLACE FUNCTION fn_sugerir_ordenes_para_liquidacion(
  p_cliente_id UUID,
  p_fecha_desde DATE,
  p_fecha_hasta DATE
)
RETURNS TABLE(
  orden_id UUID,
  numero_orden TEXT,
  fecha_completado DATE,
  total NUMERIC,
  descripcion TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id AS orden_id,
    ot.numero_orden,
    ot.fecha_completado::DATE AS fecha_completado,
    ot.total,
    ('Orden ' || ot.numero_orden || COALESCE(' - ' || ot.notas_internas, '')) AS descripcion
  FROM ordenes_trabajo ot
  WHERE ot.cliente_id = p_cliente_id
    AND ot.estado = 'completado'
    AND ot.fecha_completado IS NOT NULL
    AND ot.fecha_completado::DATE >= p_fecha_desde
    AND ot.fecha_completado::DATE <= p_fecha_hasta
    AND NOT EXISTS (
      SELECT 1
      FROM liquidaciones_items li
      WHERE li.orden_id = ot.id
    )
  ORDER BY ot.fecha_completado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agregar comentario actualizado
COMMENT ON FUNCTION fn_sugerir_ordenes_para_liquidacion(UUID, DATE, DATE) IS 
'Sugiere órdenes de trabajo completadas dentro de un rango de fechas para un cliente específico, excluyendo órdenes ya incluidas en liquidaciones. Usa el campo fecha_completado para determinar la fecha de completado real de la orden.';

-- Revocar y otorgar permisos apropiados
REVOKE ALL ON FUNCTION fn_sugerir_ordenes_para_liquidacion(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_sugerir_ordenes_para_liquidacion(UUID, DATE, DATE) TO authenticated;
