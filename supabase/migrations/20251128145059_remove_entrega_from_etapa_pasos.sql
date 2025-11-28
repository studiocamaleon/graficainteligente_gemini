/*
  # Eliminar "Entrega" como Etapa de Producción en Tabla Pasos

  ## Descripción
  Elimina "Entrega" del conjunto de etapas válidas de producción en la tabla `pasos`.
  "Entrega" es un estado final de la orden de trabajo, no una etapa de producción.

  ## Cambios Realizados
  1. Migra cualquier paso existente con etapa "Entrega" a "Terminacion"
  2. Actualiza el constraint CHECK en tabla `pasos` para incluir solo 4 etapas

  ## Etapas de Producción (4 etapas válidas)
  - Pre-prensa: Preparación de archivos y materiales
  - Produccion: Proceso de producción principal
  - Terminacion: Acabados y terminaciones finales
  - Instalacion: Instalación en sitio (si aplica)

  ## Estados de Orden de Trabajo (no son etapas)
  - pendiente: Orden confirmada sin iniciar
  - en_proceso: Orden en producción
  - finalizada: Producción completa, pendiente de entrega
  - entregada: Producto entregado al cliente (ESTADO FINAL)
  - cancelada: Orden cancelada

  ## Notas Importantes
  - "Entrega" ahora es exclusivamente un estado de la orden, no una etapa de producción
  - Los pasos existentes con etapa "Entrega" se migran automáticamente a "Terminacion"
  - La tabla `rutas_produccion_pasos` ya usa valores normalizados correctos (pre_prensa, principal, post_prensa)
*/

-- =====================================================
-- 1. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Migrar pasos con etapa 'Entrega' a 'Terminacion'
UPDATE pasos
SET etapa = 'Terminacion',
    updated_at = now()
WHERE etapa = 'Entrega';

-- =====================================================
-- 2. ACTUALIZAR CONSTRAINT EN TABLA PASOS
-- =====================================================

-- Eliminar constraint existente
ALTER TABLE pasos DROP CONSTRAINT IF EXISTS check_etapa;

-- Crear nuevo constraint con solo 4 etapas
ALTER TABLE pasos
ADD CONSTRAINT check_etapa CHECK (
  etapa IN ('Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion')
);

-- =====================================================
-- 3. REINDEXAR PARA OPTIMIZAR
-- =====================================================

-- Reindexar índice de etapas en pasos
REINDEX INDEX idx_pasos_etapa;

-- =====================================================
-- 4. VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Mostrar resumen de cambios
DO $$
DECLARE
  v_pasos_migrados INTEGER;
  v_total_pasos INTEGER;
BEGIN
  -- Contar total de pasos
  SELECT COUNT(*) INTO v_total_pasos FROM pasos;
  
  -- Contar pasos en Terminacion (posibles migrados)
  SELECT COUNT(*) INTO v_pasos_migrados
  FROM pasos
  WHERE etapa = 'Terminacion';

  RAISE NOTICE '=== Migración Completada ===';
  RAISE NOTICE 'Total de pasos en sistema: %', v_total_pasos;
  RAISE NOTICE 'Pasos con etapa "Terminacion": %', v_pasos_migrados;
  RAISE NOTICE 'Constraint actualizado: Solo 4 etapas válidas (Pre-prensa, Produccion, Terminacion, Instalacion)';
  RAISE NOTICE '"Entrega" ahora es exclusivamente un estado de orden, no una etapa de producción';
END $$;