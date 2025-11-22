/*
  # Sistema de Archivos y Links para Órdenes de Trabajo

  ## Resumen
  Este sistema permite a los usuarios adjuntar archivos y links a las órdenes de trabajo,
  con dos categorías separadas:
  1. Archivos del Cliente: Material recibido del cliente
  2. Archivos de Producción: Archivos procesados y listos para producir
  3. Links: Enlaces externos (WeTransfer, Google Drive, etc.)

  ## Nuevas Tablas

  ### 1. ordenes_trabajo_archivos
  Almacena archivos enviados por el cliente
  - Límite: 500MB por archivo, 1GB total por orden
  - Eliminación: 5 días después de completar la orden

  ### 2. ordenes_trabajo_archivos_produccion
  Almacena archivos procesados listos para producción
  - Límite: 500MB por archivo, 1GB total por orden (separado)
  - Versionado de archivos
  - Solo personal autorizado puede subir
  - Eliminación: 5 días después de completar la orden

  ### 3. ordenes_trabajo_links
  Almacena links externos compartidos por el cliente
  - Sin límite de cantidad
  - Se eliminan 5 días después de completar la orden

  ### 4. archivos_pendientes_eliminacion
  Control de eliminación automática de archivos
  - Se pobla cuando una orden se completa
  - Edge Function procesa eliminaciones diariamente

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Filtrado por company_id
  - Permisos específicos por role para archivos de producción
  - Storage buckets privados con políticas específicas

  ## Políticas de Eliminación
  - Todos los archivos y links se eliminan automáticamente 5 días después
    de que la orden se marca como completada
  - Los usuarios reciben advertencias visuales antes de la eliminación
  - La eliminación es irreversible
*/

-- =====================================================
-- 1. TABLA: ordenes_trabajo_archivos (Archivos Cliente)
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  descripcion text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT check_tamano_archivo_valido CHECK (tamano_bytes > 0 AND tamano_bytes <= 524288000)
);

CREATE INDEX IF NOT EXISTS idx_archivos_orden ON ordenes_trabajo_archivos(orden_id, company_id);
CREATE INDEX IF NOT EXISTS idx_archivos_uploaded_by ON ordenes_trabajo_archivos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_archivos_created ON ordenes_trabajo_archivos(created_at DESC);

ALTER TABLE ordenes_trabajo_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view archivos from their company"
  ON ordenes_trabajo_archivos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert archivos for their company"
  ON ordenes_trabajo_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete their own archivos or admins can delete any"
  ON ordenes_trabajo_archivos
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- =====================================================
-- 2. TABLA: ordenes_trabajo_archivos_produccion
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_archivos_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  version integer DEFAULT 1,
  reemplaza_a uuid REFERENCES ordenes_trabajo_archivos_produccion(id),
  etiquetas text[],
  notas text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT check_tamano_archivo_produccion_valido CHECK (tamano_bytes > 0 AND tamano_bytes <= 524288000),
  CONSTRAINT check_version_positiva CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_archivos_prod_orden ON ordenes_trabajo_archivos_produccion(orden_id, company_id);
