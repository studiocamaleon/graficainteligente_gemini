# ✅ Sistema de Notificaciones WhatsApp con Backend Render - IMPLEMENTADO

## Estado: LISTO PARA PROBAR

---

## 🎯 Lo que se Implementó

He actualizado completamente la Edge Function `notify-orden-finalizada` para que funcione con tu **backend propio en Render** en lugar de Evolution API.

### Cambios Realizados:

1. **✅ Eliminada dependencia de Evolution API**
   - Ya no busca en la tabla `evolution_integrations`
   - No usa configuración de Evolution

2. **✅ Integración con Backend de Render**
   - URL: `https://whatsapp-backend-w6ot.onrender.com`
   - Endpoint de estado: `GET /status/{companyId}`
   - Endpoint de envío: `POST /send`

3. **✅ Nueva función `checkWhatsAppConnection()`**
   - Verifica conexión llamando a `/status/{companyId}` del backend
   - Retorna `true` si `connected === true`
   - Maneja errores de forma elegante

4. **✅ Nueva función `sendWhatsAppMessage()` actualizada**
   - Envía mensajes a `/send` del backend de Render
   - Formato del payload:
     ```json
     {
       "companyId": "uuid-de-empresa",
       "to": "541112345678",
       "message": "Hola..."
     }
     ```

5. **✅ Formato de número actualizado**
   - Ahora envía el número en formato: `541112345678` (sin `@s.whatsapp.net`)
   - Limpia caracteres no numéricos
   - Agrega código de país 54 si falta
   - Quita el 0 inicial del código de área

---

## 🧪 Cómo Probar

### 1. Verificar que el Secret Token esté configurado

Si aún no lo hiciste, configurá el secret en Supabase:

1. Ir a: https://supabase.com/dashboard/project/sovqpafggvcbzrvbkegi/functions
2. Click en `notify-orden-finalizada`
3. Pestaña **Settings** o **Secrets**
4. Agregar secret:
   - **Name:** `TRIGGER_SECRET_TOKEN`
   - **Value:** `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`

### 2. Probar con una Orden Real

1. **Asegurate de tener WhatsApp conectado**
   - Ir a Integraciones > WhatsApp
   - Verificar que esté "Conectado"

2. **Crear una orden de prueba**
   - Cliente debe tener número de WhatsApp configurado
   - Ejemplo: `1145678901` o `+54 11 4567-8901`

3. **Completar todos los pasos de producción**
   - La orden debe cambiar automáticamente a estado "finalizada"

4. **Esperar el mensaje**
   - El cliente debería recibir un mensaje de WhatsApp inmediatamente

---

## 📋 Logs para Verificar

### En Supabase Dashboard (Logs de Edge Function):

Ir a: **Functions > notify-orden-finalizada > Logs**

**Logs exitosos deberían verse así:**

```
[Notify] Procesando notificación: { orden_id: "...", company_id: "...", tipo_orden: "trabajo" }
[WhatsApp] Verificando conexión para company: b0ad23b1-cf97-4055-823b-ef3c6bed485a
[WhatsApp] Estado de conexión: { connected: true, number: "..." }
[Notify] ✅ WhatsApp conectado, procediendo a enviar mensaje
[Notify] Enviando mensaje de orden finalizada: { ... }
[WhatsApp] Enviando mensaje a backend de Render: { ... }
[WhatsApp] Mensaje enviado exitosamente: { ... }
[Notify] ✅ Notificación registrada en base de datos
```

### En Base de Datos:

```sql
-- Ver últimas notificaciones
SELECT
  tipo_notificacion,
  estado_envio,
  telefono_destino,
  error_mensaje,
  created_at,
  respuesta_backend
FROM whatsapp_notificaciones
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔍 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     FLUJO COMPLETO                          │
└─────────────────────────────────────────────────────────────┘

1. Usuario finaliza orden
   │
   ├─> Base de datos: estado = 'finalizada'
   │
2. Trigger detecta cambio
   │
   ├─> fn_trigger_whatsapp_orden_finalizada()
   │
3. Trigger llama Edge Function
   │
   ├─> POST https://[proyecto].supabase.co/functions/v1/notify-orden-finalizada
   ├─> Headers: X-Trigger-Secret: [token]
   ├─> Body: { orden_id, company_id, tipo_orden }
   │
4. Edge Function procesa
   │
   ├─> Verifica que no se haya enviado antes
   ├─> Consulta datos de orden + cliente + empresa
   ├─> Verifica conexión WhatsApp
   │   └─> GET https://whatsapp-backend-w6ot.onrender.com/status/{companyId}
   │
5. Edge Function envía mensaje
   │
   ├─> POST https://whatsapp-backend-w6ot.onrender.com/send
   ├─> Body: { companyId, to: "541112345678", message: "..." }
   │
6. Backend de Render envía WhatsApp
   │
   └─> Cliente recibe mensaje ✅
   │
7. Edge Function registra resultado
   │
   └─> INSERT INTO whatsapp_notificaciones
```

