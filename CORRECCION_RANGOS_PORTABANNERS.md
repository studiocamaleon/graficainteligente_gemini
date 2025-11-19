# Corrección: Rangos de Precio para Portabanners

## Problema Identificado

Los productos Portabanners estaban configurados para usar rangos de precio tipo "Metro Lineal" (`mt_lineal`) cuando deberían usar rangos tipo "Unidades" (`unidades`).

### Error Original
```typescript
// En ProductoPortabannerForm.tsx (línea 192)
<RangoPrecioSelector
  tipoVenta="unidad"  // ❌ INCORRECTO: "unidad" (singular y no existe en el tipo)
  rangoSeleccionado={rangoPrecioId}
  onChange={setRangoPrecioId}
/>
```

## Solución Aplicada

### 1. Corrección del Tipo en el Formulario
**Archivo:** `src/components/productos/portabanners/ProductoPortabannerForm.tsx`

```typescript
// Línea 192 - CORREGIDO
<RangoPrecioSelector
  tipoVenta="unidades"  // ✅ CORRECTO: "unidades" (plural)
  rangoSeleccionado={rangoPrecioId}
  onChange={setRangoPrecioId}
/>
```

### 2. Actualización del Tipo TypeScript
**Archivo:** `src/types/database.ts`

```typescript
// ANTES (línea 642)
export type TipoVenta = 'mt2' | 'mt_lineal';

// DESPUÉS
export type TipoVenta = 'mt2' | 'mt_lineal' | 'unidades';  // ✅ Agregado 'unidades'
```

### 3. Mejora del Componente RangoPrecioSelector
**Archivo:** `src/components/productos/gran-formato/RangoPrecioSelector.tsx`

Se agregó una función helper para mostrar correctamente las etiquetas:

```typescript
const getTipoVentaLabel = () => {
  if (tipoVenta === 'mt2') return 'M²';
  if (tipoVenta === 'mt_lineal') return 'Metro Lineal';
  if (tipoVenta === 'unidades') return 'Unidades';  // ✅ Agregado
  return tipoVenta;
};
```

Ahora los mensajes mostrarán correctamente:
- **Antes:** "debe coincidir con el tipo de venta: Metro Lineal" ❌
- **Después:** "debe coincidir con el tipo de venta: Unidades" ✅

## Validación en Base de Datos

La tabla `rangos_precio` ya soporta el valor `'unidades'` en el campo `unidad_medida`:

```sql
-- Constraint en rangos_precio
CHECK (unidad_medida IN ('mt2', 'mt_lineal', 'unidades'));
```

Por lo tanto, los rangos de precio con `unidad_medida = 'unidades'` son válidos y se mostrarán correctamente en el selector de portabanners.

## Comportamiento Esperado

### Antes de la Corrección
1. ❌ El formulario buscaba rangos con `unidad_medida = 'unidad'` (no existe)
2. ❌ No encontraba ningún rango disponible
3. ❌ Mostraba mensaje: "debe coincidir con el tipo de venta: Metro Lineal"

### Después de la Corrección
1. ✅ El formulario busca rangos con `unidad_medida = 'unidades'`
2. ✅ Encuentra y muestra los rangos de tipo "Unidades"
3. ✅ Muestra mensaje correcto: "debe coincidir con el tipo de venta: Unidades"
4. ✅ Si no hay rangos, sugiere crear uno en ABM Core

## Archivos Modificados

1. ✅ `src/components/productos/portabanners/ProductoPortabannerForm.tsx`
   - Cambio: `tipoVenta="unidad"` → `tipoVenta="unidades"`

2. ✅ `src/types/database.ts`
   - Cambio: Agregado `'unidades'` al tipo `TipoVenta`

3. ✅ `src/components/productos/gran-formato/RangoPrecioSelector.tsx`
   - Cambio: Agregada función `getTipoVentaLabel()` para manejar el nuevo tipo

## Verificación

✅ Build compilado exitosamente sin errores
✅ Tipo TypeScript actualizado correctamente
✅ Componente acepta el nuevo valor "unidades"
✅ Mensajes de interfaz muestran texto correcto

## Nota Importante

Para que los portabanners puedan asignar rangos de precio, debes:

1. Ir al módulo **ABM Core > Rangos de Precio**
2. Crear un rango con `unidad_medida = 'unidades'`
3. Definir los niveles de cantidad (ej: 1-10, 11-50, 51-100, 101+)
4. Ese rango estará disponible para seleccionar en productos Portabanners

---

**Estado:** ✅ CORREGIDO Y VERIFICADO
**Build:** ✅ Compilación exitosa
**Fecha:** 2025-11-19
