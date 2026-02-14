-- Add tracking support for copy-center orders and extend public tracking RPC

-- 1) Add tracking_token to centro_copiado_ordenes (if missing)
ALTER TABLE public.centro_copiado_ordenes
  ADD COLUMN IF NOT EXISTS tracking_token varchar(32);

-- 2) Helper: generate a token unique across OT, Copiado and Presupuestos
CREATE OR REPLACE FUNCTION public.generate_unique_public_tracking_token()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  new_token varchar(32);
BEGIN
  LOOP
    new_token := public.generate_tracking_token();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.ordenes_trabajo ot WHERE ot.tracking_token = new_token
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.centro_copiado_ordenes cc WHERE cc.tracking_token = new_token
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.presupuestos p WHERE p.tracking_token = new_token
    );
  END LOOP;

  RETURN new_token;
END;
$$;

-- 3) Backfill missing/invalid tokens
UPDATE public.centro_copiado_ordenes cc
SET tracking_token = public.generate_unique_public_tracking_token()
WHERE cc.tracking_token IS NULL
   OR length(cc.tracking_token) <> 32
   OR cc.tracking_token !~ '^[A-Z0-9]{32}$';

-- 4) Resolve duplicates inside centro_copiado_ordenes (keep oldest, regenerate others)
WITH ranked AS (
  SELECT
    id,
    tracking_token,
    row_number() OVER (
      PARTITION BY tracking_token
      ORDER BY created_at, id
    ) AS rn
  FROM public.centro_copiado_ordenes
  WHERE tracking_token IS NOT NULL
)
UPDATE public.centro_copiado_ordenes cc
SET tracking_token = public.generate_unique_public_tracking_token()
FROM ranked r
WHERE cc.id = r.id
  AND r.rn > 1;

-- 5) Constraints/indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'centro_copiado_tracking_token_format_check'
      AND conrelid = 'public.centro_copiado_ordenes'::regclass
  ) THEN
    ALTER TABLE public.centro_copiado_ordenes
      ADD CONSTRAINT centro_copiado_tracking_token_format_check
      CHECK (
        tracking_token IS NULL OR
        (length(tracking_token) = 32 AND tracking_token ~ '^[A-Z0-9]{32}$')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_centro_copiado_tracking_token
  ON public.centro_copiado_ordenes(tracking_token)
  WHERE tracking_token IS NOT NULL;

-- 6) Trigger to auto-generate token on insert
CREATE OR REPLACE FUNCTION public.set_tracking_token_centro_copiado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tracking_token IS NULL
     OR length(NEW.tracking_token) <> 32
     OR NEW.tracking_token !~ '^[A-Z0-9]{32}$' THEN
    NEW.tracking_token := public.generate_unique_public_tracking_token();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_tracking_token_centro_copiado
ON public.centro_copiado_ordenes;

CREATE TRIGGER trigger_set_tracking_token_centro_copiado
  BEFORE INSERT ON public.centro_copiado_ordenes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tracking_token_centro_copiado();

