# Fix: Reporte de Ventas por Canal - Órdenes de Copiado

## Problema Identificado

Las órdenes del centro de copiado con canal "App Mobile" o "WhatsApp" se mostraban incorrectamente como "Mostrador" en los reportes de ventas por canal.

## Causa Raíz

La función SQL `fn_reporte_ventas_por_canal` estaba **hardcodeando** el valor `'Mostrador'` para todas las órdenes de centro copiado independientes (no vinculadas a una orden de trabajo), ignorando completamente el campo `origen` que ya existía en la tabla `centro_copiado_ordenes`.

### Código Problemático (línea 64 de la función anterior):

```sql
-- Órdenes de centro copiado independientes: usar 'Mostrador' por defecto
SELECT
  'Mostrador' AS canal,  -- ❌ HARDCODEADO
  cc.total AS monto,
  'copiado' AS tipo_orden
FROM centro_copiado_ordenes cc
WHERE cc.orden_trabajo_id IS NULL
```

## Solución Aplicada

### Migración: `fix_reporte_canal_usar_origen_copiado.sql`

Se actualizó la función `fn_reporte_ventas_por_canal` para:

1. **Órdenes de trabajo**: Mantener comportamiento actual usando `canal_venta`
2. **Órdenes de copiado vinculadas**: Priorizar `canal_venta` de la orden de trabajo, si es NULL usar `origen` de la orden de copiado
3. **Órdenes de copiado independientes**: **Usar el campo `origen` directamente** en lugar de hardcodear 'Mostrador'

### Código Corregido:

```sql
-- Órdenes de centro copiado independientes: usar campo 'origen' directamente
SELECT
  COALESCE(cc.origen, 'Mostrador') AS canal,  -- ✅ USA EL CAMPO REAL
  cc.total AS monto,
  'copiado' AS tipo_orden
FROM centro_copiado_ordenes cc
WHERE cc.orden_trabajo_id IS NULL
```

## Cambios en la Base de Datos

### Función Actualizada
- **Nombre**: `fn_reporte_ventas_por_canal`
- **Cambio**: Ahora lee el campo `origen` de las órdenes de copiado
- **Compatibilidad**: Totalmente compatible hacia atrás, no requiere cambios en el frontend

## Verificación

### Prueba Realizada:
1. ✅ Creada orden de copiado con `origen = 'App Mobile'`
2. ✅ Ejecutado reporte - aparece correctamente como "App Mobile"
3. ✅ Verificado que "WhatsApp" y "Mostrador" también funcionan correctamente

### Resultado del Reporte (después del fix):

```
Canal       | Total Ventas | Órdenes | Tipo
------------|--------------|---------|----------------
WhatsApp    | $273,234.20  | 1       | 1 trabajo
Mostrador   | $13,600.00   | 1       | 1 copiado
App Mobile  | $5,000.00    | 1       | 1 copiado
```

## Impacto

### Positivo:
- ✅ Los reportes de ventas por canal ahora son 100% precisos
- ✅ Las órdenes de copiado con origen "App Mobile" o "WhatsApp" se reportan correctamente
- ✅ No requiere cambios en el código frontend
- ✅ Compatible con todas las órdenes existentes

### Sin Cambios:
- Las órdenes de copiado existentes con `origen = 'Mostrador'` (valor por defecto) siguen reportándose correctamente como "Mostrador"

## Archivos Modificados

- `supabase/migrations/[timestamp]_fix_reporte_canal_usar_origen_copiado.sql` - Nueva migración

## Notas Adicionales

- La tabla `centro_copiado_ordenes` tiene el campo `origen` desde la migración `20251203151747_add_origen_canal_venta_centro_copiado.sql`
- El campo `origen` permite los valores: 'Web', 'WhatsApp', 'Mostrador', 'App Mobile'
- El valor por defecto es 'Mostrador' para órdenes creadas antes de establecer explícitamente el origen

## Fecha de Aplicación
3 de diciembre de 2025
