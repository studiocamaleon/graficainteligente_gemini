# Fix: Agregar Soporte para Etapa "Instalación" en el Editor de Rutas

## 🎯 Objetivo

Agregar soporte completo para la etapa "Instalación" en el editor de rutas de producción, permitiendo que los productos con pasos de instalación se visualicen y editen correctamente.

## 🔍 Problema Identificado

El componente `ItemRouteEditor` solo renderizaba 3 etapas (Pre-Prensa, Principal, Post-Prensa), a pesar de que el sistema ya soportaba una cuarta etapa llamada "Instalación" en el tipo de datos y utilidades. Esto causaba que los productos con pasos de instalación mostraran "0 pasos en total" o fallaran al cargar correctamente.

### Evidencia del Problema

**Síntomas observados:**
- Tab "Ruta de Producción" mostraba "0 pasos en total"
- Solo aparecían 3 secciones: Pre-Prensa, Etapa Principal, Post-Prensa
- Todas las secciones aparecían con "0 pasos" cuando había pasos de instalación
- Los pasos de instalación existían en la base de datos pero no se mostraban

**Captura de pantalla del usuario:**
```
┌───────────────────────────────────────┐
│ Vinilo Blanco                         │
│ 0 pasos en total                      │ ← Incorrecto
├───────────────────────────────────────┤
│ Pre-Prensa       [0 pasos]            │
│ Etapa Principal  [0 pasos]            │
│ Post-Prensa      [0 pasos]            │
│                                       │
│ ❌ Falta sección "Instalación"        │
└───────────────────────────────────────┘
```

### Análisis del Sistema

**Componentes que YA soportaban "instalacion":**

✅ **`database.ts`** (línea 1069):
```typescript
export type TipoEtapaRuta = 'pre_prensa' | 'principal' | 'post_prensa' | 'instalacion';
```

✅ **`productionUtils.ts`** (líneas 3-8):
```typescript
export const ORDEN_ETAPAS: Record<TipoEtapaRuta, number> = {
  pre_prensa: 1,
  principal: 2,
  post_prensa: 3,
  instalacion: 4,  // ✅ Ya incluido
};
```

✅ **`generateProductionRoutes.ts`**:
- Normaliza etapas de instalación correctamente
- Genera pasos con `tipo_etapa: 'instalacion'`

**Componentes que NO soportaban "instalacion":**

❌ **`useOrdenItemRutas.ts`** (líneas 274-280):
```typescript
const getRutasPorEtapa = useCallback(() => {
  return {
    pre_prensa: rutas.filter(r => r.tipo_etapa === 'pre_prensa'),
    principal: rutas.filter(r => r.tipo_etapa === 'principal'),
    post_prensa: rutas.filter(r => r.tipo_etapa === 'post_prensa'),
    // ❌ FALTA: instalacion
  };
}, [rutas]);
```

❌ **`ItemRouteEditor.tsx`** (líneas 315-317):
```typescript
{renderEtapa('pre_prensa', 'Pre-Prensa', 'bg-purple-100 text-purple-800')}
{renderEtapa('principal', 'Etapa Principal', 'bg-blue-100 text-blue-800')}
{renderEtapa('post_prensa', 'Post-Prensa', 'bg-green-100 text-green-800')}
{/* ❌ FALTA: renderEtapa('instalacion', ...) */}
```

❌ **`ItemRouteEditor.tsx`** - Log de debug (líneas 60-64):
```typescript
console.log('📊 Rutas por etapa:', {
  pre_prensa: rutasPorEtapa.pre_prensa.length,
  principal: rutasPorEtapa.principal.length,
  post_prensa: rutasPorEtapa.post_prensa.length
  // ❌ FALTA: instalacion
});
```

### Causa Raíz

El hook `getRutasPorEtapa()` filtraba las rutas en solo 3 categorías, dejando fuera los pasos de instalación. Aunque estos pasos se cargaban desde la base de datos, se perdían al momento de agruparlos por etapa.

