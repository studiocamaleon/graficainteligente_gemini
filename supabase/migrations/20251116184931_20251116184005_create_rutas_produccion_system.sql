/*
  # Sistema de Rutas de Producción Reutilizables

  ## Descripción
  Este migration crea el sistema completo de Rutas de Producción como plantillas reutilizables
  que pueden ser asignadas a productos. Las rutas definen flujos de trabajo a través de las
  5 etapas fundamentales de producción, con soporte para pasos obligatorios y condicionales.

  ## Nuevas Tablas

  ### 1. rutas_produccion
  Plantillas maestras de rutas de producción reutilizables.

  **Campos:**
  - `id` (uuid, primary key) - Identificador único
  - `company_id` (uuid, foreign key) - Empresa propietaria
  - `nombre` (text, required) - Nombre descriptivo de la ruta
  - `descripcion` (text, optional) - Descripción detallada
  - `is_active` (boolean, default true) - Estado activo/inactivo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ### 2. rutas_produccion_pasos
  Define los pasos específicos de cada ruta organizados por etapa.

  **Campos:**
  - `id` (uuid, primary key) - Identificador único
  - `ruta_id` (uuid, foreign key) - Referencia a la ruta
  - `etapa` (text, required) - Etapa: Pre-prensa, Produccion, Terminacion, Instalacion, Entrega
  - `paso_id` (uuid, foreign key) - Referencia al paso
  - `orden` (integer, required) - Orden dentro de la etapa
  - `es_obligatorio` (boolean, default true) - Si es obligatorio o condicional
  - `tipo_condicion` (text, nullable) - Tipo de condición si es condicional
  - `configuracion_condicion` (jsonb, nullable) - Configuración detallada de la condición
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización

  ## Tipos de Condiciones Soportadas

  ### sin_condicion
  Paso obligatorio que siempre se ejecuta.
  ```json
  null o {}
  ```

  ### servicio_sin_nivel
  Se ejecuta si el cliente elige un servicio específico (sin niveles de precio).
  ```json
  {
    "servicio_id": "uuid-del-servicio"
  }
  ```
  El paso se obtiene de la tabla `servicios_pasos`.

  ### servicio_con_nivel
  Se ejecuta si el cliente elige un servicio con un nivel de precio específico.
  ```json
  {
    "servicio_id": "uuid-del-servicio",
    "mapeo_niveles": {
      "nivel_id_1": "paso_id_1",
      "nivel_id_2": "paso_id_2"
    }
  }
  ```
  Cada nivel de precio puede tener un paso diferente.

  ### acabado_sin_nivel
  Se ejecuta si el cliente elige un acabado específico (sin niveles de precio).
  ```json
  {
    "acabado_id": "uuid-del-acabado"
  }
  ```
  El paso se obtiene de la tabla `acabados_pasos`.

  ### acabado_con_nivel
  Se ejecuta si el cliente elige un acabado con un nivel de precio específico.
  ```json
  {
    "acabado_id": "uuid-del-acabado",
    "mapeo_niveles": {
      "nivel_id_1": "paso_id_1",
      "nivel_id_2": "paso_id_2"
    }
  }
  ```
  Cada nivel de precio puede tener un paso diferente.

  ### tecnologia_tinta
  Se ejecuta según la combinación de tecnología + tinta configurada.
  ```json
  {
    "tecnologia_id": "uuid-de-tecnologia",
    "tinta": "CMYK"
  }
  ```
  El paso se obtiene de la tabla `tecnologias_tintas_pasos`.

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id del usuario autenticado
  - Políticas separadas para SELECT, INSERT, UPDATE, DELETE

  ## Índices
  - Índices en company_id para filtrado por empresa
  - Índices en foreign keys para optimizar joins
  - Índices compuestos en (ruta_id, etapa, orden) para consultas ordenadas
*/

-- =====================================================
-- 1. TABLA: rutas_produccion
-- =====================================================

CREATE TABLE IF NOT EXISTS rutas_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE rutas_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company rutas_produccion"
  ON rutas_produccion FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company rutas_produccion"
  ON rutas_produccion FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company rutas_produccion"
  ON rutas_produccion FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company rutas_produccion"
  ON rutas_produccion FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rutas_produccion_company_id ON rutas_produccion(company_id);
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_nombre ON rutas_produccion(nombre);
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_is_active ON rutas_produccion(is_active);

-- =====================================================
-- 2. TABLA: rutas_produccion_pasos
-- =====================================================

CREATE TABLE IF NOT EXISTS rutas_produccion_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id uuid NOT NULL REFERENCES rutas_produccion(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  paso_id uuid NOT NULL REFERENCES pasos(id) ON DELETE RESTRICT,
  orden integer NOT NULL DEFAULT 0,
  es_obligatorio boolean DEFAULT true NOT NULL,
  tipo_condicion text,
  configuracion_condicion jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraint: Etapa debe ser una de las 5 válidas
  CONSTRAINT check_etapa CHECK (etapa IN (
    'Pre-prensa',
    'Produccion',
    'Terminacion',
    'Instalacion',
    'Entrega'
  )),

  -- Constraint: Tipo de condición debe ser válido
  CONSTRAINT check_tipo_condicion CHECK (
    tipo_condicion IS NULL OR tipo_condicion IN (
      'sin_condicion',
      'servicio_sin_nivel',
      'servicio_con_nivel',
      'acabado_sin_nivel',
      'acabado_con_nivel',
      'tecnologia_tinta'
    )
  ),

  -- Constraint: Coherencia entre es_obligatorio y tipo_condicion
  CONSTRAINT check_obligatorio_condicion CHECK (
    (es_obligatorio = true AND (tipo_condicion IS NULL OR tipo_condicion = 'sin_condicion')) OR
    (es_obligatorio = false AND tipo_condicion IS NOT NULL AND tipo_condicion != 'sin_condicion')
  ),

  -- Constraint: Unique constraint para evitar duplicados de paso en la misma etapa de la misma ruta
  CONSTRAINT unique_ruta_etapa_paso UNIQUE(ruta_id, etapa, paso_id, orden)
);

