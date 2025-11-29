# Fix Final: Horarios en Tracking y WhatsApp

## Problema Resuelto

El tracking público mostraba "Consultar horarios" en lugar de los horarios configurados porque la función SQL `fn_get_public_order_tracking` no incluía el campo `company_business_hours`.

### Causa Raíz
Una migración posterior (20251129191431) sobrescribió la función eliminando el campo `company_business_hours` que había sido agregado en la migración 20251125235345.

## Solución Implementada

### 1. Migración de Base de Datos

**Archivo:** `restore_company_business_hours_to_tracking`

**Cambios aplicados:**
- ✅ Recreada función `fn_get_public_order_tracking` con todos los campos actuales
- ✅ Restaurado campo `company_business_hours` con query completo
- ✅ Mantenida información de pausas (cantidad_pausas, pausa_info)
- ✅ Mantenidos campos actualizados de company (name, address, contact_phone)

**Estructura de company_business_hours devuelta:**
```json
[
  {
    "day_of_week": 1,
    "day_name": "Lunes",
    "is_open": true,
    "opening_time_1": "09:00:00",
    "closing_time_1": "18:00:00",
    "opening_time_2": null,
    "closing_time_2": null
  },
  ...
]
```

### 2. Frontend (Ya existente - sin cambios)

**Archivos involucrados:**
- `src/hooks/useOrderTracking.ts` - Hook que llama al RPC
- `src/pages/public/OrderTracking.tsx` - Página que pasa los datos
- `src/components/tracking/TrackingStatusMessage.tsx` - Componente que muestra horarios
- `src/utils/timeUtils.ts` - Función de formateo con debugging

**Flujo de datos:**
1. Hook llama a `fn_get_public_order_tracking(token)`
2. Recibe objeto con campo `company_business_hours`
3. Pasa el array a `TrackingStatusMessage`
4. Componente usa `formatBusinessHoursForDisplay(companyBusinessHours)`
5. Función formatea y retorna string legible

### 3. Edge Function WhatsApp (Ya implementada)

**Archivo:** `supabase/functions/notify-orden-finalizada/index.ts`

**Funcionalidades:**
- ✅ Query a tabla `company_business_hours`
- ✅ Función `formatBusinessHours` para formatear array
- ✅ Mensajes incluyen sección de horarios
- ✅ Maneja casos edge (sin horarios, días cerrados, horarios divididos)

## Verificación de la Corrección

### Paso 1: Verificar función SQL

Ejecuta este query en Supabase SQL Editor con un token válido:

```sql
SELECT fn_get_public_order_tracking('TU_TOKEN_DE_32_CARACTERES');
```

**Resultado esperado:**
- Debe incluir el campo `company_business_hours` como array
- Si la empresa tiene horarios configurados, el array debe tener 7 elementos (uno por día)
- Si no tiene horarios, el array debe estar vacío `[]`

### Paso 2: Testing en Tracking Público

1. **Acceder al tracking:**
   - URL: `https://tudominio.com/tracking/{token}`
   - Reemplaza `{token}` con un token válido de 32 caracteres

2. **Verificar en consola del navegador:**
   - Abre DevTools (F12)
   - Ve a la pestaña Console
   - Deberías ver logs que empiezan con 🕐
   - Verifica que `company_business_hours` NO sea undefined
   - Verifica que sea un array con datos

3. **Verificar en UI:**
   - Si la orden está finalizada, busca la sección "Información de retiro"
   - Debe mostrar:
     - ✅ Dirección de la empresa
     - ✅ Horarios formateados (NO "Consultar horarios")
     - ✅ Número de orden

4. **Casos a probar:**

   **a) Empresa con horarios configurados:**
   - Debe mostrar horarios formateados
   - Ejemplos:
     - "Lun-Vie: 9:00-18:00"
     - "Lun-Vie: 9:00-12:00 y 15:00-19:00"
     - "Lun-Vie: 9:00-18:00, Sáb: 9:00-13:00"

   **b) Empresa sin horarios configurados:**
   - Debe mostrar "Consultar horarios"

### Paso 3: Testing de WhatsApp

1. **Finalizar una orden:**
   - Ve al módulo de órdenes
   - Selecciona una orden en estado "en_proceso"
   - Completa todos los pasos de producción
   - La orden debería cambiar a estado "finalizada"

2. **Verificar mensaje enviado:**
   - El cliente debería recibir un mensaje de WhatsApp
   - El mensaje debe incluir:
     ```
     📍 *Retiro*: {dirección de la empresa}
     🕐 *Horarios*: {horarios formateados}
     ```

3. **Verificar en panel de notificaciones:**
   - Ve a Integraciones > WhatsApp
   - Verifica el historial de notificaciones
   - El mensaje registrado debe incluir los horarios

### Paso 4: Casos Edge a Verificar

**Empresa sin horarios configurados:**
- Tracking: Debe mostrar "Consultar horarios"
- WhatsApp: Debe incluir "Consultar horarios"

**Empresa con todos los días cerrados:**
- Tracking: Debe mostrar "Consultar horarios"
- WhatsApp: Debe incluir "Consultar horarios"

