/*
  # Recibos: deshabilitar llamada HTTP desde triggers

  Pasamos a un modelo donde el PDF se genera desde la app (usuario logueado) llamando
  a la Edge Function `generate-recibo-pdf` con JWT.

  Esto evita dependencia en `private.runtime_config` y en `TRIGGER_SECRET_TOKEN`.
*/

CREATE OR REPLACE FUNCTION public.fn_trigger_crear_recibo_por_pago_ot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_cliente_id uuid;
  v_orden_id uuid;
  v_numero_recibo integer;
  v_token text;
BEGIN
  v_orden_id := NEW.orden_id;

  SELECT ot.company_id, ot.cliente_id
  INTO v_company_id, v_cliente_id
  FROM public.ordenes_trabajo ot
  WHERE ot.id = v_orden_id;

  IF v_company_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_numero_recibo := public.fn_next_numero_recibo(v_company_id);
  v_token := public.fn_generar_token_recibo(v_company_id);

  INSERT INTO public.recibos_pagos (
    company_id,
    cliente_id,
    pago_ot_id,
    orden_trabajo_id,
    numero_recibo,
    token_corto,
    fecha_pago,
    monto,
    metodo_pago,
    medio_cobro_id,
    referencia_pago,
    notas
  ) VALUES (
    v_company_id,
    v_cliente_id,
    NEW.id,
    v_orden_id,
    v_numero_recibo,
    v_token,
    NEW.fecha_pago,
    round(NEW.monto::numeric, 2),
    NEW.metodo_pago,
    NEW.medio_cobro_id,
    NEW.referencia_pago,
    NEW.notas
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_crear_recibo_por_pago_copiado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_cliente_id uuid;
  v_orden_id uuid;
  v_numero_recibo integer;
  v_token text;
BEGIN
  v_orden_id := NEW.orden_copiado_id;

  SELECT cco.company_id, cco.cliente_id
  INTO v_company_id, v_cliente_id
  FROM public.centro_copiado_ordenes cco
  WHERE cco.id = v_orden_id;

  IF v_company_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_numero_recibo := public.fn_next_numero_recibo(v_company_id);
  v_token := public.fn_generar_token_recibo(v_company_id);

  INSERT INTO public.recibos_pagos (
    company_id,
    cliente_id,
    pago_copiado_id,
    orden_copiado_id,
    numero_recibo,
    token_corto,
    fecha_pago,
    monto,
    medio_cobro_id,
    referencia_pago,
    notas
  ) VALUES (
    v_company_id,
    v_cliente_id,
    NEW.id,
    v_orden_id,
    v_numero_recibo,
    v_token,
    NEW.fecha_pago,
    round(NEW.monto::numeric, 2),
    NEW.medio_cobro_id,
    NEW.referencia_pago,
    NEW.notas
  );

  RETURN NEW;
END;
$$;

