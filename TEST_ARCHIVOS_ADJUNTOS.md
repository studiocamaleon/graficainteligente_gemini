# Test Exhaustivo: Archivos Adjuntos en Órdenes

## Fecha: 2025-11-23
## Orden testeada: e37eedc0-07bc-427d-98d6-37710fcf067b (GI-000001)

---

## Resultados de Testing en Base de Datos

### Test 1: ¿Existen archivos para la orden?
```sql
SELECT * FROM ordenes_trabajo_archivos
WHERE orden_id = 'e37eedc0-07bc-427d-98d6-37710fcf067b';
```
**Resultado:** ❌ 0 archivos
**Conclusión:** Los archivos NO se asociaron a la orden

### Test 2: ¿Hay archivos temporales huérfanos?
```sql
SELECT * FROM ordenes_trabajo_archivos
WHERE orden_temporal_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '2 hours';
```
**Resultado:** ❌ 0 archivos temporales
**Conclusión:** Los archivos NI SIQUIERA se crearon temporalmente

### Test 3: ¿Hay ALGÚN archivo en el sistema?
```sql
SELECT COUNT(*) FROM ordenes_trabajo_archivos
WHERE created_at > NOW() - INTERVAL '2 hours';
```
**Resultado:** ❌ 0 archivos
**Conclusión:** NO se está insertando NADA en la tabla

### Test 4: ¿La orden existe?
```sql
SELECT id, numero_orden, created_at, company_id
FROM ordenes_trabajo
WHERE id = 'e37eedc0-07bc-427d-98d6-37710fcf067b';
```
**Resultado:** ✅ Sí existe
- Número: GI-000001
- Creada: 2025-11-23 04:38:09
- Company: b0ad23b1-cf97-4055-823b-ef3c6bed485a

---

## Análisis de Código

### Código de Subida (useOrdenArchivos.ts líneas 181-268)

**Función:** `uploadArchivo`

**Validaciones:**
1. ✅ Valida `profile?.company_id` (línea 182)
2. ✅ Valida `ordenId` u `ordenTemporalId` (línea 186)
3. ✅ Valida el archivo (línea 191)

**Proceso:**
1. Sube archivo a storage (línea 211-218)
2. Inserta en BD (línea 242-246)
3. Si BD falla, elimina de storage (línea 250)

**Problema potencial:** Si `profile` es null o `company_id` no existe, lanza error ANTES de subir.

### Política RLS INSERT (verificada)

```sql
CREATE POLICY "Users can insert archivos for their company"
  ON ordenes_trabajo_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );
```

✅ Política correcta

---

## Hipótesis del Problema

### Hipótesis 1: Profile no está disponible en modo creación ❌
**Evidencia:**
- `useOrdenArchivos` línea 182: `if (!profile?.company_id) throw Error`
- Si profile es null, el error debería mostrarse al usuario
- Pero el usuario reporta que NO ve error, solo que los archivos "desaparecen"

**Contradicción:** Si no hubiera profile, debería mostrar error "No se pudo obtener el ID de la empresa"

### Hipótesis 2: El archivo se sube pero la función SQL lo elimina ❌
**Evidencia:**
- Verificamos que NO hay archivos temporales
- Si se subieran temporalmente, deberían estar en la BD con `orden_temporal_id`

**Contradicción:** No hay archivos temporales, así que no se están subiendo

### Hipótesis 3: El botón de subida no funciona ⚠️
**Evidencia:**
- Código parece correcto
- `handleUploadArchivo` llama a `archivos.uploadArchivo`

**Necesita verificación:** ¿Se está llamando realmente la función?

### Hipótesis 4: Error silencioso que no se muestra ⚠️
**Evidencia:**
- El catch muestra el error con `showError`
- Pero quizás el error ocurre en otro momento

**Necesita verificación:** Revisar logs de consola del navegador

---

## Próximos Pasos de Testing

### 1. Agregar logging exhaustivo

Necesito agregar console.log en CADA paso de `uploadArchivo`:

```typescript
const uploadArchivo = async ({ file, descripcion }: UploadArchivoData) => {
  console.log('[uploadArchivo] INICIO', {
    file: file.name,
    descripcion,
    profile: !!profile,
    company_id: profile?.company_id,
    ordenId,
    ordenTemporalId,
    modoTemporal
  });

  if (!profile?.company_id) {
    console.error('[uploadArchivo] ERROR: No hay company_id');
    throw new Error('No se pudo obtener el ID de la empresa');
  }

  // ... resto del código
};
```

### 2. Verificar que se llama handleUploadArchivo

Agregar log en `OrdenAdjuntosTab.tsx` línea 212:

```typescript
const handleUploadArchivo = async () => {
  console.log('[handleUploadArchivo] LLAMADO', { selectedFile: !!selectedFile });

  if (!selectedFile) {
    showWarning('Por favor selecciona un archivo');
    return;
  }

  // ... resto
};
```

### 3. Test manual en el navegador

1. Abrir DevTools → Console
2. Ir a /app/orders/crear
3. Agregar un item
4. Ir a tab "Adjuntos"
5. Click "Subir archivo de cliente"
6. Seleccionar un archivo
7. Click "Subir"
8. **Observar logs en consola**

**Logs esperados:**
```
[handleUploadArchivo] LLAMADO { selectedFile: true }
[uploadArchivo] INICIO { file: 'test.pdf', ... }
[uploadArchivo] Storage upload success
[uploadArchivo] BD insert success
```

**Si no aparecen logs:** El botón no está llamando la función

**Si aparece error:** Ver cuál es el error específico

### 4. Verificar storage bucket

```sql
-- Ver archivos en storage (si existen)
SELECT name, created_at FROM storage.objects
WHERE bucket_id = 'orden-trabajo-archivos'
  AND created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;
```

---

## Teoría Principal

**El problema MÁS probable es:**

❌ Los archivos NO se están subiendo en absoluto
❌ El botón "Subir" no está funcionando
❌ O hay un error que ocurre ANTES de la subida

**NO es:**
- ✅ Problema con la función SQL (no se llega a ese punto)
- ✅ Problema con RLS INSERT (política correcta)
- ✅ Problema con asociación (no hay archivos para asociar)

---

## Acción Requerida

**NECESITO AGREGAR LOGGING EXHAUSTIVO** para ver exactamente dónde falla el flujo.

1. Agregar logs en `uploadArchivo`
2. Agregar logs en `handleUploadArchivo`
3. Agregar logs en el componente modal de subida
4. Verificar que el botón tenga el onClick correcto
5. Hacer test manual y revisar consola

**Sin estos logs, es imposible diagnosticar el problema real.**