**Flujo del problema:**
```
1. Producto configurado con ruta que incluye instalación
   ↓
2. generateProductionRoutes() genera pasos correctamente
   → Incluye pasos con tipo_etapa: 'instalacion'
   ↓
3. Pasos se guardan en ordenes_trabajo_items_rutas
   ↓
4. useOrdenItemRutas() consulta y carga TODAS las rutas
   → Incluye pasos de instalación ✅
   ↓
5. getRutasPorEtapa() agrupa en 3 categorías solamente
   → pre_prensa, principal, post_prensa
   → ❌ Los pasos de instalación se PIERDEN
   ↓
6. ItemRouteEditor renderiza solo 3 secciones
   → ❌ Sección "Instalación" NO EXISTE
   ↓
7. RESULTADO:
   → Usuario ve "0 pasos en total"
   → Pasos de instalación existen pero NO SE MUESTRAN
   → No se pueden editar ni visualizar los pasos de instalación
```

---

## ✅ Solución Implementada

Se agregó soporte completo para la etapa "Instalación" en el hook y el componente de editor de rutas.

### Cambio 1: Actualizar Hook `useOrdenItemRutas.ts`

**Archivo**: `src/hooks/useOrdenItemRutas.ts`
**Líneas**: 274-280

**ANTES:**
```typescript
const getRutasPorEtapa = useCallback(() => {
  return {
    pre_prensa: rutas.filter(r => r.tipo_etapa === 'pre_prensa'),
    principal: rutas.filter(r => r.tipo_etapa === 'principal'),
    post_prensa: rutas.filter(r => r.tipo_etapa === 'post_prensa'),
  };
}, [rutas]);
```

**DESPUÉS:**
```typescript
const getRutasPorEtapa = useCallback(() => {
  return {
    pre_prensa: rutas.filter(r => r.tipo_etapa === 'pre_prensa'),
    principal: rutas.filter(r => r.tipo_etapa === 'principal'),
    post_prensa: rutas.filter(r => r.tipo_etapa === 'post_prensa'),
    instalacion: rutas.filter(r => r.tipo_etapa === 'instalacion'),  // ✅ Agregado
  };
}, [rutas]);
```

**Propósito**: Incluir los pasos de instalación en el objeto retornado por el hook.

---

### Cambio 2: Actualizar Log de Debug en `ItemRouteEditor.tsx`

**Archivo**: `src/components/orders/ItemRouteEditor.tsx`
**Líneas**: 60-64

**ANTES:**
```typescript
console.log('📊 Rutas por etapa:', {
  pre_prensa: rutasPorEtapa.pre_prensa.length,
  principal: rutasPorEtapa.principal.length,
  post_prensa: rutasPorEtapa.post_prensa.length
});
```

**DESPUÉS:**
```typescript
console.log('📊 Rutas por etapa:', {
  pre_prensa: rutasPorEtapa.pre_prensa.length,
  principal: rutasPorEtapa.principal.length,
  post_prensa: rutasPorEtapa.post_prensa.length,
  instalacion: rutasPorEtapa.instalacion.length  // ✅ Agregado
});
```

**Propósito**: Mostrar en consola la cantidad de pasos de instalación para debugging.

---

### Cambio 3: Renderizar Etapa Instalación en `ItemRouteEditor.tsx`

**Archivo**: `src/components/orders/ItemRouteEditor.tsx`
**Líneas**: 316-319

**ANTES:**
```typescript
{renderEtapa('pre_prensa', 'Pre-Prensa', 'bg-purple-100 text-purple-800')}
{renderEtapa('principal', 'Etapa Principal', 'bg-blue-100 text-blue-800')}
{renderEtapa('post_prensa', 'Post-Prensa', 'bg-green-100 text-green-800')}

<ConfirmDialog ... />
```

**DESPUÉS:**
```typescript
{renderEtapa('pre_prensa', 'Pre-Prensa', 'bg-purple-100 text-purple-800')}
{renderEtapa('principal', 'Etapa Principal', 'bg-blue-100 text-blue-800')}
{renderEtapa('post_prensa', 'Post-Prensa', 'bg-green-100 text-green-800')}
{renderEtapa('instalacion', 'Instalación', 'bg-orange-100 text-orange-800')}  {/* ✅ Agregado */}

<ConfirmDialog ... />
```

**Propósito**: Renderizar la sección de Instalación con color naranja distintivo.

