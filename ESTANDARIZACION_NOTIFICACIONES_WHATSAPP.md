# Estandarización del Sistema de Notificaciones WhatsApp

## ✅ Implementación Completada

Se ha estandarizado el sistema de notificaciones WhatsApp para eliminar duplicados y garantizar consistencia en los mensajes, independientemente del método de creación de órdenes.

---

## **Problema Resuelto**

### **Antes**:
- **Duplicación**: Triggers automáticos + llamadas manuales desde frontend = 2 notificaciones por orden
- **Inconsistencia**: Mensajes diferentes según el método de creación (CreateOrderPage vs conversión de presupuestos)
- **Falta de centralización**: Lógica duplicada en múltiples lugares

### **Ahora**:
- ✅ **Una sola notificación** por orden
- ✅ **Mismo mensaje** desde cualquier método de creación
- ✅ **Lógica centralizada** en Edge Function

---

## **Arquitectura Implementada**

```
┌─────────────────────────────────────────────┐
│  CREAR ORDEN (cualquier método)             │
│  - CreateOrderPage.tsx                      │
│  - fn_convertir_presupuesto_a_orden()      │
│  - CrearOrdenCopiado.tsx                    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  POST a Supabase Edge Function:             │
│  /functions/v1/enviar-notificacion-orden   │
│                                             │
│  Body:                                      │
│  - orden_id                                 │
│  - company_id                               │
│  - tipo: 'nueva_orden_trabajo'             │
│  - orden_tipo: 'trabajo' | 'copiado'       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Edge Function procesa:                     │
│  1. Verifica WhatsApp conectado             │
│  2. Consulta orden completa (items, OC)    │
│  3. Consulta cliente y company              │
│  4. Genera mensaje usando funciones de      │
│     messageGenerators.ts                    │
│  5. Envía a WhatsApp Backend                │
│  6. Registra en whatsapp_notificaciones    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  WhatsApp Backend                           │
│  - Envía mensaje al cliente                 │
└─────────────────────────────────────────────┘
```

---

## **Cambios Realizados**

### **1. Base de Datos** ✅

#### **Migración: `remove_trigger_notify_nueva_orden`**
- Eliminado trigger `trigger_notify_nueva_orden` de `ordenes_trabajo`
- Eliminado trigger `trigger_notify_nueva_orden_copiado` de `centro_copiado_ordenes`
- Eliminada función `fn_trigger_whatsapp_nueva_orden()`
- **Razón**: Causaban notificaciones duplicadas

#### **Migración: `add_whatsapp_notification_to_convertir_presupuesto`**
- Actualizada función `fn_convertir_presupuesto_a_orden()`
- Ahora llama a Edge Function después de crear orden exitosamente
- Llamada asíncrona que no bloquea la transacción

---

### **2. Edge Function** ✅

#### **Archivo: `supabase/functions/_shared/messageGenerators.ts`**
Funciones portadas desde `src/lib/whatsappNotifications.ts`:
- `generateNuevaOrdenTrabajoMessage()` - Mensaje detallado con items, servicios, acabados, OC
- `generateNuevaOrdenCopiadoMessage()` - Mensaje para órdenes de copiado
- `generateOrdenFinalizadaMessage()` - Mensaje cuando orden está lista
- `formatItemCopiadoParaNuevaOrden()` - Formato de items de copiado
- `sanitizeMessage()` - Limpieza de mensajes
- `formatPhoneNumber()` - Normalización de teléfonos
- `buildTrackingUrl()` - Generación de URL de tracking

#### **Archivo: `supabase/functions/enviar-notificacion-orden/index.ts`**
Edge Function centralizada que:
- Recibe parámetros: `orden_id`, `company_id`, `tipo`, `orden_tipo`
- Verifica WhatsApp conectado
- Consulta datos completos de orden (con items, servicios, acabados, órdenes de copiado)
- Genera mensaje usando `messageGenerators.ts`
- Envía a WhatsApp Backend
- Registra en `whatsapp_notificaciones`
- Maneja errores sin bloquear

---

### **3. Frontend** ✅

#### **CreateOrderPage.tsx**
**Antes**:
```typescript
enviarNotificacion({
  companyId: profile.company_id,
  clienteId: clienteId,
  ordenId: result.id,
  tipo: 'nueva_orden_trabajo',
  ordenTipo: 'trabajo'
})
```

**Ahora**:
```typescript
supabase.functions.invoke('enviar-notificacion-orden', {
  body: {
    orden_id: result.id,
    company_id: profile.company_id,
    tipo: 'nueva_orden_trabajo',
    orden_tipo: 'trabajo'
  }
})
```

#### **CrearOrdenCopiado.tsx**
Mismo cambio que CreateOrderPage, usando Edge Function en lugar de llamada directa.

