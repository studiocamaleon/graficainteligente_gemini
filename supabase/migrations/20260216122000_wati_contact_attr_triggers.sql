-- Wati contact attributes: triggers that only ENQUEUE (no HTTP)

-- Clients trigger
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_wati_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, NEW.whatsapp, 'client_insert', NEW.id);
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
    -- enqueue old + new phone so both contacts get refreshed
    PERFORM public.fn_enqueue_wati_contact_attr_update(OLD.company_id, OLD.whatsapp, 'client_whatsapp_change_old', OLD.id);
    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, NEW.whatsapp, 'client_whatsapp_change_new', NEW.id);
    RETURN NEW;
  END IF;

  v_changed :=
    (NEW.tiene_cuenta_corriente IS DISTINCT FROM OLD.tiene_cuenta_corriente)
    OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
    OR (NEW.nombre_fantasia IS DISTINCT FROM OLD.nombre_fantasia)
    OR (NEW.razon_social IS DISTINCT FROM OLD.razon_social)
    OR (NEW.numero_documento IS DISTINCT FROM OLD.numero_documento);

  IF v_changed THEN
    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, NEW.whatsapp, 'client_update', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_wati_from_client ON public.clients;
CREATE TRIGGER trg_enqueue_wati_from_client
AFTER INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_enqueue_wati_from_client();

-- Ordenes de trabajo trigger
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_wati_from_ot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
BEGIN
  -- On insert: always enqueue
  IF TG_OP = 'INSERT' THEN
    SELECT c.whatsapp INTO v_phone
    FROM public.clients c
    WHERE c.id = NEW.cliente_id;

    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, v_phone, 'ot_insert', NEW.cliente_id);
    RETURN NEW;
  END IF;

  -- On update: enqueue only for relevant changes
  IF (NEW.estado IS DISTINCT FROM OLD.estado)
    OR (NEW.total IS DISTINCT FROM OLD.total)
    OR (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id)
    OR (NEW.fecha_estimada_entrega IS DISTINCT FROM OLD.fecha_estimada_entrega)
    OR (NEW.fecha_completado IS DISTINCT FROM OLD.fecha_completado)
  THEN
    SELECT c.whatsapp INTO v_phone
    FROM public.clients c
    WHERE c.id = NEW.cliente_id;

    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, v_phone, 'ot_update', NEW.cliente_id);

    -- If client changed, also refresh old client's contact
    IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
      SELECT c.whatsapp INTO v_phone
      FROM public.clients c
      WHERE c.id = OLD.cliente_id;

      PERFORM public.fn_enqueue_wati_contact_attr_update(OLD.company_id, v_phone, 'ot_update_old_client', OLD.cliente_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_wati_from_ot ON public.ordenes_trabajo;
CREATE TRIGGER trg_enqueue_wati_from_ot
AFTER INSERT OR UPDATE ON public.ordenes_trabajo
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_enqueue_wati_from_ot();

-- Centro copiado ordenes trigger
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_wati_from_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT c.whatsapp INTO v_phone
    FROM public.clients c
    WHERE c.id = NEW.cliente_id;

    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, v_phone, 'cc_insert', NEW.cliente_id);
    RETURN NEW;
  END IF;

  IF (NEW.estado IS DISTINCT FROM OLD.estado)
    OR (NEW.total IS DISTINCT FROM OLD.total)
    OR (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id)
    OR (NEW.fecha_entrega_estimada IS DISTINCT FROM OLD.fecha_entrega_estimada)
    OR (NEW.fecha_completado IS DISTINCT FROM OLD.fecha_completado)
  THEN
    SELECT c.whatsapp INTO v_phone
    FROM public.clients c
    WHERE c.id = NEW.cliente_id;

    PERFORM public.fn_enqueue_wati_contact_attr_update(NEW.company_id, v_phone, 'cc_update', NEW.cliente_id);

    IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
      SELECT c.whatsapp INTO v_phone
      FROM public.clients c
      WHERE c.id = OLD.cliente_id;

      PERFORM public.fn_enqueue_wati_contact_attr_update(OLD.company_id, v_phone, 'cc_update_old_client', OLD.cliente_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_wati_from_cc ON public.centro_copiado_ordenes;
CREATE TRIGGER trg_enqueue_wati_from_cc
AFTER INSERT OR UPDATE ON public.centro_copiado_ordenes
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_enqueue_wati_from_cc();

-- Pagos OT trigger
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_wati_from_ot_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orden_id uuid;
  v_company_id uuid;
  v_cliente_id uuid;
  v_phone text;
BEGIN
  v_orden_id := COALESCE(NEW.orden_id, OLD.orden_id);

  SELECT o.company_id, o.cliente_id INTO v_company_id, v_cliente_id
  FROM public.ordenes_trabajo o
  WHERE o.id = v_orden_id;

  IF v_company_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT c.whatsapp INTO v_phone
  FROM public.clients c
  WHERE c.id = v_cliente_id;

  PERFORM public.fn_enqueue_wati_contact_attr_update(v_company_id, v_phone, 'ot_payment_change', v_cliente_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_wati_from_ot_payment ON public.ordenes_trabajo_pagos;
CREATE TRIGGER trg_enqueue_wati_from_ot_payment
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_trabajo_pagos
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_enqueue_wati_from_ot_payment();

-- Pagos CC trigger
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_wati_from_cc_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orden_id uuid;
  v_company_id uuid;
  v_cliente_id uuid;
  v_phone text;
BEGIN
  v_orden_id := COALESCE(NEW.orden_copiado_id, OLD.orden_copiado_id);

  SELECT o.company_id, o.cliente_id INTO v_company_id, v_cliente_id
  FROM public.centro_copiado_ordenes o
  WHERE o.id = v_orden_id;

  IF v_company_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT c.whatsapp INTO v_phone
  FROM public.clients c
  WHERE c.id = v_cliente_id;

  PERFORM public.fn_enqueue_wati_contact_attr_update(v_company_id, v_phone, 'cc_payment_change', v_cliente_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_wati_from_cc_payment ON public.centro_copiado_ordenes_pagos;
CREATE TRIGGER trg_enqueue_wati_from_cc_payment
AFTER INSERT OR UPDATE OR DELETE ON public.centro_copiado_ordenes_pagos
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_enqueue_wati_from_cc_payment();
