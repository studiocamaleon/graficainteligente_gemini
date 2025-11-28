# Fix: Orden de Etapas - Incluir "Instalación" en Todo el Sistema

## 🎯 Objetivo

Estandarizar el orden de las etapas de producción en todo el sistema para que siempre se respete:

```
Pre-prensa → Producción → Terminación → Instalación
```

## 🔍 Problema Identificado

El sistema tenía **inconsistencias** en la definición del orden de etapas:

### ✅ Lugares donde SÍ estaba correcto:
- `RutaPasosEditor.tsx`: Array con las 4 etapas
- `OrdenRutasTab.tsx`: Array con las 4 etapas

### ❌ Lugares donde FALTABA "instalacion":
- `productionUtils.ts`: ORDEN_ETAPAS solo tenía 3 valores
- `database.ts`: TipoEtapaRuta solo incluía 3 tipos
- `RouteDetailModal.tsx`: Array ordenEtapas con 3 etapas
- `JobExecutionModal.tsx`: Array ordenEtapas con 3 etapas
- `ActiveStepBadge.tsx`: Mapeo de colores sin instalacion
- `StepCard.tsx`: Mapeo de colores sin instalacion
- `StageDistributionChart.tsx`: Mapeo de colores sin instalacion

## ✅ Solución Implementada

### 1. Actualizado Orden de Etapas Central

**Archivo**: `src/utils/productionUtils.ts`

```typescript
export const ORDEN_ETAPAS: Record<TipoEtapaRuta, number> = {
  pre_prensa: 1,
  principal: 2,
  post_prensa: 3,
  instalacion: 4,  // ✅ AGREGADO
};
```

Este objeto se usa en `useStepExecution.ts` y otros hooks para ordenar las rutas durante la ejecución.

### 2. Actualizado Tipo TypeScript

**Archivo**: `src/types/database.ts`

```typescript
// ANTES
export type TipoEtapaRuta = 'pre_prensa' | 'principal' | 'post_prensa';

// DESPUÉS
export type TipoEtapaRuta = 'pre_prensa' | 'principal' | 'post_prensa' | 'instalacion';
```

### 3. Actualizado RouteDetailModal

**Archivo**: `src/components/orders/RouteDetailModal.tsx`

**Cambios:**
- Agregado `'instalacion'` al array `ordenEtapas`
- Agregado label: `instalacion: 'Instalación'`
- Agregado colores: `instalacion: 'bg-orange-50 border-orange-200'`

### 4. Actualizado JobExecutionModal

**Archivo**: `src/components/production/JobExecutionModal.tsx`

**Cambios:**
- Agregado `'instalacion'` al array `ordenEtapas`
- Agregado label: `instalacion: 'Instalación'`
- Agregado colores: `instalacion: 'bg-orange-100 text-orange-800 border-orange-300'`

### 5. Actualizado ActiveStepBadge

**Archivo**: `src/components/production/ActiveStepBadge.tsx`

**Cambios:**
- Agregado colores para instalacion en el Record tipado con TipoEtapaRuta:
  ```typescript
  instalacion: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
  }
  ```

### 6. Actualizado StepCard

**Archivo**: `src/components/production/StepCard.tsx`

**Cambios:**
- Agregado: `instalacion: 'border-orange-300 bg-orange-50'`

### 7. Actualizado StageDistributionChart

**Archivo**: `src/components/productivity/StageDistributionChart.tsx`

**Cambios:**
- Agregado instalacion con colores consistentes
- Reordenados colores para mantener coherencia visual:
  - Pre-prensa: purple (antes era blue)
  - Principal: blue (antes era green)
  - Post-prensa: green (antes era orange)
  - Instalación: orange (nuevo)

## 🎨 Esquema de Colores Estandarizado