-- 7) Extend public tracking RPC to support copy-center tokens as fallback
CREATE OR REPLACE FUNCTION public.fn_get_public_order_tracking(p_tracking_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- A) Try standard OT tracking first (full production detail)
  SELECT jsonb_build_object(
    'id', ot.id,
    'numero_orden', ot.numero_orden,
    'estado', ot.estado,
    'fecha_creacion', ot.fecha_creacion,
    'fecha_estimada_entrega', ot.fecha_estimada_entrega,
    'cliente_nombre', COALESCE(c.nombre_fantasia, c.razon_social),
    'company_id', ot.company_id,
    'company_name', comp.name,
    'company_address', comp.address,
    'company_phone', comp.contact_phone,
    'company_business_hours', COALESCE((
      SELECT json_agg(json_build_object(
        'day_of_week', cbh.day_of_week,
        'day_name', CASE cbh.day_of_week
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Lunes'
          WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles'
          WHEN 4 THEN 'Jueves'
          WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
          ELSE 'Desconocido'
        END,
        'is_open', cbh.is_open,
        'opening_time_1', cbh.opening_time_1,
        'closing_time_1', cbh.closing_time_1,
        'opening_time_2', cbh.opening_time_2,
        'closing_time_2', cbh.closing_time_2
      ) ORDER BY cbh.day_of_week)
      FROM public.company_business_hours cbh
      WHERE cbh.company_id = ot.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', oti.id,
        'producto_nombre', oti.producto_nombre,
        'producto_categoria', oti.producto_categoria,
        'cantidad', oti.cantidad,
        'estado', oti.estado,
        'pasos', COALESCE((
          SELECT json_agg(json_build_object(
            'id', otir.id,
            'paso_nombre', otir.paso_nombre,
            'tipo_etapa', otir.tipo_etapa,
            'orden', otir.orden,
            'estado_paso', otir.estado_paso,
            'fecha_inicio', otir.fecha_inicio,
            'fecha_fin', otir.fecha_fin,
            'cantidad_pausas', otir.cantidad_pausas,
            'pausa_info', CASE
              WHEN otir.estado_paso = 'pausado' THEN
                (
                  SELECT json_build_object(
                    'esta_pausado', true,
                    'categoria_motivo', p.categoria_motivo,
                    'fecha_inicio_pausa', p.fecha_inicio_pausa,
                    'tiempo_pausado_horas', ROUND(
                      EXTRACT(EPOCH FROM (now() - p.fecha_inicio_pausa)) / 3600, 1
                    )
                  )
                  FROM public.ordenes_items_rutas_pausas p
                  WHERE p.ruta_id = otir.id
                    AND p.fecha_fin_pausa IS NULL
                  LIMIT 1
                )
              ELSE
                json_build_object('esta_pausado', false)
            END
          ) ORDER BY
            CASE otir.tipo_etapa
              WHEN 'pre_prensa' THEN 1
              WHEN 'principal' THEN 2
              WHEN 'post_prensa' THEN 3
              WHEN 'instalacion' THEN 4
              ELSE 5
            END,
            otir.orden
          )
          FROM public.ordenes_trabajo_items_rutas otir
          WHERE otir.orden_item_id = oti.id
        ), '[]'::json)
      ) ORDER BY oti.created_at)
      FROM public.ordenes_trabajo_items oti
      WHERE oti.orden_id = ot.id
    ), '[]'::json)
  ) INTO v_result
  FROM public.ordenes_trabajo ot
  LEFT JOIN public.clients c ON c.id = ot.cliente_id
  LEFT JOIN public.companies comp ON comp.id = ot.company_id
  WHERE ot.tracking_token = p_tracking_token
    AND ot.tracking_token IS NOT NULL;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- B) Fallback: copy-center tracking with simplified item progress
  SELECT jsonb_build_object(
    'id', cc.id,
    'numero_orden', cc.numero_orden,
    'estado', cc.estado,
    'fecha_creacion', cc.fecha_solicitud,
    'fecha_estimada_entrega', cc.fecha_entrega_estimada,
    'cliente_nombre', COALESCE(c.nombre_fantasia, c.razon_social, 'Cliente'),
    'company_id', cc.company_id,
    'company_name', comp.name,
    'company_address', comp.address,
    'company_phone', comp.contact_phone,
    'company_business_hours', COALESCE((
      SELECT json_agg(json_build_object(
        'day_of_week', cbh.day_of_week,
        'day_name', CASE cbh.day_of_week
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Lunes'
          WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles'
          WHEN 4 THEN 'Jueves'
          WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
          ELSE 'Desconocido'
        END,
        'is_open', cbh.is_open,
        'opening_time_1', cbh.opening_time_1,
        'closing_time_1', cbh.closing_time_1,
        'opening_time_2', cbh.opening_time_2,
        'closing_time_2', cbh.closing_time_2
      ) ORDER BY cbh.day_of_week)
      FROM public.company_business_hours cbh
      WHERE cbh.company_id = cc.company_id
    ), '[]'::json),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', cci.id,
        'producto_nombre', COALESCE(NULLIF(cci.descripcion, ''), initcap(replace(cci.tipo_item, '_', ' '))),
        'producto_categoria', 'Centro de Copiado',
        'cantidad', COALESCE(cci.cantidad_unidades, 1),
        'estado', CASE
          WHEN cc.estado IN ('finalizada', 'entregada') THEN 'finalizado'
          WHEN cc.estado = 'en_proceso' THEN 'en_proceso'
          ELSE 'pendiente'
        END,
        'pasos', '[]'::json
      ) ORDER BY cci.created_at)
      FROM public.centro_copiado_ordenes_items cci
      WHERE cci.orden_copiado_id = cc.id
    ), '[]'::json)
  ) INTO v_result
  FROM public.centro_copiado_ordenes cc
  LEFT JOIN public.clients c ON c.id = cc.cliente_id
  LEFT JOIN public.companies comp ON comp.id = cc.company_id
  WHERE cc.tracking_token = p_tracking_token
    AND cc.tracking_token IS NOT NULL;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_public_order_tracking(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_public_order_tracking(text) IS
'Obtiene información de seguimiento público por tracking_token.
Primero busca en ordenes_trabajo (detalle completo) y, si no existe, cae a centro_copiado_ordenes (vista simple).';
