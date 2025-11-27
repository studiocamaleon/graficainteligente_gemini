# 🧪 Guía de Testing: Notificaciones WhatsApp para Órdenes de Copiado

## 📋 Preparación Inicial

### 1. Verificar Configuración de WhatsApp

Asegurarse que la empresa tiene WhatsApp configurado:

```sql
SELECT
  id,
  name,
  whatsapp_instance_name,
  whatsapp_backend_url
FROM companies
WHERE id = 'TU_COMPANY_ID';
```

**Requisitos:**
- ✅ `whatsapp_instance_name` debe tener un valor
- ✅ `whatsapp_backend_url` debe apuntar a backend válido

---

### 2. Verificar Cliente con WhatsApp

```sql
SELECT
  id,
  nombre_fantasia,
  whatsapp
FROM clients
WHERE company_id = 'TU_COMPANY_ID'
  AND whatsapp IS NOT NULL
LIMIT 1;
```

Si no hay clientes con WhatsApp, crear uno con formato: `54911XXXXXXXX`

---

### 3. Configurar Centro de Copiado

#### 3.1 Agregar Tamaños de Papel

Ir a: **Centro Copiado → Configuración → Tamaños**

Agregar al menos:
- A4 (210mm x 297mm)
- Oficio (216mm x 330mm)

#### 3.2 Agregar Materiales de Papel

Primero verificar materiales existentes:

```sql
SELECT id, nombre
FROM materiales
WHERE company_id = 'TU_COMPANY_ID';
```

Si no hay, crear en: **Configuración → Materiales**

Ejemplos:
- Obra (con variantes: 70gr, 75gr, 80gr)
- Bond (con variantes: 75gr, 80gr, 90gr)

#### 3.3 Agregar Papeles al Centro de Copiado

Ir a: **Centro Copiado → Configuración → Tipos de Papel**

Asociar materiales con variantes:
- Obra 75gr
- Bond 80gr
- etc.

---

## 🧪 Test 1: Verificar Schema y Configuración

### Ejecutar Script de Verificación

```bash
npx tsx scripts/verify-copiado-schema.ts
```

**Resultado esperado:**
```
✅ Query de papeles exitosa!
   Papeles encontrados: 2

📄 Ejemplos de papeles:
   1. Obra 75gr
      Material: Obra

   2. Bond 80gr
      Material: Bond

✅ Query de tamaños exitosa!
   Tamaños encontrados: 2

📏 Tamaños disponibles:
   - A4
   - Oficio
```

Si muestra "0 papeles" o "0 tamaños", completar paso 3 primero.

---

## 🧪 Test 2: Crear Orden y Verificar Mensaje

### Paso a Paso

#### 2.1 Crear Nueva Orden

1. **Ir a:** Centro Copiado → Crear Orden

2. **Seleccionar:**
   - Cliente con WhatsApp configurado
   - Fecha de entrega (mañana o pasado)

3. **Agregar Item:**
   - Tamaño: A4
   - Papel: Obra 75gr
   - Tinta: Color
   - Caras: Doble faz
   - Hojas: 50
   - Copias: 3
   - Anillado: Ring Wire (opcional)

4. **Guardar Orden**

#### 2.2 Verificar en Consola del Navegador

**Logs esperados:**
```
[WhatsApp] Preparando envío: { tipo: "nueva_orden_copiado", longitudMensaje: 450 }
[WhatsApp] Respuesta del backend: { success: true, messageId: "..." }
Notificación enviada exitosamente
```

**Si hay error:**
```
❌ Error en query: { message: "...", details: "..." }
```

Copiar el error completo para debugging.

#### 2.3 Verificar en Base de Datos

```sql
SELECT
  tipo_notificacion,
  estado_envio,
  LEFT(mensaje_enviado, 300) as mensaje,
  telefono_destino,
  error_mensaje,
  created_at
FROM whatsapp_notificaciones
WHERE tipo_notificacion = 'nueva_orden_copiado'
ORDER BY created_at DESC
LIMIT 1;
```

**Estado esperado:**
- `estado_envio`: `'enviado'`
- `mensaje_enviado`: Debe contener detalles completos
- `error_mensaje`: NULL

#### 2.4 Verificar Mensaje en WhatsApp

El cliente debe recibir:

```
Hola [Cliente]!

Tu orden de copiado ha sido registrada.

📋 *Orden Nº:* OC-XXXX
📅 *Fecha de entrega:* DD/MM/YYYY

*Detalle de tu pedido:*

1. 🖨️ *Impresión Color*
   3x 50 hojas Doble faz
   A4 - Obra Obra 75gr
   $XXX.XX c/u = $XXX.XX
   + Anillado Ring Wire

💰 *Total:* $XXX.XX
💳 *Saldo pendiente:* $XXX.XX

📍 *[Nombre Empresa]*
[Dirección]
📞 [Teléfono]

Gracias por confiar en nosotros!
```

