/*
  # Agregar soporte para múltiples tecnologías en productos portabanners

  ## Resumen
  Esta migración añade la capacidad de asociar múltiples tecnologías a un producto portabanner,
  permitiendo que cada tecnología tenga precios diferenciados en la tabla de precios.

  ## Cambios Principales

  ### 1. Nueva Tabla: productos_portabanners_tecnologias
  Tabla intermedia para relación muchos-a-muchos entre productos y tecnologías:
  - `id` (uuid, PK)
  - `producto_id` (uuid, FK a productos_portabanners)
  - `tecnologia_id` (uuid, FK a tecnologias)
  - Restricción UNIQUE para evitar duplicados
  - Índices para optimizar consultas

  ### 2. Actualización Tabla: productos_portabanners_precios
  Se añade campo de tecnología para precios diferenciados:
  - `tecnologia_id` (uuid, FK a tecnologias) - Tecnología específica para este precio
  - Actualización de restricción UNIQUE para incluir tecnologia_id
  - Nuevo índice en tecnologia_id

  ## Seguridad
  - RLS habilitado en productos_portabanners_tecnologias
  - Políticas para SELECT, INSERT, DELETE basadas en company_id
  - Actualización de políticas en productos_portabanners_precios

  ## Notas Importantes
  - El campo tecnologia_id en productos_portabanners se mantiene como tecnología principal
  - Las tintas siempre serán ['CMYK'] para todos los portabanners
  - Los precios ahora pueden ser específicos por tecnología
*/

-- =====================================================
-- 1. CREAR TABLA INTERMEDIA: productos_portabanners_tecnologias
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA INTERMEDIA: productos_portabanners_tecnologias
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_portabanners_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos_portabanners(id) ON DELETE CASCADE,
  tecnologia_id uuid NOT NULL REFERENCES tecnologias(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_portabanner_tecnologia
    UNIQUE(producto_id, tecnologia_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_portabanners_tecnologias_producto
  ON productos_portabanners_tecnologias(producto_id);

CREATE INDEX IF NOT EXISTS idx_portabanners_tecnologias_tecnologia
  ON productos_portabanners_tecnologias(tecnologia_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos_portabanners_tecnologias') THEN
    COMMENT ON TABLE productos_portabanners_tecnologias IS
      'Relación muchos-a-muchos entre productos portabanners y tecnologías de impresión';
  END IF;
END $$;

-- =====================================================
-- 2. ACTUALIZAR TABLA DE PRECIOS: productos_portabanners_precios
-- =====================================================

-- Agregar columna tecnologia_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos_portabanners_precios' AND column_name = 'tecnologia_id'
  ) THEN
    ALTER TABLE productos_portabanners_precios
    ADD COLUMN tecnologia_id uuid REFERENCES tecnologias(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Crear índice en tecnologia_id
CREATE INDEX IF NOT EXISTS idx_portabanners_precios_tecnologia
  ON productos_portabanners_precios(tecnologia_id);

-- Eliminar restricción UNIQUE antigua y crear nueva que incluya tecnologia_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_portabanners_precio_configuracion'
  ) THEN
     ALTER TABLE productos_portabanners_precios
       DROP CONSTRAINT unique_portabanners_precio_configuracion;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_portabanners_precio_configuracion_v2'
  ) THEN
     -- Using a new name to avoid conflicts if old one is stuck
     ALTER TABLE productos_portabanners_precios
       ADD CONSTRAINT unique_portabanners_precio_configuracion_v2
         UNIQUE NULLS NOT DISTINCT (
           producto_id,
           ancho_cm,
           alto_cm,
           cantidad_desde,
           cantidad_hasta,
           tecnologia_id
         );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos_portabanners_precios' AND column_name = 'tecnologia_id') THEN
    COMMENT ON COLUMN productos_portabanners_precios.tecnologia_id IS
      'Tecnología específica para este precio. Permite precios diferenciados por tecnología.';
  END IF;
END $$;

-- =====================================================
-- 3. ROW LEVEL SECURITY: productos_portabanners_tecnologias
-- =====================================================

ALTER TABLE productos_portabanners_tecnologias ENABLE ROW LEVEL SECURITY;

-- Política para SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own company portabanners tecnologias' AND tablename = 'productos_portabanners_tecnologias'
  ) THEN
    CREATE POLICY "Users can view own company portabanners tecnologias"
      ON productos_portabanners_tecnologias FOR SELECT
      TO authenticated
      USING (
        producto_id IN (
          SELECT id FROM productos_portabanners
          WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- Política para INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own company portabanners tecnologias' AND tablename = 'productos_portabanners_tecnologias'
  ) THEN
    CREATE POLICY "Users can insert own company portabanners tecnologias"
      ON productos_portabanners_tecnologias FOR INSERT
      TO authenticated
      WITH CHECK (
        producto_id IN (
          SELECT id FROM productos_portabanners
          WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- Política para DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own company portabanners tecnologias' AND tablename = 'productos_portabanners_tecnologias'
  ) THEN
    CREATE POLICY "Users can delete own company portabanners tecnologias"
      ON productos_portabanners_tecnologias FOR DELETE
      TO authenticated
      USING (
        producto_id IN (
          SELECT id FROM productos_portabanners
          WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
      );
  END IF;
END $$;