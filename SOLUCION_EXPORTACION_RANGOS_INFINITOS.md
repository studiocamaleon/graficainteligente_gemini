# Solución: Corrección de Exportación de Rangos Infinitos en Gran Formato

## Problema Identificado

Los rangos infinitos (como "10 o más m²") se estaban exportando incorrectamente en las listas de precios PDF de Gran Formato, mostrando "10-9999999 m²" en lugar de "≥ 10 m²".

### Causa Raíz

1. En la base de datos, los rangos infinitos se almacenan con `rango_precio_max = 9999999`
2. El código en los templates de exportación comparaba directamente con `Infinity`: `rango.max === Infinity`
3. Como el valor de la BD es numérico (`9999999`), la comparación fallaba
4. Resultado: se mostraba el valor literal "9999999" en lugar del formato correcto "≥ 10"

## Solución Implementada

### 1. Template PDF React (`GranFormatoPDFTemplate.tsx`)

**Cambios:**
- Importar funciones utilitarias: `isInfiniteRango` y `normalizeRangoMax`
- Reemplazar comparación directa `rango.max === Infinity` por `isInfiniteRango(normalizedMax)`
- Normalizar valores al generar keys de columnas
- Normalizar valores al buscar precios en el array de datos

**Resultado:** El template React ahora detecta correctamente rangos infinitos y los formatea como "≥ 10 m²"

### 2. Generador PDF jsPDF (`granFormatoPDF.ts`)

**Cambios:**
- Importar funciones utilitarias: `isInfiniteRango` y `normalizeRangoMax`
- Reemplazar comparación directa `rango.max === Infinity` por `isInfiniteRango(normalizedMax)`
- Normalizar valores al formatear encabezados de rangos

**Resultado:** Las exportaciones PDF directas (sin usar React) también muestran correctamente los rangos infinitos

### 3. Hook de Datos (`useAllProductosGranFormatoPrecios.ts`)

**Cambios:**
- Normalizar valores de rangos al cargarlos desde `rangos_precio` (líneas 210-214)
- Normalizar valores de precios al cargarlos desde `productos_gran_formato_precios` (líneas 267-270)

**Resultado:** Todos los datos se normalizan al momento de carga, garantizando consistencia en toda la aplicación

## Funciones Utilitarias Utilizadas

Las siguientes funciones de `rangoUtils.ts` se usan para garantizar consistencia:

```typescript
// Detecta si un valor es infinito (>= 999999)
isInfiniteRango(max: number): boolean

// Normaliza valores a INFINITE_RANGE_VALUE (9999999.99)
normalizeRangoMax(max: number | null | undefined): number

// Normaliza valores mínimos a 0 si son null/undefined
normalizeRangoMin(min: number | null | undefined): number

// Formatea rangos para mostrar (usa "X+ unidad" para infinitos)
formatRangoValue(min: number, max: number, unidadLabel: string): string
```

## Archivos Modificados

1. `/src/components/pdf/templates/GranFormatoPDFTemplate.tsx`
2. `/src/utils/pdfGenerators/granFormatoPDF.ts`
3. `/src/hooks/useAllProductosGranFormatoPrecios.ts`

## Verificación

✅ Build exitoso sin errores
✅ Normalización de datos al cargar desde BD
✅ Detección correcta de rangos infinitos en exportaciones
✅ Formato consistente: "≥ 10 m²" para rangos infinitos
✅ Matching correcto de precios usando valores normalizados

## Impacto en Otros Módulos

- **Impresión Laser:** No afectado (no usa comparaciones directas con Infinity)
- **Materiales Rígidos:** No afectado (no usa comparaciones directas con Infinity)

## Notas Técnicas

- El valor `INFINITE_RANGE_VALUE = 9999999.99` está definido en `rangoUtils.ts`
- La función `isInfiniteRango()` considera infinito cualquier valor >= 999999
- La normalización garantiza que valores como 9999999, 9999999.99, null, o Infinity se traten consistentemente
- Los keys de búsqueda de precios ahora usan valores normalizados para garantizar match correcto

## Fecha de Implementación

2025-11-18
