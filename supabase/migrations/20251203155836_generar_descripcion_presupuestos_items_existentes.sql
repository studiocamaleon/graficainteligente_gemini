/*
  # Generar Descripción para Items de Presupuestos Existentes

  1. Objetivo
    - Generar descripciones legibles para items que tienen configuración pero no descripción
    - Extraer información relevante del campo configuracion (jsonb)
    - Actualizar solo items donde descripcion sea NULL o vacío

  2. Estrategia
    - Función PL/pgSQL para formatear configuración a texto
    - UPDATE para aplicar la función a items sin descripción
*/

-- Función auxiliar para formatear configuración
CREATE OR REPLACE FUNCTION fn_formatear_configuracion_item(
  p_configuracion jsonb,
  p_categoria text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_partes text[] := ARRAY[]::text[];
  v_resultado text;
BEGIN
  -- Si no hay configuración, retornar vacío
  IF p_configuracion IS NULL OR p_configuracion = '{}'::jsonb THEN
    RETURN '';
  END IF;

  -- Extraer campos comunes
  
  -- Dimensiones
  IF p_configuracion->>'ancho' IS NOT NULL AND p_configuracion->>'alto' IS NOT NULL THEN
    v_partes := array_append(v_partes, 
      (p_configuracion->>'ancho') || ' x ' || (p_configuracion->>'alto') || ' cm'
    );
  END IF;

  IF p_configuracion->>'medida' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Medida: ' || (p_configuracion->>'medida'));
  END IF;

  -- Material
  IF p_configuracion->>'material' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Material: ' || (p_configuracion->>'material'));
  END IF;

  -- Gramaje
  IF p_configuracion->>'gramaje' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'gramaje') || 'g');
  END IF;

  -- Espesor
  IF p_configuracion->>'espesor' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Espesor: ' || (p_configuracion->>'espesor') || 'mm');
  END IF;

  -- Tecnología
  IF p_configuracion->>'tecnologia' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Tecnología: ' || (p_configuracion->>'tecnologia'));
  END IF;

  -- Color
  IF p_configuracion->>'color' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Color: ' || (p_configuracion->>'color'));
  END IF;

  -- Tintas (puede ser array o string)
  IF jsonb_typeof(p_configuracion->'tintas') = 'array' THEN
    v_partes := array_append(v_partes, 
      'Tintas: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(p_configuracion->'tintas')
      )
    );
  ELSIF p_configuracion->>'tintas' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Tintas: ' || (p_configuracion->>'tintas'));
  END IF;

  -- Caras impresas
  IF jsonb_typeof(p_configuracion->'caras_impresas') = 'array' THEN
    v_partes := array_append(v_partes, 
      'Impresión: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(p_configuracion->'caras_impresas')
      )
    );
  ELSIF p_configuracion->>'caras_impresas' IS NOT NULL THEN
    v_partes := array_append(v_partes, 'Impresión: ' || (p_configuracion->>'caras_impresas'));
  END IF;

  -- Cantidad de páginas (talonarios)
  IF p_configuracion->>'cantidad_paginas' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'cantidad_paginas') || ' páginas');
  END IF;

  -- Tipo de venta
  IF p_configuracion->>'tipo_venta' IS NOT NULL THEN
    CASE p_configuracion->>'tipo_venta'
      WHEN 'mt2' THEN v_partes := array_append(v_partes, 'Venta por m²');
      WHEN 'unidad' THEN v_partes := array_append(v_partes, 'Venta por unidad');
      WHEN 'mt_lineal' THEN v_partes := array_append(v_partes, 'Venta por metro lineal');
      ELSE v_partes := array_append(v_partes, 'Tipo: ' || (p_configuracion->>'tipo_venta'));
    END CASE;
  END IF;

  -- Acabados (array)
  IF jsonb_typeof(p_configuracion->'acabados') = 'array' AND jsonb_array_length(p_configuracion->'acabados') > 0 THEN
    v_partes := array_append(v_partes, 
      'Acabados: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(p_configuracion->'acabados')
      )
    );
  END IF;

  -- Servicios (array)
  IF jsonb_typeof(p_configuracion->'servicios') = 'array' AND jsonb_array_length(p_configuracion->'servicios') > 0 THEN
    v_partes := array_append(v_partes, 
      'Servicios: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(p_configuracion->'servicios')
      )
    );
  END IF;

  -- Unir todas las partes con ' • '
  IF array_length(v_partes, 1) > 0 THEN
    v_resultado := array_to_string(v_partes, ' • ');
  ELSE
    v_resultado := '';
  END IF;

  RETURN v_resultado;
END;
$$;

-- Comentario
COMMENT ON FUNCTION fn_formatear_configuracion_item(jsonb, text) IS
  'Formatea un objeto de configuración JSONB en texto legible para descripciones de items';

-- Actualizar items existentes sin descripción
UPDATE presupuestos_items
SET descripcion = fn_formatear_configuracion_item(configuracion, producto_categoria)
WHERE (descripcion IS NULL OR descripcion = '')
  AND configuracion IS NOT NULL
  AND configuracion != '{}'::jsonb;

-- Log para ver cuántos registros se actualizaron
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM presupuestos_items
  WHERE descripcion IS NOT NULL 
    AND descripcion != ''
    AND configuracion IS NOT NULL
    AND configuracion != '{}'::jsonb;
  
  RAISE NOTICE 'Se generaron descripciones para % items de presupuestos', v_count;
END $$;
