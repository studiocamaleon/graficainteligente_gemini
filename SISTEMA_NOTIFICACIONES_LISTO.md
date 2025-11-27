# ✅ Sistema de Notificaciones Automáticas - IMPLEMENTADO

## Estado: CASI LISTO (falta 1 paso manual)

---

## ✅ Lo que ya está hecho:

1. **Edge Function desplegada** → `notify-orden-finalizada` está activa en Supabase
2. **Trigger de base de datos creado** → Detecta automáticamente cuando una orden se finaliza
3. **Valores configurados** en el trigger:
   - URL: `https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada`
   - Token: `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`

---

## ⏳ ÚLTIMO PASO (solo vos podés hacerlo - 1 minuto):

Necesitás configurar el **secret token** en la Edge Function desde el dashboard de Supabase:

### Opción 1: Desde Dashboard (Recomendado)

1. Abrí: https://supabase.com/dashboard/project/sovqpafggvcbzrvbkegi/functions
2. Click en la función **notify-orden-finalizada**
3. Andá a la pestaña **Settings** o **Secrets**
4. Click en **Add new secret**
5. Completá:
   - **Name:** `TRIGGER_SECRET_TOKEN`
   - **Value:** `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`
6. Click en **Save** o **Add secret**

### Opción 2: Desde Terminal (si tenés Supabase CLI)

```bash
supabase secrets set TRIGGER_SECRET_TOKEN="DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk="
```

---

## 🧪 Cómo Probar que Funciona

### Test Simple:

1. Creá una orden de prueba con un cliente que tenga WhatsApp configurado
2. Completá todos los pasos de producción de la orden
3. La orden debería cambiar automáticamente a estado "finalizada"
4. **El cliente debe recibir un mensaje de WhatsApp** diciendo que su orden está lista

### Verificar Logs:

**En Supabase Dashboard:**
- Ir a **Functions > notify-orden-finalizada > Logs**
- Deberías ver: `[Notify] Procesando notificación` cuando se finaliza una orden

**En Base de Datos:**
```sql
-- Ver últimas notificaciones
SELECT
  tipo_notificacion,
  estado_envio,
  telefono_destino,
  error_mensaje,
  created_at
FROM whatsapp_notificaciones
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📋 Checklist de Verificación

- [x] Edge Function desplegada
- [x] Trigger de base de datos creado
- [x] URL configurada en trigger
- [x] Token configurado en trigger
- [ ] **Secret token configurado en Edge Function** ← ESTE ES EL PASO QUE FALTA
- [ ] Probado con orden de prueba

---

## 🔍 Qué Hace el Sistema

Cuando una orden (de trabajo o copiado) se finaliza:

1. **Trigger detecta** el cambio de estado
2. **Llama a Edge Function** con datos de la orden
3. **Edge Function verifica**:
   - Que no se haya enviado ya (evita duplicados)
   - Que el cliente tenga WhatsApp
   - Que WhatsApp esté conectado
4. **Genera mensaje** con:
   - Número de orden
   - Total y saldo pendiente
   - Dirección y horarios de la empresa
   - Contacto y link de reviews (si están configurados)
5. **Envía mensaje** al cliente
6. **Registra resultado** en tabla `whatsapp_notificaciones`

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

## ⚠️ Casos donde NO se envía mensaje (esperado)

- Cliente no tiene número de WhatsApp configurado
- WhatsApp no está conectado en la app
- Ya se envió una notificación de "orden_finalizada" para esa orden
- Orden no cambia a estado "finalizada"

En todos estos casos, el sistema **no falla**, simplemente no envía el mensaje y lo registra en logs.

---

## 🆘 Solución de Problemas

### "No recibí el mensaje"

**Verificar en orden:**
1. WhatsApp está conectado en Integraciones
2. Cliente tiene número de WhatsApp en su perfil
3. Número tiene formato correcto (ej: 1145678901 o +54 11 4567-8901)
4. La orden efectivamente cambió a "finalizada"

**Ver detalles en:**
- Logs de Edge Function (buscar el orden_id)
- Tabla `whatsapp_notificaciones` (buscar registros fallidos)

### "Error 401 en logs"

El secret token no está configurado o no coincide. Verificar que:
- Configuraste el secret `TRIGGER_SECRET_TOKEN` en la Edge Function
- El valor es exactamente: `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`

### "Edge Function no responde"

Verificar que la función esté activa:
```
Ir a: Functions > notify-orden-finalizada
Estado debe decir: "Active"
```

---

## 📊 Datos para Recordar

- **Proyecto Supabase:** `sovqpafggvcbzrvbkegi`
- **URL Edge Function:** `https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/notify-orden-finalizada`
- **Secret Token:** `DdPn0N8/ALG2qQLamuVPHc90G4BSkSC9OqsDlcxEKJk=`
- **Nombre de función:** `notify-orden-finalizada`

---

## 🎉 Una vez configurado el secret...

**¡EL SISTEMA FUNCIONARÁ SOLO!**

No necesitás hacer nada más. Cada vez que se finalice una orden, el cliente recibirá automáticamente el mensaje de WhatsApp.

---

## 📝 Próximos Pasos (Opcional)

Si querés extender el sistema:
- Agregar más tipos de notificaciones (orden en camino, recordatorio de retiro, etc.)
- Personalizar el template del mensaje por empresa
- Panel de estadísticas de notificaciones enviadas
- Reintentos automáticos si falla el envío

---

¿Necesitás ayuda para configurar el secret o probar el sistema? ¡Decime!
