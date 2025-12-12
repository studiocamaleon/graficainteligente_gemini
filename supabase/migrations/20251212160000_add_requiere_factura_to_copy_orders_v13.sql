-- Migration v13: Add 'requiere_factura' to Copy Center Orders
-- DESCRIPTION: Adds the 'requiere_factura' column to 'centro_copiado_ordenes' to support conditional tax logic.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centro_copiado_ordenes' AND column_name = 'requiere_factura') THEN
        ALTER TABLE centro_copiado_ordenes ADD COLUMN requiere_factura boolean NOT NULL DEFAULT false;
    END IF;
END $$;
