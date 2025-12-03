/*
  # Agregar soporte para canal "App Mobile"

  ## Descripción
  Actualiza los CHECK constraints en las tablas ordenes_trabajo y presupuestos
  para permitir el valor "App Mobile" en el campo canal_venta.

  ## Cambios
  1. Actualiza constraint en tabla ordenes_trabajo
  2. Actualiza constraint en tabla presupuestos

  ## Canales Soportados
  Después de esta migración, los canales válidos son:
  - Web
  - WhatsApp
  - Mostrador
  - App Mobile (nuevo)
*/

-- =====================================================
-- Actualizar constraint en ordenes_trabajo
-- =====================================================

ALTER TABLE ordenes_trabajo
  DROP CONSTRAINT IF EXISTS check_canal_venta;

ALTER TABLE ordenes_trabajo
  ADD CONSTRAINT check_canal_venta
  CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));

COMMENT ON COLUMN ordenes_trabajo.canal_venta IS
  'Canal de venta: Web, WhatsApp, Mostrador, App Mobile';

-- =====================================================
-- Actualizar constraint en presupuestos
-- =====================================================

ALTER TABLE presupuestos
  DROP CONSTRAINT IF EXISTS presupuestos_canal_venta_check;

ALTER TABLE presupuestos
  ADD CONSTRAINT presupuestos_canal_venta_check
  CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));

COMMENT ON COLUMN presupuestos.canal_venta IS
  'Canal de venta: Web, WhatsApp, Mostrador, App Mobile';
