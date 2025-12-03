/*
  # Corregir Función de Formateo de Configuración

  1. Problema
    - La función fn_formatear_configuracion_item usaba campos incorrectos
    - Buscaba "espesor" sin "unidad_espesor", mostrando "300mm" en lugar de "300 gr"
    - No usaba material_nombre, tecnologia_nombre, tinta_nombre
    - No extraía servicios_seleccionados ni acabados_seleccionados correctamente

  2. Solución
    - Actualizar función para usar los mismos campos que OrdenItemsTab.tsx
    - Usar medida_ancho, medida_alto (no ancho, alto)
    - Usar material_nombre con variante_nombre
    - Usar espesor con unidad_espesor correctamente
    - Usar tecnologia_nombre, tinta_nombre
    - Usar cara_impresa (no caras_impresas)
    - Extraer servicios_seleccionados y acabados_seleccionados como objetos
    - Usar separador "|" en lugar de "•"

  3. Cambios
    - DROP y CREATE de fn_formatear_configuracion_item
    - UPDATE de todos los items existentes con las descripciones corregidas
*/

-- Eliminar función anterior
DROP FUNCTION IF EXISTS fn_formatear_configuracion_item(jsonb, text);

-- Crear función corregida
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
  v_espesor text;
  v_unidad_espesor text;
  v_cara_impresa text;
  v_servicio jsonb;
  v_acabado jsonb;
