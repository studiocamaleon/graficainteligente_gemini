/*
  # Creación de Tablas para Módulo de Pedidos/Órdenes de Trabajo

  ## Descripción
  Este migration crea todas las tablas necesarias para gestionar pedidos/órdenes
  de trabajo, incluyendo las opciones seleccionadas por el cliente y las rutas
  de producción resueltas.

  ## Nuevas Tablas

  ### 1. pedidos
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `producto_id` (uuid, foreign key to productos)
  - `cliente_id` (uuid, foreign key to clients)
  - `numero_pedido` (text, generado automáticamente, único por company)
  - `cantidad` (integer, cantidad de unidades)
  - `estado` (text: 'borrador', 'confirmado', 'en_produccion', 'completado', 'cancelado')
  - `fecha_pedido` (date)
  - `fecha_entrega_estimada` (date, nullable)
  - `fecha_entrega_real` (date, nullable)
  - `opciones_seleccionadas` (jsonb, todas las opciones del cliente)
  - `notas` (text, nullable)
  - `precio_total` (numeric, nullable)
  - `created_by` (uuid, foreign key to profiles)
  - `updated_by` (uuid, foreign key to profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. pedidos_opciones
  - `id` (uuid, primary key)
  - `pedido_id` (uuid, foreign key to pedidos)
  - `tipo_opcion` (text: 'servicio', 'acabado', 'tecnologia', 'material')
  - `opcion_id` (uuid, ID del servicio/acabado/tecnología/material)
  - `opcion_nombre` (text, nombre para referencia)
  - `tiene_nivel` (boolean)
  - `nivel_id` (uuid, nullable)
  - `nivel_nombre` (text, nullable)
  - `valores_adicionales` (jsonb, datos específicos como tintas, espesores, etc)
  - `created_at` (timestamptz)

  ### 3. pedidos_rutas_resueltas
  - `id` (uuid, primary key)
  - `pedido_id` (uuid, foreign key to pedidos)
  - `tipo_etapa` (text: 'pre_prensa', 'principal', 'post_prensa')
  - `paso_id` (uuid, foreign key to pasos, nullable)
  - `grupo_paso_id` (uuid, foreign key to grupos_pasos, nullable)
  - `paso_nombre` (text, nombre del paso para referencia)
  - `orden` (integer)
  - `estado_paso` (text: 'pendiente', 'en_proceso', 'completado', 'omitido')
  - `origen_condicion` (jsonb, metadata de por qué se agregó este paso)
  - `fecha_inicio` (timestamptz, nullable)
  - `fecha_fin` (timestamptz, nullable)
  - `responsable_id` (uuid, foreign key to profiles, nullable)
  - `notas` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id del usuario autenticado

  ## Índices
  - Índices en company_id, producto_id, cliente_id, estado
  - Índices en foreign keys para optimizar joins
  - Índice único en numero_pedido por company
*/

-- =====================================================
-- 1. TABLA PEDIDOS
-- =====================================================

CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  numero_pedido text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_pedido date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_estimada date,
  fecha_entrega_real date,
  opciones_seleccionadas jsonb DEFAULT '{}'::jsonb NOT NULL,
  notas text,
  precio_total numeric(12,2),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_estado_pedido CHECK (estado IN (
    'borrador', 'confirmado', 'en_produccion', 'completado', 'cancelado'
  )),
  CONSTRAINT check_fechas_coherentes CHECK (
    fecha_entrega_estimada IS NULL OR fecha_entrega_estimada >= fecha_pedido
  ),
  CONSTRAINT unique_numero_pedido_por_company UNIQUE(company_id, numero_pedido)
);

-- =====================================================
-- 2. TABLA PEDIDOS OPCIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS pedidos_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo_opcion text NOT NULL,
  opcion_id uuid NOT NULL,
  opcion_nombre text NOT NULL,
  tiene_nivel boolean DEFAULT false NOT NULL,
  nivel_id uuid,
  nivel_nombre text,
  valores_adicionales jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT check_tipo_opcion CHECK (tipo_opcion IN (
    'servicio', 'acabado', 'tecnologia', 'material'
  )),
  CONSTRAINT check_nivel_coherencia CHECK (
    (tiene_nivel = false) OR
    (tiene_nivel = true AND nivel_id IS NOT NULL AND nivel_nombre IS NOT NULL)
  )
);

