/*
  # Creación de Tablas ABM Core

  ## Descripción
  Este migration crea todas las tablas necesarias para el sistema ABM Core, incluyendo:
  tecnologías, materiales, estaciones de trabajo, pasos, grupos de pasos, categorías,
  servicios y acabados.

  ## Nuevas Tablas

  ### 1. estaciones_trabajo
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `descripcion` (text, optional)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. tecnologias
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `tintas` (text array, para almacenar: K, CMYK, CMYK+W, CMYK+V, CMYK+W+V)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. materiales
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `aplica_espesor` (boolean, default false)
  - `unidad_espesor` (text, nullable: 'gr' o 'mm')
  - `variantes` (jsonb, array de objetos: {nombre: string, espesores: number[]})
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. pasos
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `etapa` (text, required: Pre-prensa, Produccion, Terminacion, Instalacion, Entrega)
  - `estacion_id` (uuid, foreign key to estaciones_trabajo)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. grupos_pasos
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. grupos_pasos_items (tabla relacional)
  - `id` (uuid, primary key)
  - `grupo_paso_id` (uuid, foreign key to grupos_pasos)
  - `paso_id` (uuid, foreign key to pasos)
  - `orden` (integer, para mantener secuencia)
  - `created_at` (timestamptz)

  ### 7. categorias
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `descripcion` (text, optional)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. servicios
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `nombre` (text, required)
  - `categoria_id` (uuid, foreign key to categorias)
  - `estacion_id` (uuid, foreign key to estaciones_trabajo)
  - `disponible_independiente` (boolean, default false)
  - `tiene_niveles_precio` (boolean, default false)
  - `tipo_impacto` (text, nullable si tiene niveles)
  - `valor_impacto` (numeric, nullable si tiene niveles)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. servicios_niveles_precio
  - `id` (uuid, primary key)
  - `servicio_id` (uuid, foreign key to servicios)
  - `nombre` (text, required)
  - `tipo_impacto` (text, required)
  - `valor_impacto` (numeric, required)
  - `paso_id` (uuid, nullable, foreign key to pasos)
  - `grupo_paso_id` (uuid, nullable, foreign key to grupos_pasos)
  - `orden` (integer)
  - `created_at` (timestamptz)

  ### 10. servicios_pasos (relación cuando no tiene niveles)
  - `id` (uuid, primary key)
  - `servicio_id` (uuid, foreign key to servicios)
  - `paso_id` (uuid, nullable, foreign key to pasos)
  - `grupo_paso_id` (uuid, nullable, foreign key to grupos_pasos)
  - `created_at` (timestamptz)

  ### 11. acabados (misma estructura que servicios)
  ### 12. acabados_niveles_precio (misma estructura que servicios_niveles_precio)
  ### 13. acabados_pasos (misma estructura que servicios_pasos)

  ## Seguridad
  - Se habilita RLS en todas las tablas
  - Políticas restrictivas por company_id del usuario autenticado
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índices en company_id para todas las tablas
  - Índices en foreign keys para optimizar joins
  - Índices en campos de búsqueda (nombre)
*/

-- =====================================================
-- 1. ESTACIONES DE TRABAJO
-- =====================================================

CREATE TABLE IF NOT EXISTS estaciones_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE estaciones_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company estaciones"
  ON estaciones_trabajo FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company estaciones"
  ON estaciones_trabajo FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company estaciones"
  ON estaciones_trabajo FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company estaciones"
  ON estaciones_trabajo FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_estaciones_trabajo_company_id ON estaciones_trabajo(company_id);
CREATE INDEX IF NOT EXISTS idx_estaciones_trabajo_nombre ON estaciones_trabajo(nombre);

-- =====================================================
-- 2. TECNOLOGÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tintas text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tecnologias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company tecnologias"
  ON tecnologias FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company tecnologias"
  ON tecnologias FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company tecnologias"
  ON tecnologias FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company tecnologias"
  ON tecnologias FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tecnologias_company_id ON tecnologias(company_id);
CREATE INDEX IF NOT EXISTS idx_tecnologias_nombre ON tecnologias(nombre);

-- =====================================================
-- 3. MATERIALES
-- =====================================================

CREATE TABLE IF NOT EXISTS materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  aplica_espesor boolean DEFAULT false NOT NULL,
  unidad_espesor text,
  variantes jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_unidad_espesor CHECK (unidad_espesor IS NULL OR unidad_espesor IN ('gr', 'mm'))
);

ALTER TABLE materiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company materiales"
  ON materiales FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company materiales"
  ON materiales FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company materiales"
  ON materiales FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company materiales"
  ON materiales FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_materiales_company_id ON materiales(company_id);