BEGIN
  -- Si no hay configuración, retornar vacío
  IF p_configuracion IS NULL OR p_configuracion = '{}'::jsonb THEN
    RETURN '';
  END IF;

  -- Dimensiones usando medida_ancho y medida_alto
  IF p_configuracion->>'medida_ancho' IS NOT NULL AND p_configuracion->>'medida_alto' IS NOT NULL THEN
    v_partes := array_append(v_partes,
      (p_configuracion->>'medida_ancho') || 'x' || (p_configuracion->>'medida_alto') || ' cm'
    );
  ELSIF p_configuracion->>'medida_ancho' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'medida_ancho') || ' cm');
  ELSIF p_configuracion->>'medida_alto' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'medida_alto') || ' cm');
  END IF;

  -- Material con variante
  IF p_configuracion->>'material_nombre' IS NOT NULL THEN
    IF p_configuracion->>'variante_nombre' IS NOT NULL THEN
      v_partes := array_append(v_partes,
        (p_configuracion->>'material_nombre') || ' - ' || (p_configuracion->>'variante_nombre')
      );
    ELSE
      v_partes := array_append(v_partes, p_configuracion->>'material_nombre');
    END IF;
  END IF;

  -- Espesor/Gramaje con unidad correcta
  v_espesor := p_configuracion->>'espesor';
  v_unidad_espesor := p_configuracion->>'unidad_espesor';

  IF v_espesor IS NOT NULL THEN
    IF v_unidad_espesor IS NOT NULL THEN
      -- Para gramajes (gr o g), agregar espacio antes de la unidad
      IF v_unidad_espesor IN ('gr', 'g') THEN
        v_partes := array_append(v_partes, v_espesor || ' ' || v_unidad_espesor);
      ELSE
        -- Para otras unidades (mm, cm, etc), no agregar espacio
        v_partes := array_append(v_partes, v_espesor || v_unidad_espesor);
      END IF;
    ELSE
      -- Fallback: si solo tiene espesor sin unidad
      v_partes := array_append(v_partes, v_espesor || 'mm');
    END IF;
  ELSIF p_configuracion->>'gramaje' IS NOT NULL THEN
    -- Fallback legacy para compatibilidad
    v_partes := array_append(v_partes, (p_configuracion->>'gramaje') || ' g');
  END IF;

  -- Tecnología
  IF p_configuracion->>'tecnologia_nombre' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tecnologia_nombre');
  END IF;

  -- Tinta
  IF p_configuracion->>'tinta_nombre' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tinta_nombre');
  END IF;

  -- Cara impresa (formatear correctamente)
  v_cara_impresa := p_configuracion->>'cara_impresa';
  IF v_cara_impresa IS NOT NULL THEN
    CASE v_cara_impresa
      WHEN '1/0' THEN v_partes := array_append(v_partes, 'Frente');
      WHEN '1/1' THEN v_partes := array_append(v_partes, 'Frente y Dorso');
      WHEN 'frente_y_dorso' THEN v_partes := array_append(v_partes, 'Frente y Dorso');
      WHEN 'solo_frente' THEN v_partes := array_append(v_partes, 'Frente');
      ELSE v_partes := array_append(v_partes, v_cara_impresa);
    END CASE;
  END IF;

  -- Color (para algunos productos)
  IF p_configuracion->>'color' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'color');
  END IF;

  -- Marca (para algunos productos)
  IF p_configuracion->>'marca' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'marca');
  END IF;

  -- Servicios seleccionados (objetos con nombre y nivel)
  IF jsonb_typeof(p_configuracion->'servicios_seleccionados') = 'array'
     AND jsonb_array_length(p_configuracion->'servicios_seleccionados') > 0 THEN
    FOR v_servicio IN SELECT * FROM jsonb_array_elements(p_configuracion->'servicios_seleccionados')
    LOOP
      IF v_servicio->>'nivel' IS NOT NULL THEN
        v_partes := array_append(v_partes,
          'Servicio: ' || (v_servicio->>'nombre') || ' (' || (v_servicio->>'nivel') || ')'
        );
      ELSE
        v_partes := array_append(v_partes, 'Servicio: ' || (v_servicio->>'nombre'));
      END IF;
    END LOOP;
  END IF;

  -- Acabados seleccionados (objetos con nombre y nivel)
  IF jsonb_typeof(p_configuracion->'acabados_seleccionados') = 'array'
     AND jsonb_array_length(p_configuracion->'acabados_seleccionados') > 0 THEN
    FOR v_acabado IN SELECT * FROM jsonb_array_elements(p_configuracion->'acabados_seleccionados')
    LOOP
      IF v_acabado->>'nivel' IS NOT NULL THEN
        v_partes := array_append(v_partes,
          'Acabado: ' || (v_acabado->>'nombre') || ' (' || (v_acabado->>'nivel') || ')'
        );
      ELSE
        v_partes := array_append(v_partes, 'Acabado: ' || (v_acabado->>'nombre'));
      END IF;
    END LOOP;
  END IF;

  -- Cantidad de páginas (talonarios)
  IF p_configuracion->>'cantidad_paginas' IS NOT NULL THEN
    v_partes := array_append(v_partes, (p_configuracion->>'cantidad_paginas') || ' hojas');
  END IF;

  -- Tipo de copia (talonarios)
  IF p_configuracion->>'tipo_copia' IS NOT NULL THEN
    v_partes := array_append(v_partes, p_configuracion->>'tipo_copia');
  END IF;

  -- Centro Copiado: Campos específicos
  IF p_categoria ILIKE '%copiado%' THEN
    -- Tamaño de papel
    IF p_configuracion->>'tamanio_papel' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tamanio_papel');
    END IF;

    -- Tipo de papel
    IF p_configuracion->>'tipo_papel' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tipo_papel');
    END IF;

    -- Tinta (conversión CMYK = Color, BN = B/N)
    IF p_configuracion->>'tipo_tinta' = 'CMYK' THEN
      v_partes := array_append(v_partes, 'Color');
    ELSIF p_configuracion->>'tipo_tinta' = 'BN' THEN
      v_partes := array_append(v_partes, 'B/N');
    ELSIF p_configuracion->>'tinta' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tinta');
    END IF;

    -- Cantidad de hojas
    IF p_configuracion->>'cantidad_hojas' IS NOT NULL THEN
      v_partes := array_append(v_partes, (p_configuracion->>'cantidad_hojas') || ' hojas');
    END IF;

    -- Anillado
    IF p_configuracion->'anillado'->>'tipo' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Anillado: ' || (p_configuracion->'anillado'->>'tipo'));
    ELSIF p_configuracion->>'tipo_anillado' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Anillado: ' || (p_configuracion->>'tipo_anillado'));
    END IF;

    -- Plastificado
    IF p_configuracion->'plastificado'->>'tipo' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Plastificado: ' || (p_configuracion->'plastificado'->>'tipo'));
    ELSIF p_configuracion->>'tipo_plastificado' IS NOT NULL THEN
      v_partes := array_append(v_partes, 'Plastificado: ' || (p_configuracion->>'tipo_plastificado'));
    END IF;
  END IF;

  -- Sellos: Dimensiones en mm
  IF p_categoria ILIKE '%sello%' THEN
    IF p_configuracion->>'tipo_sello' IS NOT NULL THEN
      v_partes := array_prepend(p_configuracion->>'tipo_sello', v_partes);
    END IF;

    -- Redefinir dimensiones para sellos (en mm)
    v_partes := array_remove(v_partes, NULL);
    IF array_length(v_partes, 1) > 0 AND v_partes[1] LIKE '% cm' THEN
      -- Reemplazar primera parte si es dimensión en cm
      IF p_configuracion->>'medida_ancho' IS NOT NULL AND p_configuracion->>'medida_alto' IS NOT NULL THEN
        v_partes[1] := (p_configuracion->>'medida_ancho') || 'x' || (p_configuracion->>'medida_alto') || ' mm';
      END IF;
    END IF;

    IF p_configuracion->>'tipo_tinta' IS NOT NULL THEN
      v_partes := array_append(v_partes, p_configuracion->>'tipo_tinta');
    END IF;
  END IF;

  -- Unir todas las partes con ' | ' (en lugar de ' • ')
  IF array_length(v_partes, 1) > 0 THEN
    v_resultado := array_to_string(v_partes, ' | ');
  ELSE
    v_resultado := '';
  END IF;

  RETURN v_resultado;
END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION fn_formatear_configuracion_item(jsonb, text) IS
  'Formatea un objeto de configuración JSONB en texto legible. Usa los mismos campos que OrdenItemsTab.tsx para consistencia.';

-- Actualizar TODOS los items existentes (incluso los que ya tenían descripción)
-- para corregir los que muestran "Espesor: 300mm" en lugar de "300 gr"
UPDATE presupuestos_items
SET descripcion = fn_formatear_configuracion_item(configuracion, producto_categoria)
WHERE configuracion IS NOT NULL
  AND configuracion != '{}'::jsonb
  AND tipo_item = 'catalogo'; -- Solo items de catálogo, no personalizados

-- Log para ver cuántos registros se actualizaron
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM presupuestos_items
  WHERE descripcion IS NOT NULL
    AND descripcion != ''
    AND tipo_item = 'catalogo';

  RAISE NOTICE 'Se actualizaron descripciones para % items de catálogo en presupuestos', v_count;
END $$;
