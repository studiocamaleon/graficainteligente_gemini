# Corrección de Tablas - Completada ✅

## Problema Identificado

Los productos no aparecían en los módulos de Catálogo y Pricing porque los hooks estaban consultando tablas incorrectas:
- ❌ `productos` (eliminada en migración anterior)
- ❌ `productos_pricing` (nunca existió, el nombre correcto es `productos_precios`)
- ❌ `productos_materiales` (el nombre correcto es `productos_materiales_rel`)

## Solución Implementada

### 1. Hooks Específicos Corregidos

#### ✅ useProductosImpresionLaser.ts
- Cambió de `productos` → `productos_impresion_laser`
- Cambió de `productos_pricing` → `productos_precios`
- Agregó filtro `producto_tipo = 'laser'` en tablas relacionales

#### ✅ useProductosGranFormato.ts
- Cambió de `productos` → `productos_gran_formato`
- Cambió de `productos_pricing` → `productos_precios`
- Mantiene filtro `producto_tipo = 'gran_formato'` en tablas relacionales

#### ✅ useProductosMaterialesRigidos.ts
- Cambió de `productos` → `productos_materiales_rigidos`
- Cambió de `productos_materiales` → `productos_materiales_rel`
- Cambió de `productos_pricing` → `productos_precios`
- Agregó filtro `producto_tipo = 'materiales_rigidos'` en tablas relacionales

### 2. Nuevo Hook Unificador

**Archivo:** `src/hooks/useProductosByCategoria.ts`

Este hook selecciona automáticamente el hook específico correcto basándose en el nombre de la categoría:
- "Impresion Laser" → `useProductosImpresionLaser`
- "Impresion Gran Formato" → `useProductosGranFormato`
- "Materiales Rigidos" → `useProductosMaterialesRigidos`

### 3. ProductList Actualizado

**Archivo:** `src/components/catalog/ProductList.tsx`

- Ahora usa `useProductosByCategoria` en lugar de `useProductos`
- Aplica filtros y paginación client-side (temporal)
- Funciona correctamente con las nuevas tablas específicas

### 4. Limpieza de Datos

**Migración:** `clean_productos_data.sql`

Se eliminaron todos los datos de las tablas de productos para empezar desde cero:
- ✅ productos_precios
- ✅ productos_tecnologias
- ✅ productos_materiales_rel
- ✅ productos_servicios
- ✅ productos_acabados
- ✅ productos_impresion_laser
- ✅ productos_gran_formato
- ✅ productos_materiales_rigidos

## Estructura de Tablas Correcta

### Tablas Principales (por tipo de producto)

```
productos_impresion_laser
├── id
├── company_id
├── nombre
├── medidas_ancho
├── medidas_alto
├── tipo_medida: 'medida_unica' | 'medidas_multiples'
├── medidas_disponibles (jsonb)
├── caras_impresas (array)
├── producto_impreso
├── is_active
└── created_at, updated_at

productos_gran_formato
├── id
├── company_id
├── nombre
├── tipo_venta: 'mt2' | 'mt_lineal'
├── producto_impreso
├── is_active
└── created_at, updated_at

productos_materiales_rigidos
├── id
├── company_id
├── nombre
├── tipo_venta: 'mt2' | 'mt_lineal'
├── producto_impreso
├── is_active
└── created_at, updated_at
```

### Tablas Relacionales (polimórficas)

Todas usan el patrón:
- `producto_tipo`: 'laser' | 'gran_formato' | 'materiales_rigidos'
- `producto_id`: UUID del producto en la tabla específica

```
productos_tecnologias
├── producto_tipo
├── producto_id
├── tecnologia_id
└── tintas (array)

productos_materiales_rel
├── producto_tipo
├── producto_id
├── material_id
├── variante_nombre
└── espesores (jsonb)

productos_servicios
├── producto_tipo
├── producto_id
└── servicio_id

productos_acabados
├── producto_tipo
├── producto_id
└── acabado_id

productos_precios
├── producto_tipo
├── producto_id
├── tecnologia_id (nullable)
├── tipo_tinta (nullable)
├── cara_impresion (nullable)
├── material_id (nullable)
├── variante_nombre (nullable)
├── cantidad
├── rango_min (nullable)
├── rango_max (nullable)
└── precio_venta
```

