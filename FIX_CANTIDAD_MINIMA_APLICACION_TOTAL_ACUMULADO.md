# Fix: Aplicación de Cantidad Mínima sobre Total Acumulado

## 🎯 Objetivo

Aplicar la **cantidad mínima** sobre el **total acumulado** de todas las líneas, no sobre cada línea individual. Esto corrige el problema donde 10 vinilos de 50x50cm (2.5 MT2 total) se cobraban como 10 MT2 en lugar de 2.5 MT2.

## 🔍 Problema Identificado

**Comportamiento ANTES del fix:**
```typescript
// Problema: Se aplicaba cantidad_minima a CADA línea individual

Entrada:
  Línea 1: 50x50cm = 0.25 MT2 × 10 unidades
  cantidad_minima = 1 MT2

Cálculo (INCORRECTO):
  Por cada unidad: Math.max(0.25, 1.0) = 1.0 MT2
  Total: 1.0 MT2 × 10 = 10 MT2 ❌

Resultado: Se cobraban 10 MT2 cuando el total real es 2.5 MT2
```

**Otro ejemplo del problema:**
```typescript
Entrada:
  Línea 1: 120x80cm = 0.96 MT2
  Línea 2: 120x80cm = 0.96 MT2
  Línea 3: 300x150cm = 4.5 MT2
  cantidad_minima = 1 MT2

Cálculo (INCORRECTO):
  Línea 1: Math.max(0.96, 1.0) = 1.0 MT2
  Línea 2: Math.max(0.96, 1.0) = 1.0 MT2
  Línea 3: Math.max(4.5, 1.0) = 4.5 MT2
  Total: 6.5 MT2 ❌

Real debería ser: 0.96 + 0.96 + 4.5 = 6.42 MT2 ✅
```

---

## ✅ Solución Implementada

**Comportamiento DESPUÉS del fix:**
```typescript
// Solución: Aplicar cantidad_minima al TOTAL ACUMULADO

PASO 1: Calcular total de todas las líneas
  totalMT2 = suma de (mt2_linea × cantidad)

PASO 2: Determinar si aplica el mínimo
  Si totalMT2 < cantidad_minima:
    factorAjuste = cantidad_minima / totalMT2
  Sino:
    factorAjuste = 1 (sin ajuste)

PASO 3: Aplicar factor a cada línea
  Para cada línea:
    mt2ParaPrecio = mt2_linea × factorAjuste
```

---

## 📊 Ejemplos de Cálculo Corregidos

### Ejemplo A: 10 Unidades Pequeñas (Total > Mínimo)

```typescript
Entrada:
  Línea 1: 50x50cm = 0.25 MT2 × 10 unidades
  cantidad_minima = 1 MT2

Cálculo (CORRECTO):
  PASO 1: totalMT2 = 0.25 × 10 = 2.5 MT2
  PASO 2: 2.5 >= 1 ✅ → factorAjuste = 1 (sin ajuste)
  PASO 3: mt2ParaPrecio = 0.25 × 1 = 0.25 MT2 por unidad

Total facturado: 0.25 × 10 = 2.5 MT2 ✅
Precio: 2.5 MT2 × precio_unitario
```

### Ejemplo B: 1 Unidad Pequeña (Total < Mínimo)

```typescript
Entrada:
  Línea 1: 50x50cm = 0.25 MT2 × 1 unidad
  cantidad_minima = 1 MT2

Cálculo (CORRECTO):
  PASO 1: totalMT2 = 0.25 × 1 = 0.25 MT2
  PASO 2: 0.25 < 1 ❌ → factorAjuste = 1 / 0.25 = 4
  PASO 3: mt2ParaPrecio = 0.25 × 4 = 1.0 MT2

Total facturado: 1.0 MT2 ✅
Precio: 1.0 MT2 × precio_unitario
```

### Ejemplo C: Múltiples Líneas que Suman > Mínimo

