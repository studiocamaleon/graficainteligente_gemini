/*
  # Sistema de Pausas en Producción - Fase 1: Base de Datos

  ## Descripción
  Implementa un sistema completo de pausas para pasos de producción que permite:
  - Pausar pasos con motivos categorizados
  - Registro histórico de todas las pausas
  - Múltiples ciclos de pausa/reanudación (ej: revisiones con cliente)
  - Cálculo de tiempo efectivo vs tiempo pausado
  - Notificaciones automáticas para pausas prolongadas

  ## Nuevas Tablas
  1. `pasos_motivos_pausa`: Catálogo de motivos configurables por empresa
  2. `ordenes_items_rutas_pausas`: Registro histórico de pausas
  3. `notificaciones_internas`: Sistema de notificaciones para super_admin/admin

  ## Modificaciones a Tablas Existentes
  - `ordenes_trabajo_items_rutas`:
    - Agrega estado 'pausado'
    - Campos de cálculo: tiempo_trabajo_efectivo, tiempo_pausado_total, cantidad_pausas

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por company_id
  - Notificaciones solo para super_admin y admin

  ## Casos de Uso Principales
  - Diseño enviado a revisión del cliente
  - Máquina averiada
  - Falta de materiales
  - Falta de personal

  Fecha: 2025-11-30
  Versión: 1.0
*/

-- =====================================================
-- 1. VERIFICAR Y CREAR FUNCIÓN HELPER
-- =====================================================

-- Función para actualizar updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS
'Función trigger genérica para actualizar automáticamente el campo updated_at';

-- =====================================================
-- 2. CREAR TABLA: pasos_motivos_pausa
-- =====================================================

CREATE TABLE IF NOT EXISTS pasos_motivos_pausa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN (
    'cliente',
    'materiales',
    'maquinaria',
    'personal',
    'externo',
    'otro'
  )),
  requiere_descripcion boolean DEFAULT false NOT NULL,
  color text DEFAULT '#6B7280',
  icono text,
  orden integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_motivo_nombre_por_company UNIQUE (company_id, nombre)
);

-- Índices para pasos_motivos_pausa
CREATE INDEX IF NOT EXISTS idx_motivos_pausa_company
  ON pasos_motivos_pausa(company_id);

CREATE INDEX IF NOT EXISTS idx_motivos_pausa_categoria
  ON pasos_motivos_pausa(categoria);

CREATE INDEX IF NOT EXISTS idx_motivos_pausa_activos
  ON pasos_motivos_pausa(company_id, is_active)
  WHERE is_active = true;

-- Trigger updated_at para pasos_motivos_pausa
DROP TRIGGER IF EXISTS trigger_motivos_pausa_updated_at ON pasos_motivos_pausa;

CREATE TRIGGER trigger_motivos_pausa_updated_at
  BEFORE UPDATE ON pasos_motivos_pausa
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS para pasos_motivos_pausa
ALTER TABLE pasos_motivos_pausa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own company motivos pausa" ON pasos_motivos_pausa;
CREATE POLICY "Users view own company motivos pausa"
  ON pasos_motivos_pausa FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage own company motivos pausa" ON pasos_motivos_pausa;
CREATE POLICY "Admins manage own company motivos pausa"
  ON pasos_motivos_pausa FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Comentarios
COMMENT ON TABLE pasos_motivos_pausa IS
'Catálogo de motivos de pausa configurables por empresa para pasos de producción';
COMMENT ON COLUMN pasos_motivos_pausa.categoria IS
'Categoría del motivo: cliente, materiales, maquinaria, personal, externo, otro';
COMMENT ON COLUMN pasos_motivos_pausa.requiere_descripcion IS
'Si TRUE, el operador debe proporcionar una descripción al pausar';
COMMENT ON COLUMN pasos_motivos_pausa.color IS
'Color hex para UI (#RRGGBB)';
COMMENT ON COLUMN pasos_motivos_pausa.orden IS
'Orden de visualización en listas y selectores';

-- =====================================================
-- 3. FUNCIÓN: fn_seed_motivos_pausa_default
-- =====================================================

