-- =====================================================
-- VERIFICACIÓN: Campo Origen en Órdenes de Copiado
-- =====================================================
-- Ejecuta estas queries en el SQL Editor de Supabase
-- para verificar que el fix está funcionando
-- =====================================================

-- 1. Ver las últimas órdenes de copiado y su origen
-- =====================================================
SELECT
  numero_orden,
  origen,
  estado,
  ROUND(total::numeric, 2) as total,
  orden_trabajo_id,
  TO_CHAR(fecha_solicitud, 'YYYY-MM-DD HH24:MI') as fecha,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as fecha_creacion
FROM centro_copiado_ordenes
WHERE estado != 'cancelada'
ORDER BY created_at DESC
LIMIT 20;

-- Resultado esperado:
-- Las órdenes NUEVAS (creadas después del fix) deben tener
-- origen = 'WhatsApp', 'App Mobile', 'Web', o 'Mostrador'
-- según lo que se seleccionó en el formulario


-- 2. Distribución de orígenes (todas las órdenes)
-- =====================================================
SELECT
  COALESCE(origen, 'NULL') as origen,
  COUNT(*) as cantidad_ordenes,
  ROUND(SUM(total)::numeric, 2) as total_ventas,
  ROUND(AVG(total)::numeric, 2) as promedio,
  COUNT(CASE WHEN orden_trabajo_id IS NOT NULL THEN 1 END) as vinculadas,
  COUNT(CASE WHEN orden_trabajo_id IS NULL THEN 1 END) as independientes,
  MIN(fecha_solicitud)::date as primera_orden,
  MAX(fecha_solicitud)::date as ultima_orden
FROM centro_copiado_ordenes
WHERE estado != 'cancelada'
GROUP BY origen
ORDER BY cantidad_ordenes DESC;

-- Resultado esperado:
-- Deberías ver diferentes orígenes, no solo 'Mostrador'


-- 3. Órdenes creadas HOY (para testing inmediato)
-- =====================================================
SELECT
  numero_orden,
  origen,
  ROUND(total::numeric, 2) as total,
  estado,
  TO_CHAR(created_at, 'HH24:MI:SS') as hora_creacion
FROM centro_copiado_ordenes
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- Resultado esperado:
-- Las órdenes de hoy deben tener el origen correcto


-- 4. Verificar si hay órdenes con origen NULL
-- =====================================================
SELECT
  COUNT(*) as ordenes_sin_origen,
  ROUND(SUM(total)::numeric, 2) as total_ventas,
  MAX(fecha_solicitud)::date as ultima_orden_sin_origen
FROM centro_copiado_ordenes
WHERE origen IS NULL
  AND estado != 'cancelada';

-- Resultado esperado:
-- - Si hay órdenes con origen NULL, son órdenes ANTIGUAS (antes del fix)
-- - Las órdenes NUEVAS no deben tener origen NULL


-- 5. Comparar órdenes ANTES vs DESPUÉS del fix
-- =====================================================
-- Reemplaza la fecha con cuando aplicaste el fix
WITH fecha_fix AS (
  SELECT '2025-12-03 18:00:00'::timestamp as momento_fix
)
SELECT
  CASE
    WHEN created_at < (SELECT momento_fix FROM fecha_fix) THEN 'ANTES del fix'
    ELSE 'DESPUÉS del fix'
  END as periodo,
  COALESCE(origen, 'NULL') as origen,
  COUNT(*) as cantidad,
  ROUND(SUM(total)::numeric, 2) as total_ventas
FROM centro_copiado_ordenes, fecha_fix
WHERE estado != 'cancelada'
GROUP BY
  CASE
    WHEN created_at < (SELECT momento_fix FROM fecha_fix) THEN 'ANTES del fix'
    ELSE 'DESPUÉS del fix'
  END,
  origen
ORDER BY periodo DESC, cantidad DESC;

-- Resultado esperado:
-- ANTES del fix: La mayoría o todas tienen origen = 'Mostrador' o NULL
-- DESPUÉS del fix: Diferentes orígenes según lo seleccionado


-- 6. Test de integridad: Verificar que el reporte funciona
-- =====================================================
-- IMPORTANTE: Reemplaza 'YOUR_COMPANY_ID' con tu company_id real
-- Puedes obtenerlo ejecutando: SELECT id, nombre_fantasia FROM companies LIMIT 1;

SELECT
  c.canal,
  ROUND(c.total_ventas::numeric, 2) as ventas,
  c.total_ordenes,
  c.ordenes_copiado,
  ROUND(c.porcentaje_ventas::numeric, 1) as porcentaje,
  ROUND(c.ticket_promedio::numeric, 2) as ticket_promedio
FROM fn_reporte_ventas_por_canal(
  'YOUR_COMPANY_ID'::uuid,  -- ⚠️ REEMPLAZAR
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
) c
ORDER BY c.total_ventas DESC;

-- Resultado esperado:
-- Debe mostrar diferentes canales (no solo Mostrador)
-- Las órdenes nuevas deben aparecer en sus canales correctos


-- =====================================================
-- PRUEBA PRÁCTICA
-- =====================================================
-- Para confirmar que el fix funciona:
--
-- 1. Crea una orden nueva desde la UI:
--    - Ve a Centro Copiado > Crear Orden
--    - Selecciona canal "App Mobile" (o cualquier otro que NO sea Mostrador)
--    - Completa la orden y guárdala
--
-- 2. Ejecuta esta query con el número de orden:
--
SELECT numero_orden, origen, total, created_at
FROM centro_copiado_ordenes
WHERE numero_orden = 'CC-YYYYMMDD-XXXX'  -- Reemplaza con el número real
;
--
-- 3. Verifica que origen = 'App Mobile' (o el canal que seleccionaste)
--
-- ✅ Si origen tiene el valor correcto: El fix funciona
-- ❌ Si origen = 'Mostrador': Hay un problema (contactar soporte)
--
-- =====================================================