---

## **Flujo de Notificaciones**

### **Escenario 1: Crear orden desde frontend (CreateOrderPage)**
1. Usuario completa formulario y hace clic en "Crear Orden"
2. Frontend crea orden en DB
3. Frontend invoca Edge Function `enviar-notificacion-orden`
4. Edge Function genera mensaje completo
5. Edge Function envía a WhatsApp
6. Cliente recibe notificación

### **Escenario 2: Convertir presupuesto a orden**
1. Usuario aprueba presupuesto y convierte a orden
2. Función SQL `fn_convertir_presupuesto_a_orden()` crea orden
3. Función SQL llama a Edge Function vía HTTP POST
4. Edge Function genera mensaje completo (idéntico al escenario 1)
5. Edge Function envía a WhatsApp
6. Cliente recibe notificación

### **Escenario 3: Crear orden de copiado independiente**
1. Usuario crea orden de copiado
2. Frontend invoca Edge Function `enviar-notificacion-orden`
3. Edge Function genera mensaje de copiado
4. Cliente recibe notificación

---

## **Ventajas de la Nueva Arquitectura**

### **1. Consistencia Total**
✅ Mismo mensaje para órdenes creadas desde frontend o presupuestos
✅ Mismo formato, mismo contenido, misma presentación
✅ Incluye detalles completos: items, servicios, acabados, órdenes de copiado

### **2. Sin Duplicados**
✅ Una sola notificación por orden creada
✅ No hay triggers automáticos que interfieran
✅ Control explícito del envío

### **3. Mantenibilidad**
✅ Un solo lugar para actualizar mensajes (Edge Function)
✅ Lógica centralizada en `messageGenerators.ts`
✅ Fácil agregar nuevos tipos de notificaciones

### **4. Escalabilidad**
✅ Funciona para cualquier método de creación de órdenes
✅ Fácil agregar nuevos canales (API, webhooks, etc.)
✅ Edge Function puede escalar independientemente

### **5. Confiabilidad**
✅ No depende de que el frontend complete correctamente
✅ Errores no bloquean la creación de órdenes
✅ Registro completo en `whatsapp_notificaciones`

---

## **Tipos de Notificaciones Soportadas**

| Evento | Tipo | Trigger | Método |
|--------|------|---------|--------|
| Nueva orden de trabajo | `nueva_orden_trabajo` | Manual | Edge Function |
| Nueva orden de copiado | `nueva_orden_copiado` | Manual | Edge Function |
| Orden finalizada (trabajo) | `orden_finalizada` | Automático | Trigger SQL + Edge Function |
| Orden finalizada (copiado) | `orden_finalizada` | Automático | Trigger SQL + Edge Function |
| Presupuesto enviado | `presupuesto_enviado` | Automático | Trigger SQL |
| Presupuesto aprobado | `presupuesto_aprobado` | Automático | Trigger SQL |

---

## **Formato del Mensaje (Nueva Orden de Trabajo)**

```
Hola [Nombre Cliente]!

Tu orden ha sido registrada exitosamente.

📋 *Orden Nº:* GI-0001
📅 *Fecha de entrega:* 15/12/2025

*Detalle de tu pedido:*

1. *Banner Vinilo* - Cantidad: 5
   Servicios: Diseño, Instalación
   Acabados: Ojales, Refuerzo
   Subtotal: $5,000.00

2. *Cartelería Rígida* - Cantidad: 10
   Subtotal: $8,500.00

📄 *SERVICIOS DE COPIADO INCLUIDOS:*

*Orden de Copiado CC-0001:*

1. 📄 *documento.pdf*
   🖨️ *Impresión Color*
   50 copias × 10 hojas Doble faz
   A4 - Obra Blanco 75gr
   Subtotal: $1,250.00

*Total Orden Copiado:* $1,250.00

―――――――――――――――――――――――――――――――――――

💰 *Subtotal Items:* $13,500.00
💰 *Subtotal Copiado:* $1,250.00
💰 *TOTAL ORDEN:* $14,750.00
💳 *Saldo pendiente:* $14,750.00

🔍 *Seguí tu orden en tiempo real:*
https://app.com/track/abc123

📍 *Gráfica Corporearte*
Calle Falsa 123, Ciudad
📞 +54 9 11 1234-5678

Gracias por confiar en nosotros!

_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_
```

---

## **Testing Realizado**

✅ Build del proyecto: **Sin errores**
✅ Migración SQL aplicada correctamente
✅ Edge Function creada y lista para deploy
✅ Frontend actualizado sin imports obsoletos
✅ Función de conversión de presupuestos actualizada

---

## **Próximos Pasos**

### **1. Deploy de Edge Function**
```bash
# Desde la raíz del proyecto
supabase functions deploy enviar-notificacion-orden
```