CREATE OR REPLACE FUNCTION fn_seed_motivos_pausa_default(p_company_id uuid)
RETURNS void AS $$
BEGIN
  -- Solo insertar si no existen motivos para esta empresa
  IF NOT EXISTS (SELECT 1 FROM pasos_motivos_pausa WHERE company_id = p_company_id) THEN

    INSERT INTO pasos_motivos_pausa (company_id, nombre, categoria, requiere_descripcion, color, icono, orden) VALUES
    -- ========================================
    -- Categoría: CLIENTE (PRIORIDAD MÁXIMA)
    -- ========================================
    (p_company_id, 'Esperando aprobación de diseño', 'cliente', false, '#3B82F6', 'Palette', 1),
    (p_company_id, 'Esperando confirmación de colores', 'cliente', false, '#3B82F6', 'Pipette', 2),
    (p_company_id, 'Cliente solicitó cambios', 'cliente', true, '#3B82F6', 'Edit', 3),
    (p_company_id, 'Esperando archivos del cliente', 'cliente', false, '#3B82F6', 'FileUp', 4),

    -- ========================================
    -- Categoría: MATERIALES
    -- ========================================
    (p_company_id, 'Falta papel/sustrato', 'materiales', false, '#F59E0B', 'Package', 10),
    (p_company_id, 'Falta tinta/consumibles', 'materiales', false, '#F59E0B', 'Droplet', 11),
    (p_company_id, 'Material en pedido a proveedor', 'materiales', true, '#F59E0B', 'Truck', 12),

    -- ========================================
    -- Categoría: MAQUINARIA
    -- ========================================
    (p_company_id, 'Máquina averiada', 'maquinaria', true, '#EF4444', 'AlertTriangle', 20),
    (p_company_id, 'Mantenimiento preventivo', 'maquinaria', false, '#EF4444', 'Wrench', 21),
    (p_company_id, 'Calibración necesaria', 'maquinaria', false, '#EF4444', 'Settings', 22),

    -- ========================================
    -- Categoría: PERSONAL
    -- ========================================
    (p_company_id, 'Falta operador capacitado', 'personal', false, '#8B5CF6', 'UserX', 30),
    (p_company_id, 'Operador ausente', 'personal', true, '#8B5CF6', 'UserMinus', 31),
    (p_company_id, 'Esperando asignación de responsable', 'personal', false, '#8B5CF6', 'UserCog', 32),

    -- ========================================
    -- Categoría: EXTERNO
    -- ========================================
    (p_company_id, 'Corte de energía', 'externo', false, '#6B7280', 'Zap', 40),
    (p_company_id, 'Condiciones climáticas adversas', 'externo', false, '#6B7280', 'Cloud', 41),

    -- ========================================
    -- Categoría: OTRO
    -- ========================================
    (p_company_id, 'Otro motivo', 'otro', true, '#6B7280', 'MoreHorizontal', 99);

  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_seed_motivos_pausa_default IS
'Crea 16 motivos de pausa predeterminados para una empresa si no existen. Prioriza motivos relacionados con cliente';

-- =====================================================
-- 4. CREAR TABLA: ordenes_items_rutas_pausas
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_items_rutas_pausas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id uuid NOT NULL REFERENCES ordenes_trabajo_items_rutas(id) ON DELETE CASCADE,
  motivo_pausa_id uuid NOT NULL REFERENCES pasos_motivos_pausa(id) ON DELETE RESTRICT,
  categoria_motivo text NOT NULL CHECK (categoria_motivo IN (
    'cliente',
    'materiales',
    'maquinaria',
    'personal',
    'externo',
    'otro'
  )),
  descripcion text,
  fecha_inicio_pausa timestamptz NOT NULL DEFAULT now(),
  fecha_fin_pausa timestamptz,
  pausado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reanudado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Campo calculado: duración en minutos (solo cuando está cerrada)
  duracion_minutos integer GENERATED ALWAYS AS (
    CASE
      WHEN fecha_fin_pausa IS NOT NULL THEN
        EXTRACT(EPOCH FROM (fecha_fin_pausa - fecha_inicio_pausa))::integer / 60
      ELSE
        NULL
    END
  ) STORED,

  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT check_fecha_fin_posterior CHECK (
    fecha_fin_pausa IS NULL OR fecha_fin_pausa >= fecha_inicio_pausa
  )
);