CREATE INDEX IF NOT EXISTS idx_materiales_nombre ON materiales(nombre);

-- =====================================================
-- 4. PASOS
-- =====================================================

CREATE TABLE IF NOT EXISTS pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  etapa text NOT NULL,
  estacion_id uuid NOT NULL REFERENCES estaciones_trabajo(id) ON DELETE RESTRICT,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_etapa CHECK (etapa IN ('Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion', 'Entrega'))
);

ALTER TABLE pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pasos"
  ON pasos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company pasos"
  ON pasos FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company pasos"
  ON pasos FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company pasos"
  ON pasos FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pasos_company_id ON pasos(company_id);
CREATE INDEX IF NOT EXISTS idx_pasos_estacion_id ON pasos(estacion_id);
CREATE INDEX IF NOT EXISTS idx_pasos_etapa ON pasos(etapa);
CREATE INDEX IF NOT EXISTS idx_pasos_nombre ON pasos(nombre);

-- =====================================================
-- 5. GRUPOS DE PASOS
-- =====================================================

CREATE TABLE IF NOT EXISTS grupos_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE grupos_pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company grupos_pasos"
  ON grupos_pasos FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company grupos_pasos"
  ON grupos_pasos FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company grupos_pasos"
  ON grupos_pasos FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company grupos_pasos"
  ON grupos_pasos FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_grupos_pasos_company_id ON grupos_pasos(company_id);
CREATE INDEX IF NOT EXISTS idx_grupos_pasos_nombre ON grupos_pasos(nombre);

-- =====================================================
-- 6. GRUPOS PASOS ITEMS (Tabla Relacional)
-- =====================================================

CREATE TABLE IF NOT EXISTS grupos_pasos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_paso_id uuid NOT NULL REFERENCES grupos_pasos(id) ON DELETE CASCADE,
  paso_id uuid NOT NULL REFERENCES pasos(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(grupo_paso_id, paso_id)
);

