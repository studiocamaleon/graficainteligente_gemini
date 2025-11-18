/*
  # Asignar iconos y colores a categorías existentes

  1. Objetivo
    - Asignar automáticamente iconos y colores a todas las categorías existentes
    - Utilizar sugerencias inteligentes basadas en el nombre de cada categoría
    - Aplicar colores distintivos generados a partir del nombre

  2. Mapeo de palabras clave a iconos
    - Señalética → SignpostBig
    - Impresión → Printer
    - Diseño → Palette
    - Papelería → FileText
    - Publicidad → Megaphone
    - Empaque → Package
    - Etiqueta → Tag (por defecto)
    - Y más casos específicos...

  3. Notas
    - Las categorías que ya tienen icono y color asignados NO se modifican
    - Se utiliza el icono 'Tag' como valor por defecto
    - Los colores se asignan de forma consistente usando hash del nombre
*/

-- Función temporal para generar hash de string y obtener color
CREATE OR REPLACE FUNCTION temp_get_color_from_name(name text) RETURNS text AS $$
DECLARE
  colors text[] := ARRAY['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6', '#6366F1', '#A855F7'];
  hash_value bigint;
BEGIN
  hash_value := abs(hashtext(name));
  RETURN colors[(hash_value % 12) + 1];
END;
$$ LANGUAGE plpgsql;

-- Función temporal para sugerir icono basado en nombre
CREATE OR REPLACE FUNCTION temp_suggest_icon(name text) RETURNS text AS $$
DECLARE
  lower_name text := lower(name);
BEGIN
  -- Señalética
  IF lower_name LIKE '%señal%' OR lower_name LIKE '%cartel%' THEN
    RETURN 'SignpostBig';
  END IF;
  
  -- Impresión
  IF lower_name LIKE '%impres%' OR lower_name LIKE '%print%' THEN
    RETURN 'Printer';
  END IF;
  
  -- Diseño
  IF lower_name LIKE '%diseño%' OR lower_name LIKE '%diseño gráfico%' OR lower_name LIKE '%gráfico%' THEN
    RETURN 'Palette';
  END IF;
  
  -- Papelería
  IF lower_name LIKE '%papel%' OR lower_name LIKE '%tarjeta%' THEN
    RETURN 'FileText';
  END IF;
  
  -- Publicidad
  IF lower_name LIKE '%public%' OR lower_name LIKE '%marketing%' THEN
    RETURN 'Megaphone';
  END IF;
  
  -- Empaque
  IF lower_name LIKE '%empaque%' OR lower_name LIKE '%embalaje%' OR lower_name LIKE '%caja%' THEN
    RETURN 'Package';
  END IF;
  
  -- Etiquetas y adhesivos
  IF lower_name LIKE '%etiqueta%' OR lower_name LIKE '%sticker%' OR lower_name LIKE '%adhesivo%' OR lower_name LIKE '%calcoman%' THEN
    RETURN 'Sticker';
  END IF;
  
  -- Folletos y catálogos
  IF lower_name LIKE '%folleto%' OR lower_name LIKE '%brochure%' OR lower_name LIKE '%catálogo%' OR lower_name LIKE '%revista%' THEN
    RETURN 'BookOpen';
  END IF;
  
  -- Vinilo y ploteo
  IF lower_name LIKE '%vinilo%' OR lower_name LIKE '%ploteo%' THEN
    RETURN 'Film';
  END IF;
  
  -- Textil
  IF lower_name LIKE '%textil%' OR lower_name LIKE '%tela%' OR lower_name LIKE '%ropa%' THEN
    RETURN 'Shirt';
  END IF;
  
  -- Fotografía
  IF lower_name LIKE '%foto%' OR lower_name LIKE '%imagen%' THEN
    RETURN 'Camera';
  END IF;
  
  -- Banner y banderas
  IF lower_name LIKE '%banner%' OR lower_name LIKE '%bandera%' THEN
    RETURN 'Flag';
  END IF;
  
  -- Digital
  IF lower_name LIKE '%digital%' OR lower_name LIKE '%web%' OR lower_name LIKE '%online%' THEN
    RETURN 'Monitor';
  END IF;
  
  -- Eventos
  IF lower_name LIKE '%evento%' OR lower_name LIKE '%conferencia%' THEN
    RETURN 'Calendar';
  END IF;
  
  -- Arquitectónico
  IF lower_name LIKE '%arquitect%' OR lower_name LIKE '%plano%' THEN
    RETURN 'Building';
  END IF;
  
  -- Vehículo
  IF lower_name LIKE '%vehículo%' OR lower_name LIKE '%vehiculo%' OR lower_name LIKE '%auto%' THEN
    RETURN 'Car';
  END IF;
  
  -- Por defecto
  RETURN 'Tag';
END;
$$ LANGUAGE plpgsql;

-- Actualizar categorías existentes que tienen el valor por defecto
UPDATE categorias
SET 
  icon = temp_suggest_icon(nombre),
  color = temp_get_color_from_name(nombre)
WHERE icon = 'Tag' AND color = '#6B7280';

-- Limpiar funciones temporales
DROP FUNCTION IF EXISTS temp_get_color_from_name(text);
DROP FUNCTION IF EXISTS temp_suggest_icon(text);
