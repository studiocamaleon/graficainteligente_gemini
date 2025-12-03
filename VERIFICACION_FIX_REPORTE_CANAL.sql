-- =====================================================
-- VERIFICACIÓN: Fix Reporte Canal - Campo Origen
-- =====================================================
-- Ejecuta estas queries en el SQL Editor de Supabase
-- para verificar el estado actual del sistema
-- =====================================================

-- 1. Verificar la definición actual de la función
-- =====================================================
-- Esta query muestra el código fuente de la función actual
SELECT pg_get_functiondef('fn_reporte_ventas_por_canal'::regproc);

-- Resultado esperado: Debe incluir la línea:
--   COALESCE(cc.origen, 'Mostrador') AS canal
-- en la sección de órdenes de copiado independientes


-- 2. Verificar distribución de orígenes en órdenes de copiado
-- =====================================================
-- Muestra cuántas órdenes hay de cada origen
SELECT
  origen,
  COUNT(*) as cantidad_ordenes,
  ROUND(SUM(total)::numeric, 2) as total_ventas,
  ROUND(AVG(total)::numeric, 2) as promedio,
  COUNT(CASE WHEN orden_trabajo_id IS NOT NULL THEN 1 END) as vinculadas,
  COUNT(CASE WHEN orden_trabajo_id IS NULL THEN 1 END) as independientes
FROM centro_copiado_ordenes
WHERE estado != 'cancelada'
GROUP BY origen
ORDER BY cantidad_ordenes DESC;

-- Resultado esperado:
-- | origen     | cantidad | total_ventas | promedio  | vinculadas | independientes |
-- |------------|----------|--------------|-----------|------------|----------------|
-- | Mostrador  | 15       | 45000.00     | 3000.00   | 5          | 10             |
-- | WhatsApp   | 8        | 24000.00     | 3000.00   | 2          | 6              |
-- | App Mobile | 5        | 15000.00     | 3000.00   | 0          | 5              |


-- 3. Verificar órdenes de copiado independientes (las afectadas por el fix)
-- =====================================================
-- Muestra las últimas 20 órdenes independientes y su origen
SELECT
  numero_orden,
  origen,
  estado,
  ROUND(total::numeric, 2) as total,
  TO_CHAR(fecha_solicitud, 'YYYY-MM-DD HH24:MI') as fecha,
  orden_trabajo_id
FROM centro_copiado_ordenes
WHERE orden_trabajo_id IS NULL  -- Solo independientes
  AND estado != 'cancelada'
ORDER BY fecha_solicitud DESC
LIMIT 20;

-- Verificar: ¿Todas tienen origen = 'Mostrador' o hay variedad?


-- 4. Probar la función de reporte con datos reales
-- =====================================================
-- IMPORTANTE: Reemplaza 'YOUR_COMPANY_ID' con tu company_id real
-- Puedes obtenerlo ejecutando: SELECT id FROM companies LIMIT 1;

-- Calcular fechas del mes actual
WITH fechas AS (
  SELECT
    DATE_TRUNC('month', CURRENT_DATE)::date as fecha_inicio,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date as fecha_fin
)
SELECT
  c.canal,
  ROUND(c.total_ventas::numeric, 2) as total_ventas,
  c.total_ordenes,
  c.ordenes_trabajo,
  c.ordenes_copiado,
  ROUND(c.porcentaje_ventas::numeric, 2) as porcentaje,
  ROUND(c.ticket_promedio::numeric, 2) as ticket_promedio
FROM fechas f,
LATERAL fn_reporte_ventas_por_canal(
  'YOUR_COMPANY_ID'::uuid,  -- ⚠️ REEMPLAZAR CON TU COMPANY_ID
  f.fecha_inicio,
  f.fecha_fin
) c
ORDER BY c.total_ventas DESC;