**Empresa con horarios divididos (siesta):**
- Ejemplo: Lun-Vie 9:00-12:00 y 15:00-19:00
- Tracking: "Lun-Vie: 9:00-12:00 y 15:00-19:00"
- WhatsApp: Mismo formato

**Empresa con días mixtos:**
- Ejemplo: Lun-Vie 9:00-18:00, Sábado 9:00-13:00
- Tracking: "Lun-Vie: 9:00-18:00, Sáb: 9:00-13:00"
- WhatsApp: Mismo formato

## Logs de Debugging

### Logs del Frontend (Consola del navegador)

**Logs esperados al cargar tracking:**
```
🔍 Fetching tracking data...
📦 Datos recibidos del RPC: {...}
🕐 formatBusinessHoursForDisplay llamado con: [array de horarios]
🕐 Tipo: object Es array?: true Length: 7
💾 Actualizando estado con nuevos datos...
✅ Estado actualizado correctamente
```

**Si company_business_hours es undefined:**
```
🕐 formatBusinessHoursForDisplay llamado con: undefined
🕐 Tipo: undefined Es array?: false Length: undefined
⚠️ Horarios vacíos o inválidos
```
**Esto indica que la función SQL no está devolviendo el campo o que no se ejecutó la migración.**

### Logs de Edge Function (Supabase Dashboard)

Para ver logs de la edge function:
1. Ve a Supabase Dashboard
2. Edge Functions > notify-orden-finalizada
3. Pestaña "Logs"

**Logs esperados:**
```
Orden finalizada, enviando notificación...
Horarios formateados: "Lun-Vie: 9:00-18:00"
Mensaje enviado exitosamente
```

## Solución de Problemas

### Problema: Tracking sigue mostrando "Consultar horarios"

**Verificación 1: ¿Se aplicó la migración?**
```sql
-- Verificar comentario de la función (debe ser V3.0)
SELECT obj_description('fn_get_public_order_tracking(text)'::regprocedure);
```

Debe retornar: `"Obtiene información de seguimiento público de una orden usando tracking_token. V3.0: ..."`

**Verificación 2: ¿La empresa tiene horarios configurados?**
```sql
-- Verificar horarios de la empresa
SELECT cbh.*
FROM company_business_hours cbh
JOIN ordenes_trabajo ot ON ot.company_id = cbh.company_id
WHERE ot.tracking_token = 'TU_TOKEN';
```

Si retorna 0 filas, la empresa no tiene horarios configurados.

**Solución:** Configura horarios en el perfil de empresa:
1. Ve a Configuración > Perfil de Empresa
2. Edita los horarios de atención
3. Guarda los cambios
4. Recarga el tracking

**Verificación 3: ¿La función devuelve el campo?**
```sql
SELECT
  (fn_get_public_order_tracking('TU_TOKEN')::jsonb)->>'company_business_hours' as horarios;
```

Si es NULL, revisa que la migración se haya aplicado correctamente.

### Problema: WhatsApp no incluye horarios

**Verificación 1: ¿La edge function está actualizada?**
- Ve a Supabase Dashboard > Edge Functions
- Verifica la última fecha de deployment de `notify-orden-finalizada`
- Debe ser posterior a la implementación de la corrección

**Verificación 2: ¿La función query correctamente?**
- Revisa los logs de la edge function
- Busca errores relacionados con `company_business_hours`

**Solución:** Redesplegar la edge function:
```bash
# Desde tu proyecto local
supabase functions deploy notify-orden-finalizada
```

### Problema: Error en consola del navegador

**Error: "Cannot read property 'map' of undefined"**

Esto indica que `companyBusinessHours` es undefined.

**Solución:**
1. Verifica que la migración se aplicó
2. Verifica que el hook `useOrderTracking` está pasando correctamente el campo
3. Revisa el tipo de datos en `TrackingData` interface

## Archivos Modificados

### Base de Datos
- ✅ Nueva migración: `restore_company_business_hours_to_tracking.sql`

### Frontend (Sin cambios - ya tenían debugging)
- `src/utils/timeUtils.ts` - Función con logs de debugging
- `src/hooks/useOrderTracking.ts` - Hook que llama al RPC
- `src/pages/public/OrderTracking.tsx` - Página que renderiza
- `src/components/tracking/TrackingStatusMessage.tsx` - Componente que muestra horarios

### Edge Function (Sin cambios - ya implementada)
- `supabase/functions/notify-orden-finalizada/index.ts` - Notificación WhatsApp

## Resumen Ejecutivo

**Problema:** Tracking mostraba "Consultar horarios" y WhatsApp no incluía horarios de retiro.

**Causa:** Función SQL no devolvía campo `company_business_hours`.

**Solución:** Migración que restaura el campo en la función SQL.

**Estado:** ✅ Corrección aplicada y lista para probar.

**Próximo paso:** Testing manual en ambiente de desarrollo/producción siguiendo los pasos de verificación descritos arriba.

---

**Fecha de implementación:** 2025-11-29
**Versión de función SQL:** V3.0
**Build del proyecto:** ✅ Exitoso
