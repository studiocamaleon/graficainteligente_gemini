-- =====================================================
-- Reglas Internas: Secciones + Items versionados + ACK por versión
-- =====================================================

-- 1) Tablas
CREATE TABLE IF NOT EXISTS public.reglas_internas_secciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reglas_internas_secciones_nombre_nonempty CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE IF NOT EXISTS public.reglas_internas_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  seccion_id uuid NOT NULL REFERENCES public.reglas_internas_secciones(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  es_critica boolean NOT NULL DEFAULT false,
  version_publicada integer NOT NULL DEFAULT 1,
  orden integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  aplica_roles text[] NULL,
  fecha_vigencia_desde date NULL,
  fecha_vigencia_hasta date NULL,
  publicado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  publicado_at timestamptz NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reglas_internas_items_titulo_nonempty CHECK (length(trim(titulo)) > 0),
  CONSTRAINT reglas_internas_items_contenido_nonempty CHECK (length(trim(contenido)) > 0),
  CONSTRAINT reglas_internas_items_version_positive CHECK (version_publicada >= 1),
  CONSTRAINT reglas_internas_items_vigencia_valida CHECK (
    fecha_vigencia_hasta IS NULL
    OR fecha_vigencia_desde IS NULL
    OR fecha_vigencia_hasta >= fecha_vigencia_desde
  )
);

CREATE TABLE IF NOT EXISTS public.reglas_internas_ack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  regla_id uuid NOT NULL REFERENCES public.reglas_internas_items(id) ON DELETE CASCADE,
  regla_version integer NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ack_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reglas_internas_ack_version_positive CHECK (regla_version >= 1),
  CONSTRAINT reglas_internas_ack_unique UNIQUE (regla_id, regla_version, usuario_id)
);

-- 2) Índices
CREATE INDEX IF NOT EXISTS idx_reglas_internas_secciones_company ON public.reglas_internas_secciones(company_id, is_active, orden);
CREATE INDEX IF NOT EXISTS idx_reglas_internas_items_company ON public.reglas_internas_items(company_id, is_active, estado, es_critica, orden);
CREATE INDEX IF NOT EXISTS idx_reglas_internas_items_seccion ON public.reglas_internas_items(seccion_id, orden);
CREATE INDEX IF NOT EXISTS idx_reglas_internas_ack_company_user ON public.reglas_internas_ack(company_id, usuario_id, ack_at DESC);
CREATE INDEX IF NOT EXISTS idx_reglas_internas_ack_regla_version ON public.reglas_internas_ack(regla_id, regla_version);

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION public.fn_reglas_internas_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reglas_internas_secciones_touch_updated_at ON public.reglas_internas_secciones;
CREATE TRIGGER trg_reglas_internas_secciones_touch_updated_at
BEFORE UPDATE ON public.reglas_internas_secciones
FOR EACH ROW
EXECUTE FUNCTION public.fn_reglas_internas_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reglas_internas_items_touch_updated_at ON public.reglas_internas_items;
CREATE TRIGGER trg_reglas_internas_items_touch_updated_at
BEFORE UPDATE ON public.reglas_internas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_reglas_internas_touch_updated_at();

-- 4) RLS
ALTER TABLE public.reglas_internas_secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_internas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_internas_ack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reglas_secciones_select" ON public.reglas_internas_secciones;
CREATE POLICY "reglas_secciones_select"
  ON public.reglas_internas_secciones
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "reglas_secciones_admin_mutation" ON public.reglas_internas_secciones;
CREATE POLICY "reglas_secciones_admin_mutation"
  ON public.reglas_internas_secciones
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "reglas_items_select" ON public.reglas_internas_items;
CREATE POLICY "reglas_items_select"
  ON public.reglas_internas_items
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      estado = 'publicada'
      OR company_id IN (
        SELECT p.company_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'super_admin')
      )
    )
  );

DROP POLICY IF EXISTS "reglas_items_admin_mutation" ON public.reglas_internas_items;
CREATE POLICY "reglas_items_admin_mutation"
  ON public.reglas_internas_items
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "reglas_ack_select" ON public.reglas_internas_ack;
CREATE POLICY "reglas_ack_select"
  ON public.reglas_internas_ack
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "reglas_ack_insert" ON public.reglas_internas_ack;
CREATE POLICY "reglas_ack_insert"
  ON public.reglas_internas_ack
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
    AND usuario_id = auth.uid()
  );

-- Sin políticas UPDATE/DELETE para ack: inmutable por trazabilidad.

-- 5) RPCs