---

## 🧪 Test 3: Verificar con Orden Existente

Si ya existe una orden de copiado:

```bash
npx tsx scripts/test-query-copiado.ts
```

**Resultado esperado:**
```
📋 Testeando con orden: OC-0001

✅ Query ejecutada exitosamente!

📦 Datos de la orden:
   - Número: OC-0001
   - Estado: pendiente
   - Total: $450.00
   - Items: 1

📄 Detalles de items:
   Item 1:
   - Cantidad unidades: 3
   - Cantidad hojas: 50
   - Tipo tinta: CMYK
   - Tamaño papel: A4
   - Material papel: Obra
   - Variante papel: Obra 75gr

🖨️ Mensaje formateado:
────────────────────────────────────────
1. 🖨️ *Impresión Color*
   3x 50 hojas Doble faz
   A4 - Obra Obra 75gr
   $150.00 c/u = $450.00
────────────────────────────────────────
```

---

## 🐛 Debugging: Problemas Comunes

### Error: "column centro_copiado_papeles.nombre does not exist"

❌ **Causa:** Versión antigua del código

✅ **Solución:**
```bash
git pull origin main
npm run build
```

---

### Error: "No se pudo obtener información de la orden"

❌ **Causa:** RLS (Row Level Security) bloqueando acceso

✅ **Verificar:**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies
WHERE tablename = 'centro_copiado_ordenes';

-- Verificar que el usuario tiene company_id
SELECT id, email, company_id
FROM profiles
WHERE id = auth.uid();
```

---

### Mensaje Vacío o Incompleto

❌ **Causa:** Items sin relaciones cargadas

✅ **Verificar query en consola:**

Buscar en DevTools → Network → API calls:

```
GET /rest/v1/centro_copiado_ordenes?select=...
```

Debe incluir:
```
items:centro_copiado_ordenes_items(
  *,
  tamanio_papel:centro_copiado_tamanios_papel(nombre),
  papel:centro_copiado_papeles(
    variante_nombre,
    material:material_id(nombre)
  )
)
```

---

### WhatsApp No Conectado

❌ **Causa:** Backend de WhatsApp desconectado

✅ **Verificar:**
```typescript
// En consola del navegador
const status = await fetch(
  `${BACKEND_URL}/api/${INSTANCE_NAME}/status`
);
console.log(await status.json());
```

Debe retornar: `{ connected: true }`

---

## 📊 Métricas de Éxito

Después de implementación, verificar:

### Tasa de Envío
```sql
SELECT
  COUNT(*) FILTER (WHERE estado_envio = 'enviado') as enviados,
  COUNT(*) FILTER (WHERE estado_envio = 'fallido') as fallidos,
  ROUND(
    COUNT(*) FILTER (WHERE estado_envio = 'enviado')::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as tasa_exito
FROM whatsapp_notificaciones
WHERE tipo_notificacion = 'nueva_orden_copiado'
  AND created_at > NOW() - INTERVAL '7 days';
```

**Meta:** Tasa de éxito > 95%

### Tiempo de Respuesta
```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as segundos_promedio
FROM whatsapp_notificaciones
WHERE tipo_notificacion = 'nueva_orden_copiado'
  AND estado_envio = 'enviado'
  AND created_at > NOW() - INTERVAL '7 days';
```

**Meta:** < 5 segundos

---

## 📝 Checklist Final

Antes de dar OK a producción:

- [ ] ✅ Schema verificado con `verify-copiado-schema.ts`
- [ ] ✅ Orden de prueba creada exitosamente
- [ ] ✅ Mensaje recibido en WhatsApp del cliente
- [ ] ✅ Registro en `whatsapp_notificaciones` con estado 'enviado'
- [ ] ✅ Mensaje contiene todos los detalles:
  - [ ] Número de orden
  - [ ] Fecha de entrega
  - [ ] Tamaño de papel
  - [ ] Material de papel
  - [ ] Tintas y caras
  - [ ] Cantidades correctas
  - [ ] Precios correctos
  - [ ] Anillado/plastificado (si aplica)
- [ ] ✅ Sin errores en consola del navegador
- [ ] ✅ Build exitoso
- [ ] ✅ Tasa de éxito > 95% en última semana

---

## 🎉 Resultado Esperado

**Sistema completamente funcional:**
- ✅ Notificaciones enviadas automáticamente
- ✅ Mensajes completos y profesionales
- ✅ Sin errores 400
- ✅ Trazabilidad en base de datos
- ✅ Fácil de debuggear

---

_Última actualización: 27/11/2024_
_Versión: 2.0 (Query corregida)_
