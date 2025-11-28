# Fix: Separación de Cantidad Mínima - Validación vs Cálculo de Precio

## 🎯 Objetivo

Permitir que los usuarios ingresen **medidas reales de producción** (cualquier tamaño > 0) mientras se aplica la **cantidad mínima** únicamente para el cálculo de precios. Esto resuelve el problema donde un cliente quiere un vinilo de 120x80cm (0.96 MT2) pero el sistema lo rechazaba por no cumplir con el mínimo de 1 MT2.

## 🔍 Problema Identificado

**Comportamiento ANTES:**
```
Usuario: Quiero agregar vinilo 120x80cm
Sistema: MT2 = 0.96
Sistema: ❌ ERROR - "Los MT2 deben ser al menos 1"
Resultado: No se puede crear la orden
```

**Impacto:**
- ❌ No se pueden ingresar medidas reales de producción
- ❌ Operaciones no tiene la información correcta
- ❌ Workflow bloqueado artificialmente

## ✅ Solución Implementada

**Comportamiento DESPUÉS:**
```
Usuario: Quiero agregar vinilo 120x80cm
Sistema: MT2 = 0.96
Sistema: ✅ Acepta las medidas
Sistema: 💡 Muestra mensaje informativo
Sistema: Calcula precio con max(0.96, 1.0) = 1.0 MT2
Resultado:
  - Orden creada con medidas 120x80cm (producción)
  - Precio calculado con 1 MT2 (facturación)
```

## 📋 Archivos Modificados

### 1. **Eliminada Validación en UI** ✅

**Archivo**: `src/components/wizard/steps/AddLineModal.tsx`

**Líneas modificadas**: 99-119

**Cambios:**
- ❌ **ELIMINADO**: Validación que rechazaba `mt2 < cantidad_minima`
- ❌ **ELIMINADO**: Validación que rechazaba `metrosLineales < cantidad_minima`
- ✅ **MANTENIDO**: Validaciones básicas (ancho > 0, alto > 0, etc.)
- ✅ **AGREGADO**: Comentarios explicativos del cambio

```typescript
// ANTES
if (config.cantidad_minima && mt2Calculado < config.cantidad_minima) {
  newErrors.mt2 = `Los MT2 deben ser al menos ${config.cantidad_minima}`;
}

// DESPUÉS
// NOTA: NO validamos cantidad_minima aquí - se aplica solo en cálculo de precio
// Esto permite ingresar medidas reales de producción (ej: 120x80cm = 0.96 MT2)
// mientras se cobra el mínimo (1 MT2) automáticamente en el pricing
```

---

### 2. **Aplicada Cantidad Mínima en Cálculo de Precio** ✅

**Archivo**: `src/hooks/wizard/useUniversalPricing.ts`

**Funciones modificadas:**

#### A. `getPrecioGranFormatoLine` (líneas ~723-776)

**Cambios:**
- Agregado parámetro `cantidadMinima?: number`
- Aplicado `Math.max(valorReal, cantidadMinima)` en ambos paths (rango y fallback)
- Para MT2 y Metros Lineales

```typescript
// Ejemplo MT2
const mt2Real = line.mt2_calculado || 0;
// Aplicar cantidad_minima SOLO para cálculo de precio
const mt2ParaPrecio = cantidadMinima ? Math.max(mt2Real, cantidadMinima) : mt2Real;
return precioPorUnidadRango * mt2ParaPrecio;
```

#### B. `getPrecioMaterialesRigidosLine` (líneas ~779-812)

**Cambios:**
- Agregado parámetro `cantidadMinima?: number`
- Aplicado `Math.max(mt2Real, cantidadMinima)` en ambos paths

```typescript
const mt2Real = line.mt2_calculado || 0;
const mt2ParaPrecio = cantidadMinima ? Math.max(mt2Real, cantidadMinima) : mt2Real;
return data.precio_mt2 * mt2ParaPrecio;
```

#### C. `getPrecioPlotterCorteLine` (líneas ~816-850)

**Cambios:**
- Agregado parámetro `cantidadMinima?: number`
- Aplicado `Math.max(metrosReales, cantidadMinima)` en ambos paths