-- Índices para ordenes_items_rutas_pausas
CREATE INDEX IF NOT EXISTS idx_pausas_ruta
  ON ordenes_items_rutas_pausas(ruta_id);

CREATE INDEX IF NOT EXISTS idx_pausas_motivo
  ON ordenes_items_rutas_pausas(motivo_pausa_id);

CREATE INDEX IF NOT EXISTS idx_pausas_activas
  ON ordenes_items_rutas_pausas(ruta_id)
  WHERE fecha_fin_pausa IS NULL;

CREATE INDEX IF NOT EXISTS idx_pausas_categoria
  ON ordenes_items_rutas_pausas(categoria_motivo);

CREATE INDEX IF NOT EXISTS idx_pausas_fecha_inicio
  ON ordenes_items_rutas_pausas(fecha_inicio_pausa);

-- RLS para ordenes_items_rutas_pausas
ALTER TABLE ordenes_items_rutas_pausas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own company pausas" ON ordenes_items_rutas_pausas;
CREATE POLICY "Users view own company pausas"
  ON ordenes_items_rutas_pausas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo_items_rutas otir
      WHERE otir.id = ordenes_items_rutas_pausas.ruta_id
      AND otir.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users manage own company pausas" ON ordenes_items_rutas_pausas;
CREATE POLICY "Users manage own company pausas"
  ON ordenes_items_rutas_pausas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo_items_rutas otir
      WHERE otir.id = ordenes_items_rutas_pausas.ruta_id
      AND otir.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users update own company pausas" ON ordenes_items_rutas_pausas;
CREATE POLICY "Users update own company pausas"
  ON ordenes_items_rutas_pausas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo_items_rutas otir
      WHERE otir.id = ordenes_items_rutas_pausas.ruta_id
      AND otir.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ordenes_trabajo_items_rutas otir
      WHERE otir.id = ordenes_items_rutas_pausas.ruta_id
      AND otir.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Comentarios
COMMENT ON TABLE ordenes_items_rutas_pausas IS
'Registro histórico de pausas en pasos de producción con motivos y duraciones. Soporta múltiples ciclos de pausa/reanudación';
COMMENT ON COLUMN ordenes_items_rutas_pausas.duracion_minutos IS
'Duración calculada automáticamente en minutos cuando se cierra la pausa (fecha_fin_pausa)';
COMMENT ON COLUMN ordenes_items_rutas_pausas.fecha_fin_pausa IS
'NULL indica pausa activa. Se establece automáticamente al reanudar';
COMMENT ON COLUMN ordenes_items_rutas_pausas.descripcion IS
'Descripción opcional o requerida según configuración del motivo';

-- =====================================================
-- 5. MODIFICAR TABLA: ordenes_trabajo_items_rutas
-- =====================================================

-- Agregar nuevo estado 'pausado' al constraint existente
DO $$
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estado_paso_item_ruta'
  ) THEN
    ALTER TABLE ordenes_trabajo_items_rutas
    DROP CONSTRAINT check_estado_paso_item_ruta;
  END IF;

  -- Crear constraint con el nuevo estado 'pausado'
  ALTER TABLE ordenes_trabajo_items_rutas
  ADD CONSTRAINT check_estado_paso_item_ruta
  CHECK (estado_paso IN ('pendiente', 'en_proceso', 'completado', 'omitido', 'pausado'));
END $$;

-- Agregar campos de cálculo de tiempos
ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS tiempo_trabajo_efectivo interval;

ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS tiempo_pausado_total interval;

ALTER TABLE ordenes_trabajo_items_rutas
ADD COLUMN IF NOT EXISTS cantidad_pausas integer DEFAULT 0 NOT NULL;

-- Índice para pausas activas
CREATE INDEX IF NOT EXISTS idx_rutas_pausadas
  ON ordenes_trabajo_items_rutas(company_id, estado_paso)
  WHERE estado_paso = 'pausado';

-- Comentarios
COMMENT ON COLUMN ordenes_trabajo_items_rutas.tiempo_trabajo_efectivo IS
'Tiempo real de trabajo excluyendo pausas. Calculado: (fecha_fin - fecha_inicio) - tiempo_pausado_total';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.tiempo_pausado_total IS
'Suma de todas las duraciones de pausas registradas para este paso';
COMMENT ON COLUMN ordenes_trabajo_items_rutas.cantidad_pausas IS
'Contador de cuántas veces se pausó este paso. Soporta múltiples ciclos de revisión con cliente';