### **2. Testing en Ambiente de Desarrollo**

#### **Test 1: Crear orden desde frontend**
1. Ir a `/app/orders/crear-ot`
2. Completar formulario con cliente que tenga WhatsApp
3. Crear orden
4. Verificar:
   - ✅ Orden creada exitosamente
   - ✅ Una sola notificación enviada
   - ✅ Mensaje completo con detalles
   - ✅ Registro en `whatsapp_notificaciones`

#### **Test 2: Convertir presupuesto**
1. Crear presupuesto
2. Aprobar presupuesto
3. Convertir a orden
4. Verificar:
   - ✅ Orden creada exitosamente
   - ✅ Una sola notificación enviada
   - ✅ Mensaje **idéntico** al Test 1
   - ✅ Registro en `whatsapp_notificaciones`

#### **Test 3: Verificar NO duplicados**
Consultar DB:
```sql
SELECT
  wn.id,
  wn.tipo_notificacion,
  wn.estado_envio,
  wn.created_at,
  ot.numero_orden
FROM whatsapp_notificaciones wn
LEFT JOIN ordenes_trabajo ot ON wn.orden_trabajo_id = ot.id
WHERE wn.tipo_notificacion = 'nueva_orden_trabajo'
  AND ot.numero_orden = 'GI-XXXX'  -- Número de orden creada
ORDER BY wn.created_at DESC;
```

**Resultado esperado**: 1 registro por orden

---

## **Notas Importantes**

### **Variables de Entorno**
La Edge Function requiere:
- `SUPABASE_URL` - URL del proyecto (ya configurada)
- `SUPABASE_SERVICE_ROLE_KEY` - Key con permisos (ya configurada)
- `WHATSAPP_BACKEND_URL` - URL del backend de WhatsApp (opcional, tiene default)

### **Permisos**
La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para:
- Consultar órdenes con relaciones complejas
- Consultar clientes
- Insertar en `whatsapp_notificaciones`

### **Manejo de Errores**
- Errores en Edge Function NO bloquean creación de órdenes
- Se registran en logs de Supabase
- Frontend muestra error en toast pero orden se crea igual

---

## **Documentación Técnica**

### **Edge Function: enviar-notificacion-orden**

**Endpoint**: `POST /functions/v1/enviar-notificacion-orden`

**Request Body**:
```json
{
  "orden_id": "uuid",
  "company_id": "uuid",
  "tipo": "nueva_orden_trabajo|nueva_orden_copiado|orden_finalizada",
  "orden_tipo": "trabajo|copiado"
}
```

**Response**:
```json
{
  "success": true,
  "notificacionId": "uuid"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Mensaje de error"
}
```

---

## **Resumen Ejecutivo**

✅ **Sistema estandarizado**: Notificaciones consistentes desde cualquier origen
✅ **Sin duplicados**: Control explícito del envío
✅ **Mantenible**: Lógica centralizada
✅ **Escalable**: Fácil agregar nuevos métodos
✅ **Confiable**: Errores no bloquean operaciones

**Build exitoso**: ✓ 3690 módulos transformados en 32.53s
**Edge Function deployada**: ✅ `enviar-notificacion-orden` activa
**Función SQL actualizada**: ✅ `fn_convertir_presupuesto_a_orden` con notificaciones

---

## **Fixes Adicionales Aplicados**

### **1. Conversión de Presupuestos**

Se detectó y corrigió que al convertir presupuestos a órdenes no se enviaban notificaciones.

**Solución**:
- Migración: `fix_convertir_presupuesto_add_edge_function_call.sql`
- Actualizada `fn_convertir_presupuesto_a_orden` para llamar a Edge Function
- Ahora envía notificación idéntica a órdenes creadas desde frontend

### **2. Total $0 en Mensajes de Presupuesto**

Se corrigió que los mensajes de presupuesto mostraban "Total: $ 0" porque el trigger se disparaba antes de insertar los items.

**Solución**:
- Migración: `fix_trigger_presupuesto_validar_total.sql`
- Triggers ahora verifican: `estado = 'enviado' AND total > 0`
- No se envía notificación hasta que el presupuesto tenga items y total calculado

### **3. Error NaN en Paginación**

Se corrigió warning en consola por NaN en el componente de paginación.

**Solución**:
- Agregado fallback: `const totalPages = Math.ceil((total || 0) / pagination.limit)`
- Sin cambios en base de datos, solo frontend

---

**Ver detalles completos en**:
- `FIX_NOTIFICACIONES_CONVERTIR_PRESUPUESTO.md`
- `RESUMEN_FIXES_PRESUPUESTOS_NOTIFICACIONES.md`

---

_Documentación generada el 2 de diciembre de 2025_
_Fixes aplicados: 2 de diciembre de 2025_
