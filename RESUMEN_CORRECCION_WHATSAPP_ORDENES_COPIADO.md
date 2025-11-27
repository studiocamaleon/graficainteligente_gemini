# 📱 Resumen: Corrección Completa de Notificaciones WhatsApp para Órdenes de Copiado

## 🎯 Objetivo

Corregir los mensajes de WhatsApp para órdenes de copiado en dos escenarios:
1. **Nueva orden creada** → Template de confirmación
2. **Orden finalizada** → Notificación de retiro

---

## 🔧 Correcciones Realizadas

### 1. Edge Function `notify-orden-finalizada` (Orden Finalizada)

**Problema:** El parámetro `tipo_orden` del trigger no llegaba correctamente.

**Solución:** Detección automática del tipo de orden

**Cambios:**
- ✅ Parámetro `tipo_orden` ahora es opcional en `WebhookPayload`
- ✅ Si no viene o viene mal, detecta automáticamente consultando `ordenes_trabajo`
- ✅ Si existe en `ordenes_trabajo` → es tipo `'trabajo'`
- ✅ Si NO existe → es tipo `'copiado'`
- ✅ Logs extendidos para debugging

**Archivo:** `supabase/functions/notify-orden-finalizada/index.ts`

**Ventajas:**
- No depende del trigger
- Auto-recuperable ante errores
- Backward compatible
- Fácil de debuggear

---

### 2. Frontend `whatsappNotifications.ts` (Nueva Orden)

**Problema:** La función `generateNuevaOrdenCopiadoMessage()` usaba estructura de datos incorrecta.

**Solución:** Reescribir función completa con datos correctos de BD

**Cambios:**
- ✅ Query expandida con relaciones (tamaños papel, papeles)
- ✅ Nueva función helper `formatItemCopiadoParaNuevaOrden()`
- ✅ Lectura de campos correctos de BD (`cantidad_unidades`, `cantidad_hojas`, etc.)
- ✅ Asociación de archivos con items
- ✅ Fecha corregida: `fecha_entrega_estimada` (en lugar de `fecha_entrega`)
- ✅ Formato argentino para fechas

**Archivo:** `src/lib/whatsappNotifications.ts`

**Ventajas:**
- Mensajes completos con todos los detalles
- Formato profesional y legible
- Trazabilidad de archivos
- Validación de datos antes de mostrar

---

## 📊 Comparación Antes vs Después

### Mensaje de Nueva Orden

**ANTES:**
```
Hola Cliente!

Tu orden de copiado ha sido registrada.

📋 *Orden Nº:* OC-0001
📅 *Fecha de entrega:* Invalid Date

*Detalle de tu pedido:*

1.

💰 *Total:* $450.00
💳 *Saldo pendiente:* $450.00
```

**AHORA:**
```
Hola Cliente!

Tu orden de copiado ha sido registrada.

📋 *Orden Nº:* OC-0001
📅 *Fecha de entrega:* 27/11/2024

*Detalle de tu pedido:*

1. 📄 *documento.pdf*
   Impresión para reunión
   🖨️ *Impresión Color*
   3x 50 hojas Doble faz
   A4 - Obra 75gr
   $150.00 c/u = $450.00
   + Anillado Ring Wire

💰 *Total:* $450.00
💳 *Saldo pendiente:* $450.00

📍 *Gráfica Corporearte*
Av. Principal 123
📞 11-1234-5678
```

---

### Mensaje de Orden Finalizada

**ANTES:**
```
Hola Cliente!

✅ Tu orden OC-0001 está lista para retirar!

💰 *Total:* $450.00
💳 *Saldo pendiente:* $0.00
```

**AHORA (con detección automática):**
```
Hola Cliente!

✅ Tu orden de copiado OC-0001 está lista para retirar!

📅 *Fecha de entrega:* 27/11/2024

📋 *Detalle de la orden:*

🖨️ *Impresión Color*
   3x 50 hojas Doble faz
   A4 - Obra 75gr
   $150.00 c/u = $450.00

💰 *Total:* $450.00
💳 *Saldo pendiente:* $0.00

📍 *Podés retirarla en:*
Av. Principal 123

🕐 *Horarios de atención:*
Lunes a Viernes 9-18hs
```

---

## 🔍 Flujos Completos

### Flujo 1: Crear Nueva Orden de Copiado

```
1. Usuario crea orden en frontend
2. Se guardan items con sus configuraciones
3. Se llama a enviarNotificacion() con tipo 'nueva_orden_copiado'
4. Query obtiene orden + items + relaciones (papeles, tamaños)
5. Query adicional obtiene archivos asociados
6. Se asocian archivos con items por item_generado_id
7. formatItemCopiadoParaNuevaOrden() formatea cada item
8. generateNuevaOrdenCopiadoMessage() genera mensaje completo
9. sendMessage() envía por WhatsApp
10. Se registra en whatsapp_notificaciones
```

### Flujo 2: Finalizar Orden de Copiado

