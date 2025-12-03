# Fix: Botón "Cargar Factura" en Órdenes ya Facturadas - Completado

## Resumen

Se corrigió el problema donde las órdenes que ya tenían una factura registrada seguían mostrando el botón "Cargar Factura", lo que podía confundir a los usuarios y permitir acciones redundantes.

## Problema Original

En la tabla de órdenes pendientes de facturación, **todas las órdenes** mostraban el botón "Cargar Factura", incluso aquellas que ya tenían una factura registrada (`facturada = true`).

Cuando el usuario filtraba por "Ya facturadas" o "Todas las órdenes", las órdenes facturadas seguían mostrando el botón, lo cual era inconsistente y confuso.

## Solución Implementada

### 1. Base de Datos

**Archivo**: Nueva migración `fix_boton_cargar_factura_ordenes_facturadas.sql`

- Se agregó el campo `facturada` (boolean) a la tabla de retorno de la función `fn_ordenes_pendientes_facturacion`
- Ahora el frontend recibe el estado de facturación de cada orden
- Se eliminó y recreó la función para cambiar el tipo de retorno

```sql
RETURNS TABLE (
  -- ... otros campos
  facturada boolean  -- NUEVO CAMPO
)
```

### 2. Hook de Datos

**Archivo**: `src/hooks/useFacturas.ts`

- Se agregó el campo `facturada: boolean` al interface `OrdenPendienteFacturacion`
- Ahora el tipo TypeScript incluye el estado de facturación

```typescript
export interface OrdenPendienteFacturacion {
  // ... otros campos
  facturada: boolean;
}
```

### 3. Componente de Tabla

**Archivo**: `src/components/facturas/OrdenesPendientesTable.tsx`

**Cambios implementados:**

1. **Lógica Condicional del Botón:**
   - Si `orden.facturada === true`: Se muestra un **Badge verde "Facturada"**
   - Si `orden.facturada === false`: Se muestra el **botón "Cargar Factura"**

2. **Actualización del Footer:**
   - Cambió "órdenes pendientes" → "órdenes" (más genérico)
   - Cambió "Total Pendiente" → "Total Acumulado" (más apropiado cuando se muestran todas las órdenes)

## Comportamiento Actual

### Por Defecto (Filtro: "Pendientes de facturar")
- Solo se muestran órdenes no facturadas
- Todas muestran el botón "Cargar Factura"

### Filtro: "Ya facturadas"
- Solo se muestran órdenes facturadas
- Todas muestran el badge verde "Facturada"
- **NO** se muestra el botón "Cargar Factura"

### Filtro: "Todas las órdenes"
- Se muestran órdenes facturadas y no facturadas mezcladas
- Órdenes no facturadas: botón "Cargar Factura"
- Órdenes facturadas: badge "Facturada"

## Ejemplo Visual

```
┌─────────────────┬───────────────┬──────────────────────┐
│ Nº Orden        │ Cliente       │ Acciones             │
├─────────────────┼───────────────┼──────────────────────┤
│ ORD-001         │ Cliente A     │ [👁] [Cargar Factura]│  ← No facturada
│ ORD-002         │ Cliente B     │ [👁] [✓ Facturada]   │  ← Ya facturada
│ ORD-003         │ Cliente C     │ [👁] [Cargar Factura]│  ← No facturada
└─────────────────┴───────────────┴──────────────────────┘
```

## Archivos Modificados

1. ✅ Base de datos:
   - Nueva migración: `fix_boton_cargar_factura_ordenes_facturadas.sql`

2. ✅ Frontend:
   - `src/hooks/useFacturas.ts` (interface actualizado)
   - `src/components/facturas/OrdenesPendientesTable.tsx` (lógica condicional)

## Verificación

✅ El proyecto compila correctamente sin errores
✅ Los tipos TypeScript están correctamente definidos
✅ La migración SQL se aplicó exitosamente
✅ La lógica condicional funciona correctamente

## Beneficios

✅ Mejora la UX evitando acciones redundantes
✅ Indica claramente qué órdenes ya tienen factura
✅ Previene confusión cuando se filtran órdenes facturadas
✅ El badge verde "Facturada" es claro y visible
✅ Consistente con el nuevo filtro de estado de facturación

## Integración con Fix Anterior

Este fix se integra perfectamente con el anterior:

1. **Fix 1**: Agregó el filtro de estado de facturación
2. **Fix 2** (este): Oculta el botón en órdenes facturadas

Ahora el módulo de facturación es:
- ✅ Flexible (puedes ver todas las órdenes o filtrar)
- ✅ Intuitivo (solo se muestra el botón cuando tiene sentido)
- ✅ Claro (badge verde indica órdenes facturadas)