---

## 📱 Ejemplo del Mensaje que Recibe el Cliente

```
Hola Juan Pérez!

✅ Tu orden *#12345* está lista para retirar!

💰 *Total:* $1500.00
💳 *Saldo pendiente:* $500.00

📍 *Podés retirarla en:*
Av. Principal 123, Ciudad

🕐 *Horarios de atención:*
Lunes a Viernes: 9:00 - 18:00

📞 *Contacto:* +54 11 1234-5678

⭐ *Nos ayudarías mucho dejando tu opinión:*
https://g.page/tu-negocio

Gracias por confiar en nosotros!

_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_
```

---

## ⚠️ Casos donde NO se envía mensaje (comportamiento esperado)

1. **Cliente sin WhatsApp configurado**
   - Log: `[Notify] ⚠️ Cliente no tiene WhatsApp configurado. Skipping.`

2. **WhatsApp no conectado**
   - Log: `[Notify] ⚠️ WhatsApp no está conectado para esta empresa. Skipping.`

3. **Notificación ya enviada**
   - Log: `[Notify] ⚠️ Ya se envió notificación para esta orden. Skipping.`

4. **Backend de Render no responde**
   - Log: `[WhatsApp] ⚠️ No se pudo verificar estado de WhatsApp`
   - Estado: `fallido`
   - Se registra en `whatsapp_notificaciones` con el error

---

## 🆘 Solución de Problemas

### "No recibí el mensaje"

**Verificar en orden:**

1. ✅ **WhatsApp está conectado** en Integraciones
   ```
   Ir a: Integraciones > WhatsApp
   Estado debe decir: "Conectado"
   ```

2. ✅ **Cliente tiene WhatsApp en su perfil**
   ```sql
   SELECT nombre_fantasia, whatsapp
   FROM clientes
   WHERE id = '[cliente_id]';
   ```

3. ✅ **Orden efectivamente se finalizó**
   ```sql
   SELECT numero_orden, estado, updated_at
   FROM ordenes_trabajo
   WHERE id = '[orden_id]';
   ```

4. ✅ **Ver logs de Edge Function**
   ```
   Supabase Dashboard > Functions > notify-orden-finalizada > Logs
   Buscar logs con el orden_id
   ```

5. ✅ **Verificar registro en base de datos**
   ```sql
   SELECT *
   FROM whatsapp_notificaciones
   WHERE orden_trabajo_id = '[orden_id]'
   OR orden_copiado_id = '[orden_id]';
   ```

### "Error 401 en logs"

El secret token no está configurado. Ver **Paso 1** de "Cómo Probar".

### "WhatsApp no está conectado" (pero sí está conectado en la app)

El backend de Render puede estar:
- **Dormido** (en free tier de Render puede tardar 30-60 segundos en despertar)
- **Caído** (verificar que `https://whatsapp-backend-w6ot.onrender.com` responda)

**Solución rápida:**
```bash
# Verificar manualmente si el backend responde
curl https://whatsapp-backend-w6ot.onrender.com/status/b0ad23b1-cf97-4055-823b-ef3c6bed485a
```

### "Error al enviar mensaje"

Ver el campo `error_mensaje` y `respuesta_backend` en la tabla `whatsapp_notificaciones`:

```sql
SELECT
  error_mensaje,
  respuesta_backend,
  created_at
FROM whatsapp_notificaciones
WHERE estado_envio = 'fallido'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 Configuración Actual

- **Backend WhatsApp:** `https://whatsapp-backend-w6ot.onrender.com`
- **Edge Function:** `notify-orden-finalizada` (desplegada y activa)
- **Trigger:** `fn_trigger_whatsapp_orden_finalizada()` (ambas tablas de órdenes)
- **Token Secret:** `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`

---

## 🎉 Próximos Pasos (Opcional)

Si querés extender el sistema:
- Notificaciones de orden en camino
- Recordatorio de retiro después de X días
- Notificaciones personalizadas por tipo de cliente
- Panel de estadísticas de notificaciones
- Reintentos automáticos si falla el envío

---

## ✅ Checklist Final

- [x] Edge Function actualizada para usar backend de Render
- [x] Función desplegada en Supabase
- [x] Trigger de base de datos configurado
- [x] Build del proyecto exitoso
- [ ] **Secret token configurado** ← VERIFICAR ESTO
- [ ] **Probado con orden real** ← PROBAR AHORA

---

¡Ahora probá finalizando una orden y deberías recibir el mensaje automáticamente! 🚀
