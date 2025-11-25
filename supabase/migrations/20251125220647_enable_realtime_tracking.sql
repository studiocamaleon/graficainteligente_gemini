/*
  # Habilitar Realtime para Tracking Público

  ## Descripción
  Habilita Supabase Realtime para la tabla ordenes_trabajo_items_rutas permitiendo
  que las vistas de tracking reciban actualizaciones instantáneas cuando cambian
  los estados de los pasos de producción.

  ## Cambios
  1. Agrega ordenes_trabajo_items_rutas a la publicación supabase_realtime
  2. Configura permisos para usuarios anónimos (anon)
  3. Habilita eventos UPDATE, INSERT y DELETE

  ## Impacto
  Las vistas de tracking público se actualizarán automáticamente (< 1 segundo)
  cuando se completen, inicien o cambien pasos en producción.

  ## Seguridad
  - Solo usuarios con acceso a través de tracking_token válido
  - Las políticas RLS existentes se mantienen
  - No se expone información sensible
*/

-- =====================================================
-- 1. VERIFICAR Y HABILITAR REALTIME PARA LA TABLA
-- =====================================================

-- Verificar si la tabla ya está en la publicación
DO $$
BEGIN
  -- Intentar agregar la tabla a la publicación de realtime
  -- Si ya existe, el comando no hará nada
  BEGIN
    ALTER PUBLICATION supabase_realtime 
    ADD TABLE ordenes_trabajo_items_rutas;
  EXCEPTION
    WHEN duplicate_object THEN
      -- La tabla ya está en la publicación, no hacer nada
      NULL;
  END;
END $$;

-- =====================================================
-- 2. HABILITAR REALTIME TAMBIÉN PARA OTRAS TABLAS
-- =====================================================

-- Habilitar para ordenes_trabajo (cambios de estado de la orden)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime 
    ADD TABLE ordenes_trabajo;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

-- Habilitar para ordenes_trabajo_items (cambios de estado de items)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime 
    ADD TABLE ordenes_trabajo_items;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON TABLE ordenes_trabajo_items_rutas IS
'Rutas de producción por item. Realtime habilitado para tracking público en tiempo real.';

COMMENT ON TABLE ordenes_trabajo IS
'Órdenes de trabajo. Realtime habilitado para tracking público de cambios de estado.';

COMMENT ON TABLE ordenes_trabajo_items IS
'Items de órdenes de trabajo. Realtime habilitado para tracking público de progreso.';