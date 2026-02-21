-- Enforce payment role rules at DB level (defense in depth)
-- Rules:
-- 1) INSERT pagos: permitido para todos excepto operador_taller/operator.
-- 2) UPDATE/DELETE pagos: solo super_admin.
-- Service role / SQL admin contexts are not blocked.

CREATE OR REPLACE FUNCTION public.fn_guard_ordenes_trabajo_pagos_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_auth_role text;
  v_profile_role text;
  v_user_company_id uuid;
  v_order_company_id uuid;
  v_orden_id uuid;
BEGIN
  v_auth_role := auth.role();
  v_user_id := auth.uid();

  -- Allow service/admin contexts (migrations, backend jobs)
  IF v_auth_role IN ('service_role', 'supabase_admin') OR v_user_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT p.role, p.company_id
  INTO v_profile_role, v_user_company_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_profile_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo validar el rol del usuario para pagos.';
  END IF;

  v_orden_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.orden_id ELSE NEW.orden_id END;

  SELECT o.company_id
  INTO v_order_company_id
  FROM public.ordenes_trabajo o
  WHERE o.id = v_orden_id;

  IF v_order_company_id IS NULL OR v_order_company_id <> v_user_company_id THEN
    RAISE EXCEPTION 'No tenés permisos para operar pagos de otra empresa.';
  END IF;

  IF TG_OP = 'INSERT' AND v_profile_role IN ('operador_taller', 'operator') THEN
    RAISE EXCEPTION 'El rol Operador de taller no puede registrar pagos.';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND v_profile_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo superadmin puede editar o eliminar pagos registrados.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_ordenes_trabajo_pagos_roles ON public.ordenes_trabajo_pagos;

CREATE TRIGGER trigger_guard_ordenes_trabajo_pagos_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.ordenes_trabajo_pagos
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_ordenes_trabajo_pagos_roles();


CREATE OR REPLACE FUNCTION public.fn_guard_centro_copiado_pagos_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_auth_role text;
  v_profile_role text;
  v_user_company_id uuid;
  v_order_company_id uuid;
  v_orden_copiado_id uuid;
BEGIN
  v_auth_role := auth.role();
  v_user_id := auth.uid();

  -- Allow service/admin contexts (migrations, backend jobs)
  IF v_auth_role IN ('service_role', 'supabase_admin') OR v_user_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT p.role, p.company_id
  INTO v_profile_role, v_user_company_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_profile_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo validar el rol del usuario para pagos.';
  END IF;

  v_orden_copiado_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.orden_copiado_id ELSE NEW.orden_copiado_id END;

  SELECT o.company_id
  INTO v_order_company_id
  FROM public.centro_copiado_ordenes o
  WHERE o.id = v_orden_copiado_id;

  IF v_order_company_id IS NULL OR v_order_company_id <> v_user_company_id THEN
    RAISE EXCEPTION 'No tenés permisos para operar pagos de otra empresa.';
  END IF;

  IF TG_OP = 'INSERT' AND v_profile_role IN ('operador_taller', 'operator') THEN
    RAISE EXCEPTION 'El rol Operador de taller no puede registrar pagos.';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND v_profile_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo superadmin puede editar o eliminar pagos registrados.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_centro_copiado_pagos_roles ON public.centro_copiado_ordenes_pagos;

CREATE TRIGGER trigger_guard_centro_copiado_pagos_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.centro_copiado_ordenes_pagos
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_centro_copiado_pagos_roles();
