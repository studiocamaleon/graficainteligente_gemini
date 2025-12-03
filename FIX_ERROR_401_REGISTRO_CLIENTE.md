# ✅ FIX: Error 401 en Registro de Cliente

## 🐛 Problema

Al intentar registrar un cliente desde el formulario público, se producía el siguiente error:

```
POST https://sovqpafggvcbzrvbkegi.supabase.co/functions/v1/auto-registro-cliente
401 (Unauthorized)
```

---

## 🔍 Causa Raíz

El hook `useClienteRegistro` no estaba enviando el header de **Authorization** requerido por las Edge Functions de Supabase.

### Código Original (INCORRECTO):

**Archivo:** `src/hooks/useClienteRegistro.ts` (líneas 35-44)

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // ❌ Faltaba el header Authorization
  },
  body: JSON.stringify({
    ...data,
    frontend_origin: window.location.origin,
  }),
});
```

---

## ✅ Solución

Se agregó el header de **Authorization** con el token `ANON_KEY` de Supabase.

### Código Corregido:

**Archivo:** `src/hooks/useClienteRegistro.ts` (líneas 35-45)

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // ✅ Agregado
  },
  body: JSON.stringify({
    ...data,
    frontend_origin: window.location.origin,
  }),
});
```

---

## 📝 Explicación Técnica

### ¿Por qué se requiere Authorization?

Todas las llamadas a **Edge Functions de Supabase** requieren autenticación, incluso las funciones públicas. La diferencia está en qué clave se utiliza:

| Tipo de Clave | Uso | Dónde |
|---------------|-----|-------|
| **ANON_KEY** | Operaciones públicas desde el frontend | Cliente (browser) |
| **SERVICE_ROLE_KEY** | Operaciones administrativas | Edge Functions (servidor) |

### Flujo Correcto:

```
Frontend (useClienteRegistro)
    │
    ├─→ Incluye: Authorization: Bearer ANON_KEY
    │
    ↓
Edge Function (auto-registro-cliente)
    │
    ├─→ Valida: ANON_KEY
    ├─→ Usa: SERVICE_ROLE_KEY internamente
    │
    ↓
Base de Datos (Supabase)
    │
    └─→ Crea cliente con status='pending'
```

---

## 🎯 Archivos Modificados

### 1. `src/hooks/useClienteRegistro.ts`

**Cambio:** Agregado header `Authorization` en línea 39

**Líneas afectadas:** 35-45

**Diff:**
```diff
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
+     'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      ...data,
      frontend_origin: window.location.origin,
    }),
  });
```

---

## 🧪 Testing

### Verificación del Fix:

1. **Build exitoso:**
   ```bash
   npm run build
   ```
   ✅ Compiló sin errores

2. **Probar registro:**
   - Ir a `/registro/:companyId`
   - Completar formulario con datos válidos
   - Submit
   - ✅ Debe registrar sin error 401

3. **Verificar en Base de Datos:**
   ```sql
   SELECT
     nombre_fantasia,
     status_aprobacion,
     fecha_registro
   FROM clients
   ORDER BY fecha_registro DESC
   LIMIT 1;
   ```
   ✅ Debe mostrar el nuevo cliente con `status_aprobacion = 'pending'`

---

## 📊 Comparación con Otros Hooks

Este fix alinea `useClienteRegistro` con los otros hooks del sistema que ya implementaban correctamente la autorización:

### ✅ useClienteAprobacion (CORRECTO desde el inicio):

```typescript
// Línea 56
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // ✅
  },
  body: JSON.stringify({ cliente_id: clienteId }),
});
```

### ❌ useClienteRegistro (INCORRECTO antes del fix):

```typescript
// Línea 35-39
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // ❌ Faltaba Authorization
  },
  body: JSON.stringify({ ...data }),
});
```

### ✅ useClienteRegistro (CORRECTO después del fix):

```typescript
// Línea 35-40
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // ✅
  },
  body: JSON.stringify({ ...data }),
});
```

---

## 🔐 Seguridad

### ¿Es seguro usar ANON_KEY en el frontend?

**Sí**, es completamente seguro porque:

1. **ANON_KEY** está diseñada para uso público
2. Las **RLS Policies** de Supabase protegen los datos
3. La edge function usa **SERVICE_ROLE_KEY** internamente para operaciones privilegiadas
4. El cliente solo puede ejecutar operaciones permitidas por las RLS

### Flujo de Seguridad:

```
1. Cliente envía: Authorization: Bearer ANON_KEY
   ↓
2. Supabase valida el token
   ↓
3. Edge function se ejecuta con permisos públicos
   ↓
4. Edge function usa SERVICE_ROLE_KEY para bypass RLS cuando necesario
   ↓
5. RLS protege que solo se accedan datos permitidos
```

---

## 📚 Referencias

### Variables de Entorno (.env):

```env
VITE_SUPABASE_URL=https://sovqpafggvcbzrvbkegi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Documentación Supabase:

- [Edge Functions Authentication](https://supabase.com/docs/guides/functions/auth)
- [Invoking Edge Functions](https://supabase.com/docs/guides/functions/invoke)
- [Client Libraries](https://supabase.com/docs/reference/javascript/invoking-functions)

---

## ✅ Estado del Fix

| Item | Estado |
|------|--------|
| Problema identificado | ✅ |
| Causa raíz encontrada | ✅ |
| Solución implementada | ✅ |
| Build exitoso | ✅ |
| Documentación creada | ✅ |
| Testing manual | ⏳ Pendiente |

---

## 🎯 Próximos Pasos

1. **Testing Manual:**
   - Probar registro desde formulario público
   - Verificar que no haya error 401
   - Confirmar creación en base de datos

2. **Testing de Notificaciones:**
   - Verificar que se envíe WhatsApp al cliente
   - Confirmar registro en tabla `whatsapp_notificaciones`

3. **Testing de Admin:**
   - Verificar que aparezca en pendientes
   - Probar aprobación/rechazo

---

## 💡 Lección Aprendida

**Todas las llamadas a Edge Functions de Supabase requieren el header Authorization**, incluso para funciones públicas.

### Checklist para futuras Edge Functions:

- [ ] Incluir header `Content-Type`
- [ ] Incluir header `Authorization` con ANON_KEY o SERVICE_ROLE_KEY
- [ ] Configurar CORS en la edge function
- [ ] Validar permisos con RLS

---

## 🐛 Errores Comunes Relacionados

### Error 401: Unauthorized
**Causa:** Falta header Authorization
**Solución:** Agregar `Authorization: Bearer ${ANON_KEY}`

### Error 403: Forbidden
**Causa:** Token válido pero sin permisos
**Solución:** Revisar RLS policies

### Error 404: Not Found
**Causa:** URL incorrecta o función no deployada
**Solución:** Verificar deployment de edge function

### Error 500: Internal Server Error
**Causa:** Error en la lógica de la edge function
**Solución:** Revisar logs de la edge function

---

**Fix aplicado:** 2025-12-03
**Autor:** Claude
**Archivo modificado:** `src/hooks/useClienteRegistro.ts`
**Línea modificada:** 39
**Estado:** ✅ Resuelto
