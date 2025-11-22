# Instrucciones para Crear Storage Buckets en Supabase

## IMPORTANTE: Pasos Obligatorios

Los storage buckets deben crearse manualmente antes de que el sistema de archivos funcione.

## Opción 1: Crear Buckets desde Supabase Dashboard (Recomendado)

### Paso 1: Acceder a Storage

1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar tu proyecto
3. En el menú lateral, hacer clic en "Storage"

### Paso 2: Crear Bucket para Archivos de Cliente

1. Hacer clic en "New bucket"
2. Configurar:
   - **Name:** `orden-trabajo-archivos`
   - **Public:** Deshabilitado (debe estar privado)
   - **File size limit:** 524288000 (500 MB en bytes)
   - **Allowed MIME types:** Dejar vacío o agregar los siguientes separados por coma:
     ```
     application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.adobe.illustrator,application/postscript,image/vnd.adobe.photoshop,image/jpeg,image/png,image/tiff,image/gif,image/bmp,image/webp,image/svg+xml,application/zip,application/x-rar-compressed,application/x-7z-compressed,text/plain,text/csv,application/octet-stream
     ```
3. Hacer clic en "Create bucket"

### Paso 3: Configurar Políticas RLS para Bucket de Archivos de Cliente

1. Hacer clic en el bucket recién creado
2. Ir a la pestaña "Policies"
3. Hacer clic en "New policy"

**Política 1: SELECT (Ver archivos)**
- Policy name: `Users can view files from their company`
- Policy command: `SELECT`
- Target roles: `authenticated`
- USING expression:
```sql
(bucket_id = 'orden-trabajo-archivos'::text) AND (
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
)
```

**Política 2: INSERT (Subir archivos)**
- Policy name: `Users can upload files for their company`
- Policy command: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression:
```sql
(bucket_id = 'orden-trabajo-archivos'::text) AND (
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
)
```

**Política 3: DELETE (Eliminar archivos)**
- Policy name: `Users can delete files from their company`
- Policy command: `DELETE`
- Target roles: `authenticated`
- USING expression:
```sql
(bucket_id = 'orden-trabajo-archivos'::text) AND (
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
)
```

### Paso 4: Crear Bucket para Archivos de Producción

1. Hacer clic en "New bucket" nuevamente
2. Configurar:
   - **Name:** `orden-produccion-archivos`
   - **Public:** Deshabilitado (debe estar privado)
   - **File size limit:** 524288000 (500 MB en bytes)
   - **Allowed MIME types:** Dejar vacío o agregar:
     ```
     application/pdf,application/vnd.adobe.illustrator,application/postscript,image/vnd.adobe.photoshop,image/jpeg,image/png,image/tiff,image/svg+xml,application/zip,application/x-rar-compressed,application/octet-stream
     ```
3. Hacer clic en "Create bucket"

### Paso 5: Configurar Políticas RLS para Bucket de Archivos de Producción

Repetir el proceso del Paso 3, pero cambiar:
- `bucket_id = 'orden-produccion-archivos'::text`
- En la política INSERT, agregar validación de role:

**Política INSERT mejorada para Producción:**
```sql
(bucket_id = 'orden-produccion-archivos'::text) AND (
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
) AND (
  auth.uid() IN (
    SELECT id FROM profiles
    WHERE role IN ('operator', 'admin', 'super_admin')
  )
)
```

## Opción 2: Crear Buckets Programáticamente (Avanzado)

Si prefieres crear los buckets mediante código, puedes usar la Supabase Management API o ejecutar SQL directamente.

### Usando SQL en el SQL Editor de Supabase:

```sql
-- Crear bucket de archivos de cliente
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'orden-trabajo-archivos',
  'orden-trabajo-archivos',
  false,
  524288000
);

-- Crear bucket de archivos de producción
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'orden-produccion-archivos',
  'orden-produccion-archivos',
  false,
  524288000
);
```

Luego agregar las políticas usando el Dashboard (Paso 3 y 5 arriba).

## Verificación

Para verificar que los buckets se crearon correctamente:

1. Ve a Storage en el Dashboard
2. Deberías ver dos buckets:
   - `orden-trabajo-archivos`
   - `orden-produccion-archivos`
3. Ambos deben estar marcados como "Private"
4. Cada uno debe tener 3 políticas configuradas (SELECT, INSERT, DELETE)

## Prueba

Para probar que todo funciona:

1. Ir a una orden de trabajo en la aplicación
2. Hacer clic en el tab "Archivos"
3. Intentar subir un archivo pequeño (ej: un PDF de 1MB)
4. Si funciona correctamente, el bucket está configurado
5. Repetir para el tab "Archivos de Producción"

## Solución de Problemas

### Error: "Bucket not found"
- Verificar que los buckets existen en Storage
- Verificar que los nombres son exactos: `orden-trabajo-archivos` y `orden-produccion-archivos`

### Error: "Permission denied"
- Verificar que las políticas RLS están creadas
- Verificar que las expresiones SQL son correctas
- Verificar que el usuario está autenticado

### Error: "File size exceeds limit"
- Verificar que el archivo es menor a 500MB
- Verificar que el límite del bucket es 524288000 bytes

### Error: "MIME type not allowed"
- Agregar el tipo MIME del archivo a la lista permitida
- O dejar la lista vacía para permitir todos los tipos

## Próximos Pasos

Una vez creados y configurados los buckets:

1. ✅ Los usuarios podrán subir archivos en las órdenes
2. ✅ Los archivos se almacenarán de forma segura
3. ✅ Solo usuarios de la misma empresa podrán acceder
4. ⏳ Implementar Edge Function para limpieza automática (opcional)
5. ⏳ Configurar notificaciones por email (opcional)

## Notas Adicionales

- Los buckets son privados por defecto
- Las URLs de descarga son firmadas y expiran en 1 hora
- Los archivos se organizan por: `{company_id}/{orden_id}/{archivo}`
- El sistema valida permisos tanto en frontend como backend
- Los límites de almacenamiento se validan en el trigger de base de datos

## Contacto

Si tienes problemas configurando los buckets, revisa:
- [Documentación oficial de Supabase Storage](https://supabase.com/docs/guides/storage)
- [Documentación de RLS en Storage](https://supabase.com/docs/guides/storage/security/access-control)
