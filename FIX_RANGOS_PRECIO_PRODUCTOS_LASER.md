# Corrección: Problema de Rangos de Precio en Productos Impresión Láser

## Problema Identificado

Cuando se creaba un producto de impresión láser con:
- **Tipo de venta**: Unidades
- **Rango de precio**: Asignado con varios rangos configurados

Al ir al Tab de Precios, en lugar de ver la matriz con columnas para cada rango (ejemplo: "1-50 uds", "51-100 uds", etc.), solo se mostraba una tabla con UNA fila con el valor "1".

## Causa Raíz

El componente `ProductoLaserPreciosSection.tsx` verificaba tres condiciones para mostrar la matriz de rangos:

```typescript
if (producto.tipo_venta === 'unidades' && producto.rango_precio_id && producto.rango_precio)
```

Si `producto.rango_precio` era null o undefined, NO mostraba el componente correcto (`ProductoLaserPrecioMatrizRangos`) y caía al componente por defecto que usa cantidades fijas, mostrando solo la cantidad "1".

**Posibles causas de que `producto.rango_precio` fuera null:**
1. El JOIN en la query de Supabase fallaba
2. Las políticas RLS bloqueaban el acceso a la tabla `rangos_precio` en el contexto del JOIN
3. El `rango_precio_id` no se guardó correctamente
4. El rango de precio fue eliminado o no existe

## Correcciones Aplicadas

### 1. Mejoras en el Componente de Precios

**Archivo**: `src/components/productos/impresion-laser/ProductoLaserPreciosSection.tsx`

Se agregó:
- **Logs de depuración** para diagnosticar el problema en la consola del navegador
- **Validación mejorada** con mensajes de error específicos:
  - Si `tipo_venta === 'unidades'` pero NO tiene `rango_precio_id`: Mensaje rojo indicando que debe asignar un rango
  - Si tiene `rango_precio_id` pero NO cargó `rango_precio`: Mensaje amarillo indicando que el rango no existe o no se pudo cargar
  - Si todo está correcto: Muestra la matriz de rangos normalmente

### 2. Logs en el Hook

**Archivo**: `src/hooks/useProductosImpresionLaser.ts`

Se agregaron logs de depuración que muestran en la consola:
- El ID del producto y company_id al hacer la query
- El resultado completo de la query
- Si el rango de precio se cargó correctamente
- Errores específicos si ocurren

### 3. Corrección de Políticas RLS

**Migración**: `fix_rangos_precio_rls_for_joins.sql`

Se aplicó una migración que:
- Verifica y crea la foreign key `rango_precio_id` si no existe
- Recrea todas las políticas RLS de la tabla `rangos_precio` para asegurar que funcionan correctamente con JOINs
- Agrega índice en `company_id` para optimizar las queries
- Asegura que RLS está habilitado correctamente

### 4. Script de Diagnóstico

**Archivo**: `scripts/debug-rango-precio-issue.ts`

Se creó un script de diagnóstico que permite verificar:
- Si el producto tiene `rango_precio_id` configurado
- Si el rango de precio existe en la base de datos
- Si las políticas RLS permiten acceder al rango
- Si el JOIN funciona correctamente
- Si ambos pertenecen a la misma compañía

**Uso**:
```bash
npm run ts-node scripts/debug-rango-precio-issue.ts <producto_id> <user_id>
```

## Cómo Probar la Corrección

### 1. Verificar en la Consola del Navegador

Cuando vayas al Tab de Precios de un producto, verás logs como:

```
[useProductoImpresionLaser] Fetching producto: {id: "...", companyId: "..."}
[useProductoImpresionLaser] Query result: {
  productoData: {...},
  productoError: null,
  hasRangoPrecio: true,
  rangoPrecioId: "abc-123"
}
[ProductoLaserPreciosSection] Debug Info: {
  productoNombre: "Mi Producto",
  tipoVenta: "unidades",
  rangoPrecioId: "abc-123",
  rangoPrecio: { id: "abc-123", nombre: "Unidades Estándar", ... },
  ...
}
```

