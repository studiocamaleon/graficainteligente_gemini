-- 1. Add 'tipo_item' enum to ordenes_trabajo_items (Safe check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordenes_trabajo_items' AND column_name = 'tipo_item') THEN
        ALTER TABLE ordenes_trabajo_items 
        ADD COLUMN tipo_item text DEFAULT 'standard' CHECK (tipo_item IN ('standard', 'centro_copiado'));
    END IF;
END $$;

-- 2. Create "Centro de Copiado" Station (if not exists)
DO $$
DECLARE
  v_company_id uuid;
  v_estacion_id uuid;
  v_paso_id uuid;
  v_ruta_id uuid;
BEGIN
  -- Attempt to get a generic company_id (usually the first one, or we can use a specific one if multi-tenant context allows)
  -- For safer migration, we might loop through all companies, but let's assume single tenant or applying to all.
  -- Better strategy: This data should be per-company. We'll loop through valid companies.
  
  FOR v_company_id IN SELECT id FROM companies WHERE status = 'active' LOOP
      
      -- A. Insert Station
      INSERT INTO estaciones_trabajo (company_id, nombre, descripcion, is_active)
      SELECT v_company_id, 'Centro de Copiado', 'Estación para trabajos de impresión rápida y anillados', true
      WHERE NOT EXISTS (
          SELECT 1 FROM estaciones_trabajo WHERE company_id = v_company_id AND nombre = 'Centro de Copiado'
      )
      RETURNING id INTO v_estacion_id;

      -- If existing, get the ID
      IF v_estacion_id IS NULL THEN
          SELECT id INTO v_estacion_id FROM estaciones_trabajo WHERE company_id = v_company_id AND nombre = 'Centro de Copiado';
      END IF;

      -- B. Insert Step "Impresión / Copiado" (Production Stage)
      INSERT INTO pasos (company_id, nombre, etapa, estacion_id, is_active)
      SELECT v_company_id, 'Impresión / Copiado', 'Produccion', v_estacion_id, true
      WHERE NOT EXISTS (
          SELECT 1 FROM pasos WHERE company_id = v_company_id AND nombre = 'Impresión / Copiado'
      )
      RETURNING id INTO v_paso_id;

      IF v_paso_id IS NULL THEN
           SELECT id INTO v_paso_id FROM pasos WHERE company_id = v_company_id AND nombre = 'Impresión / Copiado';
      END IF;

      -- C. Insert Standard Route "Ruta Centro de Copiado"
      INSERT INTO rutas_produccion (company_id, nombre, descripcion, is_active)
      SELECT v_company_id, 'Ruta Centro de Copiado', 'Flujo estándar para items de copiado rápido', true
      WHERE NOT EXISTS (
          SELECT 1 FROM rutas_produccion WHERE company_id = v_company_id AND nombre = 'Ruta Centro de Copiado'
      )
      RETURNING id INTO v_ruta_id;

      IF v_ruta_id IS NULL THEN
          SELECT id INTO v_ruta_id FROM rutas_produccion WHERE company_id = v_company_id AND nombre = 'Ruta Centro de Copiado';
      END IF;

      -- D. Link Step to Route (Orden 1, Obligatorio)
      INSERT INTO rutas_produccion_pasos (ruta_id, etapa, paso_id, orden, es_obligatorio, tipo_condicion)
      SELECT v_ruta_id, 'Produccion', v_paso_id, 1, true, 'sin_condicion'
      WHERE NOT EXISTS (
          SELECT 1 FROM rutas_produccion_pasos WHERE ruta_id = v_ruta_id AND paso_id = v_paso_id
      );

  END LOOP;
END $$;
