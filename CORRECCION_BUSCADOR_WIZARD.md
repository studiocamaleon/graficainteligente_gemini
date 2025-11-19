# Corrección del Buscador del Wizard

## Problema Identificado

El buscador del wizard para agregar items a la orden estaba intentando buscar en una tabla `productos` que no existe en la estructura actual. La aplicación usa tablas especializadas por categoría de producto:

- `productos_impresion_laser`
- `productos_gran_formato`
- `productos_materiales_rigidos`
- etc.

## Error Original

```javascript
// INCORRECTO - Buscaba en tabla inexistente
const { data: productsData, error: productsError } = await supabase
  .from('productos')  // ❌ Esta tabla no existe
  .select(...)
```

## Solución Implementada

Se reescribió completamente el hook `useProductSearch.ts` para:

### 1. Buscar en la Tabla Correcta

Ahora busca directamente en `productos_impresion_laser`:

```javascript
const { data: productsLaserData, error: productsError } = await supabase
  .from('productos_impresion_laser')  // ✅ Tabla correcta
  .select('id, nombre, tipo_venta, cantidades_fijas, caras_impresas, is_active')
  .eq('company_id', profile.company_id)
  .eq('is_active', true)
  .ilike('nombre', `%${debouncedSearch}%`)
  .order('nombre');
```

### 2. Obtener Datos de Tablas Relacionadas

La estructura de productos laser usa tablas de relación separadas:

```javascript
// Obtener materiales del producto
supabase
  .from('productos_impresion_laser_materiales')
  .select('material_id, variante_nombre, materiales(id, nombre)')
  .eq('producto_laser_id', laserData.id)

// Obtener medidas de la tabla de precios
supabase
  .from('productos_impresion_laser_precios')
  .select('medida_ancho, medida_alto')
  .eq('producto_laser_id', laserData.id)

// Obtener tintas de la tabla de precios
supabase
  .from('productos_impresion_laser_precios')
  .select('tinta_id, tecnologia_tintas(id, nombre, tipo)')
  .eq('producto_laser_id', laserData.id)
```

### 3. Filtrar por Company ID

Ahora el buscador respeta el contexto de la empresa del usuario:

```javascript
const { profile } = useAuth();

// Solo buscar productos de la empresa del usuario
.eq('company_id', profile.company_id)
```

### 4. Mapeo de Tipo de Venta

Se corrigió el mapeo del tipo de venta para que coincida con lo esperado por el wizard:

```javascript
tipo_venta: laserData.tipo_venta === 'cantidades_fijas' ? 'cantidad_fija' : 'unidad'
```

### 5. Extracción de Material y Variante

Se obtienen correctamente los IDs y nombres de material y variante:

```javascript
const material = materialesRes.data?.materiales;
const materialNombre = Array.isArray(material) ? material[0]?.nombre : material?.nombre;
const materialId = Array.isArray(material) ? material[0]?.id : material?.id;

const varianteNombre = materialesRes.data?.variante_nombre || '';
const varianteId = materialesRes.data?.material_id || '';
```

## Estructura de Tablas

### productos_impresion_laser (Principal)
- `id` - ID del producto
- `company_id` - Empresa propietaria
- `nombre` - Nombre del producto
- `tipo_venta` - 'unidades' o 'cantidades_fijas'
- `cantidades_fijas` - Array de cantidades disponibles
- `caras_impresas` - Opciones de caras (solo_frente, frente_y_dorso)
- `is_active` - Estado activo/inactivo

### productos_impresion_laser_materiales (Relación)
- `producto_laser_id` - FK al producto
- `material_id` - FK a materiales
- `variante_nombre` - Nombre de la variante
- `espesor` - Espesor del material (opcional)

### productos_impresion_laser_precios (Precios)
- `producto_laser_id` - FK al producto
- `medida_ancho` - Ancho en cm
- `medida_alto` - Alto en cm
- `tinta_id` - FK a tecnologia_tintas
- `cara_impresa` - Configuración de cara
- `precio_base` - Precio base del producto

## Flujo de Búsqueda Corregido

1. Usuario escribe al menos 2 caracteres
2. Se espera 300ms (debounce)
3. Se busca en `productos_impresion_laser` de la empresa del usuario
4. Para cada producto encontrado:
   - Se obtienen materiales y variantes
   - Se obtienen medidas disponibles (desde precios)
   - Se obtienen tintas disponibles (desde precios)
   - Se obtiene el precio mínimo
5. Se construye el objeto `ProductSearchResult` con toda la información
6. Se retornan los resultados al componente

## Beneficios

✅ **Búsqueda funcional** - Ya no da error de tabla inexistente
✅ **Multi-tenant** - Respeta el contexto de la empresa
✅ **Datos completos** - Obtiene toda la información necesaria
✅ **Performance optimizado** - Usa `Promise.all` para queries paralelas
✅ **Manejo de errores** - Log de errores y continuación con productos válidos

## Archivos Modificados

- `src/hooks/wizard/useProductSearch.ts` - Reescrito completamente

## Estado del Proyecto

✅ Build exitoso sin errores
✅ Búsqueda funcional en tabla correcta
✅ Contexto multi-tenant implementado
✅ Obtención de datos relacionados correcta

## Próximos Pasos

El buscador ahora funciona correctamente para productos de Impresión Laser. En el futuro, cuando se implementen otras categorías (Gran Formato, Materiales Rígidos, etc.), se puede:

1. Crear hooks de búsqueda específicos para cada categoría
2. O extender este hook para buscar en múltiples tablas según filtros

Por ahora, con Impresión Laser implementado, el wizard está completamente funcional.