ALTER TABLE rutas_produccion_pasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company rutas_produccion_pasos"
  ON rutas_produccion_pasos FOR SELECT
  TO authenticated
  USING (
    ruta_id IN (
      SELECT id FROM rutas_produccion
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own company rutas_produccion_pasos"
  ON rutas_produccion_pasos FOR INSERT
  TO authenticated
  WITH CHECK (
    ruta_id IN (
      SELECT id FROM rutas_produccion
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own company rutas_produccion_pasos"
  ON rutas_produccion_pasos FOR UPDATE
  TO authenticated
  USING (
    ruta_id IN (
      SELECT id FROM rutas_produccion
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    ruta_id IN (
      SELECT id FROM rutas_produccion
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own company rutas_produccion_pasos"
  ON rutas_produccion_pasos FOR DELETE
  TO authenticated
  USING (
    ruta_id IN (
      SELECT id FROM rutas_produccion
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_rutas_produccion_pasos_ruta_id ON rutas_produccion_pasos(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_pasos_etapa ON rutas_produccion_pasos(etapa);
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_pasos_paso_id ON rutas_produccion_pasos(paso_id);
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_pasos_tipo_condicion ON rutas_produccion_pasos(tipo_condicion);

-- Índice compuesto para consultas ordenadas por ruta y etapa
CREATE INDEX IF NOT EXISTS idx_rutas_produccion_pasos_ruta_etapa_orden
  ON rutas_produccion_pasos(ruta_id, etapa, orden);

-- =====================================================
-- 3. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_rutas_produccion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rutas_produccion_updated_at
  BEFORE UPDATE ON rutas_produccion
  FOR EACH ROW
  EXECUTE FUNCTION update_rutas_produccion_updated_at();

CREATE TRIGGER trigger_update_rutas_produccion_pasos_updated_at
  BEFORE UPDATE ON rutas_produccion_pasos
  FOR EACH ROW
  EXECUTE FUNCTION update_rutas_produccion_updated_at();

-- =====================================================
-- 4. FUNCIONES AUXILIARES
-- =====================================================

-- Función para contar pasos de una ruta por etapa
CREATE OR REPLACE FUNCTION count_pasos_por_etapa(p_ruta_id uuid, p_etapa text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM rutas_produccion_pasos
  WHERE ruta_id = p_ruta_id AND etapa = p_etapa;
$$;

-- Función para verificar si una ruta tiene al menos un paso en cada etapa
CREATE OR REPLACE FUNCTION validate_ruta_completitud(p_ruta_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_etapas text[] := ARRAY['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion', 'Entrega'];
  v_etapa text;
  v_count integer;
BEGIN
  FOREACH v_etapa IN ARRAY v_etapas
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM rutas_produccion_pasos
    WHERE ruta_id = p_ruta_id AND etapa = v_etapa;

    IF v_count = 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Función para obtener el total de pasos de una ruta
CREATE OR REPLACE FUNCTION get_total_pasos_ruta(p_ruta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM rutas_produccion_pasos
  WHERE ruta_id = p_ruta_id;
$$;

-- =====================================================
-- 5. COMENTARIOS EN LA BASE DE DATOS
-- =====================================================

COMMENT ON TABLE rutas_produccion IS
  'Plantillas maestras de rutas de producción reutilizables que definen flujos de trabajo completos.';

COMMENT ON COLUMN rutas_produccion.nombre IS
  'Nombre descriptivo de la ruta (ej: "Ruta Gran Formato Estándar", "Ruta Impresión Láser Premium")';

COMMENT ON TABLE rutas_produccion_pasos IS
  'Define los pasos específicos de cada ruta organizados por las 5 etapas de producción, con soporte para pasos obligatorios y condicionales.';

COMMENT ON COLUMN rutas_produccion_pasos.es_obligatorio IS
  'Si true, el paso siempre se ejecuta. Si false, el paso es condicional y depende de tipo_condicion.';

COMMENT ON COLUMN rutas_produccion_pasos.tipo_condicion IS
  'Tipo de condición: sin_condicion, servicio_sin_nivel, servicio_con_nivel, acabado_sin_nivel, acabado_con_nivel, tecnologia_tinta';

COMMENT ON COLUMN rutas_produccion_pasos.configuracion_condicion IS
  'Configuración JSON específica para cada tipo de condición que determina cuándo se ejecuta el paso.';

COMMENT ON FUNCTION validate_ruta_completitud IS
  'Verifica si una ruta tiene al menos un paso definido en cada una de las 5 etapas de producción.';
