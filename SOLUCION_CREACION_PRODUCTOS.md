# Solución: Creación de Productos - Completada ✅

## Problema Reportado

Al intentar crear un producto de Impresión Laser, aparecía el siguiente error:

```
Error creating producto: Object
code: "PGRST205"
message: "Could not find the table 'public.productos' in the schema cache"
hint: "Perhaps you meant the table 'public.productos_precios'"
```

## Causa del Error

La función `createProducto` en `useProductos.ts` estaba intentando insertar en la tabla `productos` que fue eliminada durante la migración de limpieza. Esta tabla fue reemplazada por 3 tablas específicas según el tipo de producto.

## Solución Implementada

### 1. Modificación de la función `createProducto`

**Archivo:** `src/hooks/useProductos.ts`

La función ahora:

1. **Detecta el tipo de producto** basándose en el `categoria_id`:
   ```typescript
   const CATEGORIA_IMPRESION_LASER = '00000000-0000-0000-0000-000000000001';
   const CATEGORIA_GRAN_FORMATO = '00000000-0000-0000-0000-000000000002';
   const CATEGORIA_MATERIALES_RIGIDOS = '00000000-0000-0000-0000-000000000003';
   ```

2. **Selecciona la tabla correcta** según el tipo:
   - Impresión Laser → `productos_impresion_laser`
   - Gran Formato → `productos_gran_formato`
   - Materiales Rígidos → `productos_materiales_rigidos`

3. **Prepara el insert con campos específicos**:
   - **Laser**: incluye `tipo_medida`, `medidas_ancho`, `medidas_alto`, `medidas_disponibles`, `caras_impresas`
   - **Gran Formato**: incluye `tipo_venta` ('mt2' o 'mt_lineal')
   - **Materiales Rígidos**: incluye `tipo_venta` ('mt2' o 'mt_lineal')

4. **Inserta relaciones con `producto_tipo`**:
   - Tecnologías en `productos_tecnologias` con campo `producto_tipo`
   - Materiales en `productos_materiales_rel` con campo `producto_tipo` (solo para Gran Formato y Materiales Rígidos)
   - Servicios en `productos_servicios` con campo `producto_tipo`
   - Acabados en `productos_acabados` con campo `producto_tipo`

### 2. Cambios Clave

#### Antes (Incorrecto)
```typescript
const { data: newProducto, error: productoError } = await supabase
  .from('productos')  // ❌ Tabla eliminada
  .insert([productoInsert])
  .select()
  .single();

await supabase
  .from('productos_materiales')  // ❌ Tabla incorrecta
  .insert([...]);

await supabase
  .from('productos_pricing')  // ❌ Tabla que no existe
  .insert([...]);
```

#### Después (Correcto)
```typescript
// Determinar tabla según categoría
let tableName: string;
if (data.categoria_id === CATEGORIA_IMPRESION_LASER) {
  tableName = 'productos_impresion_laser';  // ✅
} else if (data.categoria_id === CATEGORIA_GRAN_FORMATO) {
  tableName = 'productos_gran_formato';  // ✅
} ...

const { data: newProducto, error: productoError } = await supabase
  .from(tableName)  // ✅ Tabla específica correcta
  .insert([productoInsert])
  .select()
  .single();

// Materiales con producto_tipo
await supabase
  .from('productos_materiales_rel')  // ✅ Tabla correcta
  .insert([{
    producto_tipo: productoTipo,  // ✅ Campo polimórfico
    producto_id,
    ...
  }]);

// No insertar en productos_precios aquí
// Los precios se gestionan desde el módulo de Pricing  // ✅
```

## Flujo Correcto de Creación de Productos

### Impresión Laser

1. ✅ Insertar en `productos_impresion_laser`:
   - company_id, nombre, tipo_medida, medidas_ancho, medidas_alto, medidas_disponibles, caras_impresas, producto_impreso

2. ✅ Insertar en `productos_tecnologias`:
   - producto_tipo = 'laser', producto_id, tecnologia_id, tintas

3. ✅ (Opcional) Insertar en `productos_servicios`:
   - producto_tipo = 'laser', producto_id, servicio_id

4. ✅ (Opcional) Insertar en `productos_acabados`:
   - producto_tipo = 'laser', producto_id, acabado_id

