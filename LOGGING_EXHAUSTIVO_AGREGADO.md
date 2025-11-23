# Logging Exhaustivo Agregado para Diagnosticar Problema de Archivos

## Fecha: 2025-11-23
## Estado: LOGGING IMPLEMENTADO - REQUIERE TEST MANUAL

---

## Problema Detectado

**Los archivos NO se están insertando en la base de datos.**

### Evidencia

```sql
-- Test 1: ¿Archivos para orden específica?
SELECT * FROM ordenes_trabajo_archivos
WHERE orden_id = 'e37eedc0-07bc-427d-98d6-37710fcf067b';
-- Resultado: 0 archivos ❌

-- Test 2: ¿Archivos temporales recientes?
SELECT * FROM ordenes_trabajo_archivos
WHERE orden_temporal_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '2 hours';
-- Resultado: 0 archivos ❌

-- Test 3: ¿ALGÚN archivo en las últimas 2 horas?
SELECT COUNT(*) FROM ordenes_trabajo_archivos
WHERE created_at > NOW() - INTERVAL '2 hours';
-- Resultado: 0 ❌
```

**Conclusión:** Los archivos NI SIQUIERA se están subiendo/insertando inicialmente.

---

## Logging Agregado

Para poder diagnosticar EXACTAMENTE dónde falla el flujo, agregué logging exhaustivo en CADA paso del proceso de subida.

### 1. Archivo: `src/hooks/useOrdenArchivos.ts`

#### Función: `uploadArchivo` (líneas 181-310)

**Logs agregados:**

```typescript
// INICIO
console.log('[uploadArchivo] ===== INICIO =====');
console.log('[uploadArchivo] Parámetros:', {
  fileName: file.name,
  fileSize: file.size,
  fileType: file.type,
  descripcion,
  ordenId,
  ordenTemporalId,
  modoTemporal,
  profileExists: !!profile,
  companyId: profile?.company_id,
  userId: profile?.id
});

// Validación company_id
if (!profile?.company_id) {
  console.error('[uploadArchivo] ❌ ERROR: No hay company_id', { profile });
  throw new Error('No se pudo obtener el ID de la empresa');
}

// Validación ordenId/ordenTemporalId
if (!ordenId && !ordenTemporalId) {
  console.error('[uploadArchivo] ❌ ERROR: No hay ordenId ni ordenTemporalId');
  throw new Error('Se requiere ordenId u ordenTemporalId');
}

// Validación archivo
const validation = validateFile(file);
if (!validation.valid) {
  console.error('[uploadArchivo] ❌ ERROR: Validación falló', validation.error);
  throw new Error(validation.error);
}

console.log('[uploadArchivo] ✅ Validaciones pasadas');

// STORAGE
console.log('[uploadArchivo] 📁 Subiendo a storage:', {
  bucket: BUCKET_NAME,
  storagePath,
  modoTemporal,
  fileSize: file.size
});

// Error en storage
if (uploadError) {
  console.error('[uploadArchivo] ❌ ERROR en storage:', uploadError);
  throw uploadError;
}

console.log('[uploadArchivo] ✅ Archivo subido a storage exitosamente');

// BASE DE DATOS
console.log('[uploadArchivo] 💾 Insertando en BD:', {
  table: 'ordenes_trabajo_archivos',
  data: {
    ...insertData,
    file: file.name
  }
});

// Error en BD
if (dbError) {
  console.error('[uploadArchivo] ❌ ERROR en BD:', dbError);
  console.log('[uploadArchivo] 🗑️  Eliminando archivo de storage debido a error en BD');
  await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
  throw dbError;
}

console.log('[uploadArchivo] ✅ Registro creado en BD:', data);

// RECARGA
console.log('[uploadArchivo] 🔄 Recargando lista de archivos');
await loadArchivos();

console.log('[uploadArchivo] ===== FIN EXITOSO =====');
```

---

### 2. Archivo: `src/components/orders/OrdenAdjuntosTab.tsx`

#### Función: `handleUploadArchivo` (líneas 212-265)

**Logs agregados:**