```
1. Usuario cambia estado a 'finalizada'
2. Trigger detecta cambio de estado
3. Trigger llama a Edge Function notify-orden-finalizada
4. Edge Function recibe { orden_id, company_id, tipo_orden? }
5. Si tipo_orden no viene o es inválido:
   a. Busca en ordenes_trabajo
   b. Si existe → tipo = 'trabajo'
   c. Si NO existe → tipo = 'copiado'
6. Usa lógica correspondiente según tipo detectado
7. Para copiado: obtiene items + relaciones completas
8. generateOrdenCopiadoFinalizadaMessage() genera mensaje
9. Envía por WhatsApp backend
10. Se registra en whatsapp_notificaciones
```

---

## 🧪 Testing

### Test 1: Nueva Orden con Archivos

1. Crear orden de copiado
2. Subir 2 archivos PDF
3. Configurar items con impresión color + anillado
4. Cliente con WhatsApp configurado
5. Fecha de entrega: mañana
6. Guardar

**Resultado esperado:**
- ✅ Mensaje con nombres de archivos
- ✅ Detalles completos de impresión
- ✅ Anillado visible
- ✅ Fecha formateada correctamente

### Test 2: Finalizar Orden de Copiado

1. Tomar orden existente en estado 'en_proceso'
2. Cambiar estado a 'finalizada'

**Resultado esperado:**
- ✅ Edge Function detecta tipo = 'copiado'
- ✅ Mensaje muestra "orden de copiado"
- ✅ Incluye fecha de entrega
- ✅ Muestra items completos
- ✅ Cliente recibe notificación

### Test 3: Orden sin Archivos

1. Crear orden sin subir archivos
2. Configurar items manualmente

**Resultado esperado:**
- ✅ Mensaje sin nombres de archivos
- ✅ Detalles de impresión presentes
- ✅ Sin errores

---

## 📝 Verificación en Base de Datos

### Ver últimas notificaciones de copiado:

```sql
SELECT
  tipo_notificacion,
  LEFT(mensaje_enviado, 200) as mensaje_preview,
  estado_envio,
  telefono_destino,
  created_at,
  orden_copiado_id
FROM whatsapp_notificaciones
WHERE orden_copiado_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Ver archivos asociados a items:

```sql
SELECT
  ca.nombre_archivo,
  ca.item_generado_id,
  ci.cantidad_hojas,
  ci.cantidad_unidades,
  ci.tipo_tinta
FROM centro_copiado_archivos ca
LEFT JOIN centro_copiado_ordenes_items ci ON ca.item_generado_id = ci.id
WHERE ca.orden_copiado_id = 'UUID_DE_ORDEN'
ORDER BY ca.created_at;
```

---

## 🎯 Mapeo de Campos

### Item de Centro Copiado:

| Campo BD | Uso en Mensaje | Ejemplo |
|----------|----------------|---------|
| `cantidad_unidades` | Cantidad de copias | "3x" |
| `cantidad_hojas` | Hojas por copia | "50 hojas" |
| `tipo_tinta` | Color o B/N | "CMYK" → "Color" |
| `cara_impresa` | Simple/Doble faz | "frente_y_dorso" → "Doble faz" |
| `tamanio_papel.nombre` | Tamaño | "A4" |
| `papel.variante_nombre` | Tipo papel | "Obra 75gr" |
| `tipo_anillado` | Tipo anillado | "ring_wire" → "Ring Wire" |
| `tipo_plastificado` | Tipo plastificado | "A4" |
| `precio_unitario` | Precio c/u | "$150.00 c/u" |
| `subtotal` | Total item | "$450.00" |
| `descripcion` | Descripción | Texto libre |

---

## 🚀 Deployment

### Edge Function (ya desplegada):
```bash
# Automático con mcp__supabase__deploy_edge_function
✅ notify-orden-finalizada actualizada
```

### Frontend:
```bash
npm run build
✅ Build exitoso
```

---

## 📋 Checklist de Validación

### Nueva Orden:
- [x] Query trae relaciones (papeles, tamaños)
- [x] Archivos se asocian correctamente
- [x] Fecha usa `fecha_entrega_estimada`
- [x] Formato de fecha argentino (DD/MM/YYYY)
- [x] Items muestran todos los detalles
- [x] Anillados y plastificados aparecen
- [x] Precios formateados con 2 decimales

### Orden Finalizada:
- [x] Detección automática de tipo funciona
- [x] Items traen relaciones completas
- [x] Fecha de entrega formateada
- [x] Mensaje dice "orden de copiado"
- [x] Logs claros para debugging
- [x] Funciona sin parámetro tipo_orden

---

## 🎉 Resultado Final

**Dos sistemas robustos de notificaciones WhatsApp:**

1. ✅ **Nueva Orden:** Template completo desde frontend
2. ✅ **Orden Finalizada:** Edge Function con detección automática

**Ambos sistemas:**
- Muestran información completa y correcta
- Tienen formato profesional
- Son resilientes a errores
- Están documentados y son mantenibles

---

## 📚 Documentación Relacionada

- `FIX_MENSAJES_WHATSAPP_NUEVA_ORDEN_COPIADO_COMPLETO.md` - Detalles de corrección frontend
- `FIX_MENSAJES_WHATSAPP_ORDENES_COPIADO_DETECCION_AUTOMATICA.md` - Detalles de Edge Function

---

¡Sistema de notificaciones WhatsApp para órdenes de copiado completamente funcional! 🎊
