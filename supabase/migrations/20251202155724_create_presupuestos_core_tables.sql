/*
  # Módulo de Negociación - Fase 1: Tablas Core de Presupuestos

  ## Descripción
  Este módulo permite gestionar presupuestos/cotizaciones de manera independiente a las órdenes de trabajo,
  con capacidad de tracking público, aprobación/rechazo por clientes, y conversión automática a órdenes.

  ## 1. Tablas Nuevas
  
  ### `presupuestos`
  Tabla principal para gestionar presupuestos/cotizaciones
  - `id` (uuid, PK)
  - `company_id` (uuid, FK → companies)
  - `cliente_id` (uuid, FK → clients)
  - `numero_presupuesto` (text, único por company)
  - `vendedor_id` (uuid, FK → profiles)
  - `canal_venta` (text: Web, WhatsApp, Mostrador)
  - `estado` (text: borrador, pendiente, enviado, aprobado, rechazado, convertido, vencido)
  - Fechas: creación, validez, enviado, respuesta, vencimiento_auto
  - `tracking_token` (varchar(32), único para acceso público)
  - Montos: subtotal, total_descuentos, total
  - `condiciones_comerciales` (text)
  - `notas_internas` (text)
  - `observaciones_cliente` (text, comentarios al aprobar/rechazar)
  - `orden_trabajo_id` (uuid, FK → ordenes_trabajo, si ya se convirtió)
  - `pdf_path` (text, ruta en storage)
  - `pdf_url` (text, URL pública temporal)
  - Auditoría: created_by, updated_by, created_at, updated_at

  ### `presupuestos_items`
  Items/líneas del presupuesto (productos del sistema o personalizados)
  - `id` (uuid, PK)
  - `presupuesto_id` (uuid, FK → presupuestos)
  - `tipo_item` (text: producto_sistema, item_personalizado)
  - `producto_id` (uuid, nullable, solo si tipo_item = producto_sistema)
  - `producto_nombre` (text, guardado para histórico)
  - `producto_categoria` (text)
  - `configuracion` (jsonb, configuración del producto)
  - Cantidades y precios: cantidad, precio_base, precio_servicios, precio_acabados, precio_unitario_final, precio_total
  - `descripcion` (text, útil para items personalizados)
  - `tiempo_produccion_dias` (integer, para dar expectativas)

  ### `presupuestos_condiciones_comerciales`
  Templates configurables de condiciones comerciales
  - `id` (uuid, PK)
  - `company_id` (uuid, FK → companies)
  - `nombre` (text, nombre del template)
  - `contenido` (text, texto de condiciones, soporta markdown)
  - `es_default` (boolean)
  - `orden` (integer, para ordenar en selects)
  - `is_active` (boolean)

  ### `presupuestos_archivos`
  Archivos adjuntos a presupuestos (referencias, ejemplos, etc.)
  - Similar a ordenes_trabajo_archivos
  - Soporte para archivos temporales antes de crear presupuesto

  ### `presupuestos_historial`
  Auditoría de cambios en presupuestos
  - `id` (uuid, PK)
  - `presupuesto_id` (uuid, FK → presupuestos)
  - `accion` (text: creado, modificado, enviado, aprobado, etc.)
  - `estado_anterior`, `estado_nuevo` (text)
  - `usuario_id` (uuid, FK → profiles)
  - `detalles` (jsonb, información adicional)

  ## 2. Seguridad
  - RLS habilitado en todas las tablas
  - Políticas por company_id para multi-tenancy
  - Función pública para tracking sin autenticación

  ## 3. Notas Importantes
  - Números de presupuesto auto-generados por company
  - Tracking tokens únicos de 32 caracteres
  - Soft delete recomendado (agregar is_deleted si necesario)
  - Triggers para actualizar totales automáticamente
*/