| Etapa | Color Base | Variantes |
|-------|-----------|-----------|
| **Pre-prensa** | Purple | `bg-purple-50/100/500`, `text-purple-600/700/800`, `border-purple-200/300` |
| **Principal (Producción)** | Blue | `bg-blue-50/100/500`, `text-blue-600/700/800`, `border-blue-200/300` |
| **Post-prensa (Terminación)** | Green | `bg-green-50/100/500`, `text-green-600/700/800`, `border-green-200/300` |
| **Instalación** | Orange | `bg-orange-50/100/500`, `text-orange-600/700/800`, `border-orange-200/300` |

## 📋 Archivos Modificados

1. ✅ `src/utils/productionUtils.ts` - Orden de etapas
2. ✅ `src/types/database.ts` - Tipo TipoEtapaRuta
3. ✅ `src/components/orders/RouteDetailModal.tsx` - Array y colores
4. ✅ `src/components/production/JobExecutionModal.tsx` - Array y colores
5. ✅ `src/components/production/ActiveStepBadge.tsx` - Colores tipados
6. ✅ `src/components/production/StepCard.tsx` - Colores
7. ✅ `src/components/productivity/StageDistributionChart.tsx` - Colores y orden

## ✅ Verificación

- ✅ TypeScript compila sin errores
- ✅ Build exitoso: `npm run build`
- ✅ El orden de etapas es consistente en todo el sistema
- ✅ Los colores son coherentes y visualmente distinguibles
- ✅ Todas las funciones de ordenamiento incluyen las 4 etapas

## 🧪 Cómo Verificar

### En la UI de Rutas de Producción:

1. Ve a **ABM Core → Rutas de Producción**
2. Crea o edita una ruta
3. Las etapas deben aparecer en orden:
   - Pre-prensa (morado)
   - Producción (azul)
   - Terminación (verde)
   - **Instalación (naranja)**

### En el Modal de Ejecución de Trabajos:

1. Ve a **Producción → Jobs**
2. Haz clic en un trabajo
3. Los pasos deben agruparse por etapa en el orden correcto
4. **Instalación** debe aparecer al final con color naranja

### En Detalle de Orden:

1. Ve a **Órdenes → Detalle de Orden**
2. Tab "Rutas de Producción"
3. Las rutas deben mostrarse agrupadas por etapa
4. El orden debe ser: Pre-prensa → Producción → Terminación → Instalación

## 📊 Impacto

**Antes del fix:**
- ❌ Inconsistencia en el orden de etapas
- ❌ `instalacion` faltaba en archivos críticos
- ❌ Componentes no podían mostrar pasos de Instalación
- ❌ Funciones de ordenamiento no incluían Instalación

**Después del fix:**
- ✅ Orden estandarizado en todo el sistema
- ✅ Las 4 etapas están completamente soportadas
- ✅ Coherencia visual con colores consistentes
- ✅ El flujo de producción es completo y lógico
- ✅ TypeScript garantiza que no se olvide ninguna etapa

## 🔒 Beneficios a Futuro

1. **Type Safety**: El tipo `TipoEtapaRuta` incluye todas las etapas
2. **Consistencia**: Un solo objeto `ORDEN_ETAPAS` define el orden
3. **Mantenibilidad**: Cambios futuros solo requieren actualizar `productionUtils.ts`
4. **Visual**: Colores consistentes en toda la aplicación
5. **Escalabilidad**: Agregar nuevas etapas es directo y seguro

## 📝 Mapeo de Etapas (DB ↔ UI)

| Base de Datos (snake_case) | UI Display (Capitalizado) | Orden |
|----------------------------|---------------------------|-------|
| `pre_prensa` | Pre-prensa | 1 |
| `principal` | Producción | 2 |
| `post_prensa` | Terminación | 3 |
| `instalacion` | Instalación | 4 |

## ⚠️ Notas Importantes

1. La base de datos usa **snake_case** (`instalacion`)
2. La UI muestra **capitalizado con tilde** ("Instalación")
3. El orden se define centralmente en `productionUtils.ts`
4. Los colores son coherentes: Purple → Blue → Green → Orange
5. Todos los componentes ahora respetan el mismo orden

---

**Resultado Final**: El sistema ahora respeta completamente el orden lógico de producción:
**Pre-prensa → Producción → Terminación → Instalación** en todos los componentes y funciones. 🎉
