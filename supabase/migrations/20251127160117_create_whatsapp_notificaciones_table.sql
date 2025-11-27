/*
  # Tabla de Notificaciones de WhatsApp

  ## Descripción
  Sistema de registro y auditoría de todas las notificaciones enviadas por WhatsApp
  a clientes sobre órdenes de trabajo y órdenes de copiado.

  ## Nueva Tabla

  ### `whatsapp_notificaciones`
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key) - Empresa que envía la notificación
  - `orden_trabajo_id` (uuid, nullable, foreign key) - Referencia a orden de trabajo
  - `orden_copiado_id` (uuid, nullable, foreign key) - Referencia a orden de copiado
  - `tipo_notificacion` (text) - Tipo: nueva_orden_trabajo, nueva_orden_copiado, orden_finalizada
  - `telefono_destino` (text) - Número de WhatsApp del cliente
  - `mensaje_enviado` (text) - Contenido del mensaje enviado
  - `estado_envio` (text) - Estado: enviado, fallido
  - `error_mensaje` (text, nullable) - Mensaje de error si falla
  - `respuesta_backend` (jsonb, nullable) - Respuesta completa del backend
  - `created_at` (timestamptz) - Fecha de envío

  ## Seguridad
  - RLS habilitado para aislamiento multi-tenant
  - Solo usuarios autenticados de la empresa pueden ver sus notificaciones
  - Políticas restrictivas por company_id

  ## Índices
  - Índice en company_id para búsquedas rápidas
  - Índice en orden_trabajo_id
  - Índice en orden_copiado_id
  - Índice en tipo_notificacion para filtros
  - Índice en estado_envio para estadísticas
  - Índice en created_at para ordenamiento
*/

-- =====================================================
-- 1. CREAR TABLA whatsapp_notificaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS whatsapp_notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  orden_trabajo_id uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  orden_copiado_id uuid REFERENCES centro_copiado_ordenes(id) ON DELETE SET NULL,
  tipo_notificacion text NOT NULL CHECK (
    tipo_notificacion IN ('nueva_orden_trabajo', 'nueva_orden_copiado', 'orden_finalizada')
  ),
  telefono_destino text NOT NULL,
  mensaje_enviado text NOT NULL,
  estado_envio text NOT NULL CHECK (estado_envio IN ('enviado', 'fallido')),
  error_mensaje text,
  respuesta_backend jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Al menos una orden debe estar presente
  CHECK (
    (orden_trabajo_id IS NOT NULL AND orden_copiado_id IS NULL) OR
    (orden_trabajo_id IS NULL AND orden_copiado_id IS NOT NULL)
  )
);

-- =====================================================
-- 2. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_company_id 
  ON whatsapp_notificaciones(company_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_orden_trabajo_id 
  ON whatsapp_notificaciones(orden_trabajo_id) WHERE orden_trabajo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_orden_copiado_id 
  ON whatsapp_notificaciones(orden_copiado_id) WHERE orden_copiado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_tipo 
  ON whatsapp_notificaciones(company_id, tipo_notificacion);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_estado 
  ON whatsapp_notificaciones(company_id, estado_envio);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notificaciones_created_at 
  ON whatsapp_notificaciones(company_id, created_at DESC);

-- =====================================================
-- 3. HABILITAR ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE whatsapp_notificaciones ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. POLÍTICAS RLS
-- =====================================================

CREATE POLICY "Users can view own company notificaciones"
  ON whatsapp_notificaciones FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company notificaciones"
  ON whatsapp_notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- 5. COMENTARIOS
-- =====================================================

COMMENT ON TABLE whatsapp_notificaciones IS
'Registro de todas las notificaciones de WhatsApp enviadas a clientes sobre órdenes';

COMMENT ON COLUMN whatsapp_notificaciones.tipo_notificacion IS
'Tipo de notificación: nueva_orden_trabajo, nueva_orden_copiado, orden_finalizada';

COMMENT ON COLUMN whatsapp_notificaciones.estado_envio IS
'Estado del envío: enviado (exitoso), fallido (error)';

COMMENT ON COLUMN whatsapp_notificaciones.respuesta_backend IS
'Respuesta completa del backend de WhatsApp en formato JSON';
