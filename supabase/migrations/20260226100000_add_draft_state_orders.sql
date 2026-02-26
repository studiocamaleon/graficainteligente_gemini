-- Add draft state support for OT + Copy Center orders
-- - Allow partial draft records
-- - Assign official order numbers only when confirming drafts
-- - Prevent auto-state triggers from overriding draft status

BEGIN;

-- =====================================================
-- 1) ORDER TABLES: states + nullable fields for drafts
-- =====================================================

-- OT: nullable fields for draft mode
ALTER TABLE public.ordenes_trabajo
  ALTER COLUMN cliente_id DROP NOT NULL,
  ALTER COLUMN canal_venta DROP NOT NULL,
  ALTER COLUMN numero_orden DROP NOT NULL;

-- OT: state check includes borrador
ALTER TABLE public.ordenes_trabajo
  DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check;
ALTER TABLE public.ordenes_trabajo
  DROP CONSTRAINT IF EXISTS check_estado;
ALTER TABLE public.ordenes_trabajo
  ADD CONSTRAINT ordenes_trabajo_estado_check
  CHECK (estado IN ('borrador', 'pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'));

-- Copy center: nullable fields for draft mode
ALTER TABLE public.centro_copiado_ordenes
  ALTER COLUMN canal_venta DROP NOT NULL,
  ALTER COLUMN numero_orden DROP NOT NULL;

-- Copy center: state check includes borrador
ALTER TABLE public.centro_copiado_ordenes
  DROP CONSTRAINT IF EXISTS centro_copiado_ordenes_estado_check;
ALTER TABLE public.centro_copiado_ordenes
  ADD CONSTRAINT centro_copiado_ordenes_estado_check
  CHECK (estado IN ('borrador', 'pendiente', 'en_proceso', 'finalizada', 'entregada', 'cancelada'));

-- =====================================================
-- 2) NUMBER GENERATION ON CONFIRM
-- =====================================================

-- OT: keep existing generator trigger, but skip number assignment while draft
CREATE OR REPLACE FUNCTION public.trigger_generate_numero_orden()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Drafts must not consume official order numbers.
  IF NEW.estado = 'borrador' THEN
    RETURN NEW;
  END IF;

  IF NEW.numero_orden IS NULL OR NEW.numero_orden = '' THEN
    NEW.numero_orden := public.generate_numero_orden(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Assign OT number only if missing
CREATE OR REPLACE FUNCTION public.fn_assign_numero_orden_ot_if_missing(p_orden_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_numero text;
BEGIN
  SELECT company_id, numero_orden
  INTO v_company_id, v_numero
  FROM public.ordenes_trabajo
  WHERE id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden OT no encontrada: %', p_orden_id;
  END IF;

  IF v_numero IS NULL OR btrim(v_numero) = '' THEN
    v_numero := public.generate_numero_orden(v_company_id);

    UPDATE public.ordenes_trabajo
    SET numero_orden = v_numero,
        updated_at = now()
    WHERE id = p_orden_id;
  END IF;

  RETURN v_numero;
END;
$$;

-- Assign copy center number only if missing (CC-YYYYMMDD-#### per company/day)
CREATE OR REPLACE FUNCTION public.fn_assign_numero_orden_cc_if_missing(p_orden_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_created_at timestamptz;
  v_numero text;
  v_date_str text;
  v_next_seq integer;
BEGIN
  SELECT company_id, created_at, numero_orden
  INTO v_company_id, v_created_at, v_numero
  FROM public.centro_copiado_ordenes
  WHERE id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden Copiado no encontrada: %', p_orden_id;
  END IF;

  IF v_numero IS NOT NULL AND btrim(v_numero) <> '' THEN
    RETURN v_numero;
  END IF;

  v_date_str := to_char(timezone('America/Argentina/Buenos_Aires', COALESCE(v_created_at, now())), 'YYYYMMDD');

  SELECT COALESCE(
    MAX(
      CASE
        WHEN numero_orden ~ ('^CC-' || v_date_str || '-[0-9]{4}$')
          THEN CAST(right(numero_orden, 4) AS integer)
        ELSE 0
      END
    ),
    0
  ) + 1
  INTO v_next_seq
  FROM public.centro_copiado_ordenes
  WHERE company_id = v_company_id;

  v_numero := 'CC-' || v_date_str || '-' || lpad(v_next_seq::text, 4, '0');

  UPDATE public.centro_copiado_ordenes
  SET numero_orden = v_numero,
      updated_at = now()
  WHERE id = p_orden_id;

  RETURN v_numero;
END;
$$;

-- =====================================================
-- 3) AUTO-STATE TRIGGER: protect draft OTs
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_actualizar_estado_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_items integer;
  v_items_pendientes integer;
  v_items_finalizados integer;
  v_nuevo_estado text;
  v_orden_id uuid;
  v_estado_actual text;
BEGIN
  SELECT orden_id INTO v_orden_id
  FROM public.ordenes_trabajo_items
  WHERE id = NEW.id;

  SELECT estado INTO v_estado_actual
  FROM public.ordenes_trabajo
  WHERE id = v_orden_id;

  -- Do not auto-overwrite terminal or draft statuses.
  IF v_estado_actual IN ('cancelada', 'entregada', 'borrador') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'pendiente'),
    COUNT(*) FILTER (WHERE estado = 'finalizado')
  INTO v_total_items, v_items_pendientes, v_items_finalizados
  FROM public.ordenes_trabajo_items
  WHERE orden_id = v_orden_id;

  IF v_total_items = 0 THEN
    RETURN NEW;
  END IF;

  IF v_items_finalizados = v_total_items THEN
    v_nuevo_estado := 'finalizada';
  ELSIF v_items_pendientes = v_total_items THEN
    v_nuevo_estado := 'pendiente';
  ELSE
    v_nuevo_estado := 'en_proceso';
  END IF;

  UPDATE public.ordenes_trabajo
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = v_orden_id
    AND estado != v_nuevo_estado
    AND estado NOT IN ('cancelada', 'entregada', 'borrador');

  RETURN NEW;
END;
$$;

COMMIT;
