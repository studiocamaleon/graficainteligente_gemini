# Diagnóstico: Archivos No Se Asocian a Órdenes

## Fecha: 2025-11-23
## Estado: PROBLEMA IDENTIFICADO - EN INVESTIGACIÓN

---

## Resumen del Problema

**Síntoma:** Al crear una orden con archivos adjuntos, los archivos NO aparecen en el detalle de la orden.

**Evidencia en BD:**
```sql
-- Archivos temporales huérfanos encontrados:
SELECT * FROM ordenes_trabajo_archivos
WHERE orden_temporal_id = 'b6f60282-c591-42b9-bac1-079c763dc20a';

Resultado: 2 archivos con orden_id = NULL

-- Órdenes recientes sin archivos:
Orden GI-000006: 0 archivos
Orden GI-000005: 0 archivos
```

**Conclusión:** La función `asociarConOrden` NO se está ejecutando o está fallando silenciosamente.

---

## Tests Ejecutados

### ✅ Test 1: Estructura de BD
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ordenes_trabajo_archivos';
```
**Resultado:** CORRECTO
- `orden_id` es nullable ✅
- `orden_temporal_id` existe ✅
- `temporal_creado_en` existe ✅

---

### ✅ Test 2: Constraint XOR
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ordenes_trabajo_archivos'::regclass;
```
**Resultado:** CORRECTO
```
CHECK ((
  (orden_id IS NOT NULL AND orden_temporal_id IS NULL) OR
  (orden_id IS NULL AND orden_temporal_id IS NOT NULL)
))
```

---

### ✅ Test 3: Archivos Temporales
```sql
SELECT id, orden_id, orden_temporal_id, nombre_archivo
FROM ordenes_trabajo_archivos
WHERE orden_temporal_id IS NOT NULL;
```
**Resultado:** 2 archivos huérfanos encontrados
- ID: `e20aae98-8bbc-49f6-aa8b-80ec08692276`
- ID: `b3665d70-ccbd-493f-b443-413c3e3f67a2`
- `orden_temporal_id`: `b6f60282-c591-42b9-bac1-079c763dc20a`
- Creados: 2025-11-23 00:26 y 00:40

---

### ✅ Test 4: Órdenes Recientes
```sql
SELECT id, numero_orden, created_at
FROM ordenes_trabajo
WHERE created_at > '2025-11-23 00:00:00';
```
**Resultado:** 2 órdenes recientes
- GI-000006: creada 02:32 (después de los archivos)
- GI-000005: creada 02:19 (después de los archivos)

**Observación:** Las órdenes fueron creadas DESPUÉS de que se subieron los archivos, confirmando el flujo correcto.

---

### ✅ Test 5: Archivos en Órdenes
```sql
SELECT ot.numero_orden, COUNT(ota.id) as archivos_count
FROM ordenes_trabajo ot
LEFT JOIN ordenes_trabajo_archivos ota ON ota.orden_id = ot.id
WHERE ot.id IN ('528ec89f...', '3ba254f4...')
GROUP BY ot.numero_orden;
```
**Resultado:** PROBLEMA CONFIRMADO
- GI-000006: **0 archivos** ❌
- GI-000005: **0 archivos** ❌

---

### ✅ Test 6: UPDATE Manual
```sql
UPDATE ordenes_trabajo_archivos
SET
  orden_id = '528ec89f-df6f-4829-a475-d39b5a5093a2',
  orden_temporal_id = NULL,
  temporal_creado_en = NULL
WHERE orden_temporal_id = 'b6f60282-c591-42b9-bac1-079c763dc20a'
RETURNING id, orden_id, nombre_archivo;
```
**Resultado:** ✅ EXITOSO
- 2 archivos actualizados correctamente
- Constraint XOR no bloqueó
- Archivos ahora tienen `orden_id` y `orden_temporal_id = NULL`

**Conclusión Crítica:** El UPDATE SQL funciona perfectamente. El problema está en el código JavaScript.

---

## Análisis del Código

### Función `asociarConOrden` (useOrdenArchivos.ts líneas 340-390)

```typescript
const asociarConOrden = async (ordenIdReal: string) => {
  if (!ordenTemporalId || !profile?.company_id) {  // ← LÍNEA 341
    throw new Error('No hay archivos temporales para asociar');
  }

  try {
    console.log('[asociarConOrden] Actualizando BD para orden:', ordenIdReal);

    const { error: updateError } = await supabase
      .from('ordenes_trabajo_archivos')
      .update({
        orden_id: ordenIdReal,
        orden_temporal_id: null,
        temporal_creado_en: null
      })
      .eq('orden_temporal_id', ordenTemporalId)
      .eq('company_id', profile.company_id);

    if (updateError) throw updateError;

    const { count } = await supabase
      .from('ordenes_trabajo_archivos')
      .select('*', { count: 'exact', head: true })
      .eq('orden_id', ordenIdReal);

    console.log(`[asociarConOrden] ${count} archivos asociados en BD`);

    // ... resto del código
  } catch (err: any) {
    console.error('[ERROR] Error asociando archivos:', err);
    throw err;
  }
};
```

### Problemas Potenciales Identificados

#### Problema 1: Validación en línea 341 ⚠️

```typescript
if (!ordenTemporalId || !profile?.company_id) {
  throw new Error('No hay archivos temporales para asociar');
}
```

