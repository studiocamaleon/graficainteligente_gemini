# 📚 Instrucciones para Usar usePDFPageCount

## 🎯 Propósito

El hook `usePDFPageCount` detecta automáticamente el número de páginas en archivos PDF para calcular precios en el módulo de Centro de Copiado.

## 🔧 Configuración (YA APLICADA)

### ✅ Hook Config - Imports Correctos para Vite
```typescript
// src/hooks/usePDFPageCount.ts
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
```

**⚠️ Importante:**
- ✅ Import directo a `pdfjs-dist/build/pdf.mjs` (compatible con Vite ESM)
- ✅ Worker con sufijo `?url` para que Vite lo empaquete como asset
- ✅ Worker local (1.8MB en bundle) - NO depende de CDN
- ✅ Funciona offline y es más rápido

## 📖 Uso del Hook

### Importación
```typescript
import { usePDFPageCount } from '@/hooks/usePDFPageCount';
```

### Ejemplo Completo
```typescript
function MyComponent() {
  const { detectPages, loading, error } = usePDFPageCount();

  const handleFileUpload = async (file: File) => {
    const pageCount = await detectPages(file);

    if (pageCount !== null) {
      console.log(`PDF tiene ${pageCount} páginas`);
      // Usar pageCount para calcular precio
    } else if (file.type !== 'application/pdf') {
      console.log('No es un PDF');
    } else if (error) {
      console.log('Error:', error);
    }
  };

  return (
    <div>
      {loading && <p>Detectando páginas...</p>}
      {error && <p>Error: {error}</p>}
      <input type="file" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
      }} />
    </div>
  );
}
```

## 🔍 API del Hook

### Retorno
```typescript
{
  detectPages: (file: File) => Promise<number | null>,
  loading: boolean,
  error: string | null
}
```

### detectPages(file: File)

**Retorna:**
- `number`: Cantidad de páginas si es un PDF válido
- `null`: Si no es un PDF o si hay error

**Comportamiento:**
1. Verifica que sea PDF (`file.type === 'application/pdf'`)
2. Lee el archivo como ArrayBuffer
3. Usa PDF.js para cargar el documento
4. Retorna `pdf.numPages`
5. Maneja errores automáticamente

### Estados

- **loading**: `true` mientras detecta páginas
- **error**: Mensaje de error si falla la detección
- **error**: `null` si no hay errores

## ⚠️ Notas Importantes

1. **Solo funciona con PDFs válidos**
   - Verifica `file.type === 'application/pdf'`
   - Retorna `null` para otros tipos

2. **Worker Local Empaquetado**
   - El worker se empaqueta en el bundle (1.8MB)
   - NO requiere conexión a internet
   - Funciona offline
   - Carga más rápida que desde CDN

3. **Manejo de Errores**
   - PDFs corruptos: Capturado y retorna `null`
   - Archivos inválidos: Retorna `null` sin error
   - Errores de red: Se logean en consola

## 🧪 Testing

```bash
# Build (debe pasar)
npm run build

# Dev (debe iniciar sin errores)
npm run dev
```

## 🐛 Troubleshooting

### Error: "Failed to resolve import pdfjs-dist"
**Solución:** Asegurarse de usar imports explícitos:
```typescript
// ✅ CORRECTO
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

// ❌ INCORRECTO (no funciona con Vite)
import * as pdfjsLib from 'pdfjs-dist';
```

Luego limpiar cache:
```bash
rm -rf node_modules/.vite
npm run dev
```

### Worker no carga
**Verificar en consola del navegador:**
```javascript
console.log(pdfjsLib.GlobalWorkerOptions.workerSrc);
// Debe mostrar: /assets/pdf.worker-[hash].mjs
```

**Verificar que el worker esté en el bundle:**
```bash
ls dist/assets/pdf.worker-*.mjs
# Debe existir un archivo de ~1.8MB
```

### Detección falla
**Verificar:**
1. Archivo es PDF válido
2. Archivo no está corrupto
3. Worker está correctamente empaquetado en el build

## 📦 Dependencias

```json
{
  "pdfjs-dist": "^4.0.379"
}
```

Ya instalado en `package.json`.

## 🎓 Casos de Uso

### Centro de Copiado
```typescript
const { detectPages } = usePDFPageCount();

const calculatePrice = async (file: File, pricePerPage: number) => {
  const pages = await detectPages(file);
  if (pages) {
    return pages * pricePerPage;
  }
  // Si no es PDF o falla, pedir cantidad manual
  return null;
};
```

### Validación Pre-upload
```typescript
const validatePDF = async (file: File) => {
  const pages = await detectPages(file);

  if (!pages) {
    alert('Archivo inválido o no es PDF');
    return false;
  }

  if (pages > 100) {
    alert('PDF muy grande (máx 100 páginas)');
    return false;
  }

  return true;
};
```

---

**Versión:** 1.0
**Fecha:** 2025-11-26
**Estado:** ✅ Producción Ready
