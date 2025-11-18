/*
  # Sistema de Ubicaciones Geográficas

  ## Descripción
  Esta migración crea la estructura completa para gestionar ubicaciones geográficas jerárquicas:
  países, provincias/estados y ciudades. Se incluyen datos pre-cargados de Argentina.

  ## Nuevas Tablas

  ### 1. `countries` (Países)
  - `id` (uuid, PK) - Identificador único del país
  - `name` (text) - Nombre del país
  - `iso_code` (text, unique) - Código ISO del país (ej: AR, BR, UY)
  - `phone_code` (text) - Código telefónico internacional (ej: +54)
  - `is_active` (boolean) - Si el país está activo
  - `created_at` (timestamptz) - Fecha de creación

  ### 2. `provinces` (Provincias/Estados)
  - `id` (uuid, PK) - Identificador único
  - `country_id` (uuid, FK) - Referencia a countries
  - `name` (text) - Nombre de la provincia
  - `code` (text) - Código de la provincia (opcional)
  - `is_active` (boolean) - Si está activa
  - `created_at` (timestamptz) - Fecha de creación

  ### 3. `cities` (Ciudades)
  - `id` (uuid, PK) - Identificador único
  - `province_id` (uuid, FK) - Referencia a provinces
  - `name` (text) - Nombre de la ciudad
  - `postal_code` (text) - Código postal
  - `is_active` (boolean) - Si está activa
  - `created_at` (timestamptz) - Fecha de creación

  ## Seguridad (Row Level Security)
  - Todas las tablas tienen RLS habilitado
  - Lectura pública para usuarios autenticados (necesario para formularios)
  - Solo super_admin puede crear, actualizar o eliminar ubicaciones

  ## Datos Iniciales
  - Argentina con sus 23 provincias + CABA
  - Ciudades principales de cada provincia
  - Códigos postales de ciudades principales
*/

-- Crear tabla de países
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  iso_code text UNIQUE NOT NULL,
  phone_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de provincias
CREATE TABLE IF NOT EXISTS provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(country_id, name)
);

-- Crear tabla de ciudades
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  postal_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(province_id, name)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_provinces_country_id ON provinces(country_id);
CREATE INDEX IF NOT EXISTS idx_provinces_name ON provinces(name);
CREATE INDEX IF NOT EXISTS idx_cities_province_id ON cities(province_id);
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);
CREATE INDEX IF NOT EXISTS idx_cities_postal_code ON cities(postal_code);

-- Habilitar Row Level Security
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para countries (lectura pública, escritura restringida)
CREATE POLICY "Anyone can view active countries"
  ON countries FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Only super_admin can manage countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas RLS para provinces
CREATE POLICY "Anyone can view active provinces"
  ON provinces FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Only super_admin can manage provinces"
  ON provinces FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas RLS para cities
CREATE POLICY "Anyone can view active cities"
  ON cities FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Only super_admin can manage cities"
  ON cities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Insertar Argentina como país base
INSERT INTO countries (name, iso_code, phone_code, is_active)
VALUES ('Argentina', 'AR', '+54', true)
ON CONFLICT (iso_code) DO NOTHING;

-- Insertar las 23 provincias + CABA
DO $$
DECLARE
  v_argentina_id uuid;
BEGIN
  SELECT id INTO v_argentina_id FROM countries WHERE iso_code = 'AR' LIMIT 1;
  
  IF v_argentina_id IS NOT NULL THEN
    INSERT INTO provinces (country_id, name, code, is_active) VALUES
      (v_argentina_id, 'Ciudad Autónoma de Buenos Aires', 'CABA', true),
      (v_argentina_id, 'Buenos Aires', 'BA', true),
      (v_argentina_id, 'Catamarca', 'CA', true),
      (v_argentina_id, 'Chaco', 'CC', true),
      (v_argentina_id, 'Chubut', 'CH', true),
      (v_argentina_id, 'Córdoba', 'CB', true),
      (v_argentina_id, 'Corrientes', 'CR', true),
      (v_argentina_id, 'Entre Ríos', 'ER', true),
      (v_argentina_id, 'Formosa', 'FO', true),
      (v_argentina_id, 'Jujuy', 'JY', true),
      (v_argentina_id, 'La Pampa', 'LP', true),
      (v_argentina_id, 'La Rioja', 'LR', true),
      (v_argentina_id, 'Mendoza', 'MZ', true),
      (v_argentina_id, 'Misiones', 'MI', true),
      (v_argentina_id, 'Neuquén', 'NQ', true),
      (v_argentina_id, 'Río Negro', 'RN', true),
      (v_argentina_id, 'Salta', 'SA', true),
      (v_argentina_id, 'San Juan', 'SJ', true),
      (v_argentina_id, 'San Luis', 'SL', true),
      (v_argentina_id, 'Santa Cruz', 'SC', true),
      (v_argentina_id, 'Santa Fe', 'SF', true),
      (v_argentina_id, 'Santiago del Estero', 'SE', true),
      (v_argentina_id, 'Tierra del Fuego', 'TF', true),
      (v_argentina_id, 'Tucumán', 'TU', true)
    ON CONFLICT (country_id, name) DO NOTHING;
  END IF;