```typescript
const metrosReales = line.metros_lineales || 0;
const metrosParaPrecio = cantidadMinima ? Math.max(metrosReales, cantidadMinima) : metrosReales;
return precioRango.precio * metrosParaPrecio;
```

---

### 3. **Actualizada Función Central** ✅

**Archivo**: `src/hooks/wizard/useUniversalPricing.ts`

**Función**: `calculateLinePrice` (línea ~600)

**Cambios:**
- Agregado parámetro `cantidadMinima?: number`
- Pasado a las 3 funciones auxiliares

```typescript
export async function calculateLinePrice(
  productId: string,
  categoria: ProductCategory,
  line: MeasurementLine,
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>,
  allServicios: SelectedService[],
  allAcabados: SelectedFinishing[],
  tipoVentaReal?: 'mt2' | 'mt_lineal' | 'unidad' | 'cantidades_fijas',
  precioPorUnidadRango?: number,
  cantidadMinima?: number  // ✅ NUEVO
): Promise<...>
```

---

### 4. **Actualizado Hook de Pricing** ✅

**Archivo**: `src/hooks/wizard/useMeasurementLinesPricing.ts`

**Cambios:**
- Agregado parámetro `cantidadMinima?: number` a la firma del hook
- Pasado a `calculateLinePrice`

```typescript
export function useMeasurementLinesPricing(
  productId: string | null,
  categoria: ProductCategory | null,
  lines: MeasurementLine[],
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>,
  allServicios: SelectedService[],
  allAcabados: SelectedFinishing[],
  tipoVentaReal?: 'mt2' | 'mt_lineal' | 'unidad' | 'cantidades_fijas',
  cantidadMinima?: number,  // ✅ NUEVO
  onLinesUpdate?: (updatedLines: MeasurementLine[]) => void
)
```

---

### 5. **Actualizado Componente de Tabla** ✅

**Archivo**: `src/components/wizard/steps/MeasurementLinesTable.tsx`

**Cambios:**
- Agregado `config.cantidad_minima` al llamar `useMeasurementLinesPricing`

```typescript
useMeasurementLinesPricing(
  config.id,
  config.categoria as ProductCategory,
  lines,
  baseConfig,
  selectedServicios,
  selectedAcabados,
  config.tipo_venta_real,
  config.cantidad_minima,  // ✅ NUEVO - Pasar cantidad_minima del producto
  onChange
);
```

---

### 6. **Agregados Indicadores Visuales** ✅

**Archivo**: `src/components/wizard/steps/AddLineModal.tsx`

**Cambios:**
- Agregado indicador informativo para MT2 (líneas ~320-335)
- Agregado indicador informativo para Metros Lineales (líneas ~376-388)

**Diseño del indicador:**
```tsx
{config.cantidad_minima && mt2Calculado < config.cantidad_minima && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-blue-700">
      <p className="font-medium">Mínimo de venta</p>
      <p>
        Se producirá en las medidas indicadas ({mt2Calculado.toFixed(2)} MT2),
        pero se facturará el mínimo de {config.cantidad_minima} MT2.
      </p>
    </div>
  </div>
)}
```

**Características del indicador:**
- 🎨 Estilo informativo (azul), no error (rojo)
- ℹ️ Icono de información
- 📝 Mensaje claro y educativo
- ✅ No bloquea la acción

---

## 📊 Flujo de Datos Actualizado

### Flujo COMPLETO (Paso a Paso):

```
1. Usuario ingresa medidas en AddLineModal
   └─> 120cm x 80cm

2. Sistema calcula MT2 (sin validar contra mínimo)
   └─> MT2 = 0.96

3. Sistema muestra indicador informativo (si aplica)
   └─> "Se producirá en 0.96 MT2, se facturará 1 MT2"

4. Usuario guarda la línea
   └─> Línea guardada con mt2_calculado = 0.96

5. useMeasurementLinesPricing ejecuta cálculo
   └─> Llama calculateLinePrice con cantidadMinima = 1

6. calculateLinePrice llama getPrecioGranFormatoLine
   └─> Pasa cantidadMinima = 1

7. getPrecioGranFormatoLine calcula precio
   └─> mt2ParaPrecio = Math.max(0.96, 1.0) = 1.0
   └─> precio = precioPorUnidad * 1.0

8. Precio se guarda en la línea
   └─> precio_base_unitario calculado con 1 MT2

9. Orden se crea
   └─> Medidas reales: 120x80cm (para producción)
   └─> Precio: basado en 1 MT2 (para facturación)
```

