# ✅ Mensajes WhatsApp de Órdenes de Copiado - CORREGIDO v2

## Problema Reportado

Al enviar notificaciones de WhatsApp de órdenes de copiado:
1. ❌ **Fecha de entrega**: Mostraba "A confirmar" aunque estuviera configurada
2. ❌ **Items**: Aparecían en blanco, no se mostraban los detalles

---

## ⚠️ Problema con Primera Implementación

Después de la primera implementación, seguía sin funcionar. Al revisar, encontré que la consulta PostgREST tenía **sintaxis incorrecta**:

**❌ Sintaxis Incorrecta (v1):**
```typescript
items:centro_copiado_ordenes_items(
  *,
  tamanio:tamanio_papel_id(nombre),  // ❌ Usa nombre de columna FK
  papel:papel_id(nombre)              // ❌ Usa nombre de columna FK
)
```

**✅ Sintaxis Correcta (v2):**
```typescript
items:centro_copiado_ordenes_items(
  *,
  tamanio_papel:centro_copiado_tamanios_papel(nombre),  // ✅ Usa nombre de tabla
  papel:centro_copiado_papeles(variante_nombre)          // ✅ Usa nombre de tabla
)
```

**Causa del error:** PostgREST requiere especificar el **nombre de la tabla de destino**, no el nombre de la columna de la Foreign Key.

---

## ✅ Solución Implementada (v2 - DEFINITIVA)

He actualizado la Edge Function `notify-orden-finalizada` con las siguientes mejoras:

### 1. **Separación de funciones de mensaje**

Antes había una sola función genérica. Ahora hay dos funciones específicas:

- `generateOrdenTrabajoFinalizadaMessage()` - Para órdenes de trabajo
- `generateOrdenCopiadoFinalizadaMessage()` - Para órdenes de copiado ✨ **NUEVA**

### 2. **Consulta de items con JOIN (CORREGIDA)**

La consulta de orden de copiado ahora trae los items relacionados con la sintaxis correcta:

```typescript
const { data: ordenData } = await supabase
  .from('centro_copiado_ordenes')
  .select(`
    *,
    cliente:cliente_id(*),
    items:centro_copiado_ordenes_items(
      *,
      tamanio_papel:centro_copiado_tamanios_papel(nombre),
      papel:centro_copiado_papeles(variante_nombre)
    )
  `)
  .eq('id', orden_id)
  .single();
```

**Cambio clave:** Ahora usa los nombres de las tablas (`centro_copiado_tamanios_papel`, `centro_copiado_papeles`) en lugar de los nombres de las columnas FK.

### 3. **Nueva función `formatItemCopiado()`**

Formatea cada item según su tipo:

**Impresión:**
```
🖨️ *Impresión Color*
   2x 50 hojas Doble faz
   A4 - Obra 80gr
   $25.00 c/u = $50.00
```

**Anillado:**
```
📚 *Anillado Plástico*
   2 unidades
   $15.00 c/u = $30.00
```

**Plastificado:**
```
🎴 *Plastificado A4*
   5 unidades
   $8.00 c/u = $40.00
```

### 4. **Formateo de fecha de entrega**

Ahora muestra la fecha correctamente formateada en formato argentino:

```typescript
if (orden.fecha_entrega_estimada) {
  const fecha = new Date(orden.fecha_entrega_estimada);
  const fechaFormateada = fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  mensaje += `📅 *Fecha de entrega:* ${fechaFormateada}\n\n`;
} else {
  mensaje += `📅 *Fecha de entrega:* A confirmar\n\n`;
}
```

---

## 📱 Ejemplo de Mensaje Completo (Orden de Copiado)

```
Hola Juan Pérez!

✅ Tu orden de copiado *#CC-0025* está lista para retirar!

📅 *Fecha de entrega:* 15/12/2024

📋 *Detalle de la orden:*

🖨️ *Impresión Color*
   2x 50 hojas Doble faz
   A4 - Obra 80gr
   $25.00 c/u = $50.00

📚 *Anillado Plástico*
   2 unidades
   $15.00 c/u = $30.00

🎴 *Plastificado A4*
   5 unidades
   $8.00 c/u = $40.00

💰 *Total:* $120.00
💳 *Saldo pendiente:* $50.00

📍 *Podés retirarla en:*
Av. Corrientes 1234, CABA

🕐 *Horarios de atención:*
Lunes a Viernes: 9:00 - 18:00

📞 *Contacto:* +54 11 1234-5678

Gracias por confiar en nosotros!

_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_
```