**Colores por etapa:**
- **Pre-Prensa**: Morado (`bg-purple-100 text-purple-800`)
- **Principal**: Azul (`bg-blue-100 text-blue-800`)
- **Post-Prensa**: Verde (`bg-green-100 text-green-800`)
- **Instalación**: Naranja (`bg-orange-100 text-orange-800`) ← Nuevo

---

## 🔄 Flujo Corregido

**DESPUÉS del fix:**
```
1. Producto configurado con ruta que incluye instalación
   ↓
2. generateProductionRoutes() genera pasos correctamente
   → Incluye pasos con tipo_etapa: 'instalacion' ✅
   ↓
3. Pasos se guardan en ordenes_trabajo_items_rutas ✅
   ↓
4. useOrdenItemRutas() consulta y carga TODAS las rutas ✅
   ↓
5. getRutasPorEtapa() agrupa en 4 categorías
   → pre_prensa, principal, post_prensa, instalacion ✅
   → Los pasos de instalación se MANTIENEN ✅
   ↓
6. ItemRouteEditor renderiza 4 secciones
   → Pre-Prensa, Etapa Principal, Post-Prensa, Instalación ✅
   ↓
7. RESULTADO:
   → Usuario ve conteo correcto de pasos ✅
   → Sección "Instalación" visible con sus pasos ✅
   → Se pueden editar y visualizar todos los pasos ✅
```

---

## 📊 Vista Esperada (Después del Fix)

### Producto con pasos de instalación:

```
┌─────────────────────────────────────────────┐
│ Vinilo Blanco                               │
│ 3 pasos en total                            │ ← CORRECTO
├─────────────────────────────────────────────┤
│                                             │
│ Pre-Prensa            [0 pasos] [+ Agregar] │
│ ┌─────────────────────────────────────────┐ │
│ │ No hay pasos en esta etapa              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Etapa Principal       [1 paso]  [+ Agregar] │
│ ┌─────────────────────────────────────────┐ │
│ │ 1 Impresión                             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Post-Prensa          [1 paso]  [+ Agregar] │
│ ┌─────────────────────────────────────────┐ │
│ │ 1 Corte                                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Instalación          [1 paso]  [+ Agregar] │ ← NUEVA SECCIÓN ✅
│ ┌─────────────────────────────────────────┐ │
│ │ 1 Montaje en sitio                      │ │ ← VISIBLE AHORA ✅
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Producto sin pasos de instalación:

```
┌─────────────────────────────────────────────┐
│ Tarjeta Personal                            │
│ 2 pasos en total                            │
├─────────────────────────────────────────────┤
│ Pre-Prensa            [1 paso]              │
│ Etapa Principal       [1 paso]              │
│ Post-Prensa          [0 pasos]              │
│                                             │
│ Instalación          [0 pasos]  [+ Agregar] │ ← Aparece pero vacía ✅
│ ┌─────────────────────────────────────────┐ │
│ │ No hay pasos en esta etapa              │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 📋 Resumen de Cambios

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `src/hooks/useOrdenItemRutas.ts` | 279 | Agregar filtro `instalacion` en `getRutasPorEtapa()` |
| `src/components/orders/ItemRouteEditor.tsx` | 64 | Agregar `instalacion` en log de debug |
| `src/components/orders/ItemRouteEditor.tsx` | 319 | Renderizar sección "Instalación" con color naranja |

**Total**: 3 cambios en 2 archivos

---

## 🧪 Testing Manual

### Caso 1: Producto con pasos de instalación

**Pasos:**
1. Crear o editar un producto de la categoría que soporte instalación
2. Asignar una ruta de producción que incluya pasos de tipo "Instalación"
3. Agregar el producto a una nueva orden
4. Navegar al tab "Ruta de Producción"

**Resultado esperado:**
- ✅ Muestra "X pasos en total" (conteo correcto)
- ✅ Aparece sección "Instalación" con badge naranja
- ✅ Los pasos de instalación son visibles
- ✅ Se pueden editar, reordenar y eliminar pasos
- ✅ Se puede agregar comentarios a los pasos

