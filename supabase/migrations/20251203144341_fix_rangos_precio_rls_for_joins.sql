/*
  # Corregir políticas RLS de rangos_precio para soportar JOINs

  ## Descripción
  Las políticas RLS actuales de rangos_precio pueden estar bloqueando los JOINs
  desde productos_impresion_laser. Esta migración asegura que las políticas
  permitan acceso a los rangos cuando se accede a través de productos.

  ## Problema Identificado
  Cuando se hace un SELECT con JOIN desde productos_impresion_laser:
  ```sql
  SELECT *, rango_precio:rangos_precio(...)
  FROM productos_impresion_laser
  ```

  El JOIN puede fallar si las políticas RLS de rangos_precio no permiten
  acceso en el contexto del JOIN.

  ## Cambios
  1. Verificar y actualizar política SELECT de rangos_precio
  2. Asegurar que la foreign key está correctamente configurada
  3. Agregar índice si no existe

  ## Validación
  - Verificar que productos con rango_precio_id puedan cargar la relación
  - Confirmar que el JOIN funciona correctamente
*/

-- Verificar que existe la foreign key
DO $$
BEGIN
  -- Si no existe la foreign key, agregarla
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'productos_impresion_laser_rango_precio_id_fkey'
    AND table_name = 'productos_impresion_laser'
  ) THEN
    ALTER TABLE productos_impresion_laser
      ADD CONSTRAINT productos_impresion_laser_rango_precio_id_fkey
      FOREIGN KEY (rango_precio_id)
      REFERENCES rangos_precio(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Recrear las políticas RLS de rangos_precio para asegurar que funcionan con JOINs
DROP POLICY IF EXISTS "Users can view own company rangos_precio" ON rangos_precio;
DROP POLICY IF EXISTS "Users can insert own company rangos_precio" ON rangos_precio;
DROP POLICY IF EXISTS "Users can update own company rangos_precio" ON rangos_precio;
DROP POLICY IF EXISTS "Users can delete own company rangos_precio" ON rangos_precio;

-- Política SELECT: Permitir ver rangos de la misma compañía
CREATE POLICY "Users can view own company rangos_precio"
  ON rangos_precio FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Política INSERT: Permitir insertar rangos para la propia compañía
CREATE POLICY "Users can insert own company rangos_precio"
  ON rangos_precio FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Política UPDATE: Permitir actualizar rangos de la propia compañía
CREATE POLICY "Users can update own company rangos_precio"
  ON rangos_precio FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Política DELETE: Permitir eliminar rangos de la propia compañía
CREATE POLICY "Users can delete own company rangos_precio"
  ON rangos_precio FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Asegurar que RLS está habilitado
ALTER TABLE rangos_precio ENABLE ROW LEVEL SECURITY;

-- Agregar índice en company_id si no existe
CREATE INDEX IF NOT EXISTS idx_rangos_precio_company_id
  ON rangos_precio(company_id);

-- Comentarios para documentación
COMMENT ON TABLE rangos_precio IS
  'Rangos de precio para productos. RLS habilitado para multi-tenancy por company_id';

COMMENT ON COLUMN rangos_precio.company_id IS
  'ID de la compañía propietaria. Usado para RLS y aislamiento de datos';

COMMENT ON COLUMN rangos_precio.rangos IS
  'Array JSON de rangos con estructura: [{"min": number, "max": number | null}]';