# Mejora Kanban: Mostrar Paso Relevante en Cards

## Resumen de Cambios

Se eliminó el badge redundante de estado del job y se reemplazó por información del paso relevante, proporcionando contexto más útil al usuario.

---

## Problema Identificado

**Antes:**
- Las cards del Kanban mostraban un badge con el estado (Pendiente, En Proceso, Finalizado)
- Esta información era **redundante** porque el estado ya está implícito en la columna donde se encuentra la card
- El espacio del badge no se aprovechaba para mostrar información útil

**Visualización anterior:**
```
Columna "En Proceso"
┌─────────────────────────────┐
│ [En Proceso]    #ORD-001    │ ← Redundante!
│ Cliente: López              │
│ 📦 Tarjetas                 │
│ ▓▓▓▓░░░░░░ 45%             │
└─────────────────────────────┘
```

---

## Solución Implementada

Se reemplazó el badge de estado por un badge que muestra el **paso relevante** del job:

### Lógica de Paso Relevante

1. **Job con paso EN PROCESO:**
   - Mostrar el paso que está actualmente en ejecución
   - Icono: 🔄
   - Color según etapa

2. **Job con pasos PENDIENTES:**
   - Mostrar el primer paso pendiente (el que está listo para iniciar)
   - Icono: →
   - Color según etapa

3. **Job FINALIZADO:**
   - Mostrar indicador de completado
   - Icono: ✓
   - Color verde

4. **Job SIN RUTA:**
   - Mostrar advertencia
   - Icono: ⚠️
   - Color ámbar

### Colores por Etapa

- **Pre-Prensa:** Morado (purple)
- **Principal:** Azul (blue)
- **Post-Prensa:** Verde (green)

---

## Archivos Creados

### 1. `src/utils/productionUtils.ts` (NUEVO)

**Propósito:** Utilidad compartida para ordenar rutas por etapa y orden

```typescript
export const ORDEN_ETAPAS: Record<TipoEtapaRuta, number> = {
  pre_prensa: 1,
  principal: 2,
  post_prensa: 3,
};

export const ordenarRutasPorEtapaYOrden = <T extends RutaOrdenable>(rutas: T[]): T[] => {
  return [...rutas].sort((a, b) => {
    const ordenEtapaA = ORDEN_ETAPAS[a.tipo_etapa];
    const ordenEtapaB = ORDEN_ETAPAS[b.tipo_etapa];
    if (ordenEtapaA !== ordenEtapaB) {
      return ordenEtapaA - ordenEtapaB;
    }
    return a.orden - b.orden;
  });
};
```

**Beneficio:** Evita duplicación de código entre hooks.

---

### 2. `src/components/production/ActiveStepBadge.tsx` (NUEVO)

**Propósito:** Componente para mostrar el paso relevante del job

```typescript
interface ActiveStepBadgeProps {
  pasoRelevante?: {
    nombre: string;
    estado: 'pendiente' | 'en_proceso';
    etapa: TipoEtapaRuta;
  } | null;
  estadoJob: EstadoOrdenItem;
  totalPasos: number;
  size?: 'sm' | 'md';
}
```

**Características:**
- Truncamiento automático de nombres largos
- Tooltip con nombre completo
- Colores dinámicos según etapa
- Iconos visuales para cada estado
- Responsive y adaptable

---

## Archivos Modificados

### 3. `src/hooks/useProductionJobs.ts`

**Cambios principales:**

**a) Agregado campo `paso_relevante` a interface JobItem:**
```typescript
export interface JobItem {
  // ... campos existentes
  paso_relevante?: {
    nombre: string;
    estado: 'pendiente' | 'en_proceso';
    etapa: TipoEtapaRuta;
  } | null;
}
```

**b) Modificada consulta para traer datos completos de rutas:**
```typescript
// ANTES:
.select('orden_item_id, estado_paso')

// DESPUÉS:
.select('orden_item_id, estado_paso, paso_nombre, tipo_etapa, orden')
```

