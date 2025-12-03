/*
  # Eliminación del Sistema de Archivos en Órdenes de Trabajo

  ## Resumen
  Este script elimina completamente la funcionalidad de subir archivos en las órdenes de trabajo,
  manteniendo únicamente la funcionalidad de links externos.

  ## IMPORTANTE
  Este es un cambio destructivo. Todos los archivos subidos previamente
  se eliminarán permanentemente.
*/

-- =====================================================
-- 1. ELIMINAR STORAGE BUCKETS Y ARCHIVOS
-- =====================================================

-- Eliminar bucket de archivos de cliente
DELETE FROM storage.objects WHERE bucket_id = 'orden-trabajo-archivos';
DELETE FROM storage.buckets WHERE id = 'orden-trabajo-archivos';

-- Eliminar bucket de archivos de producción
DELETE FROM storage.objects WHERE bucket_id = 'orden-produccion-archivos';
DELETE FROM storage.buckets WHERE id = 'orden-produccion-archivos';

-- =====================================================
-- 2. ELIMINAR POLÍTICAS RLS DE STORAGE
-- =====================================================

DROP POLICY IF EXISTS "Users can view files from their company - cliente" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert files for their company - cliente" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files or admins can delete any - cliente" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files from their company - produccion" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can insert production files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete production files" ON storage.objects;

-- =====================================================
-- 3. ELIMINAR FUNCIONES Y TRIGGERS RELACIONADOS CON ARCHIVOS
-- =====================================================

-- Eliminar trigger y función de marcado de archivos para eliminación
DROP TRIGGER IF EXISTS trigger_marcar_archivos_para_eliminacion ON ordenes_trabajo;
DROP FUNCTION IF EXISTS fn_marcar_archivos_para_eliminacion() CASCADE;

-- Eliminar función que ya no se necesita
DROP FUNCTION IF EXISTS fn_actualizar_fecha_entrega_real() CASCADE;

-- Eliminar función anterior de asociación
DROP FUNCTION IF EXISTS fn_asociar_adjuntos_temporales(uuid, uuid, uuid) CASCADE;

-- =====================================================
-- 4. ELIMINAR TABLAS DE ARCHIVOS
-- =====================================================

-- Eliminar tabla de archivos pendientes de eliminación
DROP TABLE IF EXISTS archivos_pendientes_eliminacion CASCADE;

-- Eliminar tabla de archivos de producción
DROP TABLE IF EXISTS ordenes_trabajo_archivos_produccion CASCADE;

-- Eliminar tabla de archivos de cliente
DROP TABLE IF EXISTS ordenes_trabajo_archivos CASCADE;

-- =====================================================
-- 5. SIMPLIFICAR TABLA DE LINKS
-- =====================================================

-- Eliminar links temporales sin orden asociada (limpieza)
DELETE FROM ordenes_trabajo_links WHERE orden_id IS NULL;

-- Eliminar campos temporales (ya no se necesitan sin el sistema de archivos)
ALTER TABLE ordenes_trabajo_links
  DROP COLUMN IF EXISTS orden_temporal_id CASCADE,
  DROP COLUMN IF EXISTS temporal_creado_en CASCADE;

-- Hacer orden_id NOT NULL nuevamente (ahora todos los links deben estar asociados a una orden)
ALTER TABLE ordenes_trabajo_links
  ALTER COLUMN orden_id SET NOT NULL;

-- Eliminar constraint de XOR temporal (ya no aplica)
ALTER TABLE ordenes_trabajo_links
  DROP CONSTRAINT IF EXISTS check_orden_id_xor_temporal_links;

-- Eliminar índices de temporales
DROP INDEX IF EXISTS idx_links_temporal;
DROP INDEX IF EXISTS idx_links_temporal_antiguos;

-- =====================================================
-- 6. CREAR FUNCIÓN SIMPLIFICADA DE ASOCIACIÓN
-- =====================================================

-- Esta función ahora solo retorna 0 para compatibilidad con el código
CREATE OR REPLACE FUNCTION fn_asociar_adjuntos_temporales(
  p_orden_temporal_id uuid,
  p_orden_id uuid,
  p_company_id uuid
)
RETURNS TABLE(
  links_asociados integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Función simplificada - ya no hay sistema temporal
  -- Los links ahora se agregan directamente asociados a la orden
  RAISE LOG 'fn_asociar_adjuntos_temporales: Links se asocian directamente, no hay temporales';
  
  RETURN QUERY SELECT 0::integer;
END;
$$;

COMMENT ON FUNCTION fn_asociar_adjuntos_temporales IS 'Función simplificada - links ahora se asocian directamente a la orden (no hay sistema temporal)';

-- =====================================================
-- 7. VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ELIMINACIÓN DEL SISTEMA DE ARCHIVOS COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tablas eliminadas:';
  RAISE NOTICE '  - ordenes_trabajo_archivos';
  RAISE NOTICE '  - ordenes_trabajo_archivos_produccion';
  RAISE NOTICE '  - archivos_pendientes_eliminacion';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage buckets eliminados:';
  RAISE NOTICE '  - orden-trabajo-archivos';
  RAISE NOTICE '  - orden-produccion-archivos';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabla simplificada:';
  RAISE NOTICE '  - ordenes_trabajo_links (campos temporales eliminados)';
  RAISE NOTICE '';
  RAISE NOTICE 'El sistema ahora solo maneja links externos.';
  RAISE NOTICE 'Los links deben agregarse directamente asociados a una orden.';
  RAISE NOTICE '========================================';
END $$;
