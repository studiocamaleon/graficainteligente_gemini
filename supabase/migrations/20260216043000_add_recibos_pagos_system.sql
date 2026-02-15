/*
  # Sistema de Recibos por Pago (PDF)

  Objetivo:
  - Cada vez que se registra un pago (OT o Centro de Copiado), se crea un "Recibo N" por empresa.
  - Se dispara una Edge Function para generar y subir el PDF al bucket `recibos`.
  - Se expone un token corto por tenant para poder generar una URL pública que redirige a un signed URL.

  Nota:
  - En esta iteración, si un pago se edita o elimina, NO se actualiza/anula el recibo automáticamente.
*/

-- =====================================================
-- 1) Storage bucket: recibos (privado)
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('recibos', 'recibos', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2) Contador por empresa para numeración de recibos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recibos_pagos_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  next_num integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_next_num_positive CHECK (next_num >= 1)
);

-- =====================================================
-- 3) Tabla: recibos_pagos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recibos_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,

  -- Relación con pago / orden (uno de estos debe estar presente)
  pago_ot_id uuid REFERENCES public.ordenes_trabajo_pagos(id) ON DELETE SET NULL,
  pago_copiado_id uuid REFERENCES public.centro_copiado_ordenes_pagos(id) ON DELETE SET NULL,
  orden_trabajo_id uuid REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL,
  orden_copiado_id uuid REFERENCES public.centro_copiado_ordenes(id) ON DELETE SET NULL,

  numero_recibo integer NOT NULL,
  token_corto text NOT NULL,

  fecha_emision timestamptz NOT NULL DEFAULT now(),
  fecha_pago date NOT NULL,
  monto numeric(10,2) NOT NULL CHECK (monto > 0),

  -- Métodos de pago (OT tiene "metodo_pago"; ambos pueden tener medio_cobro_id)
  metodo_pago text,
  medio_cobro_id uuid REFERENCES public.medios_cobro(id) ON DELETE SET NULL,
  referencia_pago text,
  notas text,

  pdf_storage_path text,
  pdf_generated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_recibos_pagos_company_numero UNIQUE (company_id, numero_recibo),
  CONSTRAINT uq_recibos_pagos_company_token UNIQUE (company_id, token_corto),
  CONSTRAINT chk_recibo_pago_ref CHECK (
    (pago_ot_id IS NOT NULL)::int + (pago_copiado_id IS NOT NULL)::int >= 1
  )
);

