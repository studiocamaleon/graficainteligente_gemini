/*
  # Agregar Tipos de Impacto Manuales (MT2)
  
  ## Descripción
  Esta migración agrega soporte para tipos de impacto donde el usuario ingresa manualmente 
  la cantidad de metros cuadrados, en lugar de calcularla automáticamente basada en las dimensiones del ítem.

  ## Nuevos Tipos
  1. `por_mt2_manual`: Valor por MT2 (ingresado manualmente)
  2. `fijo_mt2_manual`: Valor Fijo + Valor por MT2 (ingresado manualmente)

  ## Cambios
  - Actualiza constraints CHECK en tablas:
    - servicios
    - acabados
    - servicios_niveles_precio
    - acabados_niveles_precio
  - Actualiza índices parciales para incluir `fijo_mt2_manual` como tipo combinado.
*/

-- =====================================================
-- 1. ACTUALIZAR TABLA SERVICIOS
-- =====================================================

ALTER TABLE servicios DROP CONSTRAINT IF EXISTS check_tipo_impacto;
ALTER TABLE servicios ADD CONSTRAINT check_tipo_impacto CHECK (
  tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto',
    'por_mt2_manual', 'fijo_mt2_manual'
  )
);

-- Actualizar índice de tipos combinados
DROP INDEX IF EXISTS idx_servicios_tipo_impacto_combinado;
CREATE INDEX idx_servicios_tipo_impacto_combinado 
  ON servicios(tipo_impacto) 
  WHERE tipo_impacto IN ('fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto', 'fijo_mt2_manual');

-- =====================================================
-- 2. ACTUALIZAR TABLA ACABADOS
-- =====================================================

ALTER TABLE acabados DROP CONSTRAINT IF EXISTS check_acabados_tipo_impacto;
ALTER TABLE acabados ADD CONSTRAINT check_acabados_tipo_impacto CHECK (
  tipo_impacto IS NULL OR tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto',
    'por_mt2_manual', 'fijo_mt2_manual'
  )
);

-- Actualizar índice de tipos combinados
DROP INDEX IF EXISTS idx_acabados_tipo_impacto_combinado;
CREATE INDEX idx_acabados_tipo_impacto_combinado 
  ON acabados(tipo_impacto) 
  WHERE tipo_impacto IN ('fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto', 'fijo_mt2_manual');

-- =====================================================
-- 3. ACTUALIZAR TABLA SERVICIOS_NIVELES_PRECIO
-- =====================================================

ALTER TABLE servicios_niveles_precio DROP CONSTRAINT IF EXISTS check_nivel_tipo_impacto;
ALTER TABLE servicios_niveles_precio ADD CONSTRAINT check_nivel_tipo_impacto CHECK (
  tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto',
    'por_mt2_manual', 'fijo_mt2_manual'
  )
);

-- =====================================================
-- 4. ACTUALIZAR TABLA ACABADOS_NIVELES_PRECIO
-- =====================================================

ALTER TABLE acabados_niveles_precio DROP CONSTRAINT IF EXISTS check_acabados_nivel_tipo_impacto;
ALTER TABLE acabados_niveles_precio ADD CONSTRAINT check_acabados_nivel_tipo_impacto CHECK (
  tipo_impacto IN (
    'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
    'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto',
    'por_mt2_manual', 'fijo_mt2_manual'
  )
);