---

## 🎨 Experiencia de Usuario

### Caso 1: Medida Menor al Mínimo

**Ejemplo**: Vinilo 120x80cm (0.96 MT2), mínimo = 1 MT2

**UX:**
1. Usuario ingresa 120cm x 80cm
2. Sistema muestra: "0.96 MT2"
3. Sistema muestra indicador azul informativo:
   ```
   ℹ️ Mínimo de venta
   Se producirá en las medidas indicadas (0.96 MT2),
   pero se facturará el mínimo de 1 MT2.
   ```
4. Usuario hace clic en "Guardar" → ✅ Funciona sin error
5. Línea agregada a la orden

### Caso 2: Medida Mayor al Mínimo

**Ejemplo**: Vinilo 150x100cm (1.5 MT2), mínimo = 1 MT2

**UX:**
1. Usuario ingresa 150cm x 100cm
2. Sistema muestra: "1.5 MT2"
3. NO se muestra indicador (no es necesario)
4. Usuario guarda → ✅ Funciona normal
5. Precio calculado con 1.5 MT2 reales

### Caso 3: Metros Lineales Menor al Mínimo

**Ejemplo**: Plotter 0.75 ML, mínimo = 2 ML

**UX:**
1. Usuario ingresa 0.75 ML
2. Sistema muestra indicador azul:
   ```
   ℹ️ Mínimo de venta
   Se producirá en la medida indicada (0.75 ML),
   pero se facturará el mínimo de 2 ML.
   ```
3. Usuario guarda → ✅ Funciona
4. Precio calculado con 2 ML

---

## 🔍 Casos de Prueba

### Test 1: Vinilo Pequeño

```typescript
Entrada:
- Producto: Vinilo (cantidad_minima = 1 MT2)
- Medidas: 120cm x 80cm
- Cantidad: 1

Resultado Esperado:
✅ Se acepta la medida
✅ mt2_calculado = 0.96
✅ Indicador visible: "Se facturará 1 MT2"
✅ Precio calculado con 1 MT2
✅ Orden muestra 120x80cm
```

### Test 2: Vinilo Grande

```typescript
Entrada:
- Producto: Vinilo (cantidad_minima = 1 MT2)
- Medidas: 200cm x 100cm
- Cantidad: 1

Resultado Esperado:
✅ Se acepta la medida
✅ mt2_calculado = 2.0
✅ NO se muestra indicador
✅ Precio calculado con 2.0 MT2
✅ Orden muestra 200x100cm
```

### Test 3: Plotter Corto

```typescript
Entrada:
- Producto: Vinilo Plotter (cantidad_minima = 2 ML)
- Ancho: 120cm
- Metros Lineales: 0.75
- Cantidad: 1

Resultado Esperado:
✅ Se acepta la medida
✅ metros_lineales = 0.75
✅ Indicador visible: "Se facturará 2 ML"
✅ Precio calculado con 2 ML
✅ Orden muestra 0.75 ML
```

### Test 4: Material Rígido Pequeño

```typescript
Entrada:
- Producto: Forex 3mm (cantidad_minima = 1 MT2)
- Medidas: 50cm x 70cm
- Cantidad: 1

Resultado Esperado:
✅ Se acepta la medida
✅ mt2_calculado = 0.35
✅ Indicador visible: "Se facturará 1 MT2"
✅ Precio calculado con 1 MT2
✅ Orden muestra 50x70cm
```

---

## 📝 Comentarios en el Código

Se agregaron comentarios explicativos en puntos clave:

```typescript
// NOTA: NO validamos cantidad_minima aquí - se aplica solo en cálculo de precio
// Esto permite ingresar medidas reales de producción (ej: 120x80cm = 0.96 MT2)
// mientras se cobra el mínimo (1 MT2) automáticamente en el pricing
```

```typescript
// Aplicar cantidad_minima SOLO para cálculo de precio (no para medidas de producción)
const mt2ParaPrecio = cantidadMinima ? Math.max(mt2Real, cantidadMinima) : mt2Real;
```