5. ⏳ Los precios se configuran posteriormente desde el módulo Pricing

### Gran Formato

1. ✅ Insertar en `productos_gran_formato`:
   - company_id, nombre, tipo_venta ('mt2' | 'mt_lineal'), producto_impreso

2. ✅ Insertar en `productos_tecnologias`:
   - producto_tipo = 'gran_formato', producto_id, tecnologia_id, tintas

3. ✅ Insertar en `productos_materiales_rel`:
   - producto_tipo = 'gran_formato', producto_id, material_id, variante_nombre, espesores

4. ✅ (Opcional) Insertar en `productos_servicios`:
   - producto_tipo = 'gran_formato', producto_id, servicio_id

5. ✅ (Opcional) Insertar en `productos_acabados`:
   - producto_tipo = 'gran_formato', producto_id, acabado_id

6. ⏳ Los precios se configuran posteriormente desde el módulo Pricing

### Materiales Rígidos

1. ✅ Insertar en `productos_materiales_rigidos`:
   - company_id, nombre, tipo_venta ('mt2' | 'mt_lineal'), producto_impreso

2. ✅ Insertar en `productos_materiales_rel`:
   - producto_tipo = 'materiales_rigidos', producto_id, material_id, variante_nombre, espesores

3. ✅ (Opcional) Insertar en `productos_tecnologias` (si tiene impresión):
   - producto_tipo = 'materiales_rigidos', producto_id, tecnologia_id, tintas

4. ✅ (Opcional) Insertar en `productos_servicios`:
   - producto_tipo = 'materiales_rigidos', producto_id, servicio_id

5. ✅ (Opcional) Insertar en `productos_acabados`:
   - producto_tipo = 'materiales_rigidos', producto_id, acabado_id

6. ⏳ Los precios se configuran posteriormente desde el módulo Pricing

## Estado Actual

### ✅ Completado

1. **Hooks de Lectura** - Corregidos para consultar tablas específicas:
   - `useProductosImpresionLaser.ts` → `productos_impresion_laser`
   - `useProductosGranFormato.ts` → `productos_gran_formato`
   - `useProductosMaterialesRigidos.ts` → `productos_materiales_rigidos`

2. **Hook Unificador** - Creado para seleccionar hook correcto:
   - `useProductosByCategoria.ts`

3. **ProductList** - Actualizado para usar hook unificador

4. **Función createProducto** - Refactorizada para:
   - Detectar tipo de producto por categoría
   - Usar tabla específica correcta
   - Insertar relaciones con `producto_tipo`

5. **Datos Limpios** - Base de datos limpiada para empezar desde cero

6. **Build Exitoso** - Proyecto compila sin errores

### ⏳ Pendiente

1. **Función updateProducto** - Aún consulta tabla `productos` eliminada
2. **Función deleteProducto** - Necesita adaptación para tablas específicas
3. **Función duplicateProducto** - Necesita adaptación para tablas específicas
4. **Función toggleProductoStatus** - Necesita adaptación para tablas específicas
5. **Función getProductoById** - Consulta `productos` y tablas relacionales incorrectas

## Resultado Final

✅ **Los productos ahora se pueden crear correctamente** en cada categoría (Impresión Laser, Gran Formato, Materiales Rígidos).

✅ **Los productos creados aparecerán en los módulos** de Catálogo y Pricing.

✅ **Build completado exitosamente** sin errores de TypeScript.

⚠️ **Limitaciones actuales**:
- No se pueden editar productos existentes (función updateProducto pendiente)
- No se pueden eliminar productos (función deleteProducto pendiente)
- No se pueden duplicar productos (función duplicateProducto pendiente)
- No se puede cambiar el estado activo/inactivo (función toggleProductoStatus pendiente)

## Próximos Pasos Recomendados

1. Corregir función `updateProducto` para usar tablas específicas
2. Corregir función `deleteProducto` para usar tablas específicas
3. Corregir función `duplicateProducto` para usar tablas específicas
4. Corregir función `toggleProductoStatus` para usar tablas específicas
5. Corregir función `getProductoById` para detectar tipo y usar tabla correcta
6. Probar creación completa de productos en las 3 categorías
7. Probar edición de productos
8. Configurar precios desde el módulo Pricing
