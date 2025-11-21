# Corrección del Orden de Ejecución de Pasos de Producción

## Problema Identificado

Al abrir el modal de Ejecución de Producción, el paso "activo" mostrado era el último paso en lugar del primero. Esto ocurría porque las funciones `getActiveStep` y `canStartStep` no consideraban correctamente el orden de las etapas de producción.

### Causa Raíz

1. **`getActiveStep`**: Usaba `rutas.find()` que retornaba el primer elemento del array sin considerar el orden correcto de las etapas (Pre-prensa → Producción → Post-Prensa).

2. **`canStartStep`**: Solo validaba pasos dentro de la misma etapa, sin verificar que todas las etapas anteriores estuvieran completadas.

3. **Modal**: Las rutas no estaban ordenadas correctamente dentro de cada etapa.

## Solución Implementada

### 1. Constante de Orden de Etapas

Se agregó una constante que define la prioridad de cada etapa:

```typescript
const ORDEN_ETAPAS: Record<TipoEtapaRuta, number> = {
  pre_prensa: 1,
  principal: 2,
  post_prensa: 3,
};
```

### 2. Función de Ordenamiento Global

Se creó una función helper que ordena las rutas considerando:
1. Primero por etapa (pre_prensa < principal < post_prensa)
2. Luego por orden dentro de cada etapa

```typescript
const ordenarRutas = (rutas: OrdenItemRuta[]): OrdenItemRuta[] => {
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

### 3. Corrección de `getActiveStep`

Ahora ordena las rutas antes de buscar el paso activo:

```typescript
const getActiveStep = (rutas: OrdenItemRuta[]): OrdenItemRuta | null => {
  if (rutas.length === 0) return null;

  // Ordenar rutas por etapa y orden
  const rutasOrdenadas = ordenarRutas(rutas);

  // Buscar paso en proceso
  const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
  if (pasoEnProceso) return pasoEnProceso;

  // Buscar primer paso pendiente
  const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
  return pasoPendiente || null;
};
```

### 4. Corrección de `canStartStep`

Ahora valida que:
1. Todas las etapas anteriores estén completadas
2. Todos los pasos anteriores dentro de la misma etapa estén completados

```typescript
const canStartStep = (ruta: OrdenItemRuta, rutas: OrdenItemRuta[]): boolean => {
  if (ruta.estado_paso !== 'pendiente') return false;

  const hayPasoEnProceso = rutas.some((r) => r.estado_paso === 'en_proceso');
  if (hayPasoEnProceso) return false;

  const rutasOrdenadas = ordenarRutas(rutas);
  const ordenEtapaActual = ORDEN_ETAPAS[ruta.tipo_etapa];

  // Validar que todos los pasos anteriores estén completados
  for (const r of rutasOrdenadas) {
    const ordenEtapaRuta = ORDEN_ETAPAS[r.tipo_etapa];

    // Si es una etapa anterior completa, debe estar completada/omitida
    if (ordenEtapaRuta < ordenEtapaActual) {
      if (r.estado_paso !== 'completado' && r.estado_paso !== 'omitido') {
        return false;
      }
    }
    // Si es la misma etapa pero anterior en orden, debe estar completada/omitida
    else if (ordenEtapaRuta === ordenEtapaActual && r.orden < ruta.orden) {
      if (r.estado_paso !== 'completado' && r.estado_paso !== 'omitido') {
        return false;
      }
    }
    // Si llegamos a la ruta actual, terminamos
    else if (ordenEtapaRuta === ordenEtapaActual && r.orden === ruta.orden && r.id === ruta.id) {
      break;
    }
  }

  return true;
};
```

### 5. Ordenamiento en el Modal

Se agregó ordenamiento explícito dentro de cada etapa en `JobExecutionModal.tsx`:

```typescript
const rutasPorEtapa = rutas.reduce((acc, ruta) => {
  if (!acc[ruta.tipo_etapa]) {
    acc[ruta.tipo_etapa] = [];
  }
  acc[ruta.tipo_etapa].push(ruta);
  return acc;
}, {} as Record<string, typeof rutas>);

// Ordenar rutas dentro de cada etapa por el campo 'orden'
Object.keys(rutasPorEtapa).forEach((etapa) => {
  rutasPorEtapa[etapa].sort((a, b) => a.orden - b.orden);
});
```

## Comportamiento Correcto

### Flujo de Ejecución Esperado

1. **Al abrir el modal**: El paso activo es el **primer paso de Pre-prensa** (si está pendiente)

2. **Durante Pre-prensa**: Solo se pueden ejecutar pasos de Pre-prensa en orden secuencial

3. **Transición a Producción**: Solo cuando **todos** los pasos de Pre-prensa estén completados/omitidos, se habilita el primer paso de Producción

4. **Durante Producción**: Solo se pueden ejecutar pasos de Producción en orden secuencial

5. **Transición a Post-Prensa**: Solo cuando **todos** los pasos de Producción estén completados/omitidos, se habilita el primer paso de Post-Prensa

6. **Durante Post-Prensa**: Se ejecutan los pasos finales en orden secuencial

7. **Finalización**: Cuando todos los pasos están completados/omitidos, el item se marca como "finalizado"

## Ejemplos de Validación

### Ejemplo 1: Inicio de Producción
```
Pre-prensa:
  ✅ Paso 1: Completado
  ✅ Paso 2: Completado
Producción:
  ⏸️ Paso 3: Pendiente (✅ PUEDE INICIARSE)
  ⏸️ Paso 4: Pendiente (❌ NO puede iniciarse)
Post-Prensa:
  ⏸️ Paso 5: Pendiente (❌ NO puede iniciarse)
```

### Ejemplo 2: Orden Incorrecto
```
Pre-prensa:
  ✅ Paso 1: Completado
  ⏸️ Paso 2: Pendiente (✅ PUEDE INICIARSE)
Producción:
  ⏸️ Paso 3: Pendiente (❌ NO puede iniciarse - Pre-prensa incompleta)
```

### Ejemplo 3: Paso Omitido
```
Pre-prensa:
  ✅ Paso 1: Completado
  ⚠️ Paso 2: Omitido (justificación: "Material no requiere este proceso")
Producción:
  ⏸️ Paso 3: Pendiente (✅ PUEDE INICIARSE - Omitido cuenta como completado)
```

## Archivos Modificados

1. **`src/hooks/useStepExecution.ts`**
   - Agregada constante `ORDEN_ETAPAS`
   - Agregada función `ordenarRutas`
   - Corregida función `getActiveStep`
   - Corregida función `canStartStep`

2. **`src/components/production/JobExecutionModal.tsx`**
   - Agregado ordenamiento de rutas dentro de cada etapa

## Beneficios

✅ **Flujo Predecible**: Los operadores siempre ven el paso correcto que deben ejecutar

✅ **Orden Garantizado**: No se pueden ejecutar pasos fuera de secuencia

✅ **Validación Robusta**: Se valida tanto el orden dentro de la etapa como entre etapas

✅ **UX Mejorada**: El paso activo destacado siempre es el correcto

✅ **Seguridad**: Previene errores de ejecución en orden incorrecto

## Testing Recomendado

1. Crear un job con pasos en las tres etapas
2. Verificar que el primer paso mostrado es de Pre-prensa
3. Completar pasos de Pre-prensa en orden
4. Verificar que Producción solo se habilita al completar Pre-prensa
5. Probar omitir un paso y verificar que el siguiente se habilita
6. Verificar que Post-Prensa solo se habilita al completar Producción
7. Completar todos los pasos y verificar que el item se marca como "finalizado"