-- Resultado esperado: Debe mostrar diferentes canales (no solo Mostrador)
-- | canal      | total_ventas | ordenes | trabajo | copiado | porcentaje | ticket_promedio |
-- |------------|--------------|---------|---------|---------|------------|-----------------|
-- | WhatsApp   | 279234.20    | 2       | 0       | 2       | 89.6       | 139617.10       |
-- | Mostrador  | 31600.00     | 1       | 0       | 1       | 10.4       | 31600.00        |


-- 5. Comparar antes vs después (si tienes datos históricos)
-- =====================================================
-- Esta query muestra la diferencia entre lo que DEBERÍA mostrar
-- vs lo que MOSTRABA antes del fix

WITH ordenes_independientes AS (
  SELECT
    COALESCE(origen, 'Mostrador') as origen_real,
    'Mostrador' as origen_hardcodeado,  -- El bug anterior
    COUNT(*) as cantidad,
    SUM(total) as total_ventas
  FROM centro_copiado_ordenes
  WHERE orden_trabajo_id IS NULL
    AND estado != 'cancelada'
    AND fecha_solicitud >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY origen
)
SELECT
  origen_real as "Canal Real (Correcto)",
  origen_hardcodeado as "Canal Anterior (Bug)",
  cantidad as "Órdenes",
  ROUND(total_ventas::numeric, 2) as "Total Ventas"
FROM ordenes_independientes
ORDER BY cantidad DESC;

-- Esta query muestra claramente el problema:
-- Antes TODAS las órdenes se reportaban como 'Mostrador'
-- Ahora se reportan con su origen correcto (WhatsApp, App Mobile, etc.)


-- 6. Verificar que no haya órdenes con origen NULL
-- =====================================================
-- Las órdenes con origen NULL se reportarán como 'Mostrador' por el COALESCE
SELECT
  COUNT(*) as ordenes_sin_origen,
  SUM(total) as total_ventas_sin_origen
FROM centro_copiado_ordenes
WHERE origen IS NULL
  AND estado != 'cancelada'
  AND orden_trabajo_id IS NULL;

-- Si este query devuelve un número alto, considera actualizar esas órdenes
-- con el origen correcto basado en otros campos (canal_venta, etc.)


-- 7. Query de actualización (SOLO SI ES NECESARIO)
-- =====================================================
-- ⚠️ CUIDADO: Solo ejecutar si identificaste órdenes con origen incorrecto
-- Ejemplo: Actualizar órdenes que se crearon desde la app móvil pero tienen origen NULL

-- PRIMERO VERIFICA qué se va a actualizar:
/*
SELECT
  numero_orden,
  origen,
  total,
  fecha_solicitud
FROM centro_copiado_ordenes
WHERE origen IS NULL
  AND orden_trabajo_id IS NULL
  AND [TU_CONDICION_PARA_IDENTIFICAR_APP_MOBILE]
LIMIT 10;
*/

-- LUEGO actualiza (descomenta y ajusta la condición):
/*
UPDATE centro_copiado_ordenes
SET origen = 'App Mobile'
WHERE origen IS NULL
  AND orden_trabajo_id IS NULL
  AND [TU_CONDICION_PARA_IDENTIFICAR_APP_MOBILE];
*/


-- =====================================================
-- RESULTADO ESPERADO DEL FIX
-- =====================================================
-- Después de aplicar la migración y limpiar el caché:
--
-- ✅ Las órdenes de copiado se reportan con su origen real
-- ✅ Las órdenes desde App Mobile aparecen en el canal "App Mobile"
-- ✅ Las órdenes desde WhatsApp aparecen en el canal "WhatsApp"
-- ✅ Solo las órdenes realmente de mostrador aparecen en "Mostrador"
-- ✅ Los porcentajes reflejan la distribución real de canales
--
-- Si después de ejecutar estas queries el problema persiste:
-- 1. Verifica que la función tenga el código correcto (query #1)
-- 2. Limpia el caché del navegador (Ctrl+Shift+R)
-- 3. Verifica que los datos tengan origen poblado (query #2 y #3)
-- 4. Espera 5-10 minutos para que expire el caché de Supabase
-- =====================================================