END $$;

-- Insertar ciudades principales de cada provincia
DO $$
DECLARE
  v_caba_id uuid;
  v_ba_id uuid;
  v_cordoba_id uuid;
  v_santafe_id uuid;
  v_mendoza_id uuid;
  v_tucuman_id uuid;
  v_salta_id uuid;
  v_entrerios_id uuid;
  v_chaco_id uuid;
  v_corrientes_id uuid;
  v_misiones_id uuid;
  v_formosa_id uuid;
  v_jujuy_id uuid;
  v_neuquen_id uuid;
  v_rionegro_id uuid;
  v_chubut_id uuid;
  v_santacruz_id uuid;
  v_tierradelfuego_id uuid;
  v_lapampa_id uuid;
  v_larioja_id uuid;
  v_catamarca_id uuid;
  v_sanjuan_id uuid;
  v_sanluis_id uuid;
  v_santiagodelestero_id uuid;
BEGIN
  -- Obtener IDs de provincias
  SELECT id INTO v_caba_id FROM provinces WHERE name = 'Ciudad Autónoma de Buenos Aires' LIMIT 1;
  SELECT id INTO v_ba_id FROM provinces WHERE name = 'Buenos Aires' LIMIT 1;
  SELECT id INTO v_cordoba_id FROM provinces WHERE name = 'Córdoba' LIMIT 1;
  SELECT id INTO v_santafe_id FROM provinces WHERE name = 'Santa Fe' LIMIT 1;
  SELECT id INTO v_mendoza_id FROM provinces WHERE name = 'Mendoza' LIMIT 1;
  SELECT id INTO v_tucuman_id FROM provinces WHERE name = 'Tucumán' LIMIT 1;
  SELECT id INTO v_salta_id FROM provinces WHERE name = 'Salta' LIMIT 1;
  SELECT id INTO v_entrerios_id FROM provinces WHERE name = 'Entre Ríos' LIMIT 1;
  SELECT id INTO v_chaco_id FROM provinces WHERE name = 'Chaco' LIMIT 1;
  SELECT id INTO v_corrientes_id FROM provinces WHERE name = 'Corrientes' LIMIT 1;
  SELECT id INTO v_misiones_id FROM provinces WHERE name = 'Misiones' LIMIT 1;
  SELECT id INTO v_formosa_id FROM provinces WHERE name = 'Formosa' LIMIT 1;
  SELECT id INTO v_jujuy_id FROM provinces WHERE name = 'Jujuy' LIMIT 1;
  SELECT id INTO v_neuquen_id FROM provinces WHERE name = 'Neuquén' LIMIT 1;
  SELECT id INTO v_rionegro_id FROM provinces WHERE name = 'Río Negro' LIMIT 1;
  SELECT id INTO v_chubut_id FROM provinces WHERE name = 'Chubut' LIMIT 1;
  SELECT id INTO v_santacruz_id FROM provinces WHERE name = 'Santa Cruz' LIMIT 1;
  SELECT id INTO v_tierradelfuego_id FROM provinces WHERE name = 'Tierra del Fuego' LIMIT 1;
  SELECT id INTO v_lapampa_id FROM provinces WHERE name = 'La Pampa' LIMIT 1;
  SELECT id INTO v_larioja_id FROM provinces WHERE name = 'La Rioja' LIMIT 1;
  SELECT id INTO v_catamarca_id FROM provinces WHERE name = 'Catamarca' LIMIT 1;
  SELECT id INTO v_sanjuan_id FROM provinces WHERE name = 'San Juan' LIMIT 1;
  SELECT id INTO v_sanluis_id FROM provinces WHERE name = 'San Luis' LIMIT 1;
  SELECT id INTO v_santiagodelestero_id FROM provinces WHERE name = 'Santiago del Estero' LIMIT 1;

  -- CABA
  IF v_caba_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_caba_id, 'Buenos Aires', 'C1000', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Buenos Aires
  IF v_ba_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_ba_id, 'La Plata', 'B1900', true),
      (v_ba_id, 'Mar del Plata', 'B7600', true),
      (v_ba_id, 'Bahía Blanca', 'B8000', true),
      (v_ba_id, 'Tandil', 'B7000', true),
      (v_ba_id, 'Olavarría', 'B7400', true),
      (v_ba_id, 'Pergamino', 'B2700', true),
      (v_ba_id, 'San Nicolás', 'B2900', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Córdoba
  IF v_cordoba_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_cordoba_id, 'Córdoba', 'X5000', true),
      (v_cordoba_id, 'Villa María', 'X5900', true),
      (v_cordoba_id, 'Río Cuarto', 'X5800', true),
      (v_cordoba_id, 'Villa Carlos Paz', 'X5152', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Santa Fe
  IF v_santafe_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_santafe_id, 'Santa Fe', 'S3000', true),
      (v_santafe_id, 'Rosario', 'S2000', true),
      (v_santafe_id, 'Rafaela', 'S2300', true),
      (v_santafe_id, 'Venado Tuerto', 'S2600', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Mendoza
  IF v_mendoza_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_mendoza_id, 'Mendoza', 'M5500', true),
      (v_mendoza_id, 'San Rafael', 'M5600', true),
      (v_mendoza_id, 'Godoy Cruz', 'M5501', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Tucumán
  IF v_tucuman_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_tucuman_id, 'San Miguel de Tucumán', 'T4000', true),
      (v_tucuman_id, 'Yerba Buena', 'T4107', true),
      (v_tucuman_id, 'Tafí Viejo', 'T4103', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Salta
  IF v_salta_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_salta_id, 'Salta', 'A4400', true),
      (v_salta_id, 'San Ramón de la Nueva Orán', 'A4530', true),
      (v_salta_id, 'Tartagal', 'A4560', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Entre Ríos
  IF v_entrerios_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_entrerios_id, 'Paraná', 'E3100', true),
      (v_entrerios_id, 'Concordia', 'E3200', true),
      (v_entrerios_id, 'Gualeguaychú', 'E2820', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Chaco
  IF v_chaco_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_chaco_id, 'Resistencia', 'H3500', true),
      (v_chaco_id, 'Presidencia Roque Sáenz Peña', 'H3700', true),
      (v_chaco_id, 'Barranqueras', 'H3503', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Corrientes
  IF v_corrientes_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_corrientes_id, 'Corrientes', 'W3400', true),
      (v_corrientes_id, 'Goya', 'W3450', true),
      (v_corrientes_id, 'Paso de los Libres', 'W3230', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Misiones
  IF v_misiones_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_misiones_id, 'Posadas', 'N3300', true),
      (v_misiones_id, 'Eldorado', 'N3380', true),
      (v_misiones_id, 'Oberá', 'N3360', true),
      (v_misiones_id, 'Puerto Iguazú', 'N3370', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Formosa
  IF v_formosa_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_formosa_id, 'Formosa', 'P3600', true),
      (v_formosa_id, 'Clorinda', 'P3610', true),
      (v_formosa_id, 'Pirané', 'P3603', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Jujuy
  IF v_jujuy_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_jujuy_id, 'San Salvador de Jujuy', 'Y4600', true),
      (v_jujuy_id, 'San Pedro', 'Y4500', true),
      (v_jujuy_id, 'Libertador General San Martín', 'Y4508', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Neuquén
  IF v_neuquen_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_neuquen_id, 'Neuquén', 'Q8300', true),
      (v_neuquen_id, 'San Martín de los Andes', 'Q8370', true),
      (v_neuquen_id, 'Cutral Có', 'Q8322', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Río Negro
  IF v_rionegro_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_rionegro_id, 'Viedma', 'R8500', true),
      (v_rionegro_id, 'San Carlos de Bariloche', 'R8400', true),
      (v_rionegro_id, 'General Roca', 'R8332', true),
      (v_rionegro_id, 'Cipolletti', 'R8324', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Chubut
  IF v_chubut_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_chubut_id, 'Rawson', 'U9103', true),
      (v_chubut_id, 'Comodoro Rivadavia', 'U9000', true),
      (v_chubut_id, 'Trelew', 'U9100', true),
      (v_chubut_id, 'Puerto Madryn', 'U9120', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Santa Cruz
  IF v_santacruz_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_santacruz_id, 'Río Gallegos', 'Z9400', true),
      (v_santacruz_id, 'Caleta Olivia', 'Z9011', true),
      (v_santacruz_id, 'El Calafate', 'Z9405', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Tierra del Fuego
  IF v_tierradelfuego_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_tierradelfuego_id, 'Ushuaia', 'V9410', true),
      (v_tierradelfuego_id, 'Río Grande', 'V9420', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- La Pampa
  IF v_lapampa_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_lapampa_id, 'Santa Rosa', 'L6300', true),
      (v_lapampa_id, 'General Pico', 'L6360', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- La Rioja
  IF v_larioja_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_larioja_id, 'La Rioja', 'F5300', true),
      (v_larioja_id, 'Chilecito', 'F5360', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Catamarca
  IF v_catamarca_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_catamarca_id, 'San Fernando del Valle de Catamarca', 'K4700', true),
      (v_catamarca_id, 'Andalgalá', 'K4740', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- San Juan
  IF v_sanjuan_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_sanjuan_id, 'San Juan', 'J5400', true),
      (v_sanjuan_id, 'Caucete', 'J5442', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- San Luis
  IF v_sanluis_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_sanluis_id, 'San Luis', 'D5700', true),
      (v_sanluis_id, 'Villa Mercedes', 'D5730', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

  -- Santiago del Estero
  IF v_santiagodelestero_id IS NOT NULL THEN
    INSERT INTO cities (province_id, name, postal_code, is_active) VALUES
      (v_santiagodelestero_id, 'Santiago del Estero', 'G4200', true),
      (v_santiagodelestero_id, 'La Banda', 'G4300', true),
      (v_santiagodelestero_id, 'Termas de Río Hondo', 'G4220', true)
    ON CONFLICT (province_id, name) DO NOTHING;
  END IF;

END $$;