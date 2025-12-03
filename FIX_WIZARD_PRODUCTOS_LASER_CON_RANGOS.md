# Fix: Wizard Universal - Soporte para Productos Laser con Rangos

## Problema Identificado

El wizard universal no detectaba precios para productos de **Impresión Laser** que usan rangos de precio (como "Planchas de Sticker Troquelado").

### Causa Raíz

La función `getPrecioImpresionLaser` en `src/hooks/wizard/useUniversalPricing.ts` solo buscaba precios por cantidad exacta:

```typescript
// ❌ Solo buscaba por cantidad exacta
.eq('cantidad', config.cantidad)
```

Sin embargo, productos con rangos usan `rango_precio_min` y `rango_precio_max` en lugar de `cantidad` fija.

## Solución Implementada

Se modificó la función `getPrecioImpresionLaser` para soportar ambos tipos de productos:

### Lógica Nueva

1. **Consulta el producto** para verificar si tiene `rango_precio_id` configurado
2. **Si usa rangos** (`rango_precio_id` no es null):
   - Busca precios con campos `rango_precio_min` y `rango_precio_max`
   - Encuentra en qué rango cae la cantidad solicitada
   - Retorna el precio correspondiente al rango
3. **Si NO usa rangos** (`rango_precio_id` es null):
   - Mantiene la búsqueda original por cantidad exacta
   - Retorna el precio de la cantidad específica

### Código Implementado

```typescript
async function getPrecioImpresionLaser(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  // Validaciones básicas
  if (!config.medida_ancho || !config.medida_alto || !config.tinta || !config.cara_impresa) {
    return null;
  }

  // Consultar si el producto usa rangos
  const { data: producto } = await supabase
    .from('productos_impresion_laser')
    .select('rango_precio_id')
    .eq('id', productId)
    .maybeSingle();

  const usaRangos = producto?.rango_precio_id !== null;

  if (usaRangos) {
    // Buscar precios con rangos
    const { data: precios } = await supabase
      .from('productos_impresion_laser_precios')
      .select('precio, rango_precio_min, rango_precio_max')
      .eq('producto_laser_id', productId)
      .eq('medida_ancho', config.medida_ancho)
      .eq('medida_alto', config.medida_alto)
      .eq('tinta', config.tinta)
      .eq('cara_impresa', config.cara_impresa);

    // Buscar en qué rango cae la cantidad
    const precioEnRango = precios?.find(p => {
      if (p.rango_precio_max === null) {
        return config.cantidad >= p.rango_precio_min;
      }
      return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
    });

    return precioEnRango?.precio || null;
  } else {
    // Buscar precio por cantidad exacta (original)
    const { data } = await supabase
      .from('productos_impresion_laser_precios')
      .select('precio')
      .eq('producto_laser_id', productId)
      .eq('medida_ancho', config.medida_ancho)
      .eq('medida_alto', config.medida_alto)
      .eq('tinta', config.tinta)
      .eq('cantidad', config.cantidad)
      .eq('cara_impresa', config.cara_impresa)
      .maybeSingle();

    return data?.precio || null;
  }
}
```

## Archivos Modificados

- **src/hooks/wizard/useUniversalPricing.ts** (líneas 168-237)
  - Función `getPrecioImpresionLaser` completamente reescrita

## Impacto

### ✅ Beneficios

1. **Productos con rangos ahora funcionan**: "Planchas de Sticker Troquelado" y similares ahora muestran precio
2. **Compatibilidad hacia atrás**: Productos con cantidades fijas siguen funcionando igual
3. **Consistencia**: Usa el mismo patrón que otras categorías (Gran Formato, Plotter Corte, Portabanners)
4. **Soporte en múltiples líneas**: La función `calculateLinePrice` también se beneficia automáticamente

### 🔍 Categorías Soportadas

Ahora todas las categorías soportan rangos correctamente:
- ✅ Impresión Laser (con y sin rangos)
- ✅ Impresión Gran Formato (con rangos)
- ✅ Materiales Rígidos (sin rangos, precio único)
- ✅ Plotter de Corte (con rangos)
- ✅ Portabanners (con rangos)
- ✅ Sellos (precio único)
- ✅ Talonarios (cantidades fijas)

## Testing

### Caso de Prueba

**Producto**: Planchas de Sticker Troquelado
- Formato: 10 x 20 cm
- Tinta: 4x0
- Cara impresa: Simple
- Cantidad: 500

**Resultado Esperado**:
- Encuentra el rango correcto (ej. 200-500)
- Retorna el precio configurado para ese rango

## Build

Build ejecutado exitosamente sin errores:
```bash
✓ built in 22.78s
```

## Notas Técnicas

- La detección de rangos se hace consultando `rango_precio_id` en el producto
- Si `rango_precio_id` es null, el producto usa cantidades fijas/exactas
- Si `rango_precio_id` tiene un valor, el producto usa rangos de precio
- Los rangos con `rango_precio_max = null` representan rangos abiertos (ej. "de 500 en adelante")

## Fecha

03 de Diciembre, 2025