---

## 🎯 Beneficios de la Solución

### Para Operaciones:
- ✅ Pueden ingresar **medidas exactas** de producción
- ✅ No hay restricciones artificiales
- ✅ La orden refleja lo que realmente se debe producir
- ✅ Menos confusión y errores

### Para Comercial:
- ✅ Se respeta la **cantidad mínima de venta**
- ✅ Pricing correcto y consistente
- ✅ No se pierde ingreso por vender menos del mínimo
- ✅ Políticas comerciales aplicadas automáticamente

### Para Usuarios:
- ✅ Workflow **no bloqueado**
- ✅ Indicadores **informativos** (no errores)
- ✅ Transparencia total del cálculo
- ✅ UX más fluida y clara

### Para el Sistema:
- ✅ **Separación clara** de responsabilidades
- ✅ Validación donde corresponde (datos básicos)
- ✅ Lógica de negocio donde corresponde (pricing)
- ✅ Código más mantenible

---

## 🔧 Detalles Técnicos

### Math.max()

Se usa `Math.max()` para aplicar el mínimo:

```typescript
const mt2ParaPrecio = cantidadMinima
  ? Math.max(mt2Real, cantidadMinima)
  : mt2Real;
```

**Ejemplos:**
- `Math.max(0.96, 1.0)` → `1.0` ✅ (aplica mínimo)
- `Math.max(1.5, 1.0)` → `1.5` ✅ (usa real)
- `Math.max(0.35, 1.0)` → `1.0` ✅ (aplica mínimo)

### Parámetros Opcionales

`cantidadMinima` es **opcional** en todas las funciones:

```typescript
cantidadMinima?: number
```

**Razones:**
- Compatibilidad con código existente
- No todos los productos tienen cantidad mínima
- Si es `undefined`, no se aplica (`Math.max` no se ejecuta)

### Orden de Parámetros

Se agregó `cantidadMinima` **antes** del último parámetro opcional:

```typescript
// CORRECTO ✅
function calculateLinePrice(
  ...params,
  precioPorUnidadRango?: number,
  cantidadMinima?: number  // ← Antes de callbacks
): Promise<...>

// INCORRECTO ❌
function calculateLinePrice(
  ...params,
  cantidadMinima?: number,
  precioPorUnidadRango?: number  // ← Orden confuso
): Promise<...>
```

---

## ✅ Verificación

**Build exitoso:**
```bash
npm run build
✓ built in 21.06s
```

**TypeScript:**
- ✅ Sin errores de tipos
- ✅ Parámetros opcionales correctos
- ✅ Inferencia de tipos funciona

**Lógica:**
- ✅ Validación removida de UI
- ✅ Cantidad mínima aplicada en pricing
- ✅ Indicadores visuales funcionando
- ✅ Backward compatibility mantenida

---

## 📚 Conceptos Clave

### Separación de Responsabilidades

```
┌─────────────────┐
│  VALIDACIÓN UI  │ → Solo valida datos básicos (ancho > 0, etc.)
└─────────────────┘

┌─────────────────┐
│  LÓGICA PRECIO  │ → Aplica reglas de negocio (cantidad_minima)
└─────────────────┘

┌─────────────────┐
│  PERSISTENCIA   │ → Guarda medidas reales para producción
└─────────────────┘
```

### Flujo de Información

```
Medidas Reales (120x80cm)
    ↓
Cálculo MT2 (0.96)
    ↓
Pricing con Mínimo (1.0)
    ↓
Orden con Ambos Valores
    ├─→ Producción: 120x80cm (0.96 MT2)
    └─→ Facturación: $X calculado con 1.0 MT2
```

---

## 🎉 Resultado Final

**ANTES del fix:**
```
❌ Usuario bloqueado
❌ No puede crear orden
❌ Frustración
```

**DESPUÉS del fix:**
```
✅ Usuario puede ingresar cualquier medida > 0
✅ Sistema muestra mensaje informativo claro
✅ Precio se calcula correctamente con mínimo
✅ Orden refleja medidas reales
✅ Workflow fluido y transparente
```

---

**Documentación generada**: 2025-11-28
**Versión del sistema**: Post-implementación de separación cantidad_minima