**Posibles causas:**
1. `ordenTemporalId` es `undefined` en el closure
2. `profile` aún no se ha cargado cuando se llama la función
3. `profile.company_id` es `undefined`

**Evidencia:** Si esta validación falla, la función lanza error y NO ejecuta el UPDATE.

#### Problema 2: Error Silencioso ⚠️

En CreateOrderPage.tsx línea 259-261:

```typescript
} catch (err: any) {
  showError(`Error al asociar adjuntos: ${err.message}`);
}
```

Si `asociarConOrden` lanza error, se muestra un toast pero el usuario puede no verlo o ignorarlo.

**Pregunta:** ¿El usuario vio algún mensaje de error al crear la orden?

#### Problema 3: Console.log No Aparece 🔍

Si la función se ejecutara correctamente, deberíamos ver en console:
```
[asociarConOrden] Actualizando BD para orden: <orden-id>
[asociarConOrden] <N> archivos asociados en BD
```

**Pregunta:** ¿Estos logs aparecieron en la consola del navegador?

---

## Hipótesis Principal

**La función `asociarConOrden` está fallando en la validación de la línea 341** por una de estas razones:

### Hipótesis A: `ordenTemporalId` es undefined en el closure

**Flujo:**
1. Usuario crea `useOrdenArchivos({ ordenTemporalId: 'uuid-abc' })`
2. Hook se inicializa correctamente
3. Usuario sube archivos → funciona (archivos tienen `orden_temporal_id`)
4. Usuario crea orden → llama `archivosTemp.asociarConOrden(ordenId)`
5. Dentro de `asociarConOrden`, el closure tiene `ordenTemporalId` pero...
6. Por alguna razón, `ordenTemporalId` es `undefined` en ese momento

**Causa posible:** El hook se desmontó y remontó entre subir archivos y crear orden.

### Hipótesis B: `profile` es undefined o no tiene `company_id`

**Flujo:**
1. Usuario crea orden muy rápido
2. `profile` aún se está cargando desde `useAuth()`
3. `profile?.company_id` es `undefined`
4. Validación falla, lanza error

**Causa posible:** Race condition entre crear orden y cargar profile.

### Hipótesis C: La función nunca se llama

**Flujo:**
1. Usuario crea orden
2. `createOrdenConItems` devuelve `null` en lugar de `result`
3. El `if (result)` en línea 236 es false
4. Nunca se llama `asociarConOrden`

**Causa posible:** Error al crear orden (pero el usuario ve la orden creada, así que esto es menos probable).

---

## Próximos Pasos de Investigación

### 1. Agregar Logging Detallado

Modificar `asociarConOrden` para capturar más información:

```typescript
const asociarConOrden = async (ordenIdReal: string) => {
  console.log('[asociarConOrden] INICIO - Parámetros:', {
    ordenIdReal,
    ordenTemporalId,
    profileExists: !!profile,
    companyId: profile?.company_id,
    profileFull: profile
  });

  if (!ordenTemporalId) {
    const error = new Error('ordenTemporalId es undefined o null');
    console.error('[asociarConOrden] ERROR:', error);
    throw error;
  }

  if (!profile?.company_id) {
    const error = new Error('profile.company_id es undefined');
    console.error('[asociarConOrden] ERROR:', error, { profile });
    throw error;
  }

  // ... resto
};
```

### 2. Verificar en CreateOrderPage

Agregar logs antes de llamar `asociarConOrden`:

```typescript
console.log('[CreateOrderPage] Antes de asociar adjuntos:', {
  ordenId: result.id,
  archivosTemp: archivosTemp,
  hasAsociarConOrden: typeof archivosTemp.asociarConOrden === 'function'
});

const [resultArchivos, resultLinks] = await Promise.all([
  archivosTemp.asociarConOrden(result.id),
  linksTemp.asociarConOrden(result.id)
]);
```

### 3. Verificar `profile` en useAuth

Asegurar que `profile` está disponible antes de crear orden.

---

## Solución Temporal (Para Testing)

Mientras investigamos, podemos asociar manualmente los archivos huérfanos:

```sql
-- Asociar archivos temporales huérfanos a una orden específica
UPDATE ordenes_trabajo_archivos
SET
  orden_id = '<orden-id>',
  orden_temporal_id = NULL,
  temporal_creado_en = NULL
WHERE orden_temporal_id = '<orden-temporal-id>'
  AND company_id = '<company-id>';
```

Esto NO soluciona el problema raíz, pero permite al usuario ver sus archivos mientras corregimos el código.

---

## Recomendación Inmediata

**Necesitamos agregar logging detallado** para identificar exactamente dónde falla. Las posibilidades son:

1. ❌ La función nunca se llama
2. ❌ `ordenTemporalId` es undefined
3. ❌ `profile.company_id` es undefined
4. ❌ Hay un error en el UPDATE que no estamos capturando

Una vez que tengamos los logs, sabremos exactamente qué corregir.

---

## Estado Actual

- ✅ BD estructura correcta
- ✅ Constraint XOR funciona
- ✅ UPDATE manual funciona
- ✅ Archivos se suben correctamente
- ❌ `asociarConOrden` no funciona (causa desconocida)
- 🔍 Necesitamos más logs para diagnosticar

**Siguiente acción:** Implementar logging detallado y reproducir el problema.