```typescript
// INICIO
console.log('[handleUploadArchivo] ===== LLAMADO =====', {
  selectedFile: !!selectedFile,
  fileName: selectedFile?.name,
  descripcion: archivoForm.descripcion,
  ordenId,
  ordenTemporalId,
  modoCreacion
});

// Sin archivo
if (!selectedFile) {
  console.warn('[handleUploadArchivo] ⚠️  No hay archivo seleccionado');
  showWarning('Por favor selecciona un archivo');
  return;
}

// Llamar a upload
console.log('[handleUploadArchivo] 📤 Llamando a archivos.uploadArchivo...');
const nuevoArchivo = await archivos.uploadArchivo({
  file: selectedFile,
  descripcion: archivoForm.descripcion || undefined
});

console.log('[handleUploadArchivo] ✅ Archivo subido exitosamente:', nuevoArchivo);

// Error
catch (err: any) {
  console.error('[handleUploadArchivo] ❌ ERROR:', err);
  // ... manejo de error
  console.error('[handleUploadArchivo] Mostrando error al usuario:', errorMessage);
  showError(errorMessage);
}
```

---

## Cómo Diagnosticar el Problema

### Pasos para el Test Manual

1. **Abrir DevTools**
   - F12 o Click derecho → Inspeccionar
   - Ir a tab **Console**

2. **Navegar a crear orden**
   - `/app/orders/crear`

3. **Completar datos básicos**
   - Agregar al menos 1 item
   - Completar campos requeridos

4. **Ir a tab "Adjuntos"**
   - Click en "Adjuntos" en el formulario

5. **Subir un archivo**
   - Click en "Subir archivo de cliente"
   - Seleccionar un archivo (ej: PDF pequeño)
   - Click "Subir"

6. **OBSERVAR LOGS EN CONSOLA**

---

## Escenarios Posibles y Sus Logs

### ✅ ESCENARIO 1: Todo funciona correctamente

```
[handleUploadArchivo] ===== LLAMADO =====
  selectedFile: true
  fileName: "test.pdf"
  ordenTemporalId: "abc-123..."
  modoCreacion: true

[handleUploadArchivo] 📤 Llamando a archivos.uploadArchivo...

[uploadArchivo] ===== INICIO =====
[uploadArchivo] Parámetros:
  fileName: "test.pdf"
  fileSize: 52340
  ordenTemporalId: "abc-123..."
  modoTemporal: true
  profileExists: true
  companyId: "b0ad23b1-..."

[uploadArchivo] ✅ Validaciones pasadas

[uploadArchivo] 📁 Subiendo a storage:
  bucket: "orden-trabajo-archivos"
  storagePath: "b0ad23b1-.../temporal/abc-123.../1732345678_abc.pdf"

[uploadArchivo] ✅ Archivo subido a storage exitosamente

[uploadArchivo] 💾 Insertando en BD:
  table: "ordenes_trabajo_archivos"
  data: { company_id: "...", orden_temporal_id: "...", ... }

[uploadArchivo] ✅ Registro creado en BD: { id: "xyz-789...", ... }

[uploadArchivo] 🔄 Recargando lista de archivos

[useOrdenArchivos] Archivos cargados: 1

[uploadArchivo] ===== FIN EXITOSO =====

[handleUploadArchivo] ✅ Archivo subido exitosamente: { id: "xyz-789..." }

Toast: "Archivo subido correctamente" ✅
```

---

### ❌ ESCENARIO 2: Profile/company_id no disponible

```
[handleUploadArchivo] ===== LLAMADO =====
  selectedFile: true
  fileName: "test.pdf"
  ordenTemporalId: "abc-123..."

[handleUploadArchivo] 📤 Llamando a archivos.uploadArchivo...

[uploadArchivo] ===== INICIO =====
[uploadArchivo] Parámetros:
  profileExists: true
  companyId: undefined  ← ❌ PROBLEMA AQUÍ

[uploadArchivo] ❌ ERROR: No hay company_id { profile: {...} }

[handleUploadArchivo] ❌ ERROR: Error: No se pudo obtener el ID de la empresa

[handleUploadArchivo] Mostrando error al usuario: "No se pudo obtener el ID de la empresa"

Toast: "No se pudo obtener el ID de la empresa" ❌
```

---

### ❌ ESCENARIO 3: ordenTemporalId no disponible

