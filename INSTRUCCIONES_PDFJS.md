# 📚 Instrucciones para Usar usePDFPageCount

## 🎯 Propósito

El hook `usePDFPageCount` detecta automáticamente el número de páginas en archivos PDF para calcular precios en el módulo de Centro de Copiado.

## 🔧 Configuración (YA APLICADA)

### ✅ Vite Config
```typescript
// vite.config.ts
optimizeDeps: {
  include: ['pdfjs-dist'],  // NECESARIO para que funcione
}
```

### ✅ Hook Config
```typescript
// src/hooks/usePDFPageCount.ts
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
```

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

2. **Worker desde CDN**
   - El worker se carga desde CDN (no localmente)
   - Requiere conexión a internet
   - Versión: 4.0.379

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
**Solución:** Verificar que `vite.config.ts` tenga:
```typescript
optimizeDeps: {
  include: ['pdfjs-dist'],
}
```

Luego:
```bash
rm -rf node_modules/.vite
npm run dev
```

### Worker no carga
**Verificar:** URL del worker en `usePDFPageCount.ts`
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
```

### Detección falla
**Verificar:**
1. Archivo es PDF válido
2. Archivo no está corrupto
3. Browser tiene acceso a internet (para el worker)

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