CREATE OR REPLACE FUNCTION public.fn_reglas_internas_listado(
  p_company_id uuid,
  p_include_drafts boolean DEFAULT false
)
RETURNS TABLE (
  seccion_id uuid,
  seccion_nombre text,
  seccion_descripcion text,
  seccion_orden integer,
  regla_id uuid,
  titulo text,
  contenido text,
  estado text,
  es_critica boolean,
  version_publicada integer,
  regla_orden integer,
  aplica_roles text[],
  fecha_vigencia_desde date,
  fecha_vigencia_hasta date,
  publicado_at timestamptz,
  actualizado_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_company_id uuid;
BEGIN
  SELECT p.role, p.company_id
  INTO v_role, v_company_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_company_id IS NULL OR v_company_id <> p_company_id THEN
    RAISE EXCEPTION 'No autorizado para consultar reglas internas de esta empresa';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.nombre,
    s.descripcion,
    s.orden,
    i.id,
    i.titulo,
    i.contenido,
    i.estado,
    i.es_critica,
    i.version_publicada,
    i.orden,
    i.aplica_roles,
    i.fecha_vigencia_desde,
    i.fecha_vigencia_hasta,
    i.publicado_at,
    i.updated_at
  FROM public.reglas_internas_secciones s
  JOIN public.reglas_internas_items i
    ON i.seccion_id = s.id
   AND i.company_id = s.company_id
  WHERE s.company_id = p_company_id
    AND s.is_active = true
    AND i.is_active = true
    AND (
      i.estado = 'publicada'
      OR (
        p_include_drafts = true
        AND v_role IN ('admin', 'super_admin')
      )
    )
  ORDER BY s.orden, s.nombre, i.orden, i.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reglas_internas_publish_item(
  p_item_id uuid
)
RETURNS public.reglas_internas_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_company_id uuid;
  v_item public.reglas_internas_items;
  v_new_version integer;
BEGIN
  SELECT p.role, p.company_id
  INTO v_role, v_company_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Solo admin/superadmin puede publicar reglas';
  END IF;

  SELECT *
  INTO v_item
  FROM public.reglas_internas_items i
  WHERE i.id = p_item_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Regla interna no encontrada';
  END IF;

  IF v_item.company_id <> v_company_id THEN
    RAISE EXCEPTION 'No autorizado para publicar reglas de otra empresa';
  END IF;

  -- Si ya estaba publicada y hubo edición posterior a la última publicación,
  -- incrementamos versión para exigir nueva confirmación.
  v_new_version := v_item.version_publicada;
  IF v_item.estado = 'publicada'
     AND v_item.publicado_at IS NOT NULL
     AND v_item.updated_at > v_item.publicado_at THEN
    v_new_version := v_item.version_publicada + 1;
  END IF;

  UPDATE public.reglas_internas_items
     SET estado = 'publicada',
         version_publicada = v_new_version,
         publicado_por = auth.uid(),
         publicado_at = now(),
         updated_by = auth.uid(),
         updated_at = now()
   WHERE id = p_item_id
   RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reglas_internas_pendientes_usuario(
  p_company_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS TABLE (
  regla_id uuid,
  seccion_nombre text,
  titulo text,
  contenido text,
  version_publicada integer,
  publicado_at timestamptz,
  aplica_roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT p.company_id
  INTO v_company_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_company_id IS NULL OR v_company_id <> p_company_id THEN
    RAISE EXCEPTION 'No autorizado para consultar pendientes de esta empresa';
  END IF;

  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Solo podés consultar tus propios pendientes';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    s.nombre,
    i.titulo,
    i.contenido,
    i.version_publicada,
    i.publicado_at,
    i.aplica_roles
  FROM public.reglas_internas_items i
  JOIN public.reglas_internas_secciones s
    ON s.id = i.seccion_id
   AND s.company_id = i.company_id
  WHERE i.company_id = p_company_id
    AND i.is_active = true
    AND s.is_active = true
    AND i.estado = 'publicada'
    AND i.es_critica = true
    AND (
      i.fecha_vigencia_desde IS NULL OR i.fecha_vigencia_desde <= now()::date
    )
    AND (
      i.fecha_vigencia_hasta IS NULL OR i.fecha_vigencia_hasta >= now()::date
    )
    AND (
      -- Si aplica_roles es NULL, usamos default operativo/comercial
      (i.aplica_roles IS NULL AND p_role IN ('manager', 'operador_diseno', 'operador_taller', 'viewer'))
      OR
      (i.aplica_roles IS NOT NULL AND p_role = ANY(i.aplica_roles))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reglas_internas_ack a
      WHERE a.regla_id = i.id
        AND a.regla_version = i.version_publicada
        AND a.usuario_id = p_user_id
    )
  ORDER BY s.orden, s.nombre, i.orden, i.publicado_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reglas_internas_ack(
  p_item_id uuid,
  p_version integer
)
RETURNS public.reglas_internas_ack
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item public.reglas_internas_items;
  v_profile public.profiles;
  v_ack public.reglas_internas_ack;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  SELECT * INTO v_item
  FROM public.reglas_internas_items i
  WHERE i.id = p_item_id;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Regla interna no encontrada';
  END IF;

  IF v_item.company_id <> v_profile.company_id THEN
    RAISE EXCEPTION 'No autorizado para confirmar reglas de otra empresa';
  END IF;

  IF p_version <> v_item.version_publicada THEN
    RAISE EXCEPTION 'Versión inválida para confirmación';
  END IF;

  INSERT INTO public.reglas_internas_ack (
    company_id,
    regla_id,
    regla_version,
    usuario_id
  )
  VALUES (
    v_item.company_id,
    v_item.id,
    p_version,
    auth.uid()
  )
  ON CONFLICT (regla_id, regla_version, usuario_id)
  DO UPDATE SET ack_at = excluded.ack_at
  RETURNING * INTO v_ack;

  RETURN v_ack;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reglas_internas_listado(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reglas_internas_publish_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reglas_internas_pendientes_usuario(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reglas_internas_ack(uuid, integer) TO authenticated;
