/*
  # Creación de Tablas para Módulo de Catálogo de Productos

  ## Descripción
  Este migration crea todas las tablas necesarias para el módulo de Catálogo,
  incluyendo productos, rangos de precio, y todas las relaciones con tecnologías,
  materiales, servicios, acabados, pricing y rutas de producción.

  ## Nuevas Tablas

  ### 1. rangos_precio
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `rangos` (jsonb, estructura: [{min: number, max: number, descuento: number}])
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `categoria_id` (uuid, foreign key to categorias)
  - `nombre` (text, required)
  - `medidas_ancho` (numeric, required)
  - `medidas_alto` (numeric, required)
  - `caras_impresas` (text, required: 'solo_frente' o 'frente_y_dorso')
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. productos_tecnologias
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `tecnologia_id` (uuid, foreign key to tecnologias)
  - `tintas` (text array, opcional)
  - `created_at` (timestamptz)
  - UNIQUE constraint en (producto_id, tecnologia_id)

  ### 4. productos_materiales
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `material_id` (uuid, foreign key to materiales)
  - `variante_nombre` (text, required)
  - `espesores` (jsonb array, opcional)
  - `created_at` (timestamptz)

  ### 5. productos_servicios
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `servicio_id` (uuid, foreign key to servicios)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - UNIQUE constraint en (producto_id, servicio_id)

  ### 6. productos_acabados
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `acabado_id` (uuid, foreign key to acabados)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - UNIQUE constraint en (producto_id, acabado_id)

  ### 7. productos_pricing
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos, unique)
  - `unidad_pricing` (text, required: 'por_unidad', 'cantidades_fijas', 'mt2', 'mt_lineal')
  - `tiene_descuento` (boolean, default false)
  - `cantidades_fijas` (jsonb array, opcional)
  - `rango_precio_id` (uuid, foreign key to rangos_precio, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. productos_rutas_produccion
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `tipo_etapa` (text, required: 'pre_prensa', 'principal', 'post_prensa')
  - `paso_id` (uuid, foreign key to pasos, nullable)
  - `grupo_paso_id` (uuid, foreign key to grupos_pasos, nullable)
  - `orden` (integer, required)
  - `created_at` (timestamptz)

  ## Seguridad
  - Se habilita RLS en todas las tablas
  - Políticas restrictivas por company_id del usuario autenticado
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índices en company_id para todas las tablas
  - Índices en foreign keys para optimizar joins
  - Índices en campos de búsqueda (nombre, is_active)
*/

-- =====================================================
-- 1. RANGOS DE PRECIO
-- =====================================================

CREATE TABLE IF NOT EXISTS rangos_precio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  rangos jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE rangos_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company rangos_precio"
  ON rangos_precio FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company rangos_precio"
  ON rangos_precio FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company rangos_precio"
  ON rangos_precio FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company rangos_precio"
  ON rangos_precio FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rangos_precio_company_id ON rangos_precio(company_id);
CREATE INDEX IF NOT EXISTS idx_rangos_precio_nombre ON rangos_precio(nombre);

-- =====================================================
-- 2. PRODUCTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  medidas_ancho numeric NOT NULL,
  medidas_alto numeric NOT NULL,
  caras_impresas text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_caras_impresas CHECK (caras_impresas IN ('solo_frente', 'frente_y_dorso')),
  CONSTRAINT check_medidas_positivas CHECK (medidas_ancho > 0 AND medidas_alto > 0),
  CONSTRAINT unique_producto_nombre_por_categoria UNIQUE(company_id, categoria_id, nombre)
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos"
  ON productos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company productos"
  ON productos FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company productos"
  ON productos FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company productos"
  ON productos FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_productos_company_id ON productos(company_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_is_active ON productos(is_active);

-- =====================================================
-- 3. PRODUCTOS TECNOLOGÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE RESTRICT,
  tintas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(producto_id, tecnologia_id)
);

ALTER TABLE productos_tecnologias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_tecnologias"
  ON productos_tecnologias FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_tecnologias"
  ON productos_tecnologias FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_tecnologias"
  ON productos_tecnologias FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_tecnologias"
  ON productos_tecnologias FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_tecnologias_producto_id ON productos_tecnologias(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_tecnologias_tecnologia_id ON productos_tecnologias(tecnologia_id);

-- =====================================================
-- 4. PRODUCTOS MATERIALES
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  variante_nombre text NOT NULL,
  espesores jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE productos_materiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_materiales"
  ON productos_materiales FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_materiales"
  ON productos_materiales FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_materiales"
  ON productos_materiales FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_materiales"
  ON productos_materiales FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_materiales_producto_id ON productos_materiales(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_materiales_material_id ON productos_materiales(material_id);

-- =====================================================
-- 5. PRODUCTOS SERVICIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(producto_id, servicio_id)
);

ALTER TABLE productos_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_servicios"
  ON productos_servicios FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_servicios"
  ON productos_servicios FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_servicios"
  ON productos_servicios FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_servicios"
  ON productos_servicios FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_servicios_producto_id ON productos_servicios(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_servicios_servicio_id ON productos_servicios(servicio_id);

-- =====================================================
-- 6. PRODUCTOS ACABADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE RESTRICT,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(producto_id, acabado_id)
);

ALTER TABLE productos_acabados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_acabados"
  ON productos_acabados FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_acabados"
  ON productos_acabados FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_acabados"
  ON productos_acabados FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_acabados"
  ON productos_acabados FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_acabados_producto_id ON productos_acabados(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_acabados_acabado_id ON productos_acabados(acabado_id);

-- =====================================================
-- 7. PRODUCTOS PRICING
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE UNIQUE,
  unidad_pricing text NOT NULL,
  tiene_descuento boolean DEFAULT false NOT NULL,
  cantidades_fijas jsonb DEFAULT '[]'::jsonb,
  rango_precio_id uuid REFERENCES rangos_precio(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_unidad_pricing CHECK (unidad_pricing IN ('por_unidad', 'cantidades_fijas', 'mt2', 'mt_lineal'))
);

ALTER TABLE productos_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_pricing"
  ON productos_pricing FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_pricing"
  ON productos_pricing FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_pricing"
  ON productos_pricing FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_pricing"
  ON productos_pricing FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_pricing_producto_id ON productos_pricing(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_pricing_rango_precio_id ON productos_pricing(rango_precio_id);

-- =====================================================
-- 8. PRODUCTOS RUTAS DE PRODUCCIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_rutas_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo_etapa text NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_tipo_etapa CHECK (tipo_etapa IN ('pre_prensa', 'principal', 'post_prensa')),
  CONSTRAINT check_paso_o_grupo_ruta CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  )
);

ALTER TABLE productos_rutas_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_rutas_produccion"
  ON productos_rutas_produccion FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_rutas_produccion"
  ON productos_rutas_produccion FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_rutas_produccion"
  ON productos_rutas_produccion FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_rutas_produccion"
  ON productos_rutas_produccion FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_productos_rutas_produccion_producto_id ON productos_rutas_produccion(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_produccion_paso_id ON productos_rutas_produccion(paso_id);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_produccion_grupo_paso_id ON productos_rutas_produccion(grupo_paso_id);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_produccion_tipo_etapa ON productos_rutas_produccion(tipo_etapa);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_produccion_orden ON productos_rutas_produccion(orden);
