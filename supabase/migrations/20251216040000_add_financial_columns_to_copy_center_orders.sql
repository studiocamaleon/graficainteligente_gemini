/*
  # Agregar columnas financieras a Centro de Copiado

  1. Nuevas Columnas
    - `subtotal` (numeric, default 0)
    - `total_descuentos` (numeric, default 0)

  2. Propósito
    - Permitir guardar el desglose de precios en las órdenes de copiado.
*/

DO $$ 
BEGIN
  -- Add subtotal column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'centro_copiado_ordenes' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE centro_copiado_ordenes 
    ADD COLUMN subtotal numeric(10,2) DEFAULT 0 CHECK (subtotal >= 0);
  END IF;

  -- Add total_descuentos column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'centro_copiado_ordenes' AND column_name = 'total_descuentos'
  ) THEN
    ALTER TABLE centro_copiado_ordenes 
    ADD COLUMN total_descuentos numeric(10,2) DEFAULT 0 CHECK (total_descuentos >= 0);
  END IF;
END $$;
