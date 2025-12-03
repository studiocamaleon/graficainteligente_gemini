# Extracción Automática de Número de Factura - Completado

**Fecha:** 2025-12-03
**Estado:** ✅ Completado y Desplegado

---

## Resumen Ejecutivo

Se ha implementado exitosamente un sistema de **extracción automática del número de factura** desde archivos PDF de AFIP argentinos. El sistema utiliza una Edge Function que procesa el PDF y detecta automáticamente el número de factura, completando el campo correspondiente en el modal de registro.

**Característica clave:** El PDF siempre se guarda en Supabase Storage y se envía al cliente por WhatsApp, independientemente de si se detecta o no el número automáticamente.

---

## Implementación Realizada

### 1. ✅ Edge Function: `extract-invoice-number`

**Ubicación:** `supabase/functions/extract-invoice-number/index.ts`

**Funcionalidad:**
- Recibe un archivo PDF vía FormData desde el frontend
- Usa la librería `npm:pdf-parse@1.1.1` para extraer texto del PDF
- Busca patrones comunes de facturas AFIP argentinas
- Retorna el número de factura en formato `XXXXX-XXXXXXXX`

**Patrones de Detección:**
1. `"Punto de Venta: 00002 Comp. Nro: 00000300"` → `00002-00000300`
2. Formato directo: `"00002-00000300"`
3. `"Nro de Comprobante: 00002-00000300"`
4. `"Factura Nro: 00002-00000300"`
5. Secuencias de 5 dígitos + 8 dígitos separadas por espacio

**Características:**
- ✅ CORS configurado correctamente
- ✅ Validación de tipo de archivo (solo PDF)
- ✅ Límite de tamaño: 10MB
- ✅ Manejo robusto de errores sin bloquear el flujo
- ✅ Logs detallados para debugging
- ✅ Desplegada exitosamente en Supabase

**Respuesta:**
```typescript
// Éxito
{
  "success": true,
  "numeroFactura": "00002-00000300"
}

// No detectado
{
  "success": false,
  "error": "No se pudo detectar el número de factura en el PDF"
}
```

---

### 2. ✅ Modal de Registro Mejorado

**Archivo:** `src/components/facturas/RegistrarFacturaModal.tsx`

**Cambios Implementados:**

#### Estados Agregados:
```typescript
const [extrayendo, setExtrayendo] = useState(false);
const [numeroAutoDetectado, setNumeroAutoDetectado] = useState(false);
```

#### Nueva Función `extraerNumeroFactura`:
- Se ejecuta automáticamente al seleccionar un archivo PDF
- Crea FormData y llama a la Edge Function
- Si detecta el número, auto-completa el campo `numeroFactura`
- Si falla, no muestra error al usuario (solo logging)
- No bloquea el flujo de registro

#### Feedback Visual:
1. **Mientras extrae:**
   - Spinner con texto "Leyendo número de factura del PDF..."
   - Campo de número de factura deshabilitado

2. **Número detectado:**
   - Badge verde con ícono de checkmark
   - Texto: "Número detectado automáticamente"

3. **No detectado:**
   - Badge azul informativo
   - Texto: "Complete el número manualmente"

4. **Texto de ayuda:**
   - "El número se detecta automáticamente del PDF o puede ingresarlo manualmente"

---

## Flujo Completo del Usuario

### Paso 1: Usuario selecciona PDF
```
Usuario → Selecciona archivo PDF en el modal
       ↓
Frontend valida: tipo PDF, tamaño < 10MB
       ↓
Archivo guardado en estado: archivo = File
       ↓
Se llama automáticamente: extraerNumeroFactura(file)
```

### Paso 2: Extracción Automática
```
Frontend crea FormData con el archivo
       ↓
Llamada a Edge Function: extract-invoice-number
       ↓
Edge Function procesa PDF con pdf-parse
       ↓
Busca patrones de número de factura
       ↓
Retorna { success: true, numeroFactura: "00002-00000300" }
```

### Paso 3: Auto-completado
```
Frontend recibe respuesta exitosa
       ↓
setNumeroFactura("00002-00000300")
       ↓
setNumeroAutoDetectado(true)
       ↓
Se muestra badge verde: "Número detectado automáticamente"
```

### Paso 4: Usuario confirma o edita
```
Usuario puede:
- Dejar el número detectado
- Editarlo si es incorrecto
- Completarlo manualmente si no se detectó
       ↓
Click en "Registrar y Notificar"
```

