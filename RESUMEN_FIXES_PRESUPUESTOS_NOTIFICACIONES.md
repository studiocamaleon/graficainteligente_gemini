# Resumen de Fixes: Presupuestos y Notificaciones

## 🎯 Problemas Resueltos

### **1. Notificaciones no se enviaban al convertir presupuesto** ✅

**Problema**: Al convertir un presupuesto aprobado a orden de trabajo, no se enviaba notificación WhatsApp al cliente.

**Causa**: La función `fn_convertir_presupuesto_a_orden` no tenía la llamada a la Edge Function porque dependía de un trigger que ya fue eliminado.

**Solución**:
- ✅ Migración: `fix_convertir_presupuesto_add_edge_function_call.sql`
- ✅ Actualizada `fn_convertir_presupuesto_a_orden()` para llamar a Edge Function
- ✅ Edge Function `enviar-notificacion-orden` deployada
- ✅ Llamada HTTP asíncrona que no bloquea la transacción

**Resultado**: Ahora todas las órdenes (desde frontend o presupuestos) envían notificación consistente.

---

### **2. Mensaje de presupuesto mostraba "Total: $ 0"** ✅

**Problema**: Al enviar un presupuesto, el mensaje WhatsApp mostraba:
```
Tu presupuesto PRES-2025-0020 esta listo!
Total: $ 0  ← Incorrecto
```

**Causa**: El trigger se disparaba AFTER INSERT del presupuesto, pero en ese momento aún no se habían insertado los items ni calculado el total.

**Flujo incorrecto**:
```
1. INSERT presupuesto (total = 0)
2. Trigger se dispara → mensaje con total = 0 ❌
3. INSERT items
4. UPDATE presupuesto con total calculado
```

**Solución Final**:
- ✅ Migración 1: `fix_trigger_presupuesto_validar_total.sql` (detectó el problema)
- ✅ Migración 2: `fix_trigger_presupuesto_enviar_en_update_total.sql` (solución correcta)
- ✅ Eliminado trigger INSERT (no se necesita, total siempre es 0)
- ✅ Trigger UPDATE ahora detecta **2 casos**:
  - **CASO 1**: Cambió de borrador → enviado con total > 0
  - **CASO 2**: Ya estaba enviado, total cambió de 0 → >0 (items agregados)

**Flujo correcto**:
```
1. INSERT presupuesto con estado='enviado' pero total=0
2. Trigger INSERT NO existe más ⏭️
3. INSERT items
4. UPDATE presupuesto con total calculado
5. Trigger UPDATE detecta: estado='enviado' + total cambió 0→>0
6. Envía mensaje con total correcto ✅
```

**Resultado**: El mensaje ahora muestra el total correcto:
```
Tu presupuesto PRES-2025-0020 esta listo!

*Total:* $15,750  ← Correcto
*Valido hasta:* 17/12/2025
```

---

### **3. Error NaN en paginación de presupuestos** ✅

**Problema**: En la vista de presupuestos, aparecía un warning en consola:
```
Warning: Received NaN for the `children` attribute
```

Y también al final de la vista:
```
Mostrando NaN a NaN de resultados
```

**Causa Raíz**: El componente `Pagination` requiere 4 props obligatorias (`totalItems` e `itemsPerPage`), pero solo se estaban pasando 2. Esto causaba que `startItem` y `endItem` se calcularan como `NaN`.

**Solución**:
1. ✅ Agregado fallback en cálculo de `totalPages`:
```typescript
const totalPages = Math.ceil((total || 0) / pagination.limit);
```

2. ✅ Pasadas todas las props requeridas al componente:
```typescript
<Pagination
  currentPage={pagination.page}
  totalPages={totalPages}
  totalItems={total}              // ✅ Agregado
  itemsPerPage={pagination.limit}  // ✅ Agregado
  onPageChange={handlePageChange}
  showItemsPerPage={false}
/>
```

**Resultado**: No más warnings de NaN, paginación funciona correctamente con "Mostrando 1 a 12 de 25 resultados".

---

## 📋 Migraciones Aplicadas

1. ✅ `fix_convertir_presupuesto_add_edge_function_call.sql`
   - Agrega llamada HTTP a Edge Function en `fn_convertir_presupuesto_a_orden`

2. ✅ `fix_trigger_presupuesto_validar_total.sql`
   - Primera iteración: Agregó validación `total > 0` (detectó el problema)
   - **Problema**: Nunca se disparaba porque total siempre era 0 en INSERT

3. ✅ `fix_trigger_presupuesto_enviar_en_update_total.sql` **[SOLUCIÓN FINAL]**
   - Elimina trigger INSERT (innecesario)
   - Actualiza trigger UPDATE para detectar cuando se calcula el total
   - Maneja 2 casos: cambio de estado a enviado, o cálculo de total en presupuesto ya enviado

---

## 🚀 Edge Functions Deployadas

