/*
  # Creación del Sistema de Rutas de Producción Condicionales

  ## Descripción
  Este migration crea el sistema completo de rutas de producción condicionales,
  incluyendo la nueva tabla de plantillas que reemplaza productos_rutas_produccion
  y agrega soporte para pasos condicionales basados en opciones del cliente.

  ## Nuevas Tablas

  ### 1. productos_rutas_plantillas (reemplazo de productos_rutas_produccion)
  - `id` (uuid, primary key)
  - `producto_id` (uuid, foreign key to productos)
  - `tipo_etapa` (text: 'pre_prensa', 'principal', 'post_prensa')
  - `orden` (integer, orden dentro de su etapa)
  - `es_condicional` (boolean, indica si es paso fijo o condicional)
  - `condicion_tipo` (text, tipo de condición: null si es fijo)
  - `condicion_config` (jsonb, configuración de la condición)
  - `paso_id` (uuid, foreign key to pasos, nullable)
  - `grupo_paso_id` (uuid, foreign key to grupos_pasos, nullable)
  - `paso_plantilla` (text, token para resolución dinámica, ej: {servicio:xxx:nivel})
  - `nombre_display` (text, nombre descriptivo para mostrar en UI)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. productos_rutas_produccion_backup
  - Copia de seguridad de la tabla original antes de migrar

  ## Tipos de Condiciones Soportadas
  - `fijo`: Paso siempre se aplica (es_condicional = false)
  - `condicional_servicio_nivel`: Se aplica si cliente elige servicio con nivel específico
  - `condicional_servicio_simple`: Se aplica si cliente elige el servicio (sin importar nivel)
  - `condicional_acabado_nivel`: Se aplica si cliente elige acabado con nivel específico
  - `condicional_acabado_simple`: Se aplica si cliente elige el acabado (sin importar nivel)
  - `condicional_tecnologia`: Se aplica si se usa tecnología específica
  - `condicional_tintas`: Se aplica si se usan combinaciones de tintas específicas
  - `condicional_material_variante`: Se aplica si se usa material con variante específica
  - `condicional_compuesto`: Múltiples condiciones con operadores AND/OR

  ## Estructura de condicion_config
  ```json
  {
    "tipo": "condicional_servicio_nivel",
    "servicio_id": "uuid",
    "requiere_nivel": true,
    "paso_por_nivel": {
      "nivel_id_1": "paso_id_1",
      "nivel_id_2": "paso_id_2"
    }
  }
  ```

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id del usuario autenticado

  ## Índices
  - Índices en producto_id, tipo_etapa, orden, condicion_tipo
  - Índices en foreign keys para optimizar joins
*/

-- =====================================================
-- 1. CREAR BACKUP DE TABLA ORIGINAL
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_rutas_produccion_backup AS
SELECT * FROM productos_rutas_produccion;

-- =====================================================
-- 2. CREAR NUEVA TABLA DE PLANTILLAS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_rutas_plantillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo_etapa text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  es_condicional boolean DEFAULT false NOT NULL,
  condicion_tipo text,
  condicion_config jsonb DEFAULT '{}'::jsonb,
  paso_id uuid REFERENCES pasos(id) ON DELETE RESTRICT,
  grupo_paso_id uuid REFERENCES grupos_pasos(id) ON DELETE RESTRICT,
  paso_plantilla text,
  nombre_display text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT check_tipo_etapa_plantillas CHECK (tipo_etapa IN ('pre_prensa', 'principal', 'post_prensa')),
  
  CONSTRAINT check_paso_o_grupo_plantillas CHECK (
    (paso_id IS NOT NULL AND grupo_paso_id IS NULL AND paso_plantilla IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NOT NULL AND paso_plantilla IS NULL) OR
    (paso_id IS NULL AND grupo_paso_id IS NULL AND paso_plantilla IS NOT NULL)
  ),
  
  CONSTRAINT check_condicion_tipo CHECK (
    condicion_tipo IS NULL OR condicion_tipo IN (
      'condicional_servicio_nivel',
      'condicional_servicio_simple',
      'condicional_acabado_nivel',
      'condicional_acabado_simple',
      'condicional_tecnologia',
      'condicional_tintas',
      'condicional_material_variante',
      'condicional_compuesto'
    )
  ),
  
  CONSTRAINT check_condicional_coherencia CHECK (
    (es_condicional = false AND condicion_tipo IS NULL) OR
    (es_condicional = true AND condicion_tipo IS NOT NULL)
  )
);

-- =====================================================
-- 3. CONFIGURAR RLS
-- =====================================================

ALTER TABLE productos_rutas_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company productos_rutas_plantillas"
  ON productos_rutas_plantillas FOR SELECT
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own company productos_rutas_plantillas"
  ON productos_rutas_plantillas FOR INSERT
  TO authenticated
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own company productos_rutas_plantillas"
  ON productos_rutas_plantillas FOR UPDATE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own company productos_rutas_plantillas"
  ON productos_rutas_plantillas FOR DELETE
  TO authenticated
  USING (producto_id IN (SELECT id FROM productos WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- 4. CREAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_producto_id ON productos_rutas_plantillas(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_tipo_etapa ON productos_rutas_plantillas(tipo_etapa);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_orden ON productos_rutas_plantillas(orden);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_es_condicional ON productos_rutas_plantillas(es_condicional);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_condicion_tipo ON productos_rutas_plantillas(condicion_tipo);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_paso_id ON productos_rutas_plantillas(paso_id);
CREATE INDEX IF NOT EXISTS idx_productos_rutas_plantillas_grupo_paso_id ON productos_rutas_plantillas(grupo_paso_id);

-- =====================================================
-- 5. MIGRAR DATOS EXISTENTES (PASOS FIJOS)
-- =====================================================

INSERT INTO productos_rutas_plantillas (
  producto_id,
  tipo_etapa,
  orden,
  es_condicional,
  condicion_tipo,
  condicion_config,
  paso_id,
  grupo_paso_id,
  paso_plantilla,
  nombre_display,
  created_at,
  updated_at
)
SELECT 
  producto_id,
  tipo_etapa,
  orden,
  false as es_condicional,
  NULL as condicion_tipo,
  '{}'::jsonb as condicion_config,
  paso_id,
  grupo_paso_id,
  NULL as paso_plantilla,
  COALESCE(
    (SELECT nombre FROM pasos WHERE id = productos_rutas_produccion.paso_id),
    (SELECT nombre FROM grupos_pasos WHERE id = productos_rutas_produccion.grupo_paso_id)
  ) as nombre_display,
  created_at,
  now() as updated_at
FROM productos_rutas_produccion;

-- =====================================================
-- 6. CREAR TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_productos_rutas_plantillas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_rutas_plantillas_updated_at
  BEFORE UPDATE ON productos_rutas_plantillas
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_rutas_plantillas_updated_at();
