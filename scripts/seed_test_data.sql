
-- Seed Test Data for Pasos and Clientes

DO $$
DECLARE
  v_company_id UUID;
  v_station_id UUID;
  v_paso_count INTEGER;
  v_cliente_count INTEGER;
BEGIN
  -- 1. Get Company
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found';
  END IF;
  
  RAISE NOTICE 'Using Company ID: %', v_company_id;

  -- 2. Get or Create Station
  SELECT id INTO v_station_id FROM estaciones_trabajo WHERE company_id = v_company_id LIMIT 1;

  IF v_station_id IS NULL THEN
    INSERT INTO estaciones_trabajo (company_id, nombre, is_active)
    VALUES (v_company_id, 'Estación de Prueba', true)
    RETURNING id INTO v_station_id;
    RAISE NOTICE 'Created new Station ID: %', v_station_id;
  ELSE
    RAISE NOTICE 'Using existing Station ID: %', v_station_id;
  END IF;

  -- 3. Insert 100 Pasos for different stages
  INSERT INTO pasos (company_id, nombre, etapa, estacion_id, is_active)
  SELECT 
    v_company_id,
    'Paso de Prueba ' || i || ' - ' || (ARRAY['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion'])[1 + (i % 4)],
    (ARRAY['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion'])[1 + (i % 4)], -- Implicit cast or text
    v_station_id,
    true
  FROM generate_series(1, 100) AS t(i);
  
  GET DIAGNOSTICS v_paso_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % Pasos', v_paso_count;

  -- 4. Insert 10 Clientes
  INSERT INTO clients (
    company_id, 
    nombre_fantasia, 
    razon_social, 
    tipo_documento, 
    numero_documento, 
    is_active,
    tiene_cuenta_corriente,
    dias_vencimiento
  )
  SELECT 
    v_company_id,
    'Cliente Prueba ' || i,
    'Cliente Prueba ' || i || ' S.A.',
    'CUIT',
    '20' || lpad(i::text, 8, '0') || '1',
    true,
    false,
    30
  FROM generate_series(1, 50) AS t(i)
  ON CONFLICT DO NOTHING; -- Avoid duplicates if running multiple times

  GET DIAGNOSTICS v_cliente_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % Clientes', v_cliente_count;
  
END $$;