**c) Agregada función `encontrarPasoRelevante`:**
```typescript
const encontrarPasoRelevante = (itemRutas: any[]) => {
  if (itemRutas.length === 0) return null;

  const rutasOrdenadas = ordenarRutasPorEtapaYOrden(itemRutas);

  // Buscar paso en proceso
  const pasoEnProceso = rutasOrdenadas.find(r => r.estado_paso === 'en_proceso');
  if (pasoEnProceso) {
    return {
      nombre: pasoEnProceso.paso_nombre,
      estado: 'en_proceso',
      etapa: pasoEnProceso.tipo_etapa
    };
  }

  // Buscar primer paso pendiente
  const pasoPendiente = rutasOrdenadas.find(r => r.estado_paso === 'pendiente');
  if (pasoPendiente) {
    return {
      nombre: pasoPendiente.paso_nombre,
      estado: 'pendiente',
      etapa: pasoPendiente.tipo_etapa
    };
  }

  return null;
};
```

**d) Campo agregado al mapeo de JobItem:**
```typescript
const pasoRelevante = encontrarPasoRelevante(itemRutas);

return {
  // ... campos existentes
  paso_relevante: pasoRelevante,
};
```

**Nota:** También se actualizó la función `updateJobGranular` para incluir el paso relevante en las actualizaciones en tiempo real.

---

### 4. `src/hooks/useStepExecution.ts`

**Cambios:**

**a) Importar utilidad compartida:**
```typescript
import { ordenarRutasPorEtapaYOrden, ORDEN_ETAPAS } from '../utils/productionUtils';
```

**b) Eliminado código duplicado:**
- Eliminada constante `ORDEN_ETAPAS` local (ahora importada)
- Eliminada función `ordenarRutas` local (reemplazada por `ordenarRutasPorEtapaYOrden`)

**c) Actualizar llamadas:**
```typescript
// ANTES:
const rutasOrdenadas = ordenarRutas(rutas);

// DESPUÉS:
const rutasOrdenadas = ordenarRutasPorEtapaYOrden(rutas);
```

---

### 5. `src/components/production/JobCard.tsx`

**Cambios:**

**a) Cambiar import:**
```typescript
// ANTES:
import { ItemStatusBadge } from '../orders/ItemStatusBadge';

// DESPUÉS:
import { ActiveStepBadge } from './ActiveStepBadge';
```

**b) Reemplazar badge:**
```typescript
// ANTES:
<ItemStatusBadge estado={job.estado} size="sm" />

// DESPUÉS:
<ActiveStepBadge
  pasoRelevante={job.paso_relevante}
  estadoJob={job.estado}
  totalPasos={job.total_pasos}
  size="sm"
/>
```

---

## Resultado Visual

### Columna "Pendiente"

```
┌─────────────────────────────┐
│ [→ Diseño]      #ORD-001    │ ← Muestra primer paso pendiente
│ Cliente: Imprenta López     │
│ 📦 Tarjetas personales      │
│ Cantidad: 1000              │
│ ░░░░░░░░░░ 0%              │
└─────────────────────────────┘
```

**Interpretación:** El job está listo, el siguiente paso a realizar es "Diseño"

---

### Columna "En Proceso"

```
┌─────────────────────────────┐
│ [🔄 Impresión]  #ORD-002    │ ← Muestra paso actualmente en ejecución
│ Cliente: García SA          │
│ 📦 Folletos A4              │
│ Cantidad: 500               │
│ ▓▓▓▓░░░░░░ 45%             │
└─────────────────────────────┘
```

**Interpretación:** El job está en proceso, actualmente se está ejecutando "Impresión"

---

### Columna "Finalizado"

```
┌─────────────────────────────┐
│ [✓ Completado]  #ORD-003    │ ← Indica que todo está terminado
│ Cliente: Martínez SRL       │
│ 📦 Banners 2x1              │
│ Cantidad: 10                │
│ ▓▓▓▓▓▓▓▓▓▓ 100%            │
└─────────────────────────────┘
```

**Interpretación:** El job completó todos sus pasos

---

### Job Sin Ruta Definida

```
┌─────────────────────────────┐
│ [⚠️ Sin ruta]   #ORD-004    │ ← Alerta de configuración incompleta
│ Cliente: Nuevo Cliente      │
│ 📦 Producto especial        │
│ Cantidad: 1                 │
│ ░░░░░░░░░░ 0%              │
└─────────────────────────────┘
```

**Interpretación:** El job no tiene ruta de producción configurada

---

## Beneficios de la Mejora

### 1. Información Contextual Relevante

**Antes:**
- "Este job está en proceso" ← Ya lo sé por la columna

**Ahora:**
- "Este job está ejecutando el paso de Impresión" ← Información útil!

### 2. Identificación Rápida de Etapas

Los colores permiten identificar visualmente en qué etapa del proceso está cada job:
- **Morado:** Pre-producción (diseño, preparación)
- **Azul:** Producción principal
- **Verde:** Post-producción (terminaciones)

