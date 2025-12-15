-- Migration: Update Debug Function to Show Config Keys
-- Date: 2025-12-15
-- Description: Updates fn_debug_ruta_restore to return the keys present in the configuration JSON.

CREATE OR REPLACE FUNCTION fn_debug_ruta_restore(
  p_orden_item_id uuid,
  p_producto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_categoria text;
  v_ruta_id uuid;
  v_total_pasos int;
  v_pasos_sin_condicion int;
  v_pasos_tecnologia int;
  v_configuracion jsonb;
  v_producto_table text;
  v_tech_id_in_config text;
  v_tech_nombre_in_config text;
BEGIN
  -- 1. Get Category
  SELECT c.nombre INTO v_categoria
  FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
  WHERE p.id = p_producto_id;

  -- 2. Get Config
  SELECT configuracion INTO v_configuracion
  FROM ordenes_trabajo_items
  WHERE id = p_orden_item_id;

  v_tech_id_in_config := v_configuracion->>'tecnologia_id';
  v_tech_nombre_in_config := v_configuracion->>'tecnologia_nombre';

  -- 3. Determine Route ID (Robust Lookups)
  v_producto_table := 'Unknown';
  
  -- Check Impresion Laser
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_impresion_laser WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_impresion_laser'; END IF;
  END IF;

  -- Check Gran Formato
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_gran_formato WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_gran_formato'; END IF;
  END IF;
  
  -- Check Materiales Rigidos
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_materiales_rigidos WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_materiales_rigidos'; END IF;
  END IF;

  -- Check Plotter de Corte
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_plotter_corte WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_plotter_corte'; END IF;
  END IF;

  -- Check Portabanners
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_portabanners WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_portabanners'; END IF;
  END IF;

  -- Check Sellos
  IF v_ruta_id IS NULL THEN
    SELECT ruta_produccion_id INTO v_ruta_id FROM productos_sellos WHERE id = p_producto_id;
    IF v_ruta_id IS NOT NULL THEN v_producto_table := 'productos_sellos'; END IF;
  END IF;

  -- 4. Count steps if route found
  v_total_pasos := 0;
  v_pasos_sin_condicion := 0;
  v_pasos_tecnologia := 0;
  
  IF v_ruta_id IS NOT NULL THEN
    SELECT count(*) INTO v_total_pasos
    FROM rutas_produccion_pasos
    WHERE ruta_id = v_ruta_id;

    SELECT count(*) INTO v_pasos_sin_condicion
    FROM rutas_produccion_pasos
    WHERE ruta_id = v_ruta_id 
    AND (tipo_condicion IS NULL OR tipo_condicion = 'sin_condicion');

    SELECT count(*) INTO v_pasos_tecnologia
    FROM rutas_produccion_pasos
    WHERE ruta_id = v_ruta_id 
    AND tipo_condicion = 'tecnologia_tinta';
  END IF;

  v_result := jsonb_build_object(
    'producto_id', p_producto_id,
    'categoria_detectada', v_categoria,
    'ruta_found_id', v_ruta_id,
    'tabla_origen_ruta', v_producto_table,
    'total_pasos_plantilla', v_total_pasos,
    'pasos_incondicionales_plantilla', v_pasos_sin_condicion,
    'pasos_tecnologia_plantilla', v_pasos_tecnologia,
    'config_keys', (SELECT jsonb_object_keys(v_configuracion)),
    'tech_id_found', v_tech_id_in_config,
    'tech_nombre_found', v_tech_nombre_in_config
  );

  RETURN v_result;
END;
$$;
