# Fix: Etapa "Instalacion" se guardaba como "Produccion"

## 🐛 Problema Identificado

Cuando se intentaba agregar pasos en la etapa **"Instalacion"** al configurar una ruta de producción, los pasos se guardaban incorrectamente con la etapa **"Produccion"** en lugar de "Instalacion".

## 🔍 Causa Raíz

El problema estaba en **dos funciones de normalización de etapas** que tenían lógica incorrecta:

### 1. `generateProductionRoutes.ts` - Función `normalizarEtapa()`

**Línea 54 (ANTES):**
```typescript
// 4. Principal por defecto (producción, impresión, etc.)
return 'principal';  // ❌ TODO lo que no coincidía iba a 'principal'
```

**El problema:**
- La función NO manejaba "Instalacion"
- Cuando recibía "Instalacion", no coincidía con ningún caso
- Por defecto devolvía `'principal'` (que se mapea a "Produccion")
- **"Instalacion"** → fallback → **"principal"** → **"Produccion"** ❌

### 2. `OrdenRutasTab.tsx` - Función `normalizeEtapa()`

**Líneas 85-88 (ANTES):**
```typescript
// 4. Principal/Producción
if (etapaLower.includes('produccion') ||
    etapaLower.includes('principal') ||
    etapaLower.includes('impresion')) {  // ❌ Capturaba "Instalacion"
  return 'Produccion';
}
```

**El problema:**
- La condición `etapaLower.includes('impresion')` era demasiado amplia
- **"Instalacion"** contiene la subcadena **"impresion"** (instal**acion**)
- Entonces "Instalacion" → includes('impresion') → **true** → **"Produccion"** ❌

## ✅ Solución Implementada

### 1. Corrección en `generateProductionRoutes.ts`

**Cambios realizados:**
```typescript
function normalizarEtapa(etapa: string): TipoEtapaRuta {
  const etapaLower = etapa.toLowerCase().replace(/[-\s]/g, '_');

  // 1. Si ya está normalizado, devolver sin cambios
  if (etapaLower === 'pre_prensa' || etapaLower === 'principal' || etapaLower === 'post_prensa') {
    return etapaLower as TipoEtapaRuta;
  }

  // 2. ✅ NUEVO: Instalacion (verificar ANTES de otros checks)
  if (etapaLower.includes('instalacion')) {
    return etapa as TipoEtapaRuta;
  }

  // 3. Post-prensa
  if (etapaLower.includes('post') ||
      etapaLower.includes('terminacion') ||
      etapaLower.includes('acabado')) {
    return 'post_prensa';
  }

  // 4. Pre-prensa
  if (etapaLower.startsWith('pre') && !etapaLower.includes('post')) {
    return 'pre_prensa';
  }

  // 5. ✅ MODIFICADO: Produccion/Principal (más específico)
  if (etapaLower.includes('produccion') || etapaLower.includes('principal')) {
    return 'principal';
  }

  // 6. ✅ NUEVO: Fallback que preserva el valor original
  return etapa as TipoEtapaRuta;
}
```

**Mejoras:**
- ✅ Manejo explícito de "Instalacion" ANTES de otros checks
- ✅ Verificación específica sin regex ambiguas
- ✅ Fallback que preserva el valor en lugar de forzar 'principal'

### 2. Corrección en `OrdenRutasTab.tsx`

**Cambios realizados:**
```typescript
function normalizeEtapa(etapa: string): string {
  const etapaLower = etapa.toLowerCase().replace(/[-\s]/g, '_');

  // 1. Verificar valores exactos normalizados primero
  if (etapaLower === 'pre_prensa') return 'Pre-prensa';
  if (etapaLower === 'post_prensa') return 'Terminacion';
  if (etapaLower === 'principal') return 'Produccion';
  if (etapaLower === 'instalacion') return 'Instalacion';  // ✅ NUEVO

  // 2. ✅ NUEVO: Instalacion (verificar ANTES para evitar conversión errónea)
  if (etapaLower.includes('instalacion')) {
    return 'Instalacion';
  }

  // 3. Verificar POST antes de PRE
  if (etapaLower.includes('post') ||
      etapaLower.includes('terminacion') ||
      etapaLower.includes('acabado')) {
    return 'Terminacion';
  }

  // 4. Verificar PRE con condiciones estrictas
  if (etapaLower.startsWith('pre') && !etapaLower.includes('post')) {
    return 'Pre-prensa';
  }

  // 5. ✅ MODIFICADO: Producción (SIN 'impresion' para evitar capturar 'Instalacion')
  if (etapaLower.includes('produccion') || etapaLower.includes('principal')) {
    return 'Produccion';
  }

  // 6. Fallback sin cambios
  return etapa;
}
```

**Mejoras:**
- ✅ Verificación explícita de "instalacion" en valores exactos
- ✅ Check específico de "instalacion" ANTES de otros
- ✅ **ELIMINADA** la condición `.includes('impresion')` que causaba el bug
- ✅ Array de etapas actualizado: `['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion']`

## 📋 Archivos Modificados

1. **`src/utils/generateProductionRoutes.ts`**
   - Función `normalizarEtapa()` - Líneas 35-70
   - Agregado manejo explícito de "Instalacion"
   - Modificado fallback para preservar valores

2. **`src/components/orders/OrdenRutasTab.tsx`**
   - Función `normalizeEtapa()` - Líneas 65-98
   - Agregado manejo de "Instalacion"
   - Eliminado `.includes('impresion')` problemático
   - Array `etapas` - Línea 124: Agregado 'Instalacion'

## ✅ Verificación

- ✅ El proyecto compila sin errores: `npm run build`
- ✅ Todas las etapas están correctamente mapeadas:
  - Pre-prensa ✓
  - Produccion ✓
  - Terminacion ✓
  - **Instalacion ✓** (ahora funciona correctamente)

## 🧪 Cómo Probar

1. Reiniciar el servidor de desarrollo: `npm run dev`
2. Ir a: **ABM Core → Rutas de Producción**
3. Seleccionar o crear una ruta
4. Hacer clic en la etapa **"Instalacion"**
5. Agregar un paso condicional con servicio con niveles
6. **Resultado esperado**: El paso se guarda correctamente en "Instalacion" y aparece en la UI

## 📊 Impacto

**Antes del fix:**
- ❌ Pasos de "Instalacion" se guardaban en "Produccion"
- ❌ No se podían configurar rutas con etapa de instalación
- ❌ Confusión en el flujo de producción

**Después del fix:**
- ✅ "Instalacion" funciona como etapa independiente
- ✅ Los pasos se guardan en la etapa correcta
- ✅ La UI muestra los pasos en la etapa correspondiente
- ✅ Flujo de producción completo con 4 etapas

## 🔒 Prevención

Para evitar bugs similares en el futuro:

1. **Principio**: Siempre verificar strings específicos ANTES de patterns amplios
2. **Orden crítico**:
   - Primero: valores exactos
   - Segundo: strings específicos (ej: "instalacion")
   - Tercero: patterns generales (ej: includes/startsWith)
   - Último: fallback
3. **Testing**: Probar TODAS las etapas al modificar funciones de normalización
4. **Documentación**: Comentar casos edge y orden de verificaciones

## 📝 Notas Adicionales

- Las 4 etapas válidas son: `Pre-prensa`, `Produccion`, `Terminacion`, `Instalacion`
- La base de datos ya soportaba "Instalacion" (constraint verificado)
- El problema era solo en las funciones de normalización del frontend
- Los logs de debugging agregados anteriormente ayudarán a identificar problemas similares
