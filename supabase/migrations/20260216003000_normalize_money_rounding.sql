/*
  # Normalizar redondeo de montos (2 decimales) para evitar "adeuda por centavos"

  ## Problema
  Varias columnas monetarias son `numeric` sin escala fija. Si desde JS se insertan números
  con artefactos (ej: 0.30000000000004), esos decimales quedan persistidos y al comparar
  `total - sum(pagos)` aparece un saldo residual muy pequeño.

  ## Solución
  1) Redondear datos existentes a 2 decimales en las tablas principales.
  2) Endurecer el trigger `calcular_datos_pago_from_medio_cobro()` para que redondee
     `monto` y `comision_aplicada` antes de persistir.
*/

-- 1) Datos existentes: pagos OT
UPDATE public.ordenes_trabajo_pagos
SET
  monto = round(monto::numeric, 2),
  comision_aplicada = round(coalesce(comision_aplicada, 0)::numeric, 2)
WHERE
  monto IS NOT NULL
  AND (
    monto <> round(monto::numeric, 2)
    OR coalesce(comision_aplicada, 0) <> round(coalesce(comision_aplicada, 0)::numeric, 2)
  );

-- 2) Datos existentes: header OT (solo columnas conocidas; si faltan en algún entorno, esta migración fallará)
DO $$
BEGIN
  -- Columnas que existen en el esquema actual del proyecto (según migraciones).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ordenes_trabajo' AND column_name = 'subtotal'
  ) THEN
    EXECUTE $sql$
      UPDATE public.ordenes_trabajo
      SET
        subtotal = round(coalesce(subtotal, 0)::numeric, 2),
        total_descuentos = round(coalesce(total_descuentos, 0)::numeric, 2),
        total = round(coalesce(total, 0)::numeric, 2)
      WHERE
        (subtotal IS NOT NULL AND subtotal <> round(subtotal::numeric, 2))
        OR (total_descuentos IS NOT NULL AND total_descuentos <> round(total_descuentos::numeric, 2))
        OR (total IS NOT NULL AND total <> round(total::numeric, 2));
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ordenes_trabajo' AND column_name = 'subtotal_iva'
  ) THEN
    EXECUTE $sql$
      UPDATE public.ordenes_trabajo
      SET subtotal_iva = round(coalesce(subtotal_iva, 0)::numeric, 2)
      WHERE subtotal_iva IS NOT NULL AND subtotal_iva <> round(subtotal_iva::numeric, 2);
    $sql$;
  END IF;
END;
$$;

-- 3) Datos existentes: items OT (redondeo a 2 decimales para consistencia de totales)
UPDATE public.ordenes_trabajo_items
SET
  precio_base = round(coalesce(precio_base, 0)::numeric, 2),
  precio_servicios = round(coalesce(precio_servicios, 0)::numeric, 2),
  precio_acabados = round(coalesce(precio_acabados, 0)::numeric, 2),
  precio_unitario_final = round(coalesce(precio_unitario_final, 0)::numeric, 2),
  precio_total = round(coalesce(precio_total, 0)::numeric, 2)
WHERE
  (precio_base IS NOT NULL AND precio_base <> round(precio_base::numeric, 2))
  OR (precio_servicios IS NOT NULL AND precio_servicios <> round(precio_servicios::numeric, 2))
  OR (precio_acabados IS NOT NULL AND precio_acabados <> round(precio_acabados::numeric, 2))
  OR (precio_unitario_final IS NOT NULL AND precio_unitario_final <> round(precio_unitario_final::numeric, 2))
  OR (precio_total IS NOT NULL AND precio_total <> round(precio_total::numeric, 2));

-- 4) Endurecer trigger de pagos OT para redondear siempre
CREATE OR REPLACE FUNCTION public.calcular_datos_pago_from_medio_cobro()
RETURNS TRIGGER AS $$
DECLARE
  v_medio_cobro public.medios_cobro%ROWTYPE;
BEGIN
  -- Normalizar monto antes de cualquier cálculo.
  IF NEW.monto IS NOT NULL THEN
    NEW.monto := round(NEW.monto::numeric, 2);
  END IF;

  -- Si tiene medio_cobro_id, calcular comisión y fecha de liberación
  IF NEW.medio_cobro_id IS NOT NULL THEN
    SELECT * INTO v_medio_cobro
    FROM public.medios_cobro
    WHERE id = NEW.medio_cobro_id;

    IF v_medio_cobro.comision_porcentaje IS NOT NULL AND v_medio_cobro.comision_porcentaje > 0 THEN
      NEW.comision_aplicada := (NEW.monto * v_medio_cobro.comision_porcentaje / 100);
    ELSE
      NEW.comision_aplicada := 0;
    END IF;

    IF v_medio_cobro.dias_liberacion IS NOT NULL AND v_medio_cobro.dias_liberacion > 0 THEN
      NEW.fecha_liberacion_estimada := NEW.fecha_pago + (v_medio_cobro.dias_liberacion || ' days')::interval;
    ELSE
      NEW.fecha_liberacion_estimada := NEW.fecha_pago;
    END IF;
  ELSE
    NEW.comision_aplicada := 0;
    NEW.fecha_liberacion_estimada := NEW.fecha_pago;
  END IF;

  -- Normalizar comisión siempre
  NEW.comision_aplicada := round(coalesce(NEW.comision_aplicada, 0)::numeric, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