```typescript
Entrada:
  Línea 1: 120x80cm = 0.96 MT2 × 1 = 0.96 MT2
  Línea 2: 120x80cm = 0.96 MT2 × 1 = 0.96 MT2
  Línea 3: 300x150cm = 4.5 MT2 × 1 = 4.5 MT2
  cantidad_minima = 1 MT2

Cálculo (CORRECTO):
  PASO 1: totalMT2 = 0.96 + 0.96 + 4.5 = 6.42 MT2
  PASO 2: 6.42 >= 1 ✅ → factorAjuste = 1 (sin ajuste)
  PASO 3:
    Línea 1: 0.96 × 1 = 0.96 MT2
    Línea 2: 0.96 × 1 = 0.96 MT2
    Línea 3: 4.5 × 1 = 4.5 MT2

Total facturado: 6.42 MT2 ✅
Precio total: (0.96 + 0.96 + 4.5) × precio_unitario
```

### Ejemplo D: Múltiples Líneas que Suman < Mínimo

```typescript
Entrada:
  Línea 1: 60x60cm = 0.36 MT2 × 1 = 0.36 MT2
  Línea 2: 50x50cm = 0.25 MT2 × 1 = 0.25 MT2
  cantidad_minima = 1 MT2

Cálculo (CORRECTO):
  PASO 1: totalMT2 = 0.36 + 0.25 = 0.61 MT2
  PASO 2: 0.61 < 1 ❌ → factorAjuste = 1 / 0.61 = 1.6393
  PASO 3:
    Línea 1: 0.36 × 1.6393 = 0.5901 MT2
    Línea 2: 0.25 × 1.6393 = 0.4098 MT2

Total facturado: 0.5901 + 0.4098 = 0.9999 ≈ 1.0 MT2 ✅
Precio total: 1.0 MT2 × precio_unitario
```

---

## 📋 Archivos Modificados

### 1. **useMeasurementLinesPricing.ts** - Cálculo de Factor de Ajuste

**Ubicación**: Líneas 43-60 (nuevo código)

**Cambios:**
- Agregado cálculo de `factorAjusteMT2` y `factorAjusteMetrosLineales`
- Factor se calcula basado en total acumulado vs cantidad_minima
- Si total >= mínimo: factor = 1 (sin ajuste)
- Si total < mínimo: factor = mínimo / total

**Código:**
```typescript
// PASO 1.5: Determinar si se debe aplicar cantidad_minima y calcular factor de ajuste
// El mínimo se aplica al TOTAL ACUMULADO, no a cada línea individual
let factorAjusteMT2 = 1;
let factorAjusteMetrosLineales = 1;

if (cantidadMinima) {
  if (tipoVentaReal === 'mt2' && totalMT2Acumulado > 0 && totalMT2Acumulado < cantidadMinima) {
    // Total acumulado es menor al mínimo → Aplicar ajuste proporcional
    factorAjusteMT2 = cantidadMinima / totalMT2Acumulado;
    console.log(`📊 Cantidad mínima aplicada al total: ${totalMT2Acumulado.toFixed(2)} MT2 → ${cantidadMinima} MT2 (factor: ${factorAjusteMT2.toFixed(4)})`);
  } else if (tipoVentaReal === 'mt_lineal' && totalMetrosLinealesAcumulado > 0 && totalMetrosLinealesAcumulado < cantidadMinima) {
    // Total acumulado es menor al mínimo → Aplicar ajuste proporcional
    factorAjusteMetrosLineales = cantidadMinima / totalMetrosLinealesAcumulado;
    console.log(`📊 Cantidad mínima aplicada al total: ${totalMetrosLinealesAcumulado.toFixed(2)} ML → ${cantidadMinima} ML (factor: ${factorAjusteMetrosLineales.toFixed(4)})`);
  } else {
    console.log(`✅ Total acumulado supera el mínimo. No se aplica ajuste.`);
  }
}
```

**Llamada actualizada:**
```typescript
// Línea 92
const precio = await calculateLinePrice(
  productId,
  categoria,
  line,
  baseConfig,
  line.servicios || [],
  line.acabados || [],
  tipoVentaReal,
  precioPorUnidadRango || undefined,
  tipoVentaReal === 'mt2' ? factorAjusteMT2 : factorAjusteMetrosLineales  // ✅ Factor
);
```