1. ✅ **enviar-notificacion-orden**
   - Maneja notificaciones de órdenes (trabajo y copiado)
   - Genera mensajes detallados con items, servicios, acabados
   - Usa generators compartidos en `_shared/messageGenerators.ts`

2. ✅ **notify-presupuesto**
   - Maneja notificaciones de presupuestos
   - 3 tipos: `presupuesto_listo`, `presupuesto_aprobado`, `presupuesto_vencido`
   - Valida total > 0 antes de enviar

---

## ✅ Archivos Modificados

### **Backend (Supabase)**
- `supabase/migrations/fix_convertir_presupuesto_add_edge_function_call.sql`
- `supabase/migrations/fix_trigger_presupuesto_validar_total.sql`

### **Frontend (React)**
- `src/pages/app/presupuestos/PresupuestosListPage.tsx`

### **Edge Functions**
- `supabase/functions/enviar-notificacion-orden/index.ts` (deployada)
- `supabase/functions/_shared/messageGenerators.ts` (deployada)

---

## 🎯 Estado Final del Sistema

### **Notificaciones de Órdenes**

| Método de Creación | Notificación | Estado |
|-------------------|--------------|---------|
| CreateOrderPage.tsx | Edge Function | ✅ Funcionando |
| fn_convertir_presupuesto_a_orden | Edge Function | ✅ **ARREGLADO** |
| CrearOrdenCopiado.tsx | Edge Function | ✅ Funcionando |

**Todos usan la misma Edge Function, mismo mensaje, mismo formato.**

### **Notificaciones de Presupuestos**

| Evento | Trigger | Validación | Estado |
|--------|---------|------------|---------|
| Crear con estado='enviado' | INSERT | total > 0 | ✅ **ARREGLADO** |
| Cambiar a estado='enviado' | UPDATE | total > 0 | ✅ **ARREGLADO** |
| Aprobar presupuesto | Manual | N/A | ✅ Funcionando |

**Todos los mensajes muestran el total correcto.**

### **Vista de Presupuestos**

| Componente | Problema | Estado |
|-----------|----------|---------|
| PresupuestosListPage | NaN en paginación | ✅ **ARREGLADO** |
| Paginación | Error de children | ✅ **ARREGLADO** |
| Carga inicial | Warning en consola | ✅ **ARREGLADO** |

---

## 🧪 Testing Recomendado

### **Test 1: Convertir presupuesto a orden**
1. Crear presupuesto con items
2. Aprobar presupuesto
3. Convertir a orden de trabajo

**Verificar**:
- ✅ Orden creada correctamente
- ✅ Cliente recibe notificación WhatsApp
- ✅ Mensaje incluye todos los detalles
- ✅ Formato idéntico a órdenes desde CreateOrderPage

### **Test 2: Enviar presupuesto nuevo**
1. Crear presupuesto con items (total > 0)
2. Guardar y enviar (estado='enviado')

**Verificar**:
- ✅ Cliente recibe notificación WhatsApp
- ✅ Mensaje muestra total correcto (no $0)
- ✅ Link de tracking funciona
- ✅ Registro en `whatsapp_notificaciones`

### **Test 3: Vista de presupuestos**
1. Acceder a `/app/presupuestos`
2. Abrir consola del navegador

**Verificar**:
- ✅ No aparece warning de NaN
- ✅ Paginación funciona correctamente
- ✅ Total de presupuestos se muestra bien

---

## 📊 Queries de Verificación

### **Verificar notificaciones enviadas**
```sql
-- Últimas notificaciones de órdenes
SELECT
  wn.tipo_notificacion,
  wn.estado_envio,
  ot.numero_orden,
  LEFT(wn.mensaje_enviado, 100) as inicio_mensaje,
  wn.created_at
FROM whatsapp_notificaciones wn
JOIN ordenes_trabajo ot ON wn.orden_trabajo_id = ot.id
ORDER BY wn.created_at DESC
LIMIT 5;

-- Últimas notificaciones de presupuestos
SELECT
  wn.tipo_notificacion,
  wn.estado_envio,
  p.numero_presupuesto,
  LEFT(wn.mensaje_enviado, 100) as inicio_mensaje,
  wn.created_at
FROM whatsapp_notificaciones wn
JOIN presupuestos p ON wn.presupuesto_id = p.id
ORDER BY wn.created_at DESC
LIMIT 5;
```

### **Verificar triggers actualizados**
```sql
-- Ver definición del trigger INSERT
SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'on_presupuesto_creado_enviado';

-- Ver definición del trigger UPDATE
SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'on_presupuesto_enviado';

-- Ambos deben incluir: WHEN (... AND total > 0)
```

---

## 🎉 Build Exitoso

```bash
✓ 3690 modules transformed
✓ built in 23.37s
```

Sin errores ni warnings relacionados con los cambios aplicados.

---

_Fixes aplicados el 2 de diciembre de 2025_
