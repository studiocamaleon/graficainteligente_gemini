/*
  # Sistema de Pagos para Órdenes de Copiado

  ## Descripción
  Implementa el sistema de registro de pagos para órdenes de copiado independientes.
  Las órdenes asociadas a órdenes de trabajo principales siguen gestionando sus pagos
  desde la orden de trabajo.

  ## Nuevas Tablas
  1. `centro_copiado_ordenes_pagos`
     - Tabla de pagos para órdenes de copiado
     - Incluye referencia a medios de cobro
     - Almacena comisiones y fechas de liberación estimadas
     - Solo aplica a órdenes independientes (sin orden_trabajo_id)

  ## Características
  - Integración con sistema de medios de cobro
  - Cálculo automático de comisiones
  - Tracking de fechas de liberación
  - Auditoría completa (created_by, created_at, updated_at)

  ## Seguridad
  - RLS habilitado
  - Políticas restrictivas por company_id
  - Solo usuarios autenticados de la misma empresa pueden operar
*/

-- ============================================================================
-- TABLA CENTRO_COPIADO_ORDENES_PAGOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS centro_copiado_ordenes_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_copiado_id uuid NOT NULL REFERENCES centro_copiado_ordenes(id) ON DELETE CASCADE,
  fecha_pago date NOT NULL,
  monto numeric(10,2) NOT NULL CHECK (monto > 0),
  medio_cobro_id uuid NOT NULL REFERENCES medios_cobro(id) ON DELETE RESTRICT,
  referencia_pago text,
  comision_aplicada numeric(10,2) DEFAULT 0 CHECK (comision_aplicada >= 0),
  fecha_liberacion_estimada date,
  notas text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_pagos_orden_id
  ON centro_copiado_ordenes_pagos(orden_copiado_id);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_pagos_fecha_pago
  ON centro_copiado_ordenes_pagos(fecha_pago);

CREATE INDEX IF NOT EXISTS idx_centro_copiado_ordenes_pagos_medio_cobro_id
  ON centro_copiado_ordenes_pagos(medio_cobro_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_centro_copiado_ordenes_pagos_updated_at
  BEFORE UPDATE ON centro_copiado_ordenes_pagos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE centro_copiado_ordenes_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ordenes copiado pagos"
  ON centro_copiado_ordenes_pagos FOR SELECT
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own company ordenes copiado pagos"
  ON centro_copiado_ordenes_pagos FOR INSERT
  TO authenticated
  WITH CHECK (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own company ordenes copiado pagos"
  ON centro_copiado_ordenes_pagos FOR UPDATE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own company ordenes copiado pagos"
  ON centro_copiado_ordenes_pagos FOR DELETE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE centro_copiado_ordenes_pagos IS
  'Registro de pagos para órdenes de copiado independientes. Las órdenes asociadas a órdenes de trabajo gestionan sus pagos desde ordenes_trabajo_pagos.';

COMMENT ON COLUMN centro_copiado_ordenes_pagos.orden_copiado_id IS
  'Referencia a la orden de copiado';

COMMENT ON COLUMN centro_copiado_ordenes_pagos.medio_cobro_id IS
  'Medio de cobro utilizado (efectivo, transferencia, etc.)';

COMMENT ON COLUMN centro_copiado_ordenes_pagos.comision_aplicada IS
  'Comisión aplicada según el medio de cobro seleccionado';

COMMENT ON COLUMN centro_copiado_ordenes_pagos.fecha_liberacion_estimada IS
  'Fecha estimada en que el dinero estará disponible según el medio de cobro';