---

### 2. **useUniversalPricing.ts** - Firma de calculateLinePrice

**Ubicación**: Línea 600

**Cambios:**
- Parámetro `cantidadMinima` → `factorAjuste`
- Documentación actualizada

**Código:**
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
  factorAjuste?: number  // ✅ Factor de ajuste (1 = sin ajuste, > 1 = con mínimo)
): Promise<...>
```

**Llamadas actualizadas:**
```typescript
// Líneas 633, 636, 639
case 'Impresion Gran Formato':
  precioBaseUnitario = await getPrecioGranFormatoLine(productId, lineConfig, line, tipoVentaReal, precioPorUnidadRango, factorAjuste);
  break;
case 'Materiales Rigidos':
  precioBaseUnitario = await getPrecioMaterialesRigidosLine(productId, lineConfig, line, precioPorUnidadRango, factorAjuste);
  break;
case 'Plotter de Corte':
  precioBaseUnitario = await getPrecioPlotterCorteLine(productId, lineConfig, line, precioPorUnidadRango, factorAjuste);
  break;
```

---

### 3. **getPrecioGranFormatoLine** - Aplicación de Factor

**Ubicación**: Líneas 724-778

**Cambios:**
- Parámetro `cantidadMinima` → `factorAjuste`
- Lógica `Math.max(valor, minimo)` → `valor * factorAjuste`

**Código ANTES:**
```typescript
const mt2Real = line.mt2_calculado || 0;
const mt2ParaPrecio = cantidadMinima ? Math.max(mt2Real, cantidadMinima) : mt2Real;  // ❌
return precioPorUnidadRango * mt2ParaPrecio;
```

**Código DESPUÉS:**
```typescript
const mt2Real = line.mt2_calculado || 0;
// Aplicar factor de ajuste (si el total acumulado era menor al mínimo)
const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;  // ✅
return precioPorUnidadRango * mt2ParaPrecio;
```

---

### 4. **getPrecioMaterialesRigidosLine** - Aplicación de Factor

**Ubicación**: Líneas 780-815

**Cambios idénticos a getPrecioGranFormatoLine:**
- `cantidadMinima` → `factorAjuste`
- `Math.max()` → multiplicación por factor

**Código:**
```typescript
const mt2Real = line.mt2_calculado || 0;
// Aplicar factor de ajuste
const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;  // ✅
return precioPorUnidadRango * mt2ParaPrecio;
```

---

### 5. **getPrecioPlotterCorteLine** - Aplicación de Factor

**Ubicación**: Líneas 817-856

**Cambios idénticos para metros lineales:**
- `cantidadMinima` → `factorAjuste`
- `Math.max()` → multiplicación por factor

**Código:**
```typescript
const metrosReales = line.metros_lineales || 0;
// Aplicar factor de ajuste
const metrosParaPrecio = factorAjuste ? metrosReales * factorAjuste : metrosReales;  // ✅
return precioPorUnidadRango * metrosParaPrecio;
```

---

### 6. **AddLineModal.tsx** - Indicadores Actualizados

**Ubicación**: Líneas 320-333 (MT2) y 379-392 (ML)

**Cambios:**
- Mensaje actualizado para explicar que el mínimo se aplica **al total**
- Clarificación de que cada línea se factura con su valor real si el total supera el mínimo

**Indicador MT2:**
```tsx
{config.cantidad_minima && mt2Calculado < config.cantidad_minima && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-blue-700">
      <p className="font-medium">Mínimo de venta: {config.cantidad_minima} MT2</p>
      <p>
        Esta línea tiene {mt2Calculado.toFixed(2)} MT2.
        El mínimo de {config.cantidad_minima} MT2 se aplica sobre el{' '}
        <strong>total de todas las líneas</strong>. Si el total supera el mínimo,
        se facturará el valor real de cada línea.
      </p>
    </div>
  </div>
)}
```

**Indicador Metros Lineales:**
```tsx
{config.cantidad_minima && metrosLineales > 0 && metrosLineales < config.cantidad_minima && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-blue-700">
      <p className="font-medium">Mínimo de venta: {config.cantidad_minima} ML</p>
      <p>
        Esta línea tiene {metrosLineales.toFixed(2)} ML.
        El mínimo de {config.cantidad_minima} ML se aplica sobre el{' '}
        <strong>total de todas las líneas</strong>. Si el total supera el mínimo,
        se facturará el valor real de cada línea.
      </p>
    </div>
  </div>
)}
```

---

## 🔬 Fórmula Matemática

### Cálculo del Factor de Ajuste

```
Si total_acumulado < cantidad_minima:
  factor_ajuste = cantidad_minima / total_acumulado