CREATE INDEX IF NOT EXISTS idx_archivos_prod_uploaded_by ON ordenes_trabajo_archivos_produccion(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_archivos_prod_version ON ordenes_trabajo_archivos_produccion(reemplaza_a);
CREATE INDEX IF NOT EXISTS idx_archivos_prod_created ON ordenes_trabajo_archivos_produccion(created_at DESC);

ALTER TABLE ordenes_trabajo_archivos_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view archivos produccion from their company"
  ON ordenes_trabajo_archivos_produccion
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can insert archivos produccion"
  ON ordenes_trabajo_archivos_produccion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('operator', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete their own archivos produccion or admins can delete any"
  ON ordenes_trabajo_archivos_produccion
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- =====================================================
-- 3. TABLA: ordenes_trabajo_links
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  url text NOT NULL,
  descripcion text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT check_url_valida CHECK (url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_links_orden ON ordenes_trabajo_links(orden_id, company_id);
CREATE INDEX IF NOT EXISTS idx_links_created_by ON ordenes_trabajo_links(created_by);
CREATE INDEX IF NOT EXISTS idx_links_created ON ordenes_trabajo_links(created_at DESC);

ALTER TABLE ordenes_trabajo_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links from their company"
  ON ordenes_trabajo_links
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert links for their company"
  ON ordenes_trabajo_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own links"
  ON ordenes_trabajo_links
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own links or admins can delete any"
  ON ordenes_trabajo_links
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- =====================================================
-- 4. TABLA: archivos_pendientes_eliminacion
-- =====================================================

CREATE TABLE IF NOT EXISTS archivos_pendientes_eliminacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id uuid NOT NULL,
  orden_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo_recurso text NOT NULL CHECK (tipo_recurso IN ('archivo_cliente', 'archivo_produccion', 'link')),
  storage_path text,
  fecha_orden_completada timestamptz NOT NULL,
  fecha_eliminacion_programada timestamptz NOT NULL,
  eliminado boolean DEFAULT false,
  fecha_eliminacion timestamptz,
  error_eliminacion text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pendientes_eliminacion_fecha ON archivos_pendientes_eliminacion(fecha_eliminacion_programada, eliminado);
CREATE INDEX IF NOT EXISTS idx_pendientes_eliminacion_company ON archivos_pendientes_eliminacion(company_id, eliminado);
CREATE INDEX IF NOT EXISTS idx_pendientes_eliminacion_orden ON archivos_pendientes_eliminacion(orden_id);

ALTER TABLE archivos_pendientes_eliminacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pending deletions from their company"
  ON archivos_pendientes_eliminacion
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 5. FUNCIONES DE VALIDACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION fn_validar_limite_total_archivos_cliente()
RETURNS TRIGGER AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 1073741824;
BEGIN
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_actual
  FROM ordenes_trabajo_archivos
  WHERE orden_id = NEW.orden_id
    AND company_id = NEW.company_id;

  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'La orden ha alcanzado el límite de almacenamiento de 1GB para archivos de cliente. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_limite_archivos_cliente
  BEFORE INSERT ON ordenes_trabajo_archivos
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_limite_total_archivos_cliente();

CREATE OR REPLACE FUNCTION fn_validar_limite_total_archivos_produccion()
RETURNS TRIGGER AS $$
DECLARE
  v_total_actual bigint;
  v_limite_maximo bigint := 1073741824;
BEGIN
  SELECT COALESCE(SUM(tamano_bytes), 0)
  INTO v_total_actual
  FROM ordenes_trabajo_archivos_produccion
  WHERE orden_id = NEW.orden_id
    AND company_id = NEW.company_id;

  IF (v_total_actual + NEW.tamano_bytes) > v_limite_maximo THEN
    RAISE EXCEPTION 'La orden ha alcanzado el límite de almacenamiento de 1GB para archivos de producción. Espacio disponible: % MB',
      ROUND((v_limite_maximo - v_total_actual)::numeric / 1048576, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_limite_archivos_produccion
  BEFORE INSERT ON ordenes_trabajo_archivos_produccion
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_limite_total_archivos_produccion();

-- =====================================================
-- 6. FUNCIÓN: Marcar archivos para eliminación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_marcar_archivos_para_eliminacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregada' AND (OLD.estado IS NULL OR OLD.estado != 'entregada') THEN

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id,
      orden_id,
      company_id,
      tipo_recurso,
      storage_path,
      fecha_orden_completada,
      fecha_eliminacion_programada
    )
    SELECT
      id,
      orden_id,
      company_id,
      'archivo_cliente',
      storage_path,
      NOW(),
      NOW() + interval '5 days'
    FROM ordenes_trabajo_archivos
    WHERE orden_id = NEW.id;

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id,
      orden_id,
      company_id,
      tipo_recurso,
      storage_path,
      fecha_orden_completada,
      fecha_eliminacion_programada
    )
    SELECT
      id,
      orden_id,
      company_id,
      'archivo_produccion',
      storage_path,
      NOW(),
      NOW() + interval '5 days'
    FROM ordenes_trabajo_archivos_produccion
    WHERE orden_id = NEW.id;

    INSERT INTO archivos_pendientes_eliminacion (
      recurso_id,
      orden_id,
      company_id,
      tipo_recurso,
      storage_path,
      fecha_orden_completada,
      fecha_eliminacion_programada
    )
    SELECT
      id,
      orden_id,
      company_id,
      'link',
      NULL,
      NOW(),
      NOW() + interval '5 days'
    FROM ordenes_trabajo_links
    WHERE orden_id = NEW.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_marcar_archivos_eliminacion
  AFTER UPDATE ON ordenes_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION fn_marcar_archivos_para_eliminacion();

COMMENT ON TABLE ordenes_trabajo_archivos IS 'Archivos enviados por clientes adjuntos a órdenes de trabajo. Límite: 1GB total por orden.';
COMMENT ON TABLE ordenes_trabajo_archivos_produccion IS 'Archivos procesados listos para producción. Solo personal autorizado. Límite: 1GB total por orden.';
COMMENT ON TABLE ordenes_trabajo_links IS 'Links externos compartidos por clientes (WeTransfer, Google Drive, etc.)';
COMMENT ON TABLE archivos_pendientes_eliminacion IS 'Control de eliminación automática. Los recursos se eliminan 5 días después de completar la orden.';
