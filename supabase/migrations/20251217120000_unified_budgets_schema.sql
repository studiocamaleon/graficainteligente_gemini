-- =====================================================
-- UNIFIED BUDGETS: Schema Updates for Presupuestos
-- =====================================================

DO $$
BEGIN
    -- 1. Update Check Constraint for 'tipo_item' in 'presupuestos_items'
    -- First, check if the constraint exists to drop it (to allow modification)
    -- We assume the constraint name, or we search for it. 
    -- Common name pattern: table_column_check
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_items_tipo_item_check'
    ) THEN
        ALTER TABLE presupuestos_items DROP CONSTRAINT presupuestos_items_tipo_item_check;
    END IF;

    -- Re-add the constraint with 'centro_copiado' included
    -- We also include 'producto_sistema', 'item_personalizado' which likely existed, and 'standard' for consistency with OT
    ALTER TABLE presupuestos_items 
    ADD CONSTRAINT presupuestos_items_tipo_item_check 
    CHECK (tipo_item IN ('producto_sistema', 'item_personalizado', 'centro_copiado', 'standard'));

    -- 2. Ensure 'configuracion' column exists (JSONB)
    -- Used to store specific configurations for copy center items (paper, binding, etc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'presupuestos_items' AND column_name = 'configuracion'
    ) THEN
        ALTER TABLE presupuestos_items ADD COLUMN configuracion JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 3. Ensure 'unidad_medida' matches new needs (optional, usually text)
    -- Verify if we need new columns for price breakdown in Budgets equivalent to OT?
    -- OT has: precio_base, precio_servicios, precio_acabados.
    -- Presupuestos items usually has: precio_unitario, cantidad, subtotal.
    -- Ideally, we should add breakdown columns to Budgets too for accurate conversion.
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presupuestos_items' AND column_name = 'precio_base') THEN
        ALTER TABLE presupuestos_items ADD COLUMN precio_base numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presupuestos_items' AND column_name = 'precio_servicios') THEN
        ALTER TABLE presupuestos_items ADD COLUMN precio_servicios numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presupuestos_items' AND column_name = 'precio_acabados') THEN
        ALTER TABLE presupuestos_items ADD COLUMN precio_acabados numeric DEFAULT 0;
    END IF;

    -- Also 'tiempo_produccion_dias' might be useful
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presupuestos_items' AND column_name = 'tiempo_produccion_dias') THEN
         ALTER TABLE presupuestos_items ADD COLUMN tiempo_produccion_dias integer DEFAULT 0;
    END IF;

END $$;