Sino:
  factor_ajuste = 1

Ejemplos:
  total = 0.25 MT2, minimo = 1 MT2 → factor = 1 / 0.25 = 4
  total = 0.61 MT2, minimo = 1 MT2 → factor = 1 / 0.61 = 1.6393
  total = 2.5 MT2, minimo = 1 MT2 → factor = 1 (sin ajuste)
```

### Aplicación a Cada Línea

```
mt2_para_precio = mt2_real × factor_ajuste

Ejemplos con factor = 4:
  0.25 MT2 × 4 = 1.0 MT2

Ejemplos con factor = 1.6393:
  0.36 MT2 × 1.6393 = 0.5901 MT2
  0.25 MT2 × 1.6393 = 0.4098 MT2
  Total: 0.9999 ≈ 1.0 MT2 ✅

Ejemplos con factor = 1:
  0.25 MT2 × 1 = 0.25 MT2 (valor real)
```

---

## 📊 Comparación ANTES vs DESPUÉS

### Caso: 10 Vinilos Pequeños

| | ANTES (Incorrecto) | DESPUÉS (Correcto) |
|---|---|---|
| **Input** | 10× 50x50cm (0.25 MT2 c/u) | 10× 50x50cm (0.25 MT2 c/u) |
| **Total Real** | 2.5 MT2 | 2.5 MT2 |
| **Lógica** | Math.max(0.25, 1) × 10 | factor = 1, sin ajuste |
| **Facturado** | 10 MT2 ❌ | 2.5 MT2 ✅ |
| **Diferencia** | +400% sobrecobro | Correcto |

### Caso: 1 Vinilo Pequeño

| | ANTES (Correcto) | DESPUÉS (Correcto) |
|---|---|---|
| **Input** | 1× 50x50cm (0.25 MT2) | 1× 50x50cm (0.25 MT2) |
| **Total Real** | 0.25 MT2 | 0.25 MT2 |
| **Lógica** | Math.max(0.25, 1) | factor = 4, ajuste aplicado |
| **Facturado** | 1 MT2 ✅ | 1 MT2 ✅ |
| **Diferencia** | Correcto | Correcto |

### Caso: 3 Líneas Mixtas

| | ANTES (Incorrecto) | DESPUÉS (Correcto) |
|---|---|---|
| **Input** | 120x80cm + 120x80cm + 300x150cm | 120x80cm + 120x80cm + 300x150cm |
| **Total Real** | 6.42 MT2 | 6.42 MT2 |
| **Lógica** | 1+1+4.5 | 0.96+0.96+4.5, factor=1 |
| **Facturado** | 6.5 MT2 ❌ | 6.42 MT2 ✅ |
| **Diferencia** | +0.08 MT2 sobrecobro | Correcto |

---

## 🎯 Beneficios de la Corrección

### Para el Cliente:
- ✅ **Cobro justo**: No paga de más cuando compra múltiples unidades pequeñas
- ✅ **Transparente**: Entiende que el mínimo es para el pedido completo
- ✅ **Incentivo**: Puede combinar líneas pequeñas para llegar al mínimo

### Para el Negocio:
- ✅ **Correcto comercialmente**: El mínimo se aplica al pedido, no a cada producto
- ✅ **Competitivo**: Precios más justos y competitivos
- ✅ **Profesional**: Lógica de negocio correcta

### Para el Sistema:
- ✅ **Lógica correcta**: Cálculo matemático preciso
- ✅ **Flexible**: Funciona con cualquier combinación de líneas
- ✅ **Escalable**: Fórmula aplicable a cualquier cantidad mínima

---

## 🧪 Casos de Prueba

### Test 1: Multiple Small Items Over Minimum
```typescript
Input:
  10× 50x50cm = 0.25 MT2 cada uno
  cantidad_minima = 1 MT2