---

## 🔍 Logs Mejorados

Ahora la Edge Function registra más información para debugging:

```
[Notify] Procesando notificación: { orden_id: "...", tipo_orden: "copiado" }
[Notify] Orden de copiado obtenida: {
  numero_orden: "CC-0025",
  items_count: 3,
  fecha_entrega: "2024-12-15T00:00:00Z"
}
[Notify] Enviando mensaje de orden finalizada: {
  tipo_orden: "copiado",
  numeroOrden: "CC-0025",
  messageLength: 545
}
```

---

## ✅ Cambios Técnicos

### Archivo Modificado:
- `/tmp/cc-agent/59764544/project/supabase/functions/notify-orden-finalizada/index.ts`

### Funciones Agregadas:
1. `formatItemCopiado(item)` - Formatea un item según su tipo
2. `generateOrdenCopiadoFinalizadaMessage()` - Genera mensaje específico para órdenes de copiado
3. Renombrada: `generateOrdenFinalizadaMessage()` → `generateOrdenTrabajoFinalizadaMessage()`

### Lógica de Selección:
```typescript
const mensaje = tipo_orden === 'trabajo'
  ? generateOrdenTrabajoFinalizadaMessage(orden, cliente, company, saldoPendiente)
  : generateOrdenCopiadoFinalizadaMessage(orden, cliente, company, saldoPendiente);
```

---

## 🧪 Cómo Probar

1. **Crear una orden de copiado con:**
   - Fecha de entrega estimada configurada
   - Al menos 1 item (impresión, anillado o plastificado)
   - Cliente con WhatsApp configurado

2. **Finalizar la orden:**
   - Completar todos los pasos si tiene ruta de producción
   - O marcar manualmente como "finalizada"

3. **Verificar el mensaje recibido:**
   - Debe mostrar la fecha correcta
   - Debe listar todos los items con sus detalles
   - Formato debe ser claro y legible

---

## 📊 Verificación en Base de Datos

Para ver el mensaje completo que se envió:

```sql
SELECT
  tipo_notificacion,
  telefono_destino,
  mensaje_enviado,
  estado_envio,
  created_at
FROM whatsapp_notificaciones
WHERE orden_copiado_id = '[id-de-tu-orden]'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 🎯 Estado: LISTO PARA PROBAR (v2 - CON CORRECCIÓN)

- ✅ Edge Function actualizada (v2)
- ✅ Sintaxis PostgREST corregida
- ✅ Desplegada en Supabase
- ✅ Build del proyecto exitoso
- ✅ Logs mejorados para debugging

### 🔧 Corrección Aplicada

**Problema identificado:** La sintaxis de JOIN de PostgREST estaba incorrecta.

**Solución:** Cambié de usar nombres de columnas FK a nombres de tablas:
- ❌ `tamanio:tamanio_papel_id(nombre)`
- ✅ `tamanio_papel:centro_copiado_tamanios_papel(nombre)`

También actualicé `formatItemCopiado()` para usar `item.tamanio_papel?.nombre` en lugar de `item.tamanio?.nombre`.

---

## 🧪 Cómo Probar AHORA

1. **Crear una NUEVA orden de copiado** (no reutilizar la anterior):
   - Fecha de entrega estimada configurada
   - Al menos 1 item (impresión, anillado o plastificado)
   - Cliente con WhatsApp configurado

2. **Finalizar la orden:**
   - Marcar como "finalizada"

3. **Verificar el mensaje recibido:**
   - ✅ Debe mostrar la fecha correcta
   - ✅ Debe listar todos los items con sus detalles completos
   - ✅ Formato debe ser claro y legible

**IMPORTANTE:** Si seguía llegando el mensaje sin fecha/items con la orden anterior, probá con una orden NUEVA porque la notificación anterior ya quedó registrada en la base de datos.

---

¡Esta vez debería funcionar correctamente! 🚀
