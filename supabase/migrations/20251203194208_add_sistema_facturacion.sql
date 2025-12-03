/*
  # Sistema de Facturación para Órdenes de Trabajo

  ## Descripción General
  Implementa un sistema completo para gestionar facturas de órdenes de trabajo:
  - Registro de si una orden requiere facturación
  - Almacenamiento del monto de IVA calculado
  - Gestión de archivos PDF de facturas
  - Auditoría completa de operaciones
  - Notificaciones automáticas al cliente

  ## Cambios en este archivo

  ### 1. Nuevos Campos en ordenes_trabajo
  - `requiere_factura` (boolean): Indica si el cliente solicitó factura
  - `subtotal_iva` (numeric): Monto del IVA calculado (21%)
  - `facturada` (boolean): Indica si ya se cargó la factura
  - `fecha_facturacion` (timestamptz): Cuándo se cargó la factura
  - `numero_factura` (text): Número de factura fiscal asignado
  - `factura_storage_path` (text): Ruta del archivo en storage

  ### 2. Nueva Tabla: facturas_historial
  Registro de auditoría de todas las operaciones sobre facturas:
  - Creación, reemplazo, anulación
  - Incluye montos (subtotal, IVA, total)
  - Trazabilidad completa (quién, cuándo, por qué)

  ### 3. Storage Bucket: facturas
  Bucket privado para almacenar archivos PDF de facturas:
  - Estructura: {company_id}/{orden_id}/{timestamp}_{filename}.pdf
  - RLS por company_id
  - Políticas para SELECT, INSERT, UPDATE, DELETE

  ## Seguridad
  - RLS habilitado en facturas_historial
  - Storage policies restrictivas por company_id
  - Acceso solo a facturas de la propia empresa
  - Auditoría de todas las operaciones

  ## Índices
  - Índices parciales para órdenes que requieren factura
  - Índices para órdenes pendientes de facturación
  - Índices para búsquedas en historial
  - Optimización de consultas frecuentes

  ## Notas Importantes
  - Campos son compatibles con órdenes existentes (defaults apropiados)
  - IVA calculado en frontend pero persistido en BD
  - Sistema preparado para notificaciones WhatsApp automáticas
  - Backward compatible: órdenes existentes tendrán requiere_factura=false
*/

-- =====================================================
-- 1. AGREGAR CAMPOS A ordenes_trabajo
-- =====================================================

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS requiere_factura boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS subtotal_iva numeric DEFAULT 0 NOT NULL CHECK (subtotal_iva >= 0),
  ADD COLUMN IF NOT EXISTS facturada boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fecha_facturacion timestamptz,
  ADD COLUMN IF NOT EXISTS numero_factura text,
  ADD COLUMN IF NOT EXISTS factura_storage_path text;

-- Comentarios descriptivos
COMMENT ON COLUMN ordenes_trabajo.requiere_factura IS 'Indica si el cliente solicitó factura para esta orden';
COMMENT ON COLUMN ordenes_trabajo.subtotal_iva IS 'Monto del IVA calculado (21% del subtotal con descuento)';
COMMENT ON COLUMN ordenes_trabajo.facturada IS 'Indica si ya se cargó el archivo de factura';
COMMENT ON COLUMN ordenes_trabajo.fecha_facturacion IS 'Fecha y hora en que se cargó la factura';
COMMENT ON COLUMN ordenes_trabajo.numero_factura IS 'Número de factura fiscal asignado';
COMMENT ON COLUMN ordenes_trabajo.factura_storage_path IS 'Ruta del archivo PDF en Supabase Storage';

-- =====================================================
-- 2. ÍNDICES PARA OPTIMIZAR CONSULTAS
-- =====================================================

-- Índice para consultar órdenes que requieren factura
CREATE INDEX IF NOT EXISTS idx_ordenes_requiere_factura
  ON ordenes_trabajo(company_id, requiere_factura)
  WHERE requiere_factura = true;

-- Índice para consultar órdenes pendientes de facturación (query más frecuente)
CREATE INDEX IF NOT EXISTS idx_ordenes_pendientes_facturacion
  ON ordenes_trabajo(company_id, requiere_factura, facturada)
  WHERE requiere_factura = true AND facturada = false;