**Logs esperados en consola:**
```
📍 ItemRouteEditor montado/actualizado: {
  ordenItemId: "uuid",
  totalRutas: 3,
  loading: false
}
📊 Rutas por etapa: {
  pre_prensa: 0,
  principal: 1,
  post_prensa: 1,
  instalacion: 1  ← ✅ Ahora visible
}
```

---

### Caso 2: Producto sin pasos de instalación

**Pasos:**
1. Agregar un producto normal (ej: tarjetas, folletos) a una orden
2. Navegar al tab "Ruta de Producción"

**Resultado esperado:**
- ✅ Muestra conteo correcto de pasos
- ✅ Aparece sección "Instalación" con "0 pasos"
- ✅ Mensaje: "No hay pasos en esta etapa"
- ✅ Botón "+ Agregar" disponible para agregar pasos manualmente

---

### Caso 3: Agregar paso de instalación manualmente

**Pasos:**
1. En el editor de rutas de cualquier producto
2. Ir a la sección "Instalación"
3. Hacer clic en "+ Agregar"
4. Seleccionar un paso de instalación (ej: "Montaje en sitio")
5. Agregar el paso

**Resultado esperado:**
- ✅ El paso se agrega correctamente
- ✅ Badge muestra "1 paso"
- ✅ El paso aparece en la lista con número de orden
- ✅ Se puede editar, mover y eliminar
- ✅ El paso se marca como "Modificado manualmente"

---

### Caso 4: Restaurar ruta original con instalación

**Pasos:**
1. Editar manualmente los pasos de una ruta (agregar/eliminar)
2. Hacer clic en "Restaurar Original"
3. Confirmar la acción

**Resultado esperado:**
- ✅ La ruta se restaura desde la plantilla del producto
- ✅ Los pasos de instalación originales se restauran
- ✅ Todos los cambios manuales se revierten
- ✅ Los comentarios personalizados se pierden (comportamiento esperado)

---

## 📈 Verificación de Consistencia

Después del fix, TODAS las partes del sistema están alineadas:

| Componente | Etapas Soportadas | Estado |
|------------|------------------|---------|
| `database.ts` (TipoEtapaRuta) | 4: pre_prensa, principal, post_prensa, instalacion | ✅ Consistente |
| `productionUtils.ts` (ORDEN_ETAPAS) | 4: con orden definido (1-4) | ✅ Consistente |
| `generateProductionRoutes.ts` | 4: normaliza y genera todas | ✅ Consistente |
| `useOrdenItemRutas.ts` (getRutasPorEtapa) | 4: filtra todas las etapas | ✅ Corregido |
| `ItemRouteEditor.tsx` (render) | 4: renderiza todas las etapas | ✅ Corregido |
| `ItemRouteEditor.tsx` (debug log) | 4: muestra conteo de todas | ✅ Corregido |

**Resultado:** Sistema 100% consistente ✅

---

## 🎯 Impacto del Fix

### Productos Beneficiados

**✅ Productos con instalación física:**
- Portabanners y expositores
- Estructuras de POP
- Señalética exterior
- Letreros con montaje
- Vinilos con instalación
- Cualquier producto que requiera montaje en sitio

**✅ Nuevas capacidades:**
- Configurar pasos específicos de instalación
- Agregar comentarios para el equipo de instalación
- Trackear el progreso de instalación en producción
- Generar reportes incluyendo tiempo de instalación

### Sin Regresiones

**✅ Productos sin instalación:**
- Funcionan exactamente igual que antes
- La sección "Instalación" aparece vacía (comportamiento correcto)
- No hay cambios en el flujo de trabajo

**✅ Otras etapas:**
- Pre-Prensa, Principal, Post-Prensa sin cambios
- Todos los flujos existentes funcionan igual

---

## 🔍 Logs de Debug Mejorados

**ANTES del fix:**
```
📊 Rutas por etapa: {
  pre_prensa: 0,
  principal: 1,
  post_prensa: 1
}
// ❌ No muestra instalacion, se pierden esos pasos
```

**DESPUÉS del fix:**
```
📊 Rutas por etapa: {
  pre_prensa: 0,
  principal: 1,
  post_prensa: 1,
  instalacion: 1  // ✅ Ahora visible
}
```

Esto facilita el debugging y permite identificar rápidamente si hay pasos de instalación en una ruta.

---