ALTER TABLE grupos_pasos_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company grupos_pasos_items"
  ON grupos_pasos_items FOR SELECT
  TO authenticated
  USING (grupo_paso_id IN (SELECT id FROM grupos_pasos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company grupos_pasos_items"
  ON grupos_pasos_items FOR INSERT
  TO authenticated
  WITH CHECK (grupo_paso_id IN (SELECT id FROM grupos_pasos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company grupos_pasos_items"
  ON grupos_pasos_items FOR UPDATE
  TO authenticated
  USING (grupo_paso_id IN (SELECT id FROM grupos_pasos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (grupo_paso_id IN (SELECT id FROM grupos_pasos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company grupos_pasos_items"
  ON grupos_pasos_items FOR DELETE
  TO authenticated
  USING (grupo_paso_id IN (SELECT id FROM grupos_pasos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_grupos_pasos_items_grupo_paso_id ON grupos_pasos_items(grupo_paso_id);
CREATE INDEX IF NOT EXISTS idx_grupos_pasos_items_paso_id ON grupos_pasos_items(paso_id);
CREATE INDEX IF NOT EXISTS idx_grupos_pasos_items_orden ON grupos_pasos_items(orden);

-- =====================================================
-- 7. CATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company categorias"
  ON categorias FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company categorias"
  ON categorias FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company categorias"
  ON categorias FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company categorias"
  ON categorias FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_categorias_company_id ON categorias(company_id);
CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre);

-- =====================================================
-- 8. SERVICIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES estaciones_trabajo(id) ON DELETE RESTRICT,
  disponible_independiente boolean DEFAULT false NOT NULL,
  tiene_niveles_precio boolean DEFAULT false NOT NULL,
  tipo_impacto text,
  valor_impacto numeric,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_tipo_impacto CHECK (tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal'
  ))
);

ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company servicios"
  ON servicios FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company servicios"
  ON servicios FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company servicios"
  ON servicios FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company servicios"
  ON servicios FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_servicios_company_id ON servicios(company_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categoria_id ON servicios(categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicios_estacion_id ON servicios(estacion_id);
CREATE INDEX IF NOT EXISTS idx_servicios_nombre ON servicios(nombre);

-- =====================================================
-- 9. SERVICIOS NIVELES PRECIO
-- =====================================================

CREATE TABLE IF NOT EXISTS servicios_niveles_precio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_impacto text NOT NULL,
  valor_impacto numeric NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_nivel_tipo_impacto CHECK (tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal'
  )),
  CONSTRAINT check_paso_o_grupo CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  )
);

ALTER TABLE servicios_niveles_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company servicios_niveles_precio"
  ON servicios_niveles_precio FOR SELECT
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company servicios_niveles_precio"
  ON servicios_niveles_precio FOR INSERT
  TO authenticated
  WITH CHECK (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company servicios_niveles_precio"
  ON servicios_niveles_precio FOR UPDATE
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company servicios_niveles_precio"
  ON servicios_niveles_precio FOR DELETE
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_servicios_niveles_precio_servicio_id ON servicios_niveles_precio(servicio_id);
CREATE INDEX IF NOT EXISTS idx_servicios_niveles_precio_orden ON servicios_niveles_precio(orden);

-- =====================================================
-- 10. SERVICIOS PASOS
-- =====================================================

CREATE TABLE IF NOT EXISTS servicios_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_servicios_pasos_paso_o_grupo CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  )
);

ALTER TABLE servicios_pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company servicios_pasos"
  ON servicios_pasos FOR SELECT
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company servicios_pasos"
  ON servicios_pasos FOR INSERT
  TO authenticated
  WITH CHECK (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company servicios_pasos"
  ON servicios_pasos FOR UPDATE
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company servicios_pasos"
  ON servicios_pasos FOR DELETE
  TO authenticated
  USING (servicio_id IN (SELECT id FROM servicios WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_servicios_pasos_servicio_id ON servicios_pasos(servicio_id);
CREATE INDEX IF NOT EXISTS idx_servicios_pasos_paso_id ON servicios_pasos(paso_id);
CREATE INDEX IF NOT EXISTS idx_servicios_pasos_grupo_paso_id ON servicios_pasos(grupo_paso_id);

-- =====================================================
-- 11. ACABADOS (igual a servicios)
-- =====================================================

CREATE TABLE IF NOT EXISTS acabados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES estaciones_trabajo(id) ON DELETE RESTRICT,
  disponible_independiente boolean DEFAULT false NOT NULL,
  tiene_niveles_precio boolean DEFAULT false NOT NULL,
  tipo_impacto text,
  valor_impacto numeric,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_acabados_tipo_impacto CHECK (tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal'
  ))
);

ALTER TABLE acabados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company acabados"
  ON acabados FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company acabados"
  ON acabados FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company acabados"
  ON acabados FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company acabados"
  ON acabados FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_acabados_company_id ON acabados(company_id);
CREATE INDEX IF NOT EXISTS idx_acabados_categoria_id ON acabados(categoria_id);
CREATE INDEX IF NOT EXISTS idx_acabados_estacion_id ON acabados(estacion_id);
CREATE INDEX IF NOT EXISTS idx_acabados_nombre ON acabados(nombre);

-- =====================================================
-- 12. ACABADOS NIVELES PRECIO
-- =====================================================

CREATE TABLE IF NOT EXISTS acabados_niveles_precio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_impacto text NOT NULL,
  valor_impacto numeric NOT NULL,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_acabados_nivel_tipo_impacto CHECK (tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal'
  )),
  CONSTRAINT check_acabados_paso_o_grupo CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  )
);

ALTER TABLE acabados_niveles_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company acabados_niveles_precio"
  ON acabados_niveles_precio FOR SELECT
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company acabados_niveles_precio"
  ON acabados_niveles_precio FOR INSERT
  TO authenticated
  WITH CHECK (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company acabados_niveles_precio"
  ON acabados_niveles_precio FOR UPDATE
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company acabados_niveles_precio"
  ON acabados_niveles_precio FOR DELETE
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_acabados_niveles_precio_acabado_id ON acabados_niveles_precio(acabado_id);
CREATE INDEX IF NOT EXISTS idx_acabados_niveles_precio_orden ON acabados_niveles_precio(orden);

-- =====================================================
-- 13. ACABADOS PASOS
-- =====================================================

CREATE TABLE IF NOT EXISTS acabados_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acabado_id uuid NOT NULL REFERENCES acabados(id) ON DELETE CASCADE,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_acabados_pasos_paso_o_grupo CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL)
  )
);

ALTER TABLE acabados_pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company acabados_pasos"
  ON acabados_pasos FOR SELECT
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company acabados_pasos"
  ON acabados_pasos FOR INSERT
  TO authenticated
  WITH CHECK (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company acabados_pasos"
  ON acabados_pasos FOR UPDATE
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company acabados_pasos"
  ON acabados_pasos FOR DELETE
  TO authenticated
  USING (acabado_id IN (SELECT id FROM acabados WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_acabados_pasos_acabado_id ON acabados_pasos(acabado_id);
CREATE INDEX IF NOT EXISTS idx_acabados_pasos_paso_id ON acabados_pasos(paso_id);
CREATE INDEX IF NOT EXISTS idx_acabados_pasos_grupo_paso_id ON acabados_pasos(grupo_paso_id);