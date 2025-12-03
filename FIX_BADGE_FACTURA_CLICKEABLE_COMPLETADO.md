# Fix: Badge "Facturada" Clickeable para Ver PDF - Completado

## Resumen

Se implementó la funcionalidad para que el badge "Facturada" sea clickeable y permita abrir el archivo PDF de la factura directamente en el navegador, sin necesidad de descargarlo.

## Problema Original

El badge "Facturada" era estático y no permitía ninguna interacción. Los usuarios no podían acceder fácilmente al archivo PDF de la factura una vez que esta había sido cargada, lo que generaba una experiencia de usuario limitada.

## Solución Implementada

### 1. Base de Datos

**Archivo**: Nueva migración `add_factura_info_ordenes_pendientes.sql`

- Se agregaron dos campos a la tabla de retorno de `fn_ordenes_pendientes_facturacion`:
  - `numero_factura` (text): Número de la factura fiscal
  - `factura_storage_path` (text): Ruta del archivo PDF en Supabase Storage

```sql
RETURNS TABLE (
  -- ... otros campos
  numero_factura text,
  factura_storage_path text
)
```

### 2. Interface TypeScript

**Archivo**: `src/hooks/useFacturas.ts`

- Se agregaron los nuevos campos al interface:

```typescript
export interface OrdenPendienteFacturacion {
  // ... otros campos
  numero_factura: string | null;
  factura_storage_path: string | null;
}
```

### 3. Componente de Tabla

**Archivo**: `src/components/facturas/OrdenesPendientesTable.tsx`

**Cambios implementados:**

1. **Imports Adicionales:**
   - `useState` de React
   - `FileDown` de lucide-react
   - `supabase` para generar URLs firmadas

2. **Nueva Función `handleVerFactura`:**
   - Genera una URL firmada temporal (válida por 1 hora)
   - Usa `supabase.storage.createSignedUrl()` para acceso seguro
   - Abre el PDF en una nueva pestaña del navegador
   - Maneja errores y estados de carga

3. **Badge Interactivo:**
   - Ahora es un botón clickeable con estilos personalizados
   - Muestra el número de factura si está disponible (ej: "FC-0001")
   - Muestra "Facturada" si no hay número disponible
   - Incluye icono de descarga cuando el archivo está disponible
   - Tiene efecto hover con cambio de color y sombra
   - Muestra indicador de carga (spinner) mientras se abre el PDF
   - Se deshabilita si no hay archivo disponible

## Características del Badge

### Estados Visuales

1. **Normal (con archivo disponible):**
   - Color verde (`bg-green-100 text-green-700`)
   - Icono de descarga (`FileDown`)
   - Muestra número de factura o "Facturada"
   - Efecto hover: fondo más oscuro y sombra sutil
   - Cursor pointer

2. **Cargando (abriendo PDF):**
   - Muestra spinner animado
   - Texto "Abriendo..."
   - Opacidad reducida
   - Deshabilitado temporalmente

3. **Sin archivo:**
   - Mismo estilo visual pero sin efecto hover
   - Cursor default (no clickeable)
   - Tooltip indica "No hay archivo disponible"

### Ejemplo Visual del Badge

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Ver Detalle 👁]  [📥 FC-0001]  ← Clickeable          │
│  [Ver Detalle 👁]  [📥 Facturada] ← Clickeable         │
│  [Ver Detalle 👁]  [⏳ Abriendo...] ← Cargando         │
│  [Ver Detalle 👁]  [Facturada] ← Sin archivo          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Flujo de Uso

1. Usuario ve la tabla de órdenes facturadas
2. Identifica una orden con badge verde (ej: "FC-0001")
3. Hace clic en el badge
4. Sistema genera URL firmada temporal del PDF
5. PDF se abre en nueva pestaña del navegador
6. Usuario puede ver el PDF sin descargarlo
7. La URL expira después de 1 hora (seguridad)

## Seguridad

✅ **URLs Firmadas Temporales:**
- Se generan bajo demanda (no se almacenan)
- Válidas por 1 hora solamente
- Expiran automáticamente

✅ **Bucket Privado:**
- El bucket 'facturas' es privado
- Solo usuarios autenticados pueden acceder
- RLS aplica por company_id

✅ **Políticas de Storage:**
- Solo se puede ver facturas de la propia empresa
- Las políticas validan el company_id en el path

## Beneficios

✅ Acceso rápido e intuitivo al PDF de la factura
✅ No requiere descargar el archivo para verlo
✅ Muestra el número de factura directamente en la tabla
✅ Feedback visual claro (spinner mientras carga)
✅ Manejo robusto de errores
✅ Seguridad mediante URLs firmadas temporales
✅ Se abre en nueva pestaña (no interrumpe la navegación)
✅ Funciona perfectamente con filtros de estado

## Archivos Modificados

1. ✅ Base de datos:
   - Nueva migración: `add_factura_info_ordenes_pendientes.sql`

2. ✅ Frontend:
   - `src/hooks/useFacturas.ts` (interface actualizado)
   - `src/components/facturas/OrdenesPendientesTable.tsx` (badge interactivo)

## Verificación

✅ El proyecto compila correctamente sin errores
✅ Los tipos TypeScript están correctamente definidos
✅ La migración SQL se aplicó exitosamente
✅ El badge es clickeable y genera URLs firmadas
✅ Se muestran estados de carga apropiadamente

## Casos de Uso

### Caso 1: Orden con factura cargada
- Badge muestra: "FC-0001" (o número de factura)
- Al hacer clic: PDF se abre en nueva pestaña
- Usuario puede ver, imprimir, descargar

### Caso 2: Orden facturada sin número
- Badge muestra: "Facturada"
- Al hacer clic: PDF se abre en nueva pestaña

### Caso 3: Orden marcada como facturada pero sin archivo
- Badge muestra: "Facturada" (sin icono)
- No es clickeable
- Tooltip: "No hay archivo disponible"

## Notas Técnicas

- La URL firmada se genera cada vez que se hace clic (no se cachea)
- El tiempo de expiración de 1 hora es configurable (parámetro `3600`)
- Se usa `window.open()` para abrir en nueva pestaña
- Los PDFs se abren directamente en el navegador (no se descargan)
- Compatible con todos los navegadores modernos

## Mejoras Futuras (Opcionales)

- Agregar opción de descarga directa del PDF
- Mostrar fecha de facturación en tooltip
- Agregar vista previa en modal (sin salir de la página)
- Historial de visualizaciones de facturas