-- ============================================================================
-- TABLA: presupuestos
-- ============================================================================
CREATE TABLE IF NOT EXISTS presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  cliente_id uuid NOT NULL REFERENCES clients(id),
  numero_presupuesto text NOT NULL,
  vendedor_id uuid NOT NULL REFERENCES profiles(id),
  canal_venta text NOT NULL CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN (
    'borrador', 'pendiente', 'enviado', 'aprobado',
    'rechazado', 'convertido', 'vencido'
  )),

  -- Fechas
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_validez timestamptz, -- Hasta cuándo es válido
  fecha_enviado timestamptz, -- Cuándo se envió al cliente
  fecha_respuesta timestamptz, -- Cuándo respondió el cliente
  fecha_vencimiento_auto timestamptz, -- Para auto-vencer

  -- Tracking público
  tracking_token varchar(32) UNIQUE,

  -- Montos
  subtotal numeric NOT NULL DEFAULT 0,
  total_descuentos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,

  -- Condiciones comerciales (texto libre o template)
  condiciones_comerciales text,
  notas_internas text,
  observaciones_cliente text, -- Comentarios del cliente al aprobar/rechazar

  -- Conversión
  orden_trabajo_id uuid REFERENCES ordenes_trabajo(id), -- Si ya se convirtió

  -- Archivos
  pdf_path text, -- Path del PDF en storage
  pdf_url text, -- URL pública temporal

  -- Auditoría
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT presupuestos_numero_unique UNIQUE (company_id, numero_presupuesto),
  CONSTRAINT check_subtotal_positivo CHECK (subtotal >= 0),
  CONSTRAINT check_total_positivo CHECK (total >= 0),
  CONSTRAINT check_fecha_validez CHECK (fecha_validez IS NULL OR fecha_validez > fecha_creacion),
  CONSTRAINT check_tracking_token_format CHECK (
    tracking_token IS NULL OR
    (length(tracking_token) = 32 AND tracking_token ~ '^[A-Z0-9]{32}$')
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_presupuestos_company_id ON presupuestos(company_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente_id ON presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_vendedor_id ON presupuestos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha_creacion ON presupuestos(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_presupuestos_tracking_token ON presupuestos(tracking_token) WHERE tracking_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_orden_trabajo_id ON presupuestos(orden_trabajo_id) WHERE orden_trabajo_id IS NOT NULL;

-- ============================================================================
-- TABLA: presupuestos_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS presupuestos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,

  -- Tipo de item
  tipo_item text NOT NULL DEFAULT 'producto_sistema' CHECK (tipo_item IN (
    'producto_sistema', -- Item del catálogo
    'item_personalizado' -- Item ingresado manualmente
  )),

  -- Si es producto del sistema
  producto_id uuid, -- Nullable, solo si tipo_item = 'producto_sistema'
  producto_nombre text NOT NULL, -- Siempre se guarda para histórico
  producto_categoria text, -- Categoría para histórico

  -- Configuración (para productos del sistema)
  configuracion jsonb NOT NULL DEFAULT '{}',

  -- Cantidades y precios
  cantidad numeric NOT NULL,
  precio_base numeric NOT NULL DEFAULT 0,
  precio_servicios numeric NOT NULL DEFAULT 0,
  precio_acabados numeric NOT NULL DEFAULT 0,
  precio_unitario_final numeric NOT NULL DEFAULT 0,
  precio_total numeric NOT NULL DEFAULT 0,

  -- Descripción adicional (útil para items personalizados)
  descripcion text,

  -- Tiempos estimados (para dar expectativas al cliente)
  tiempo_produccion_dias integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_producto_sistema CHECK (
    (tipo_item = 'producto_sistema' AND producto_id IS NOT NULL) OR
    (tipo_item = 'item_personalizado' AND producto_id IS NULL)
  ),
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_precios_positivos CHECK (
    precio_base >= 0 AND
    precio_servicios >= 0 AND
    precio_acabados >= 0 AND
    precio_unitario_final >= 0 AND
    precio_total >= 0
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_items_presupuesto_id ON presupuestos_items(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_items_producto_id ON presupuestos_items(producto_id) WHERE producto_id IS NOT NULL;

-- ============================================================================
-- TABLA: presupuestos_condiciones_comerciales
-- ============================================================================
CREATE TABLE IF NOT EXISTS presupuestos_condiciones_comerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  nombre text NOT NULL,
  contenido text NOT NULL,
  es_default boolean DEFAULT false,
  orden integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT condiciones_nombre_unique UNIQUE (company_id, nombre)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_condiciones_company_id ON presupuestos_condiciones_comerciales(company_id);
CREATE INDEX IF NOT EXISTS idx_condiciones_es_default ON presupuestos_condiciones_comerciales(es_default) WHERE es_default = true;
CREATE INDEX IF NOT EXISTS idx_condiciones_is_active ON presupuestos_condiciones_comerciales(is_active) WHERE is_active = true;

-- ============================================================================
-- TABLA: presupuestos_archivos
-- ============================================================================
CREATE TABLE IF NOT EXISTS presupuestos_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid REFERENCES presupuestos(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),

  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  descripcion text,

  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),

  -- Soporte para archivos temporales (antes de crear presupuesto)
  presupuesto_temporal_id uuid,
  temporal_creado_en timestamptz,

  CONSTRAINT check_presupuesto_o_temporal CHECK (
    presupuesto_id IS NOT NULL OR presupuesto_temporal_id IS NOT NULL
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_archivos_presupuesto_id ON presupuestos_archivos(presupuesto_id) WHERE presupuesto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_archivos_temporal ON presupuestos_archivos(presupuesto_temporal_id) WHERE presupuesto_temporal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_archivos_company_id ON presupuestos_archivos(company_id);

-- ============================================================================
-- TABLA: presupuestos_historial
-- ============================================================================
CREATE TABLE IF NOT EXISTS presupuestos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  accion text NOT NULL, -- 'creado', 'modificado', 'enviado', 'aprobado', etc.
  estado_anterior text,
  estado_nuevo text,
  usuario_id uuid REFERENCES profiles(id),
  detalles jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_historial_presupuesto_id ON presupuestos_historial(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_historial_created_at ON presupuestos_historial(created_at DESC);

-- ============================================================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_condiciones_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_historial ENABLE ROW LEVEL SECURITY;
