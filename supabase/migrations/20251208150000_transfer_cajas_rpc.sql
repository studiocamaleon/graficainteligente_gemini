-- Función segura para obtener opciones de cajas destino (blind transfer)
-- Permite listar ID y NOMBRE de todas las cajas activas de la empresa
-- sin exponer saldo ni otros detalles sensibles.
-- SECURITY DEFINER permite saltar las políticas RLS restrictivas de lectura.

CREATE OR REPLACE FUNCTION fn_get_cajas_options(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  nombre text,
  tipo text,
  es_principal boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el usuario pertenezca a la empresa que consulta (seguridad básica)
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.nombre,
    c.tipo,
    c.es_principal
  FROM cajas c
  WHERE c.company_id = p_company_id
  AND c.is_active = true
  ORDER BY c.es_principal DESC, c.nombre ASC;
END;
$$;