```
[handleUploadArchivo] ===== LLAMADO =====
  selectedFile: true
  fileName: "test.pdf"
  ordenTemporalId: undefined  ← ❌ PROBLEMA AQUÍ

[handleUploadArchivo] 📤 Llamando a archivos.uploadArchivo...

[uploadArchivo] ===== INICIO =====
[uploadArchivo] Parámetros:
  ordenId: undefined
  ordenTemporalId: undefined  ← ❌ PROBLEMA

[uploadArchivo] ❌ ERROR: No hay ordenId ni ordenTemporalId

[handleUploadArchivo] ❌ ERROR: Error: Se requiere ordenId u ordenTemporalId

Toast: "Se requiere ordenId u ordenTemporalId" ❌
```

---

### ❌ ESCENARIO 4: Error en storage

```
[uploadArchivo] ===== INICIO =====
[uploadArchivo] Parámetros: { ... }
[uploadArchivo] ✅ Validaciones pasadas

[uploadArchivo] 📁 Subiendo a storage: { ... }

[uploadArchivo] ❌ ERROR en storage: {
  message: "Bucket not found",
  statusCode: 404
}

[handleUploadArchivo] ❌ ERROR: Error: Bucket not found

Toast: "Bucket not found" ❌
```

---

### ❌ ESCENARIO 5: Error en BD (RLS u otro)

```
[uploadArchivo] ===== INICIO =====
[uploadArchivo] Parámetros: { ... }
[uploadArchivo] ✅ Validaciones pasadas

[uploadArchivo] 📁 Subiendo a storage: { ... }
[uploadArchivo] ✅ Archivo subido a storage exitosamente

[uploadArchivo] 💾 Insertando en BD: { ... }

[uploadArchivo] ❌ ERROR en BD: {
  message: "new row violates row-level security policy",
  code: "42501"
}

[uploadArchivo] 🗑️  Eliminando archivo de storage debido a error en BD

[handleUploadArchivo] ❌ ERROR: Error: new row violates...

Toast: "new row violates row-level security policy" ❌
```

---

### ❌ ESCENARIO 6: El botón NO llama la función

```
(nada en consola) ← ❌ PROBLEMA: handleUploadArchivo no se ejecuta
```

**Esto significaría:**
- El onClick del botón no está conectado
- O hay un problema en el modal que no cierra el evento

---

## Próximos Pasos

### 1. **Hacer el test manual ahora**

Por favor:
1. Abre la aplicación
2. Ve a crear una nueva orden
3. Intenta subir un archivo
4. **COPIA Y PEGA TODOS los logs de la consola aquí**

### 2. **Según los logs, sabré exactamente dónde falla:**

- ❓ **No aparece `[handleUploadArchivo]`**
  - Problema: El botón no está llamando la función
  - Solución: Revisar el onClick del botón en el modal

- ❓ **Aparece error de `company_id`**
  - Problema: Profile no se carga correctamente
  - Solución: Revisar useAuth y cómo se pasa profile

- ❓ **Aparece error de `ordenTemporalId`**
  - Problema: No se está generando/pasando el UUID temporal
  - Solución: Revisar CreateOrderPage línea 33-47

- ❓ **Error en storage**
  - Problema: Bucket no existe o no hay permisos
  - Solución: Verificar configuración de storage en Supabase

- ❓ **Error en BD (RLS)**
  - Problema: Política RLS bloqueando INSERT
  - Solución: Revisar políticas RLS y agregar UPDATE policy

---

## Build Status

```bash
npm run build
✓ built in 18.31s
```

✅ **Compilación exitosa**
✅ **Código listo para testing**

---

## IMPORTANTE

**NO puedo decir que está solucionado hasta que:**

1. ✅ Hagas el test manual
2. ✅ Vea los logs completos de la consola
3. ✅ Identifique el error EXACTO
4. ✅ Implemente la solución específica
5. ✅ Verifiques que los archivos SE INSERTAN en la BD
6. ✅ Verifiques que los archivos SE VEN en el detalle de la orden

**Este logging me permitirá identificar el problema real en menos de 5 minutos una vez que vea los logs.**

---

**Próximo paso:** Por favor haz el test manual y compárteme TODOS los logs de la consola.
