/*
  # Fix Notificaciones Internas Realtime

  1. Configuración
    - Agregar REPLICA IDENTITY FULL a la tabla notificaciones_internas
    - Esto permite que Supabase Realtime aplique correctamente las políticas RLS
    - Los eventos INSERT/UPDATE se transmitirán con los datos completos

  2. Seguridad
    - Las políticas RLS existentes se mantienen intactas
    - Solo los usuarios autorizados verán sus propias notificaciones
*/

-- =====================================================
-- CONFIGURAR REPLICA IDENTITY FULL
-- =====================================================

-- Habilitar replica identity FULL para la tabla notificaciones_internas
-- Esto es necesario para que Supabase Realtime pueda enviar los datos completos
-- y aplicar correctamente las políticas RLS en los eventos de broadcast
ALTER TABLE notificaciones_internas REPLICA IDENTITY FULL;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que la tabla está en la publicación de realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'notificaciones_internas'
  ) THEN
    RAISE NOTICE '✅ Tabla notificaciones_internas está en supabase_realtime';
  ELSE
    RAISE WARNING '⚠️ Tabla notificaciones_internas NO está en supabase_realtime. Agregándola...';

    -- Agregar la tabla a la publicación si no está
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones_internas;
      RAISE NOTICE '✅ Tabla agregada a supabase_realtime';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE '✅ Tabla ya estaba en supabase_realtime';
    END;
  END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ REPLICA IDENTITY FULL configurado para notificaciones_internas';
  RAISE NOTICE '📡 Las notificaciones ahora se transmitirán correctamente via Realtime';
  RAISE NOTICE '🔒 Las políticas RLS se aplicarán correctamente en los broadcasts';
END $$;