-- Índice para consultar órdenes ya facturadas (con fecha para ordenamiento)
CREATE INDEX IF NOT EXISTS idx_ordenes_facturadas
  ON ordenes_trabajo(company_id, facturada, fecha_facturacion DESC)
  WHERE facturada = true;

-- Índice para búsquedas por número de factura
CREATE INDEX IF NOT EXISTS idx_ordenes_numero_factura
  ON ordenes_trabajo(company_id, numero_factura)
  WHERE numero_factura IS NOT NULL;

-- =====================================================
-- 3. TABLA: facturas_historial
-- =====================================================

-- Tabla para auditoría de facturas
CREATE TABLE IF NOT EXISTS facturas_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero_factura text NOT NULL,
  monto_subtotal numeric NOT NULL CHECK (monto_subtotal >= 0),
  monto_iva numeric NOT NULL CHECK (monto_iva >= 0),
  monto_total numeric NOT NULL CHECK (monto_total >= 0),
  factura_storage_path text NOT NULL,
  tipo_operacion text NOT NULL CHECK (tipo_operacion IN ('creacion', 'reemplazo', 'anulacion')),
  observaciones text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para facturas_historial
CREATE INDEX IF NOT EXISTS idx_facturas_historial_orden
  ON facturas_historial(orden_id);

CREATE INDEX IF NOT EXISTS idx_facturas_historial_company
  ON facturas_historial(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facturas_historial_numero
  ON facturas_historial(company_id, numero_factura);

-- Comentario descriptivo
COMMENT ON TABLE facturas_historial IS 'Registro de auditoría de todas las operaciones sobre facturas (creación, reemplazo, anulación)';
COMMENT ON COLUMN facturas_historial.tipo_operacion IS 'Tipo de operación: creacion (primera vez), reemplazo (cambio de factura), anulacion (factura anulada)';
COMMENT ON COLUMN facturas_historial.monto_subtotal IS 'Subtotal de la orden con descuentos aplicados (sin IVA)';
COMMENT ON COLUMN facturas_historial.monto_iva IS 'Monto del IVA aplicado';
COMMENT ON COLUMN facturas_historial.monto_total IS 'Total facturado (subtotal + IVA)';

-- =====================================================
-- 4. RLS PARA facturas_historial
-- =====================================================

ALTER TABLE facturas_historial ENABLE ROW LEVEL SECURITY;

-- Policy: Ver facturas de la propia empresa
CREATE POLICY "Users can view own company facturas historial"
  ON facturas_historial FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policy: Insertar facturas en la propia empresa
CREATE POLICY "Users can insert own company facturas historial"
  ON facturas_historial FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policy: No se permite UPDATE ni DELETE (solo INSERT para auditoría)
-- Si en el futuro se requiere modificar, se pueden agregar policies específicas

-- =====================================================
-- 5. STORAGE BUCKET PARA FACTURAS
-- =====================================================

-- Crear bucket para facturas (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas', 'facturas', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. POLÍTICAS DE ACCESO AL BUCKET
-- =====================================================

-- Policy: Ver facturas de la propia empresa
CREATE POLICY "Users can view own company facturas"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Subir facturas a la propia empresa
CREATE POLICY "Users can upload own company facturas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Actualizar facturas de la propia empresa
CREATE POLICY "Users can update own company facturas"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Eliminar facturas de la propia empresa
CREATE POLICY "Users can delete own company facturas"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 7. DATOS INICIALES Y RETROCOMPATIBILIDAD
-- =====================================================

-- Actualizar órdenes existentes para asegurar valores por defecto
UPDATE ordenes_trabajo
SET
  requiere_factura = COALESCE(requiere_factura, false),
  subtotal_iva = COALESCE(subtotal_iva, 0),
  facturada = COALESCE(facturada, false)
WHERE requiere_factura IS NULL
   OR subtotal_iva IS NULL
   OR facturada IS NULL;

-- =====================================================
-- FIN DE MIGRACIÓN: Sistema de Facturación - Fase 1
-- =====================================================
