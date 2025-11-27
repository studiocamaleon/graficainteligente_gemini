/*
  # Parametrización de Cuentas Corrientes

  ## Descripción
  Esta migración agrega campos de parametrización para cuentas corrientes,
  permitiendo configurar días específicos de cierre según el tipo de acuerdo de pago.

  ## Cambios en la tabla `clients`

  ### Nuevos Campos
  - `dia_cierre_semanal` (integer) - Día de la semana para cierre (1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom)
  - `dia_cierre_mensual` (integer) - Día del mes para cierre mensual (1-28)
  - `usa_ultimo_dia_mes` (boolean) - Si TRUE, el cierre mensual es el último día del mes
  - `dias_vencimiento` (integer) - Días después del cierre en que vence la liquidación

  ### Configuración por tipo de acuerdo
  - **Semanal**: Requiere `dia_cierre_semanal` (1-7)
  - **Quincenal**: No requiere config adicional (siempre día 1 y 15)
  - **Mensual**: Requiere `dia_cierre_mensual` (1-28) O `usa_ultimo_dia_mes = true`

  ## Seguridad
  - Se mantiene RLS existente
  - Sin cambios en permisos

  ## Migración de Datos
  - Clientes existentes con CC reciben valores por defecto según su acuerdo
  - Semanal → Viernes (5)
  - Mensual → Último día del mes
  - Todos → 7 días de vencimiento
*/

-- =====================================================
-- 1. Agregar nuevos campos a clients
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dia_cierre_semanal INTEGER
    CHECK (dia_cierre_semanal IS NULL OR (dia_cierre_semanal >= 1 AND dia_cierre_semanal <= 7));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dia_cierre_mensual INTEGER
    CHECK (dia_cierre_mensual IS NULL OR (dia_cierre_mensual >= 1 AND dia_cierre_mensual <= 28));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS usa_ultimo_dia_mes BOOLEAN DEFAULT false;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dias_vencimiento INTEGER DEFAULT 7
    CHECK (dias_vencimiento >= 0 AND dias_vencimiento <= 90);

-- =====================================================
-- 2. Comentarios descriptivos
-- =====================================================

COMMENT ON COLUMN clients.dia_cierre_semanal IS
  'Día de la semana para cierre semanal: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo';

COMMENT ON COLUMN clients.dia_cierre_mensual IS
  'Día del mes para cierre mensual (1-28). Se usa rango 1-28 para evitar problemas con febrero.';

COMMENT ON COLUMN clients.usa_ultimo_dia_mes IS
  'Si es TRUE, el cierre mensual se realiza el último día del mes (28, 29, 30 o 31 según corresponda)';

COMMENT ON COLUMN clients.dias_vencimiento IS
  'Cantidad de días después del cierre en que vence la liquidación. Por defecto 7 días.';

-- =====================================================
-- 3. Migrar datos de clientes existentes con CC
-- =====================================================

-- Clientes con acuerdo SEMANAL → Viernes por defecto
UPDATE clients
SET
  dia_cierre_semanal = 5,
  dias_vencimiento = 7
WHERE tiene_cuenta_corriente = true
  AND acuerdo_pago = 'Semanal'
  AND dia_cierre_semanal IS NULL;

-- Clientes con acuerdo MENSUAL → Último día del mes por defecto
UPDATE clients
SET
  usa_ultimo_dia_mes = true,
  dias_vencimiento = 7
WHERE tiene_cuenta_corriente = true
  AND acuerdo_pago = 'Mensual'
  AND usa_ultimo_dia_mes = false
  AND dia_cierre_mensual IS NULL;

-- Clientes con acuerdo QUINCENAL → Solo días de vencimiento
UPDATE clients
SET dias_vencimiento = 7
WHERE tiene_cuenta_corriente = true
  AND acuerdo_pago = 'Quincenal'
  AND dias_vencimiento IS NULL;

-- =====================================================
-- 4. Agregar constraints de validación
-- =====================================================

-- Si el acuerdo es Semanal, debe tener dia_cierre_semanal configurado
ALTER TABLE clients
  ADD CONSTRAINT check_semanal_config
    CHECK (
      (acuerdo_pago != 'Semanal') OR
      (acuerdo_pago = 'Semanal' AND dia_cierre_semanal IS NOT NULL)
    );

-- Si el acuerdo es Mensual, debe tener dia_cierre_mensual O usa_ultimo_dia_mes = true
ALTER TABLE clients
  ADD CONSTRAINT check_mensual_config
    CHECK (
      (acuerdo_pago != 'Mensual') OR
      (acuerdo_pago = 'Mensual' AND (dia_cierre_mensual IS NOT NULL OR usa_ultimo_dia_mes = true))
    );

-- Si usa_ultimo_dia_mes es true, dia_cierre_mensual debe ser NULL
ALTER TABLE clients
  ADD CONSTRAINT check_ultimo_dia_exclusivo
    CHECK (
      (usa_ultimo_dia_mes = false) OR
      (usa_ultimo_dia_mes = true AND dia_cierre_mensual IS NULL)
    );