-- =====================================================
-- 3. TABLA PEDIDOS RUTAS RESUELTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS pedidos_rutas_resueltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo_etapa text NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE SET NULL,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE SET NULL,
  paso_nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  estado_paso text NOT NULL DEFAULT 'pendiente',
  origen_condicion jsonb DEFAULT '{}'::jsonb,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  responsable_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT check_tipo_etapa_rutas_resueltas CHECK (tipo_etapa IN (
    'pre_prensa', 'principal', 'post_prensa'
  )),
  CONSTRAINT check_estado_paso CHECK (estado_paso IN (
    'pendiente', 'en_proceso', 'completado', 'omitido'
  )),
  CONSTRAINT check_fechas_paso_coherentes CHECK (
    fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio
  )
);

-- =====================================================
-- 4. CONFIGURAR RLS - PEDIDOS
-- =====================================================

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company pedidos"
  ON pedidos FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company pedidos"
  ON pedidos FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company pedidos"
  ON pedidos FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- 5. CONFIGURAR RLS - PEDIDOS OPCIONES
-- =====================================================

ALTER TABLE pedidos_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pedidos_opciones"
  ON pedidos_opciones FOR SELECT
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company pedidos_opciones"
  ON pedidos_opciones FOR INSERT
  TO authenticated
  WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company pedidos_opciones"
  ON pedidos_opciones FOR UPDATE
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company pedidos_opciones"
  ON pedidos_opciones FOR DELETE
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 6. CONFIGURAR RLS - PEDIDOS RUTAS RESUELTAS
-- =====================================================

ALTER TABLE pedidos_rutas_resueltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pedidos_rutas_resueltas"
  ON pedidos_rutas_resueltas FOR SELECT
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company pedidos_rutas_resueltas"
  ON pedidos_rutas_resueltas FOR INSERT
  TO authenticated
  WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company pedidos_rutas_resueltas"
  ON pedidos_rutas_resueltas FOR UPDATE
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company pedidos_rutas_resueltas"
  ON pedidos_rutas_resueltas FOR DELETE
  TO authenticated
  USING (pedido_id IN (SELECT id FROM pedidos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 7. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pedidos_company_id ON pedidos(company_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_producto_id ON pedidos(producto_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_pedido ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_numero_pedido ON pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_by ON pedidos(created_by);

CREATE INDEX IF NOT EXISTS idx_pedidos_opciones_pedido_id ON pedidos_opciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_opciones_tipo_opcion ON pedidos_opciones(tipo_opcion);
CREATE INDEX IF NOT EXISTS idx_pedidos_opciones_opcion_id ON pedidos_opciones(opcion_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_pedido_id ON pedidos_rutas_resueltas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_tipo_etapa ON pedidos_rutas_resueltas(tipo_etapa);
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_orden ON pedidos_rutas_resueltas(orden);
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_estado_paso ON pedidos_rutas_resueltas(estado_paso);
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_paso_id ON pedidos_rutas_resueltas(paso_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_rutas_resueltas_responsable_id ON pedidos_rutas_resueltas(responsable_id);

-- =====================================================
-- 8. CREAR TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION update_pedidos_updated_at();

CREATE TRIGGER trigger_update_pedidos_rutas_resueltas_updated_at
  BEFORE UPDATE ON pedidos_rutas_resueltas
  FOR EACH ROW
  EXECUTE FUNCTION update_pedidos_updated_at();

-- =====================================================
-- 9. FUNCIÓN PARA GENERAR NÚMERO DE PEDIDO
-- =====================================================

CREATE OR REPLACE FUNCTION generar_numero_pedido(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_year text;
  v_counter integer;
  v_numero text;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(numero_pedido FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_counter
  FROM pedidos
  WHERE company_id = p_company_id
    AND numero_pedido LIKE 'PED-' || v_year || '-%';
  
  v_numero := 'PED-' || v_year || '-' || LPAD(v_counter::text, 6, '0');
  
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;
