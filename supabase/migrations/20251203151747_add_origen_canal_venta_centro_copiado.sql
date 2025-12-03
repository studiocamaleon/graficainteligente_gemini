/*
  # Agregar Canal de Venta a Órdenes de Copiado y Nuevo Canal "App Mobile"

  ## Descripción
  Agrega el campo `origen` (canal de venta) a las órdenes de copiado para permitir
  el tracking de ventas por canal en los reportes financieros. También agrega el
  nuevo canal "App Mobile" a todo el sistema.

  ## Cambios

  1. **centro_copiado_ordenes**
     - Agregar columna `origen` (canal de venta)
     - Tipo: text NOT NULL DEFAULT 'Mostrador'
     - Valores permitidos: 'Web', 'WhatsApp', 'Mostrador', 'App Mobile'

  2. **ordenes_trabajo**
     - Actualizar constraint para incluir 'App Mobile'

  3. **presupuestos**
     - Actualizar constraint para incluir 'App Mobile'

  ## Impacto
  - Las órdenes de copiado existentes tendrán 'Mostrador' como valor por defecto
  - Los reportes de ventas por canal ahora incluirán las órdenes de copiado correctamente
  - El nuevo canal "App Mobile" estará disponible en todo el sistema
*/

-- =====================================================
-- 1. AGREGAR CAMPO ORIGEN A CENTRO_COPIADO_ORDENES
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_copiado_ordenes'
    AND column_name = 'origen'
  ) THEN
    ALTER TABLE centro_copiado_ordenes
    ADD COLUMN origen text NOT NULL DEFAULT 'Mostrador'
    CHECK (origen IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));
  END IF;
END $$;

COMMENT ON COLUMN centro_copiado_ordenes.origen IS 'Canal de venta por el cual se originó la orden (Web, WhatsApp, Mostrador, App Mobile)';

-- =====================================================
-- 2. ACTUALIZAR CONSTRAINT EN ORDENES_TRABAJO
-- =====================================================

-- Eliminar constraint anterior si existe
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS check_canal_venta;

-- Crear nuevo constraint con App Mobile
ALTER TABLE ordenes_trabajo
ADD CONSTRAINT check_canal_venta
CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));

COMMENT ON COLUMN ordenes_trabajo.canal_venta IS 'Canal de venta por el cual se originó la orden (Web, WhatsApp, Mostrador, App Mobile)';

-- =====================================================
-- 3. ACTUALIZAR CONSTRAINT EN PRESUPUESTOS
-- =====================================================

-- Eliminar constraint anterior si existe
ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_canal_venta_check;

-- Crear nuevo constraint con App Mobile
ALTER TABLE presupuestos
ADD CONSTRAINT presupuestos_canal_venta_check
CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador', 'App Mobile'));

COMMENT ON COLUMN presupuestos.canal_venta IS 'Canal de venta por el cual se originó el presupuesto (Web, WhatsApp, Mostrador, App Mobile)';
