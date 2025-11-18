/*
  # Actualizar constraints para nuevos valores de tipo_medida

  1. Cambios
    - Eliminar constraint antiguo check_tipo_medida
    - Crear nuevo constraint que incluya 'ancho_maximo' y 'sin_medida'
    - Actualizar constraint check_medida_unica_positivas para excluir nuevos tipos
    - Agregar constraint para validar ancho_maximo cuando tipo_medida = 'ancho_maximo'

  2. Notas
    - Permite migrar productos existentes a los nuevos tipos de medida
*/

-- Eliminar constraint antiguo
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_tipo_medida;

-- Crear nuevo constraint con todos los valores permitidos
ALTER TABLE productos ADD CONSTRAINT check_tipo_medida 
  CHECK (tipo_medida = ANY (ARRAY['medida_unica'::text, 'medidas_multiples'::text, 'ancho_maximo'::text, 'sin_medida'::text]));

-- Actualizar constraint de medida_unica para excluir nuevos tipos
ALTER TABLE productos DROP CONSTRAINT IF EXISTS check_medida_unica_positivas;
ALTER TABLE productos ADD CONSTRAINT check_medida_unica_positivas 
  CHECK (
    tipo_medida <> 'medida_unica'::text 
    OR (medidas_ancho > 0::numeric AND medidas_alto > 0::numeric)
  );

-- Agregar constraint para ancho_maximo
ALTER TABLE productos ADD CONSTRAINT check_ancho_maximo_when_required 
  CHECK (
    tipo_medida <> 'ancho_maximo'::text 
    OR (ancho_maximo IS NOT NULL AND ancho_maximo > 0::numeric)
  );