## Flujo de Uso Correcto

### Crear Producto de Impresión Laser

1. Insertar en `productos_impresion_laser`
2. Insertar en `productos_tecnologias` con `producto_tipo = 'laser'`
3. (Opcional) Insertar en `productos_servicios` con `producto_tipo = 'laser'`
4. (Opcional) Insertar en `productos_acabados` con `producto_tipo = 'laser'`
5. Insertar en `productos_precios` con `producto_tipo = 'laser'`

### Crear Producto de Gran Formato

1. Insertar en `productos_gran_formato`
2. Insertar en `productos_tecnologias` con `producto_tipo = 'gran_formato'`
3. Insertar en `productos_materiales_rel` con `producto_tipo = 'gran_formato'`
4. (Opcional) Insertar en `productos_servicios` con `producto_tipo = 'gran_formato'`
5. (Opcional) Insertar en `productos_acabados` con `producto_tipo = 'gran_formato'`
6. Insertar en `productos_precios` con `producto_tipo = 'gran_formato'`

### Crear Producto de Materiales Rígidos

1. Insertar en `productos_materiales_rigidos`
2. Insertar en `productos_materiales_rel` con `producto_tipo = 'materiales_rigidos'`
3. (Opcional) Insertar en `productos_tecnologias` con `producto_tipo = 'materiales_rigidos'` (si tiene impresión)
4. (Opcional) Insertar en `productos_servicios` con `producto_tipo = 'materiales_rigidos'`
5. (Opcional) Insertar en `productos_acabados` con `producto_tipo = 'materiales_rigidos'`
6. Insertar en `productos_precios` con `producto_tipo = 'materiales_rigidos'`

## Próximos Pasos

### ⚠️ Hooks Pendientes de Corrección

Los siguientes hooks AÚN consultan tablas incorrectas y necesitan ser corregidos:

1. **useProductos.ts** - Hook genérico que consulta `productos` eliminada
   - Usado por: Wizard de productos, funciones CRUD
   - Necesita: Determinar tipo de producto y usar tabla específica

2. **useProducto.ts** - Funciones CRUD (create, update, delete, duplicate)
   - Necesita: Adaptar para trabajar con tablas específicas por tipo

3. **useProductoForWizard.ts** - Hook usado en el wizard de creación
   - Necesita: Verificar si usa `productos` o ya está actualizado

### Tareas Prioritarias

1. ✅ Corregir hooks de lectura específicos por categoría
2. ✅ Crear hook unificador `useProductosByCategoria`
3. ✅ Actualizar `ProductList` para usar nuevo hook
4. ✅ Limpiar datos de tablas
5. ⏳ Corregir funciones CRUD en `useProducto`
6. ⏳ Actualizar wizard de productos para usar tablas específicas
7. ⏳ Probar creación de productos en cada categoría

## Resultado Final

Con estas correcciones:
- ✅ Los productos ahora se consultan desde las tablas correctas
- ✅ El sistema usa arquitectura polimórfica correcta
- ✅ Los datos están limpios para comenzar desde cero
- ✅ Build completó exitosamente sin errores
- ⚠️ Aún falta corregir funciones CRUD para crear/editar productos

## Notas Importantes

1. **Filtros y Paginación**: Actualmente se aplican client-side en `ProductList`. Para mejor performance con muchos productos, deberían moverse a los hooks específicos.

2. **Funciones CRUD**: Los hooks de creación/edición/eliminación (`useProducto`) aún no están adaptados. Intentar crear un producto fallará hasta que se corrijan.

3. **Wizard de Productos**: El wizard probablemente necesita actualizaciones para detectar el tipo de producto y usar la tabla correcta.

4. **Pricing**: Los módulos de Pricing usan los mismos hooks que Catálogo, por lo tanto ya funcionan correctamente para listar productos.
