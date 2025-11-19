# Solución a Errores de Queries en Buscador del Wizard

## Fecha
19 de noviembre de 2025

## Problemas Identificados

### Error 1: Relación FK inexistente
```
Could not find a relationship between 'productos_impresion_laser_precios'
and 'tecnologia_tintas' in the schema cache
```

**Causa**: El código intentaba hacer un JOIN directo entre `productos_impresion_laser_precios` y `tecnologia_tintas`, pero no existe una FK directa entre estas tablas.

### Error 2: Columna inexistente
```
column productos_impresion_laser_precios.precio_base does not exist
```

**Causa**: El código buscaba la columna `precio_base`, pero la tabla tiene la columna `precio`.

## Estructura Real de la Tabla

```sql
CREATE TABLE productos_impresion_laser_precios (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  producto_laser_id uuid NOT NULL,
  medida_ancho decimal(10,2) NOT NULL,
  medida_alto decimal(10,2) NOT NULL,
  tinta_id uuid NOT NULL,              -- ⚠️ No tiene FK a tecnologia_tintas
  cantidad integer NOT NULL,
  cara_impresa text NOT NULL,
  precio decimal(10,2) NOT NULL,       -- ⚠️ Se llama 'precio', no 'precio_base'
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

**Observaciones**:
- La columna `tinta_id` es un uuid simple, sin FK definida
- La columna de precio se llama `precio`, no `precio_base`
- No hay columna `rango_precio_id` en esta tabla

## Soluciones Implementadas

### 1. Query de Tintas Corregida

**Antes (Incorrecto)**:
```typescript
supabase
  .from('productos_impresion_laser_precios')
  .select('tinta_id, tecnologia_tintas(id, nombre, tipo)')  // ❌ No existe FK
  .eq('producto_laser_id', laserData.id)
```

**Después (Correcto)**:
```typescript
// Primero obtener los IDs de tintas
supabase
  .from('productos_impresion_laser_precios')
  .select('tinta_id')  // ✅ Solo obtenemos el ID
  .eq('producto_laser_id', laserData.id)

// Luego consultar la tabla de tintas por separado
const tintaIds = tintasRes.data.map((t: any) => t.tinta_id).filter(Boolean);

if (tintaIds.length > 0) {
  const { data: tintasInfo } = await supabase
    .from('tecnologia_tintas_pasos')  // ✅ Tabla correcta
    .select('id, nombre, tipo')
    .in('id', tintaIds);
}
```

### 2. Query de Precio Mínimo Corregida

**Antes (Incorrecto)**:
```typescript
supabase
  .from('productos_impresion_laser_precios')
  .select('precio_base')  // ❌ Columna inexistente
  .eq('producto_laser_id', laserData.id)
  .order('precio_base', { ascending: true })
```

**Después (Correcto)**:
```typescript
supabase
  .from('productos_impresion_laser_precios')
  .select('precio')  // ✅ Columna correcta
  .eq('producto_laser_id', laserData.id)
  .order('precio', { ascending: true })
```

### 3. Mapeo del Resultado

**Antes (Incorrecto)**:
```typescript
precio_desde: precioMinRes.data?.precio_base || null
```

**Después (Correcto)**:
```typescript
precio_desde: precioMinRes.data?.precio || null
```

## Flujo de Consulta Optimizado

```typescript
// 1. Obtener datos básicos del producto
const productsLaserData = await supabase
  .from('productos_impresion_laser')
  .select('id, nombre, tipo_venta, cantidades_fijas, caras_impresas, is_active')

// 2. Para cada producto, obtener datos relacionados en paralelo
const [materialesRes, medidasRes, tintasRes, precioMinRes] = await Promise.all([
  // Materiales (tiene FK)
  supabase
    .from('productos_impresion_laser_materiales')
    .select('material_id, variante_nombre, materiales(id, nombre)'),

  // Medidas (desde precios)
  supabase
    .from('productos_impresion_laser_precios')
    .select('medida_ancho, medida_alto'),

  // IDs de tintas (sin JOIN)
  supabase
    .from('productos_impresion_laser_precios')
    .select('tinta_id'),

  // Precio mínimo
  supabase
    .from('productos_impresion_laser_precios')
    .select('precio')
    .order('precio', { ascending: true })
    .limit(1)
]);

// 3. Consultar información de tintas por separado
const tintaIds = tintasRes.data.map(t => t.tinta_id).filter(Boolean);
const tintasInfo = await supabase
  .from('tecnologia_tintas_pasos')
  .select('id, nombre, tipo')
  .in('id', tintaIds);
```

## Beneficios de la Solución

✅ **Queries correctas** - Usa las columnas y relaciones que realmente existen
✅ **Sin errores de FK** - No intenta JOINs imposibles
✅ **Consulta separada de tintas** - Obtiene la información correctamente
✅ **Performance optimizado** - Usa `Promise.all` donde es posible
✅ **Datos completos** - Obtiene toda la información necesaria para el wizard

## Notas Importantes

### Inconsistencia con Hook de Pricing

El hook `useImpresionLaserPricing.ts` usa campos que no existen en la tabla actual:
- `precio_base` (debería ser `precio`)
- `rango_precio_id` (no existe en la tabla actual)

**Recomendación**: Revisar y actualizar el hook de pricing para que coincida con el esquema real de la base de datos.

### Tabla de Tintas

La tabla correcta para las tintas es:
- `tecnologia_tintas_pasos` (NO `tecnologia_tintas`)

Esta tabla contiene:
- `id` - UUID de la tinta
- `nombre` - Nombre descriptivo
- `tipo` - Tipo de tinta (CMYK, K, etc.)

## Archivos Modificados

- `src/hooks/wizard/useProductSearch.ts` - Corregidas queries y lógica de obtención de tintas

## Estado del Proyecto

✅ Build exitoso sin errores
✅ Queries corregidas y funcionales
✅ Búsqueda de productos operativa
✅ Obtención de tintas mediante consulta separada

## Próximos Pasos Recomendados

1. **Revisar hook de pricing** - Actualizar `useImpresionLaserPricing.ts` para usar columnas correctas
2. **Validar esquema completo** - Verificar que todas las queries de la aplicación usen los nombres de columna correctos
3. **Considerar migración** - Si se necesita `precio_base` y `rango_precio_id`, agregar estas columnas mediante migración