CREATE INDEX IF NOT EXISTS idx_recibos_pagos_company_id ON public.recibos_pagos(company_id);
CREATE INDEX IF NOT EXISTS idx_recibos_pagos_cliente_id ON public.recibos_pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recibos_pagos_fecha_emision ON public.recibos_pagos(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_recibos_pagos_token ON public.recibos_pagos(token_corto);

-- updated_at trigger (ya existe update_updated_at_column en el proyecto)
DROP TRIGGER IF EXISTS update_recibos_pagos_updated_at ON public.recibos_pagos;
CREATE TRIGGER update_recibos_pagos_updated_at
  BEFORE UPDATE ON public.recibos_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: lectura para usuarios de la empresa
ALTER TABLE public.recibos_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company recibos pagos" ON public.recibos_pagos;
CREATE POLICY "Users can view own company recibos pagos"
  ON public.recibos_pagos FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 4) Helpers: token corto + numeración atómica
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_generar_token_recibo(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_existe boolean;
  v_intentos integer := 0;
  v_max_intentos integer := 10;
BEGIN
  LOOP
    v_token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    SELECT EXISTS(
      SELECT 1
      FROM public.recibos_pagos
      WHERE company_id = p_company_id
        AND token_corto = v_token
    ) INTO v_existe;

    EXIT WHEN NOT v_existe;

    v_intentos := v_intentos + 1;
    IF v_intentos >= v_max_intentos THEN
      RAISE EXCEPTION 'No se pudo generar token único después de % intentos', v_max_intentos;
    END IF;
  END LOOP;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_next_numero_recibo(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_num integer;
BEGIN
  INSERT INTO public.recibos_pagos_counters(company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.recibos_pagos_counters
  SET next_num = next_num + 1,
      updated_at = now()
  WHERE company_id = p_company_id
  RETURNING next_num - 1 INTO v_num;

  RETURN v_num;
END;
$$;

-- =====================================================
-- 5) RPC para Edge Function: obtener recibo por token
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_obtener_recibo_por_token(
  p_company_id uuid,
  p_token text
)
RETURNS TABLE(
  recibo_id uuid,
  pdf_storage_path text,
  numero_recibo integer,
  orden_numero text,
  monto numeric,
  fecha_pago date,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rp.id,
    rp.pdf_storage_path,
    rp.numero_recibo,
    COALESCE(ot.numero_orden, cco.numero_orden) as orden_numero,
    rp.monto,
    rp.fecha_pago,
    (rp.pdf_storage_path IS NOT NULL) as is_valid
  FROM public.recibos_pagos rp
  LEFT JOIN public.ordenes_trabajo ot ON ot.id = rp.orden_trabajo_id
  LEFT JOIN public.centro_copiado_ordenes cco ON cco.id = rp.orden_copiado_id
  WHERE rp.company_id = p_company_id
    AND rp.token_corto = p_token;
END;
$$;

-- =====================================================
-- 6) Triggers: crear recibo al insertar un pago
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_trigger_crear_recibo_por_pago_ot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'private'
AS $$
DECLARE
  v_company_id uuid;
  v_cliente_id uuid;
  v_orden_id uuid;
  v_numero_recibo integer;
  v_token text;
  v_supabase_url text;
  v_trigger_secret text;
  v_edge_url text;
  v_cfg_supabase_url text;
  v_cfg_trigger_secret text;
  v_recibo_id uuid;
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
  )
  RETURNING id INTO v_recibo_id;

  SELECT
    nullif(supabase_url, ''),
    nullif(trigger_secret_token, '')
  INTO
    v_cfg_supabase_url,
    v_cfg_trigger_secret
  FROM private.runtime_config
  WHERE id = true
  LIMIT 1;

  v_supabase_url := COALESCE(v_cfg_supabase_url, nullif(current_setting('app.supabase_url', true), ''));
  v_trigger_secret := COALESCE(v_cfg_trigger_secret, nullif(current_setting('app.trigger_secret_token', true), ''));

  IF v_supabase_url IS NULL OR v_trigger_secret IS NULL THEN
    RAISE WARNING '[Recibos] Missing runtime_config supabase_url/trigger_secret_token. Skipping PDF generation.';
    RETURN NEW;
  END IF;

  v_edge_url := rtrim(v_supabase_url, '/') || '/functions/v1/generate-recibo-pdf';

  BEGIN
    PERFORM net.http_post(
      url := v_edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret
      ),
      body := jsonb_build_object(
        'recibo_id', v_recibo_id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Recibos] Error calling PDF generator: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_crear_recibo_por_pago_ot ON public.ordenes_trabajo_pagos;
CREATE TRIGGER trigger_crear_recibo_por_pago_ot
  AFTER INSERT ON public.ordenes_trabajo_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_crear_recibo_por_pago_ot();

CREATE OR REPLACE FUNCTION public.fn_trigger_crear_recibo_por_pago_copiado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'private'
AS $$
DECLARE
  v_company_id uuid;
  v_cliente_id uuid;
  v_orden_id uuid;
  v_numero_recibo integer;
  v_token text;
  v_supabase_url text;
  v_trigger_secret text;
  v_edge_url text;
  v_cfg_supabase_url text;
  v_cfg_trigger_secret text;
  v_recibo_id uuid;
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
  )
  RETURNING id INTO v_recibo_id;

  SELECT
    nullif(supabase_url, ''),
    nullif(trigger_secret_token, '')
  INTO
    v_cfg_supabase_url,
    v_cfg_trigger_secret
  FROM private.runtime_config
  WHERE id = true
  LIMIT 1;

  v_supabase_url := COALESCE(v_cfg_supabase_url, nullif(current_setting('app.supabase_url', true), ''));
  v_trigger_secret := COALESCE(v_cfg_trigger_secret, nullif(current_setting('app.trigger_secret_token', true), ''));

  IF v_supabase_url IS NULL OR v_trigger_secret IS NULL THEN
    RAISE WARNING '[Recibos] Missing runtime_config supabase_url/trigger_secret_token. Skipping PDF generation.';
    RETURN NEW;
  END IF;

  v_edge_url := rtrim(v_supabase_url, '/') || '/functions/v1/generate-recibo-pdf';

  BEGIN
    PERFORM net.http_post(
      url := v_edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', v_trigger_secret
      ),
      body := jsonb_build_object(
        'recibo_id', v_recibo_id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Recibos] Error calling PDF generator: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_crear_recibo_por_pago_copiado ON public.centro_copiado_ordenes_pagos;
CREATE TRIGGER trigger_crear_recibo_por_pago_copiado
  AFTER INSERT ON public.centro_copiado_ordenes_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_crear_recibo_por_pago_copiado();

