# Análisis de Tablas y Módulos

## Problema Identificado

Los productos no aparecen en los módulos de Catálogo y Pricing porque los hooks están consultando tablas incorrectas.

## Tablas que EXISTEN en la Base de Datos

```
productos_acabados
productos_gran_formato
productos_impresion_laser
productos_materiales_rel
productos_materiales_rigidos
productos_precios
productos_rutas_plantillas
productos_servicios
productos_tecnologias
```

## Tablas que los HOOKS Consultan (INCORRECTAS)

### Módulo: Catálogo - Impresión Laser
**Hook:** `useProductosImpresionLaser.ts`
- ❌ `productos` (línea 34) - ELIMINADA
- ❌ `productos_tecnologias` (línea 53) - EXISTE pero necesita filtro por producto_tipo
- ❌ `productos_pricing` (línea 63) - NO EXISTE (debe ser `productos_precios`)

### Módulo: Catálogo - Gran Formato
**Hook:** `useProductosGranFormato.ts`
- ❌ `productos` (línea 34) - ELIMINADA
- ❌ `productos_tecnologias` (línea 52) con filtro producto_tipo='gran_formato' - OK si existe
- ❌ `productos_materiales_rel` (línea 65) con filtro producto_tipo='gran_formato' - EXISTE
- ❌ `productos_pricing` (línea 78) - NO EXISTE (debe ser `productos_precios`)

### Módulo: Catálogo - Materiales Rígidos
**Hook:** `useProductosMaterialesRigidos.ts`
- ❌ `productos` (línea 76) - ELIMINADA
- ❌ `productos_materiales` (línea 102) - NO EXISTE (debe ser `productos_materiales_rel`)
- ❌ `productos_tecnologias` (línea 111) - EXISTE pero necesita filtro por producto_tipo
- ❌ `productos_pricing` (línea 119) - NO EXISTE (debe ser `productos_precios`)

### Módulo: Pricing
Los módulos de Pricing usan los mismos hooks que Catálogo, por lo tanto tienen los mismos problemas.

## Mapeo de Tablas INCORRECTAS → CORRECTAS

| Tabla Buscada (Incorrecta) | Tabla Correcta |
|----------------------------|----------------|
| `productos` | `productos_impresion_laser` / `productos_gran_formato` / `productos_materiales_rigidos` |
| `productos_pricing` | `productos_precios` |
| `productos_materiales` | `productos_materiales_rel` |
| `productos_tecnologias` | `productos_tecnologias` (OK, pero necesita filtro `producto_tipo`) |

## Estructura Correcta por Módulo

### Impresión Laser
**Tabla principal:** `productos_impresion_laser`
**Tablas relacionales:**
- `productos_tecnologias` (filtrado por `producto_tipo = 'laser'`)
- `productos_precios` (filtrado por `producto_tipo = 'laser'`)
- `productos_servicios` (opcional)
- `productos_acabados` (opcional)

### Gran Formato
**Tabla principal:** `productos_gran_formato`
**Tablas relacionales:**
- `productos_tecnologias` (filtrado por `producto_tipo = 'gran_formato'`)
- `productos_materiales_rel` (filtrado por `producto_tipo = 'gran_formato'`)
- `productos_precios` (filtrado por `producto_tipo = 'gran_formato'`)
- `productos_servicios` (opcional)
- `productos_acabados` (opcional)

### Materiales Rígidos
**Tabla principal:** `productos_materiales_rigidos`
**Tablas relacionales:**
- `productos_tecnologias` (filtrado por `producto_tipo = 'materiales_rigidos'`)
- `productos_materiales_rel` (filtrado por `producto_tipo = 'materiales_rigidos'`)
- `productos_precios` (filtrado por `producto_tipo = 'materiales_rigidos'`)
- `productos_servicios` (opcional)
- `productos_acabados` (opcional)

## Plan de Corrección

### 1. Actualizar Hook: useProductosImpresionLaser.ts
- Cambiar consulta de `productos` a `productos_impresion_laser`
- Cambiar `productos_pricing` a `productos_precios`
- Agregar filtro `producto_tipo = 'laser'` en consultas relacionales

### 2. Actualizar Hook: useProductosGranFormato.ts
- Cambiar consulta de `productos` a `productos_gran_formato`
- Cambiar `productos_pricing` a `productos_precios`
- Mantener filtros `producto_tipo = 'gran_formato'` en consultas relacionales

### 3. Actualizar Hook: useProductosMaterialesRigidos.ts
- Cambiar consulta de `productos` a `productos_materiales_rigidos`
- Cambiar `productos_materiales` a `productos_materiales_rel`
- Cambiar `productos_pricing` a `productos_precios`
- Agregar filtro `producto_tipo = 'materiales_rigidos'` en consultas relacionales

### 4. Verificar Hook: useProductoPrecios.ts
- Ya usa `productos_precios` ✅
- Ya tiene campo `producto_tipo` ✅

### 5. Limpiar Datos de la Base de Datos
- Eliminar todos los registros de las tablas de productos para empezar desde cero
- Esto asegura que no haya datos inconsistentes o en tablas incorrectas

## Notas Importantes

1. **Todas las tablas relacionales usan patrón polimórfico:**
   - Campo `producto_tipo`: 'laser' | 'gran_formato' | 'materiales_rigidos'
   - Campo `producto_id`: UUID del producto en la tabla específica

2. **La tabla `productos` fue eliminada intencionalmente** en la migración de limpieza

3. **No existen tablas `_v2`** - fueron renombradas a sus nombres finales

4. **La tabla `productos_pricing` NO EXISTE** - el nombre correcto es `productos_precios`
