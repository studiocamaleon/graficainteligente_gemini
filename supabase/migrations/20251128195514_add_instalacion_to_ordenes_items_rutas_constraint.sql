/*
  # Agregar 'instalacion' al Constraint de ordenes_trabajo_items_rutas

  ## Problema
  El constraint check_tipo_etapa_item_ruta solo acepta 3 valores:
  - 'pre_prensa'
  - 'principal'
  - 'post_prensa'

  Esto causa errores al insertar rutas con etapa 'instalacion' generadas
  por productos que incluyen pasos de instalación (ej: Gran Formato).

  Error observado:
  ```
  code: "23514"
  message: "new row for relation \"ordenes_trabajo_items_rutas\"
            violates check constraint \"check_tipo_etapa_item_ruta\""
  ```

  ## Inconsistencia Actual
  - rutas_produccion_pasos: ✅ Soporta 'instalacion' (4 valores)
  - ordenes_trabajo_items_rutas: ❌ NO soporta 'instalacion' (3 valores)

  ## Flujo del Error
  1. Usuario crea orden con producto de Gran Formato
  2. generateProductionRoutes() genera pasos con etapa 'instalacion'
  3. INSERT en ordenes_trabajo_items_rutas con tipo_etapa: 'instalacion'
  4. ❌ Constraint RECHAZA el valor
  5. Error: Orden no se completa, rutas no se insertan

  ## Solución
  Actualizar constraint para aceptar 4 valores en snake_case:
  - 'pre_prensa'
  - 'principal'
  - 'post_prensa'
  - 'instalacion' ← NUEVO

  ## Consistencia del Sistema
  Después de este fix, todas las partes estarán alineadas:
  - Tipo TypeScript TipoEtapaRuta: 4 valores ✅
  - Utilidad ORDEN_ETAPAS: 4 valores ✅
  - rutas_produccion_pasos constraint: 4 valores ✅
  - ordenes_trabajo_items_rutas constraint: 4 valores ✅ (este fix)
  - Hook getRutasPorEtapa(): 4 valores ✅
  - Componente ItemRouteEditor: 4 secciones ✅

  ## Productos Beneficiados
  - Gran Formato con instalación
  - Portabanners con montaje
  - Estructuras de POP con armado
  - Señalética con instalación en sitio
  - Cualquier producto que requiera montaje físico
*/

-- =====================================================
-- 1. MIGRAR DATOS EXISTENTES (si los hay)
-- =====================================================

-- Convertir cualquier variación de instalación a snake_case
-- (por precaución, aunque no debería haber datos aún)
UPDATE ordenes_trabajo_items_rutas
SET tipo_etapa = 'instalacion',
    updated_at = now()
WHERE tipo_etapa IN ('Instalacion', 'Instalación', 'INSTALACION');

-- =====================================================
-- 2. ELIMINAR CONSTRAINT EXISTENTE
-- =====================================================

ALTER TABLE ordenes_trabajo_items_rutas
DROP CONSTRAINT IF EXISTS check_tipo_etapa_item_ruta;

-- =====================================================
-- 3. CREAR NUEVO CONSTRAINT CON 4 VALORES
-- =====================================================

ALTER TABLE ordenes_trabajo_items_rutas
ADD CONSTRAINT check_tipo_etapa_item_ruta CHECK (
  tipo_etapa IN ('pre_prensa', 'principal', 'post_prensa', 'instalacion')
);

-- =====================================================
-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON CONSTRAINT check_tipo_etapa_item_ruta
ON ordenes_trabajo_items_rutas IS
  'Valida que tipo_etapa sea uno de los 4 valores válidos en snake_case:
   pre_prensa, principal, post_prensa, instalacion';

COMMENT ON COLUMN ordenes_trabajo_items_rutas.tipo_etapa IS
  'Etapa de producción del paso: pre_prensa, principal, post_prensa, instalacion';

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
  v_total_rutas INTEGER;
  v_pre_prensa INTEGER;
  v_principal INTEGER;
  v_post_prensa INTEGER;
  v_instalacion INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_rutas FROM ordenes_trabajo_items_rutas;
  SELECT COUNT(*) INTO v_pre_prensa FROM ordenes_trabajo_items_rutas WHERE tipo_etapa = 'pre_prensa';
  SELECT COUNT(*) INTO v_principal FROM ordenes_trabajo_items_rutas WHERE tipo_etapa = 'principal';
  SELECT COUNT(*) INTO v_post_prensa FROM ordenes_trabajo_items_rutas WHERE tipo_etapa = 'post_prensa';
  SELECT COUNT(*) INTO v_instalacion FROM ordenes_trabajo_items_rutas WHERE tipo_etapa = 'instalacion';

  RAISE NOTICE '=== Constraint Actualizado en ordenes_trabajo_items_rutas ===';
  RAISE NOTICE 'Total de rutas en órdenes: %', v_total_rutas;
  RAISE NOTICE 'Distribución por etapa:';
  RAISE NOTICE '  - pre_prensa: %', v_pre_prensa;
  RAISE NOTICE '  - principal: %', v_principal;
  RAISE NOTICE '  - post_prensa: %', v_post_prensa;
  RAISE NOTICE '  - instalacion: %', v_instalacion;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Constraint actualizado: Acepta 4 valores en snake_case';
  RAISE NOTICE '✅ Consistente con rutas_produccion_pasos';
  RAISE NOTICE '✅ Órdenes con productos de instalación ahora funcionarán correctamente';
END $$;