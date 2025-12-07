-- =============================================
-- MIGRATION: 20251207214500_fix_egresos_credit_card.sql
-- Description: Makes caja_id nullable and updates trigger to handle credit card expenses.
-- =============================================

-- 1. Make caja_id nullable in egresos table
ALTER TABLE egresos ALTER COLUMN caja_id DROP NOT NULL;

-- 2. Update the trigger function to handle null caja_id
CREATE OR REPLACE FUNCTION fn_crear_movimiento_egreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movimiento_id uuid;
BEGIN
  -- Only create a movement in cajas_movimientos if a caja is involved (caja_id is NOT NULL)
  IF NEW.caja_id IS NOT NULL THEN
      INSERT INTO cajas_movimientos (
        caja_id,
        tipo_movimiento,
        monto,
        concepto,
        fecha,
        referencia_tipo,
        referencia_id,
        created_by
      ) VALUES (
        NEW.caja_id,
        'egreso',
        NEW.monto,
        NEW.concepto,
        NEW.fecha,
        'egreso',
        NEW.id,
        NEW.created_by
      )
      RETURNING id INTO v_movimiento_id;

      NEW.movimiento_id := v_movimiento_id;
  END IF;

  RETURN NEW;
END;
$$;