### Paso 5: Registro y Almacenamiento
```
onSubmit llamado con: ordenId, numeroFactura, archivo, observaciones
       ↓
Hook useFacturas.registrarFactura():
       ↓
1. Sube el PDF a Supabase Storage (bucket: facturas)
2. Registra factura en BD con numero_factura y storage_path
3. Envía notificación WhatsApp al cliente con link de descarga
4. Refresca datos
```

---

## Ventajas del Sistema

### 1. No Bloquea el Proceso
- Si la extracción falla, el usuario puede ingresar el número manualmente
- No hay mensajes de error alarmantes
- El flujo de registro siempre funciona

### 2. PDF Siempre se Guarda
- El archivo PDF siempre se sube a Supabase Storage
- El cliente siempre recibe el link de descarga por WhatsApp
- La extracción es solo una ayuda, no afecta el resultado final

### 3. Experiencia de Usuario Mejorada
- Ahorra tiempo al usuario (no tiene que escribir el número)
- Feedback visual claro del estado del proceso
- Campo siempre editable para correcciones

### 4. Robusto y Tolerante a Fallos
- Manejo de errores sin afectar la funcionalidad principal
- Logs detallados para debugging
- Validaciones de seguridad (tamaño, tipo de archivo)

---

## Testing Recomendado

### Escenario 1: PDF con número válido
1. Seleccionar PDF de factura AFIP
2. Verificar que aparece el spinner "Leyendo número..."
3. Verificar que el campo se completa automáticamente
4. Verificar badge verde de confirmación
5. Registrar factura normalmente

### Escenario 2: PDF sin número detectable
1. Seleccionar PDF sin número reconocible
2. Verificar que el spinner aparece
3. Verificar que se muestra badge azul "Complete manualmente"
4. Ingresar número manualmente
5. Registrar factura normalmente

### Escenario 3: PDF muy grande
1. Seleccionar PDF > 10MB
2. Verificar mensaje de error de tamaño
3. No se ejecuta la extracción

### Escenario 4: Archivo no PDF
1. Seleccionar imagen o documento Word
2. Verificar mensaje de error de tipo
3. No se ejecuta la extracción

### Escenario 5: Edge Function falla
1. Simular error en Edge Function
2. Verificar que no muestra error al usuario
3. Permitir ingreso manual del número
4. Registro funciona normalmente

---

## Archivos Modificados

### Creados:
- ✅ `supabase/functions/extract-invoice-number/index.ts`

### Modificados:
- ✅ `src/components/facturas/RegistrarFacturaModal.tsx`

---

## Próximos Pasos Opcionales

### Mejoras Futuras:
1. **Agregar más patrones de detección** para diferentes formatos de facturas
2. **Soporte para facturas electrónicas XML** (además de PDF)
3. **Validación del formato** del número detectado (checksum AFIP)
4. **Cache de resultados** para PDFs procesados previamente
5. **Estadísticas de detección** (% de éxito en auto-detección)

### Monitoreo:
- Revisar logs de la Edge Function para detectar patrones no reconocidos
- Analizar casos donde no se detecta el número para mejorar patrones
- Medir tiempo de procesamiento promedio

---

## Notas Técnicas

### Librería PDF Parse:
- Compatible con Deno mediante `npm:pdf-parse@1.1.1`
- Funciona bien con PDFs generados por AFIP
- Timeout implícito de 10 segundos (límite de Edge Functions)

### CORS:
- Configurado para aceptar cualquier origen (`*`)
- Headers estándar para compatibilidad con Supabase Client

### Seguridad:
- Validación de tipo MIME en backend
- Límite de tamaño para evitar ataques DoS
- No se ejecuta código del PDF (solo lectura de texto)
- Edge Function no requiere JWT (proceso auxiliar)

---

## Conclusión

Se ha implementado exitosamente un sistema de **extracción automática de números de factura** que:

✅ Mejora la experiencia del usuario (auto-completado)
✅ Es robusto y tolerante a fallos
✅ No bloquea el proceso de registro
✅ Mantiene el flujo de almacenamiento en Storage
✅ Envía el PDF al cliente por WhatsApp
✅ Está desplegado y listo para usar

**El proyecto compila correctamente y está listo para producción.**
