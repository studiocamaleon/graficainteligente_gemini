/*
  # Actualizar Opciones de Color en Productos Plotter de Corte

  ## Descripción
  Esta migración actualiza las opciones de color disponibles para productos de
  Plotter de Corte, expandiendo las opciones de 2 a 6 valores distintos.

  ## Cambios
  1. Elimina el constraint existente `check_plotter_corte_color`
  2. Actualiza los productos existentes con 'Blanco o Negro' a 'Blanco'
  3. Crea un nuevo constraint con las siguientes opciones:
    - Blanco
    - Negro
    - Color
    - Esmerilado Gris
    - Esmerilado Blanco
    - Otro

  ## Seguridad
  - La migración es segura ya que primero elimina el constraint antiguo
  - Actualiza los datos existentes para que sean compatibles
  - Luego aplica el nuevo constraint con las opciones expandidas
*/

-- Paso 1: Eliminar el constraint existente de color
ALTER TABLE productos_plotter_corte
DROP CONSTRAINT IF EXISTS check_plotter_corte_color;

-- Paso 2: Actualizar productos existentes con 'Blanco o Negro' a 'Blanco'
UPDATE productos_plotter_corte
SET color = 'Blanco'
WHERE color = 'Blanco o Negro';

-- Paso 3: Crear nuevo constraint con las opciones actualizadas
ALTER TABLE productos_plotter_corte
ADD CONSTRAINT check_plotter_corte_color
  CHECK (color IN ('Blanco', 'Negro', 'Color', 'Esmerilado Gris', 'Esmerilado Blanco', 'Otro'));