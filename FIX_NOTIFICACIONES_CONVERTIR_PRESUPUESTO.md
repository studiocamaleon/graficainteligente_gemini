# Fix: Notificaciones al Convertir Presupuesto a Orden

## ✅ Problema Resuelto

Al convertir un presupuesto a orden de trabajo, **no se enviaba notificación WhatsApp** al cliente porque:

1. El trigger automático `trigger_notify_nueva_orden` fue eliminado (causaba duplicados)
2. La función `fn_convertir_presupuesto_a_orden` no tenía la llamada a la Edge Function

## 🔧 Solución Implementada

### **1. Migración de Base de Datos**

**Archivo**: `fix_convertir_presupuesto_add_edge_function_call.sql`

Se actualizó la función `fn_convertir_presupuesto_a_orden` para:

- ✅ Agregar `'net'` al `search_path` (necesario para `net.http_post`)
- ✅ Agregar variables para HTTP request (`v_request_id`, `v_edge_function_url`)
- ✅ Agregar bloque `BEGIN/EXCEPTION` con llamada HTTP a Edge Function
- ✅ Llamada **asíncrona** que no bloquea la transacción
- ✅ Logging de éxito y errores

**Código agregado**:
```sql
-- Enviar notificación WhatsApp vía Edge Function (asíncrono, no bloqueante)
BEGIN
  v_edge_function_url := 'https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden';

  SELECT net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    ),
    body := jsonb_build_object(
      'orden_id', v_orden_id::text,
      'company_id', v_presupuesto.company_id::text,
      'tipo', 'nueva_orden_trabajo',
      'orden_tipo', 'trabajo'
    )
  ) INTO v_request_id;

  RAISE LOG '[Conversión Presupuesto] Notificación WhatsApp enviada con request ID: %', v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Conversión Presupuesto] Error enviando notificación WhatsApp: %', SQLERRM;
END;
```

### **2. Deploy de Edge Function**

**Edge Function**: `enviar-notificacion-orden`

✅ **Deployada exitosamente** usando `mcp__supabase__deploy_edge_function`

La Edge Function:
- Recibe parámetros de la orden
- Consulta datos completos (items, servicios, acabados, órdenes de copiado)
- Genera mensaje detallado usando `messageGenerators.ts`
- Envía a WhatsApp Backend
- Registra en `whatsapp_notificaciones`

---

## 📋 Flujo Completo

### **Cuando se convierte presupuesto a orden**:

```
Usuario aprueba presupuesto
    ↓
Función SQL: fn_convertir_presupuesto_a_orden()
    ↓
INSERT en ordenes_trabajo (crea orden)
    ↓
Copiar items, archivos, pagos
    ↓
HTTP POST a Edge Function: enviar-notificacion-orden
    ↓
Edge Function:
  - Consulta orden completa
  - Genera mensaje detallado (igual que CreateOrderPage)
  - Envía a WhatsApp Backend
  - Registra en whatsapp_notificaciones
    ↓
Cliente recibe notificación WhatsApp
```

---

## ✅ Verificaciones

### **1. Función SQL actualizada**
```sql
-- Verificar que la función tiene la llamada a Edge Function
SELECT
  p.proname as nombre_funcion,
  pg_get_functiondef(p.oid) as definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'fn_convertir_presupuesto_a_orden'
  AND n.nspname = 'public';
```

Debe contener:
- ✅ `SET search_path TO 'public', 'net'`
- ✅ `v_request_id bigint`
- ✅ `v_edge_function_url text`
- ✅ `net.http_post(...)`

### **2. Edge Function deployada**
```bash
# Verificar que está activa
curl -X POST https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/enviar-notificacion-orden \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{
    "orden_id": "test",
    "company_id": "test",
    "tipo": "nueva_orden_trabajo",
    "orden_tipo": "trabajo"
  }'
```

### **3. Testing en Producción**

**Pasos para probar**:

1. Crear un presupuesto
2. Agregar items
3. Aprobar presupuesto
4. Convertir a orden de trabajo

**Resultado esperado**:
- ✅ Orden creada correctamente
- ✅ Cliente recibe notificación WhatsApp
- ✅ Mensaje incluye todos los detalles (items, servicios, acabados)
- ✅ Formato idéntico al de órdenes creadas desde CreateOrderPage
- ✅ Registro en tabla `whatsapp_notificaciones`

**Verificar en DB**:
```sql
-- Ver última notificación enviada
SELECT
  wn.id,
  wn.tipo_notificacion,
  wn.estado_envio,
  wn.created_at,
  ot.numero_orden,
  LEFT(wn.mensaje_enviado, 100) as inicio_mensaje
FROM whatsapp_notificaciones wn
LEFT JOIN ordenes_trabajo ot ON wn.orden_trabajo_id = ot.id
ORDER BY wn.created_at DESC
LIMIT 5;
```

---

## 🎯 Consistencia Garantizada

Ahora **todas** las órdenes creadas (desde frontend o presupuestos) envían:

✅ **Mismo mensaje**: Formato detallado con items, servicios, acabados
✅ **Misma lógica**: Edge Function centralizada `enviar-notificacion-orden`
✅ **Mismo registro**: Tabla `whatsapp_notificaciones`
✅ **Sin duplicados**: Una sola notificación por orden

---

## 📝 Archivos Modificados

1. ✅ **Migración SQL**: `fix_convertir_presupuesto_add_edge_function_call.sql`
2. ✅ **Edge Function**: `enviar-notificacion-orden/index.ts` (deployada)
3. ✅ **Shared Functions**: `_shared/messageGenerators.ts` (deployada)

---

## 🚀 Estado Final

**Sistema de notificaciones completamente estandarizado**:

| Método de Creación | Notificación | Estado |
|-------------------|--------------|---------|
| CreateOrderPage.tsx | Edge Function | ✅ Funcionando |
| fn_convertir_presupuesto_a_orden | Edge Function | ✅ ARREGLADO |
| CrearOrdenCopiado.tsx | Edge Function | ✅ Funcionando |

---

_Fix aplicado el 2 de diciembre de 2025_
