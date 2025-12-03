# Fix: Filtros de Facturación - Completado

## Resumen

Se ha corregido el problema de los filtros en la vista de **Órdenes Pendientes de Facturación**. Ahora los usuarios pueden ver todas las órdenes (facturadas y no facturadas) o filtrar específicamente por estado de facturación.

## Problema Original

La función SQL `fn_ordenes_pendientes_facturacion` tenía hardcodeado el filtro `facturada = false`, lo que significaba que **siempre** mostraba solo las órdenes pendientes de facturación, sin importar qué filtros se seleccionaran en la interfaz.

Cuando el usuario seleccionaba "Todos los estados" en el filtro de estado de orden, esperaba ver todas las órdenes, pero la función siempre filtraba por órdenes no facturadas.

## Solución Implementada

### 1. Base de Datos

**Archivo**: Nueva migración `fix_filtros_facturacion.sql`

- Se agregó un nuevo parámetro `p_estado_facturacion` a la función `fn_ordenes_pendientes_facturacion`
- El filtro `facturada = false` ahora es condicional:
  - `'pendiente'`: solo órdenes no facturadas
  - `'facturada'`: solo órdenes ya facturadas
  - `NULL` o `''`: todas las órdenes (sin filtrar por estado de facturación)

```sql
AND (
  p_estado_facturacion IS NULL
  OR p_estado_facturacion = ''
  OR (p_estado_facturacion = 'pendiente' AND ot.facturada = false)
  OR (p_estado_facturacion = 'facturada' AND ot.facturada = true)
)
```

### 2. Interfaz de Usuario

**Archivo**: `src/components/facturas/FacturasFilters.tsx`

- Se agregó un nuevo filtro **"Estado de Facturación"** con tres opciones:
  - "Todas las órdenes" (valor vacío)
  - "Pendientes de facturar" (valor: 'pendiente')
  - "Ya facturadas" (valor: 'facturada')
- Se ajustó el grid de filtros para acomodar 5 columnas en pantallas XL
- Se actualizó la lógica de `hasActiveFilters` para incluir el nuevo filtro

### 3. Hook de Datos

**Archivo**: `src/hooks/useFacturas.ts`

- Se agregó el campo `estado_facturacion` al interface `UseFacturasFilters`
- Se actualizó el `useEffect` para reaccionar a cambios en el nuevo filtro
- Se pasó el parámetro `p_estado_facturacion` a la llamada RPC

### 4. Vista Principal

**Archivo**: `src/pages/app/finanzas/FacturasView.tsx`

- Se agregó el estado local `estadoFacturacion` con valor inicial `'pendiente'` (mantiene comportamiento anterior por defecto)
- Se pasó el nuevo estado al hook `useFacturas`
- Se pasaron las props necesarias al componente `FacturasFilters`
- Se actualizó `handleClearFilters` para resetear el filtro a 'pendiente'
- **Bonus**: Se hizo el título de la sección dinámico según el filtro seleccionado:
  - "Órdenes Pendientes de Facturación" (cuando filtro = 'pendiente')
  - "Órdenes Facturadas" (cuando filtro = 'facturada')
  - "Todas las Órdenes" (cuando filtro = '')
- **Bonus**: Se actualizó el mensaje del `EmptyState` para que sea dinámico

## Comportamiento Actual

### Por Defecto
- Al entrar a la vista, se muestra **"Pendientes de facturar"** seleccionado (mantiene comportamiento anterior)
- Solo se ven órdenes que requieren factura pero no han sido facturadas

### Con Filtros
- **"Todas las órdenes"**: Muestra todas las órdenes que requieren factura, estén o no facturadas
- **"Pendientes de facturar"**: Solo muestra órdenes no facturadas (comportamiento anterior)
- **"Ya facturadas"**: Solo muestra órdenes que ya tienen factura registrada

### Interacción con Otros Filtros
Los filtros de fecha, cliente y estado de orden funcionan en conjunto con el nuevo filtro de estado de facturación, permitiendo combinaciones como:
- "Órdenes finalizadas que están pendientes de facturar"
- "Órdenes facturadas del cliente X en el mes de diciembre"
- "Todas las órdenes en producción (facturadas y no facturadas)"

## Archivos Modificados

1. ✅ Base de datos:
   - Nueva migración: `fix_filtros_facturacion.sql`

2. ✅ Frontend:
   - `src/components/facturas/FacturasFilters.tsx`
   - `src/hooks/useFacturas.ts`
   - `src/pages/app/finanzas/FacturasView.tsx`

## Verificación

✅ El proyecto compila correctamente sin errores
✅ Los tipos TypeScript están correctamente definidos
✅ La migración SQL se aplicó exitosamente
✅ Se mantiene la compatibilidad con el comportamiento anterior (por defecto muestra pendientes)

## Próximos Pasos

El usuario puede probar la funcionalidad:

1. Ir a **Finanzas → Facturas**
2. Por defecto verá las órdenes pendientes de facturar
3. Cambiar el filtro **"Estado de Facturación"** a:
   - "Todas las órdenes" → Verá todas las órdenes (facturadas y no facturadas)
   - "Ya facturadas" → Verá solo las órdenes que ya tienen factura
4. Combinar con otros filtros (fecha, cliente, estado) para refinar los resultados
5. Usar "Limpiar filtros" para volver al estado por defecto (pendientes)

## Beneficios

✅ Mayor flexibilidad en el módulo de facturación
✅ Los usuarios pueden ver todas las órdenes cuando lo necesiten
✅ Se mantiene el comportamiento por defecto (muestra solo pendientes)
✅ Interfaz intuitiva y predecible
✅ Títulos y mensajes dinámicos que guían al usuario
✅ Todos los filtros funcionan correctamente en conjunto
