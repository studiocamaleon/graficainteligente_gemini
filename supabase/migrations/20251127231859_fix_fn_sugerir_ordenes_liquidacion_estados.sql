/*
  # Corregir Función de Liquidación para Estados Correctos

  ## Descripción
  Actualiza la función fn_sugerir_ordenes_para_liquidacion para buscar órdenes
  con los estados correctos: 'finalizada' y 'entregada'.

  ## Cambios Realizados
  - Cambia filtro de estado de 'completado' a incluir 'finalizada' y 'entregada'
  - Ambos estados tienen fecha_completado establecida y deben poder liquidarse

  ## Lógica de Liquidación

  ### Órdenes que DEBEN aparecer:
  - Estado 'finalizada' + fecha_completado NOT NULL ✅
  - Estado 'entregada' + fecha_completado NOT NULL ✅

  ### Órdenes que NO deben aparecer:
  - Estado 'pendiente' ❌
  - Estado 'en_proceso' ❌
  - Estado 'cancelada' ❌
  - Órdenes ya incluidas en otra liquidación ❌
  - Órdenes fuera del rango de fechas especificado ❌

  ## Razón del Cambio
  Una orden finalizada ya completó el trabajo, y una orden entregada también.
  Ambas deben poder incluirse en liquidaciones, ya que el trabajo está completo
  y la fecha_completado registra cuándo se finalizó el trabajo.

  ## Uso de la Función
  ```sql
  SELECT * FROM fn_sugerir_ordenes_para_liquidacion(
    'uuid-del-cliente',
    '2025-01-01',
    '2025-01-31'
  );
  ```

  Retorna órdenes finalizadas O entregadas dentro del rango de fechas,
  que no hayan sido incluidas en liquidaciones previas.
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
    -- Incluir órdenes finalizadas O entregadas
    AND ot.estado IN ('finalizada', 'entregada')
    -- Debe tener fecha_completado establecida
    AND ot.fecha_completado IS NOT NULL
    -- Dentro del rango de fechas especificado
    AND ot.fecha_completado::DATE >= p_fecha_desde
    AND ot.fecha_completado::DATE <= p_fecha_hasta
    -- No debe estar ya incluida en una liquidación
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
'Sugiere órdenes finalizadas o entregadas dentro de un rango de fechas para un cliente específico, excluyendo órdenes ya incluidas en liquidaciones. Usa fecha_completado para el filtro de fechas.';

-- Revocar y otorgar permisos apropiados
REVOKE ALL ON FUNCTION fn_sugerir_ordenes_para_liquidacion(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_sugerir_ordenes_para_liquidacion(UUID, DATE, DATE) TO authenticated;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Query para verificar la función (ejecutar manualmente si necesario)
-- SELECT 
--   pg_get_functiondef('fn_sugerir_ordenes_para_liquidacion'::regproc) 
-- as function_definition;
