/*
  # Actualización de Rangos de Precio - Eliminar Descuentos

  ## Descripción
  Esta migración modifica la tabla rangos_precio para eliminar los descuentos de los rangos
  y agregar un campo de unidad de medida. Los rangos ahora solo definen intervalos de cantidades
  con su unidad correspondiente, sin especificar descuentos.

  ## Cambios Realizados

  ### 1. Modificaciones en rangos_precio
  - Se agrega el campo `unidad_medida` (text): Tipo de unidad para los rangos
    - Valores permitidos: 'mt2', 'mt_lineal', 'unidades'
  - Se modifica la estructura del campo `rangos` (jsonb): 
    - Antes: [{min: number, max: number, descuento: number}]
    - Ahora: [{min: number, max: number}]
  - Se eliminan todos los rangos existentes ya que no hay datos en uso

  ### 2. Constraint
  - Se agrega CHECK constraint para validar que unidad_medida tenga valores válidos

  ## Notas Importantes
  - Los rangos existentes serán eliminados (confirmado que no hay datos en uso)
  - La nueva estructura facilita la gestión de tablas de precio en el módulo de Pricing
  - Los descuentos se aplicarán posteriormente a nivel de producto en el módulo de Pricing
*/

-- Eliminar rangos existentes (confirmado que no hay datos)
DELETE FROM rangos_precio;

-- Agregar campo unidad_medida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rangos_precio' AND column_name = 'unidad_medida'
  ) THEN
    ALTER TABLE rangos_precio ADD COLUMN unidad_medida text NOT NULL DEFAULT 'unidades';
  END IF;
END $$;

-- Agregar constraint para validar unidad_medida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_unidad_medida'
  ) THEN
    ALTER TABLE rangos_precio
      ADD CONSTRAINT check_unidad_medida 
      CHECK (unidad_medida IN ('mt2', 'mt_lineal', 'unidades'));
  END IF;
END $$;

-- Actualizar comentario de la tabla para reflejar el cambio
COMMENT ON TABLE rangos_precio IS 'Almacena rangos de cantidades con su unidad de medida para ser utilizados en tablas de precio. Los descuentos se aplican a nivel de producto en el módulo de Pricing.';

COMMENT ON COLUMN rangos_precio.unidad_medida IS 'Unidad de medida para los rangos: mt2 (metros cuadrados), mt_lineal (metros lineales), o unidades';

COMMENT ON COLUMN rangos_precio.rangos IS 'Array de objetos JSON con estructura: [{min: number, max: number}]. Define los intervalos de cantidades sin descuentos.';
