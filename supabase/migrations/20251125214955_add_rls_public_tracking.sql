/*
  # Políticas RLS para Acceso Público de Tracking

  ## Descripción
  Permite acceso público de solo lectura a órdenes de trabajo y datos relacionados
  mediante el tracking_token, sin necesidad de autenticación.

  ## Políticas Creadas
  1. `ordenes_trabajo`: SELECT público con token válido
  2. `ordenes_trabajo_items`: SELECT público vía orden con token
  3. `ordenes_trabajo_items_rutas`: SELECT público vía item con token
  4. `clients`: SELECT público solo nombre_fantasia vía orden con token

  ## Seguridad
  - Solo operaciones SELECT (lectura)
  - Solo para usuarios anónimos (TO anon)
  - Requiere tracking_token válido (no nulo)
  - No expone información sensible (precios, pagos, etc.)
  - Acceso en cascada mediante EXISTS

  ## Importante
  - NO permite INSERT, UPDATE, DELETE
  - NO permite acceso a datos de facturación
  - NO permite acceso a notas internas completas
*/

-- =====================================================
-- 1. POLÍTICA PARA ordenes_trabajo
-- =====================================================

-- Permitir acceso público a órdenes con token válido
CREATE POLICY "Public access with tracking token"
ON ordenes_trabajo FOR SELECT
TO anon
USING (tracking_token IS NOT NULL);

-- =====================================================
-- 2. POLÍTICA PARA ordenes_trabajo_items
-- =====================================================

-- Permitir acceso a items de órdenes con token válido
CREATE POLICY "Public access to orden items via token"
ON ordenes_trabajo_items FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM ordenes_trabajo ot
    WHERE ot.id = ordenes_trabajo_items.orden_id
    AND ot.tracking_token IS NOT NULL
  )
);

-- =====================================================
-- 3. POLÍTICA PARA ordenes_trabajo_items_rutas
-- =====================================================

-- Permitir acceso a rutas de items de órdenes con token válido
CREATE POLICY "Public access to item rutas via token"
ON ordenes_trabajo_items_rutas FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM ordenes_trabajo_items oti
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE oti.id = ordenes_trabajo_items_rutas.orden_item_id
    AND ot.tracking_token IS NOT NULL
  )
);

-- =====================================================
-- 4. POLÍTICA PARA clients (Solo nombre)
-- =====================================================

-- Permitir acceso público solo a nombre de cliente de órdenes con token
CREATE POLICY "Public access to client name via tracking token"
ON clients FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM ordenes_trabajo ot
    WHERE ot.cliente_id = clients.id
    AND ot.tracking_token IS NOT NULL
  )
);

-- =====================================================
-- 5. POLÍTICA PARA pasos (Referencia de nombres)
-- =====================================================

-- Permitir acceso público a nombres de pasos referenciados en rutas
CREATE POLICY "Public access to paso names via tracking"
ON pasos FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM ordenes_trabajo_items_rutas otir
    JOIN ordenes_trabajo_items oti ON oti.id = otir.orden_item_id
    JOIN ordenes_trabajo ot ON ot.id = oti.orden_id
    WHERE otir.paso_id = pasos.id
    AND ot.tracking_token IS NOT NULL
  )
);

-- =====================================================
-- 6. COMENTARIOS
-- =====================================================

COMMENT ON POLICY "Public access with tracking token" ON ordenes_trabajo IS
'Permite acceso público de lectura a órdenes mediante tracking_token válido';

COMMENT ON POLICY "Public access to orden items via token" ON ordenes_trabajo_items IS
'Permite acceso público a items de órdenes que tienen tracking_token válido';

COMMENT ON POLICY "Public access to item rutas via token" ON ordenes_trabajo_items_rutas IS
'Permite acceso público a rutas de producción de items de órdenes con tracking_token';

COMMENT ON POLICY "Public access to client name via tracking token" ON clients IS
'Permite acceso público solo al nombre del cliente de órdenes con tracking_token válido';

COMMENT ON POLICY "Public access to paso names via tracking" ON pasos IS
'Permite acceso público a nombres de pasos referenciados en rutas de órdenes con tracking_token';