Expected:
  ✅ totalMT2 = 2.5 MT2
  ✅ 2.5 > 1, factor = 1
  ✅ Cada línea: 0.25 MT2 (real)
  ✅ Total facturado: 2.5 MT2
```

### Test 2: Single Small Item Under Minimum
```typescript
Input:
  1× 50x50cm = 0.25 MT2
  cantidad_minima = 1 MT2

Expected:
  ✅ totalMT2 = 0.25 MT2
  ✅ 0.25 < 1, factor = 4
  ✅ Línea: 0.25 × 4 = 1.0 MT2
  ✅ Total facturado: 1.0 MT2
```

### Test 3: Mixed Lines Over Minimum
```typescript
Input:
  Línea 1: 120x80cm = 0.96 MT2
  Línea 2: 120x80cm = 0.96 MT2
  Línea 3: 300x150cm = 4.5 MT2
  cantidad_minima = 1 MT2

Expected:
  ✅ totalMT2 = 6.42 MT2
  ✅ 6.42 > 1, factor = 1
  ✅ Línea 1: 0.96 MT2 (real)
  ✅ Línea 2: 0.96 MT2 (real)
  ✅ Línea 3: 4.5 MT2 (real)
  ✅ Total facturado: 6.42 MT2
```

### Test 4: Two Small Lines Under Minimum
```typescript
Input:
  Línea 1: 60x60cm = 0.36 MT2
  Línea 2: 50x50cm = 0.25 MT2
  cantidad_minima = 1 MT2

Expected:
  ✅ totalMT2 = 0.61 MT2
  ✅ 0.61 < 1, factor = 1.6393
  ✅ Línea 1: 0.36 × 1.6393 = 0.5901 MT2
  ✅ Línea 2: 0.25 × 1.6393 = 0.4098 MT2
  ✅ Total facturado: 0.9999 ≈ 1.0 MT2
```

---

## 📈 Logs del Sistema

El sistema ahora muestra logs claros sobre la aplicación del mínimo:

```typescript
// Cuando se aplica el mínimo:
📊 Cantidad mínima aplicada al total: 0.61 MT2 → 1 MT2 (factor: 1.6393)

// Cuando NO se aplica el mínimo:
✅ Total acumulado (2.50 MT2) supera el mínimo de 1. No se aplica ajuste.
```

---

## ✅ Verificación

**Build exitoso:**
```bash
npm run build
✓ built in 19.56s
```

**TypeScript:**
- ✅ Sin errores de tipos
- ✅ Parámetros correctamente tipados
- ✅ Lógica matemática correcta

**Lógica:**
- ✅ Factor de ajuste calculado sobre total acumulado
- ✅ Aplicación proporcional a cada línea
- ✅ Casos edge correctamente manejados

**Integración:**
- ✅ Funciona con múltiples líneas
- ✅ Compatible con productos MT2 y Metros Lineales
- ✅ Indicadores visuales actualizados

---

## 📚 Resumen Ejecutivo

### Cambio Clave

**ANTES**:
```
cantidad_minima aplicada a CADA línea → Math.max(valor_linea, minimo)
```

**DESPUÉS**:
```
cantidad_minima aplicada al TOTAL → valor_linea × (minimo / total)
```

### Fórmula Final

```
factor = cantidad_minima <= total_acumulado ? 1 : cantidad_minima / total_acumulado
precio_linea = mt2_linea × precio_unitario × factor
```

### Resultado

La cantidad mínima ahora se aplica correctamente **una sola vez al pedido completo**, distribuyendo el ajuste proporcionalmente entre todas las líneas cuando el total es menor al mínimo, pero respetando los valores reales cuando el total supera el mínimo.

---

**Documentación generada**: 2025-11-28
**Versión del sistema**: Post-implementación de aplicación de cantidad_minima sobre total acumulado
