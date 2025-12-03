/*
  # Sistema de URLs Cortas para Facturas

  1. Nueva Tabla
    - `facturas_urls_cortas`
      - Almacena tokens cortos únicos por empresa para acceso rápido a facturas
      - Incluye expiración automática de 30 días
      - Multi-tenant: cada empresa tiene su propio espacio de tokens

  2. Función de Generación de Token
    - `fn_generar_token_factura`
      - Genera token alfanumérico de 8 caracteres
      - Garantiza unicidad dentro de cada empresa
      - Retorna el token generado

  3. Seguridad
    - RLS habilitado
    - Usuarios solo pueden ver tokens de su empresa
    - Índice único para prevenir duplicados por empresa
*/

-- =====================================================
-- TABLA: facturas_urls_cortas
-- =====================================================

CREATE TABLE IF NOT EXISTS facturas_urls_cortas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  orden_trabajo_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  token_corto text NOT NULL,
  factura_storage_path text NOT NULL,
  numero_factura text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Índice único: un token es único dentro de una empresa
  CONSTRAINT uq_facturas_urls_company_token UNIQUE (company_id, token_corto)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_facturas_urls_company_id
  ON facturas_urls_cortas(company_id);

CREATE INDEX IF NOT EXISTS idx_facturas_urls_expires_at
  ON facturas_urls_cortas(expires_at);

CREATE INDEX IF NOT EXISTS idx_facturas_urls_orden_id
  ON facturas_urls_cortas(orden_trabajo_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE facturas_urls_cortas ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden ver tokens de su empresa
CREATE POLICY "Users can view own company URLs"
  ON facturas_urls_cortas
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Solo service_role puede insertar (desde Edge Function)
CREATE POLICY "Service role can insert URLs"
  ON facturas_urls_cortas
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- FUNCIÓN: fn_generar_token_factura
-- =====================================================

CREATE OR REPLACE FUNCTION fn_generar_token_factura(
  p_company_id uuid,
  p_orden_trabajo_id uuid,
  p_factura_storage_path text,
  p_numero_factura text,
  p_dias_validez integer DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_existe boolean;
  v_intentos integer := 0;
  v_max_intentos integer := 10;
  v_expires_at timestamptz;
BEGIN
  -- Calcular fecha de expiración
  v_expires_at := now() + (p_dias_validez || ' days')::interval;

  -- Generar token único
  LOOP
    -- Generar token de 8 caracteres alfanuméricos (mayúsculas y números)
    v_token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Verificar si ya existe para esta empresa
    SELECT EXISTS(
      SELECT 1
      FROM facturas_urls_cortas
      WHERE company_id = p_company_id
        AND token_corto = v_token
    ) INTO v_existe;

    -- Si no existe, salir del loop
    EXIT WHEN NOT v_existe;

    -- Incrementar intentos
    v_intentos := v_intentos + 1;

    -- Si supera máximo de intentos, error
    IF v_intentos >= v_max_intentos THEN
      RAISE EXCEPTION 'No se pudo generar token único después de % intentos', v_max_intentos;
    END IF;
  END LOOP;

  -- Insertar registro
  INSERT INTO facturas_urls_cortas (
    company_id,
    orden_trabajo_id,
    token_corto,
    factura_storage_path,
    numero_factura,
    expires_at
  ) VALUES (
    p_company_id,
    p_orden_trabajo_id,
    v_token,
    p_factura_storage_path,
    p_numero_factura,
    v_expires_at
  );

  -- Retornar token generado
  RETURN v_token;
END;
$$;

-- =====================================================
-- FUNCIÓN: fn_obtener_factura_por_token
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_factura_por_token(
  p_company_id uuid,
  p_token text
)
RETURNS TABLE(
  factura_storage_path text,
  numero_factura text,
  orden_numero text,
  expires_at timestamptz,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fuc.factura_storage_path,
    fuc.numero_factura,
    ot.numero_orden,
    fuc.expires_at,
    (fuc.expires_at > now()) as is_valid
  FROM facturas_urls_cortas fuc
  INNER JOIN ordenes_trabajo ot ON ot.id = fuc.orden_trabajo_id
  WHERE fuc.company_id = p_company_id
    AND fuc.token_corto = p_token;
END;
$$;

-- =====================================================
-- LIMPIEZA AUTOMÁTICA (Opcional)
-- =====================================================

-- Crear función para limpiar tokens expirados
CREATE OR REPLACE FUNCTION fn_limpiar_tokens_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Eliminar tokens expirados hace más de 30 días
  DELETE FROM facturas_urls_cortas
  WHERE expires_at < (now() - interval '30 days');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Comentario sobre la tabla
COMMENT ON TABLE facturas_urls_cortas IS
  'Almacena tokens cortos para acceso rápido a facturas. Multi-tenant por company_id.';

COMMENT ON FUNCTION fn_generar_token_factura IS
  'Genera un token único de 8 caracteres para acceso rápido a una factura.';

COMMENT ON FUNCTION fn_obtener_factura_por_token IS
  'Obtiene información de factura mediante token corto y company_id. Incluye validación de expiración.';