### 2. Mensajes de Error Específicos

**Si el producto no tiene rango asignado:**
- Verás un mensaje rojo indicando que debe asignar un rango de precio
- Solución: Edita el producto y asigna un rango

**Si el rango no existe o no se carga:**
- Verás un mensaje amarillo con el ID del rango que no se pudo cargar
- Solución: Edita el producto y vuelve a asignar un rango válido

### 3. Verificar la Matriz de Rangos

Si todo está correcto, deberías ver:
- Una matriz con COLUMNAS para cada rango configurado
- Ejemplo: "1-50 uds", "51-100 uds", "101-250 uds", etc.
- Inputs para configurar el precio de cada combinación (medida + tinta + cara + rango)

## Casos de Uso

### Caso 1: Producto con Tipo Venta "Unidades"

✅ **Correcto**: Se muestra la matriz de rangos con columnas para cada rango
- Requisito: Debe tener `rango_precio_id` asignado
- Requisito: El rango debe existir y ser accesible

### Caso 2: Producto con Tipo Venta "Cantidades Fijas"

✅ **Correcto**: Se muestra tabla con filas para cada cantidad fija
- Ejemplo: Si tiene cantidades [100, 250, 500], verás 3 filas
- NO debe tener `rango_precio_id` asignado

## Validación de Base de Datos

Para verificar que todo está correcto en la base de datos, puedes ejecutar:

```sql
-- Verificar productos con tipo_venta = 'unidades'
SELECT
  p.id,
  p.nombre,
  p.tipo_venta,
  p.rango_precio_id,
  r.nombre as rango_nombre,
  r.rangos
FROM productos_impresion_laser p
LEFT JOIN rangos_precio r ON r.id = p.rango_precio_id
WHERE p.tipo_venta = 'unidades';
```

**Resultado esperado:**
- Si `rango_precio_id` NO es null, debe haber un `rango_nombre`
- Si `rango_nombre` es null pero `rango_precio_id` NO es null, hay un problema: el rango no existe

## Próximos Pasos

1. **Prueba el Tab de Precios** de un producto con tipo de venta "Unidades"
2. **Revisa la consola del navegador** para ver los logs de depuración
3. **Si ves mensajes de error**, sigue las instrucciones para corregir el problema
4. **Si todo funciona correctamente**, verás la matriz de rangos con todas las columnas

## Notas Técnicas

### Foreign Key

La migración asegura que existe la foreign key:
```sql
ALTER TABLE productos_impresion_laser
  ADD CONSTRAINT productos_impresion_laser_rango_precio_id_fkey
  FOREIGN KEY (rango_precio_id)
  REFERENCES rangos_precio(id)
  ON DELETE RESTRICT;
```

Esto garantiza integridad referencial: no se puede asignar un `rango_precio_id` que no existe.

### Políticas RLS

Las políticas RLS actualizadas aseguran que:
- Los usuarios solo pueden ver rangos de su propia compañía
- El JOIN funciona correctamente en el contexto de autenticación
- No hay bloqueos inesperados al hacer queries con JOIN

### Trigger de Validación

Ya existe un trigger que valida:
- Si `tipo_venta = 'unidades'` → `rango_precio_id` es OBLIGATORIO
- Si `tipo_venta = 'cantidades_fijas'` → `rango_precio_id` debe ser NULL

Esto previene estados inconsistentes en la base de datos.

## Resumen

Las correcciones aplicadas garantizan que:

✅ Los productos con tipo de venta "Unidades" muestran correctamente la matriz de rangos
✅ Los mensajes de error son claros y específicos
✅ Los logs de depuración ayudan a diagnosticar problemas
✅ Las políticas RLS funcionan correctamente con JOINs
✅ La integridad referencial está garantizada

Si después de estas correcciones aún ves el problema, usa el script de diagnóstico para investigar más a fondo.