-- =====================================================
-- 6. CREAR TABLA: notificaciones_internas
-- =====================================================

CREATE TABLE IF NOT EXISTS notificaciones_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'pausa_prolongada',
    'paso_completado',
    'orden_finalizada',
    'alerta_produccion',
    'sistema'
  )),
  titulo text NOT NULL,
  mensaje text NOT NULL,
  referencia_tipo text CHECK (referencia_tipo IN (
    'orden_trabajo',
    'orden_item',
    'ruta_paso',
    'pausa'
  )),
  referencia_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  leida boolean DEFAULT false NOT NULL,
  leida_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT check_leida_at_requires_leida CHECK (
    (leida = false AND leida_at IS NULL) OR
    (leida = true AND leida_at IS NOT NULL)
  )
);

-- Índices para notificaciones_internas
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
  ON notificaciones_internas(usuario_id, leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_company
  ON notificaciones_internas(company_id);

CREATE INDEX IF NOT EXISTS idx_notificaciones_referencia
  ON notificaciones_internas(referencia_tipo, referencia_id);

CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas
  ON notificaciones_internas(usuario_id, company_id)
  WHERE leida = false;

-- RLS para notificaciones_internas
ALTER TABLE notificaciones_internas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON notificaciones_internas;
CREATE POLICY "Users view own notifications"
  ON notificaciones_internas FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON notificaciones_internas;
CREATE POLICY "Users update own notifications"
  ON notificaciones_internas FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON notificaciones_internas;
CREATE POLICY "System can insert notifications"
  ON notificaciones_internas FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Comentarios
COMMENT ON TABLE notificaciones_internas IS
'Sistema de notificaciones internas para usuarios (NO WhatsApp). Incluye alertas de pausas prolongadas >24h para super_admin y admin';
COMMENT ON COLUMN notificaciones_internas.tipo IS
'Tipo de notificación: pausa_prolongada (>24h), paso_completado, orden_finalizada, alerta_produccion, sistema';
COMMENT ON COLUMN notificaciones_internas.metadata IS
'Datos adicionales en JSON: {orden_numero, paso_nombre, tiempo_pausado, horas_pausado, categoria_motivo, etc}';
COMMENT ON COLUMN notificaciones_internas.referencia_tipo IS
'Tipo de entidad referenciada para navegación: orden_trabajo, orden_item, ruta_paso, pausa';

-- =====================================================
-- 7. TRIGGER: Auto-seed motivos al crear empresa
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_seed_motivos_pausa_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Llamar a la función de seed para la nueva empresa
  PERFORM fn_seed_motivos_pausa_default(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_seed_motivos_pausa ON companies;

CREATE TRIGGER trigger_auto_seed_motivos_pausa
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_motivos_pausa_new_company();

COMMENT ON FUNCTION trigger_seed_motivos_pausa_new_company IS
'Trigger que ejecuta fn_seed_motivos_pausa_default automáticamente cuando se crea una nueva empresa';

-- =====================================================
-- 8. SEED PARA EMPRESAS EXISTENTES
-- =====================================================

-- Ejecutar seed para todas las empresas existentes que no tengan motivos
DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN
    SELECT id FROM companies
    WHERE NOT EXISTS (
      SELECT 1 FROM pasos_motivos_pausa WHERE company_id = companies.id
    )
  LOOP
    PERFORM fn_seed_motivos_pausa_default(v_company.id);
  END LOOP;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN FASE 1
-- =====================================================

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ FASE 1 COMPLETADA: Sistema de Pausas en Producción';
  RAISE NOTICE '📦 Tablas creadas: pasos_motivos_pausa, ordenes_items_rutas_pausas, notificaciones_internas';
  RAISE NOTICE '🔧 Modificaciones: ordenes_trabajo_items_rutas (estado pausado + campos de tiempo)';
  RAISE NOTICE '🌱 Seeds: Motivos predeterminados creados para todas las empresas';
  RAISE NOTICE '🔒 Seguridad: RLS habilitado en todas las tablas nuevas';
  RAISE NOTICE '🎯 Siguiente: Fase 2 - Backend y Triggers (funciones SQL)';
END $$;
