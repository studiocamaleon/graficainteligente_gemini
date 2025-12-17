DO $$
DECLARE
  v_categoria_id uuid;
  v_servicio_record record;
  v_acabado_record record;
BEGIN
  -- 1. Obtener ID de la categoría Centro de Copiado
  SELECT id INTO v_categoria_id FROM categorias WHERE nombre = 'Centro de Copiado' LIMIT 1;

  -- Solo proceder si la categoría existe
  IF v_categoria_id IS NOT NULL THEN
    
    ---------------------------------------------------------------------------
    -- SERVICIOS: Anillado, Plastificado, Abrochado, Corte, Perforado
    ---------------------------------------------------------------------------
    FOR v_servicio_record IN 
      SELECT id, nombre FROM servicios 
      WHERE is_active = true 
        AND (
          nombre ILIKE '%Anillado%' OR 
          nombre ILIKE '%Plastificado%' OR 
          nombre ILIKE '%Abrochado%' OR 
          nombre ILIKE '%Corte%' OR
          nombre ILIKE '%Perforado%'
        )
    LOOP
      -- Insertar relación si no existe
      INSERT INTO servicios_categorias (servicio_id, categoria_id)
      VALUES (v_servicio_record.id, v_categoria_id)
      ON CONFLICT (servicio_id, categoria_id) DO NOTHING;
      
      RAISE NOTICE 'Asociado servicio: %', v_servicio_record.nombre;
    END LOOP;

    ---------------------------------------------------------------------------
    -- ACABADOS: Laminado, Barniz, Laca
    ---------------------------------------------------------------------------
    FOR v_acabado_record IN 
      SELECT id, nombre FROM acabados 
      WHERE is_active = true 
        AND (
          nombre ILIKE '%Laminado%' OR 
          nombre ILIKE '%Barniz%' OR 
          nombre ILIKE '%Laca%'
        )
    LOOP
      -- Insertar relación si no existe
      INSERT INTO acabados_categorias (acabado_id, categoria_id)
      VALUES (v_acabado_record.id, v_categoria_id)
      ON CONFLICT (acabado_id, categoria_id) DO NOTHING;

      RAISE NOTICE 'Asociado acabado: %', v_acabado_record.nombre;
    END LOOP;

  END IF;
END $$;