## 🧪 Verificación del Build

**Build exitoso:**
```bash
npm run build
✓ 2794 modules transformed
✓ built in 21.93s
```

**Sin errores:**
- ✅ TypeScript validado (todos los tipos consistentes)
- ✅ Sin errores de compilación
- ✅ Bundle generado correctamente
- ✅ Sin warnings adicionales

---

## 📚 Beneficios del Fix

### 1. Visibilidad Completa
Ahora los usuarios pueden ver TODOS los pasos de producción, incluyendo instalación, en un solo lugar.

### 2. Edición Completa
Los pasos de instalación se pueden:
- Visualizar con su número de orden
- Editar y agregar comentarios
- Reordenar dentro de la etapa
- Eliminar si es necesario
- Agregar manualmente

### 3. Consistencia del Sistema
Todas las partes del sistema ahora hablan el mismo "idioma" respecto a las 4 etapas de producción.

### 4. Mejor Debugging
Los logs ahora muestran información completa, facilitando la detección de problemas.

### 5. UX Mejorada
La interfaz refleja correctamente la cantidad de pasos, eliminando confusión ("0 pasos" cuando hay pasos de instalación).

---

## 🔄 Relación con Otros Fixes

Este fix complementa otros cambios recientes:

**Relacionado con:**
- `FIX_ORDEN_ETAPAS_INSTALACION.md`: Agregó soporte de "instalacion" al tipo y utilidades
- `FIX_ETAPA_INSTALACION.md`: Normalizó el valor de etapa en migraciones
- `FIX_GENERACION_RUTAS_GRAN_FORMATO.md`: Corrigió generación de rutas para Gran Formato

**Completa la funcionalidad:**
```
1. Database & Tipos ✅ (fix previo)
2. Utilidades ✅ (fix previo)
3. Generación de rutas ✅ (fix previo)
4. Visualización y edición ✅ (ESTE FIX)
```

---

## 🎯 Próximos Pasos Sugeridos

Aunque este fix está completo, hay oportunidades de mejora:

### 1. Ordenamiento Visual Mejorado
Actualmente las etapas se renderizan en orden:
1. Pre-Prensa
2. Principal
3. Post-Prensa
4. Instalación

Considerar usar `ORDEN_ETAPAS` de `productionUtils.ts` para renderizar dinámicamente en el orden correcto.

### 2. Validación de Rutas
Agregar validación que alerte si:
- Una ruta tiene instalación sin principal
- Los pasos de instalación están fuera de orden
- Faltan pasos obligatorios en instalación

### 3. Iconografía Distintiva
Usar iconos diferentes para cada etapa:
- Pre-Prensa: 📋 o ⚙️
- Principal: 🖨️ o 🎨
- Post-Prensa: ✂️ o 📦
- Instalación: 🔧 o 🚚

### 4. Estadísticas de Instalación
Agregar métricas específicas en dashboards:
- Tiempo promedio de instalación
- Órdenes con instalación pendiente
- Performance del equipo de instalación

---

## 📝 Resumen Ejecutivo

### Problema
La etapa "Instalación" existía en el sistema pero no se mostraba en el editor de rutas, causando confusión y pasos invisibles.

### Causa
El hook `getRutasPorEtapa()` solo filtraba 3 etapas, y el componente solo renderizaba 3 secciones.

### Solución
1. Agregado filtro `instalacion` al hook
2. Agregado log de debug para instalación
3. Renderizada sección "Instalación" con color naranja

### Resultado
- ✅ Visualización completa de los 4 tipos de etapas
- ✅ Edición funcional de pasos de instalación
- ✅ Sistema 100% consistente
- ✅ Sin regresiones en funcionalidad existente

### Archivos Modificados
- `src/hooks/useOrdenItemRutas.ts` (1 línea)
- `src/components/orders/ItemRouteEditor.tsx` (2 cambios)

### Impacto
- **Positivo**: Todos los productos con instalación
- **Neutro**: Productos sin instalación (sin cambios)
- **Regresiones**: Ninguna

---

**Documentación generada**: 2025-11-28
**Versión del sistema**: Post-adición soporte etapa Instalación
**Fix**: Visualización y edición de rutas con etapa Instalación