### 3. Elimina Redundancia Visual

No se muestra dos veces la misma información (estado), aprovechando mejor el espacio de la UI.

### 4. Mejor Comunicación del Flujo

El icono comunica visualmente el estado:
- **→** : Listo para iniciar
- **🔄** : En ejecución
- **✓** : Completado
- **⚠️** : Requiere atención

### 5. Código Más Mantenible

La utilidad compartida `ordenarRutasPorEtapaYOrden` evita duplicación y hace el código más DRY (Don't Repeat Yourself).

---

## Casos de Uso

### Para Operador de Producción

**Escenario:** Busco un job para iniciar
- Veo columna "Pendiente"
- Las cards muestran `→ Diseño`, `→ Corte`, `→ Impresión`
- Identifico rápidamente qué tipo de trabajo necesita cada job

### Para Supervisor

**Escenario:** Verifico progreso de jobs
- Veo columna "En Proceso"
- Las cards muestran qué paso se está ejecutando en cada momento
- Detecto cuellos de botella (varios jobs en mismo paso)

### Para Operador Especializado

**Escenario:** Soy operador de impresión
- Busco visualmente badges azules con 🔄 (etapa principal en proceso)
- Filtro mentalmente los jobs que me corresponden

---

## Compatibilidad y Mantenimiento

### Datos Legacy

✅ La función `encontrarPasoRelevante` maneja correctamente:
- Jobs sin rutas (devuelve null)
- Jobs sin pasos pendientes ni en proceso (devuelve null)
- Jobs con datos inconsistentes

### Actualización en Tiempo Real

✅ El sistema de realtime existente sigue funcionando:
- `useRealtimeJobs` escucha cambios en la BD
- `updateJobGranular` recalcula el paso relevante
- El Kanban se actualiza automáticamente

### Performance

✅ Optimizaciones aplicadas:
- La función `ordenarRutasPorEtapaYOrden` es O(n log n)
- Solo se ejecuta una vez por job durante el fetch inicial
- Las actualizaciones granulares minimizan re-renders

---

## Testing Sugerido

### Casos a Probar

1. **Job Pendiente con primer paso listo:**
   - ✅ Debe mostrar `→ [Nombre del primer paso]`
   - ✅ Color según etapa del paso

2. **Job En Proceso con paso activo:**
   - ✅ Debe mostrar `🔄 [Nombre del paso en ejecución]`
   - ✅ Color según etapa del paso

3. **Job Finalizado:**
   - ✅ Debe mostrar `✓ Completado`
   - ✅ Color verde

4. **Job sin ruta:**
   - ✅ Debe mostrar `⚠️ Sin ruta`
   - ✅ Color ámbar

5. **Nombres largos de pasos:**
   - ✅ Debe truncar con ellipsis
   - ✅ Tooltip muestra nombre completo

6. **Actualización en tiempo real:**
   - ✅ Al iniciar un paso → Badge cambia de `→` a `🔄`
   - ✅ Al completar un paso → Badge cambia al siguiente paso
   - ✅ Al finalizar último paso → Badge cambia a `✓ Completado`

---

## Próximas Mejoras Potenciales

1. **Filtro por Etapa:**
   - Permitir filtrar jobs por etapa (pre_prensa, principal, post_prensa)
   - Útil para operadores especializados

2. **Indicador de Tiempo:**
   - Mostrar tiempo transcurrido del paso en proceso
   - Alerta si excede tiempo estimado

3. **Indicador de Prioridad:**
   - Badge adicional para jobs urgentes
   - Integración con fecha de entrega

4. **Agrupación Visual:**
   - Agrupar jobs por etapa dentro de cada columna
   - Mejora la organización visual

5. **Responsable del Paso:**
   - Mostrar avatar del usuario responsable
   - Junto al nombre del paso activo

---

## Conclusión

Esta mejora transforma el Kanban de producción de una vista redundante a una herramienta informativa que proporciona contexto real y útil sobre el estado de cada job. Los operadores ahora pueden:

- ✅ Identificar rápidamente qué paso está ejecutándose o debe ejecutarse
- ✅ Visualizar la etapa de producción mediante colores
- ✅ Detectar jobs sin configuración de ruta
- ✅ Tomar decisiones más rápidas sobre qué trabajo priorizar

El código resultante es más limpio, mantenible y reutilizable gracias a la extracción de utilidades compartidas.
