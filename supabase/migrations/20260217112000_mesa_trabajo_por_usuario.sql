-- Mesa de trabajo por usuario (ownership exclusivo por ruta)

ALTER TABLE public.ordenes_items_mesa_trabajo
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill desde columna legacy
UPDATE public.ordenes_items_mesa_trabajo
SET assigned_user_id = assigned_by
WHERE assigned_user_id IS NULL
  AND assigned_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mesa_trabajo_assigned_user
  ON public.ordenes_items_mesa_trabajo(company_id, assigned_user_id);

CREATE OR REPLACE FUNCTION public.fn_take_step_to_user_mesa(
  p_company_id uuid,
  p_ruta_id uuid,
  p_estacion_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  status text,
  owner_user_id uuid,
  owner_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_user_id uuid;
  v_owner_name text;
BEGIN
  INSERT INTO public.ordenes_items_mesa_trabajo (
    company_id,
    ruta_id,
    estacion_id,
    assigned_user_id,
    assigned_by,
    assigned_at
  )
  VALUES (
    p_company_id,
    p_ruta_id,
    p_estacion_id,
    p_user_id,
    p_user_id,
    now()
  )
  ON CONFLICT (company_id, ruta_id) DO NOTHING;

  SELECT
    mt.assigned_user_id,
    COALESCE(pr.full_name, 'Usuario desconocido')
  INTO
    v_owner_user_id,
    v_owner_name
  FROM public.ordenes_items_mesa_trabajo mt
  LEFT JOIN public.profiles pr ON pr.id = mt.assigned_user_id
  WHERE mt.company_id = p_company_id
    AND mt.ruta_id = p_ruta_id
  LIMIT 1;

  -- Legacy rows sin owner: intentar tomar ownership ahora.
  IF v_owner_user_id IS NULL THEN
    UPDATE public.ordenes_items_mesa_trabajo
    SET
      assigned_user_id = p_user_id,
      assigned_by = COALESCE(assigned_by, p_user_id),
      assigned_at = COALESCE(assigned_at, now()),
      updated_at = now()
    WHERE company_id = p_company_id
      AND ruta_id = p_ruta_id
      AND assigned_user_id IS NULL;

    SELECT
      mt.assigned_user_id,
      COALESCE(pr.full_name, 'Usuario desconocido')
    INTO
      v_owner_user_id,
      v_owner_name
    FROM public.ordenes_items_mesa_trabajo mt
    LEFT JOIN public.profiles pr ON pr.id = mt.assigned_user_id
    WHERE mt.company_id = p_company_id
      AND mt.ruta_id = p_ruta_id
    LIMIT 1;
  END IF;

  IF v_owner_user_id = p_user_id THEN
    status := 'taken';
    owner_user_id := v_owner_user_id;
    owner_name := v_owner_name;
    RETURN NEXT;
    RETURN;
  END IF;

  status := 'taken_by_other';
  owner_user_id := v_owner_user_id;
  owner_name := COALESCE(v_owner_name, 'Usuario desconocido');
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_release_step_from_user_mesa(
  p_company_id uuid,
  p_ruta_id uuid,
  p_user_id uuid,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  IF p_force THEN
    DELETE FROM public.ordenes_items_mesa_trabajo
    WHERE company_id = p_company_id
      AND ruta_id = p_ruta_id;
  ELSE
    DELETE FROM public.ordenes_items_mesa_trabajo
    WHERE company_id = p_company_id
      AND ruta_id = p_ruta_id
      AND (
        assigned_user_id = p_user_id
        OR (assigned_user_id IS NULL AND assigned_by = p_user_id)
      );
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    status := 'released';
  ELSE
    status := 'not_owner';
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cleanup_mesa_on_step_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estado_paso IN ('completado', 'omitido') THEN
    DELETE FROM public.ordenes_items_mesa_trabajo
    WHERE company_id = NEW.company_id
      AND ruta_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cleanup_mesa_on_step_closed ON public.ordenes_trabajo_items_rutas;
CREATE TRIGGER trigger_cleanup_mesa_on_step_closed
AFTER UPDATE OF estado_paso ON public.ordenes_trabajo_items_rutas
FOR EACH ROW
WHEN (OLD.estado_paso IS DISTINCT FROM NEW.estado_paso)
EXECUTE FUNCTION public.fn_cleanup_mesa_on_step_closed();
