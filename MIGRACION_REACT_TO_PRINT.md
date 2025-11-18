# Migración de React-PDF a React-to-Print

## Resumen

Se completó exitosamente la migración del sistema de generación de PDFs desde `@react-pdf/renderer` hacia `react-to-print`, simplificando enormemente el código y eliminando dependencias complejas.

## Cambios Realizados

### 1. Dependencias

**Eliminadas:**
- `@react-pdf/renderer` y todos sus paquetes relacionados
- Polyfills de Node.js: `vite-plugin-node-polyfills`, `buffer`, `stream-browserify`, `browserify-zlib`, `assert`

**Agregadas:**
- `react-to-print@^3.2.0`

### 2. Configuración

**vite.config.ts:**
- Eliminadas todas las configuraciones de polyfills y alias
- Simplificado a configuración mínima con solo React plugin

### 3. Sistema Base de Impresión

**Nuevos archivos creados:**

- `src/styles/print.css` - Estilos CSS globales para impresión con media queries
- `src/hooks/usePrintDocument.ts` - Hook personalizado que encapsula react-to-print
- `src/components/print/PrintableDocument.tsx` - Contenedor base reutilizable
- `src/components/print/PrintHeader.tsx` - Encabezado para documentos impresos
- `src/components/print/PrintFooter.tsx` - Pie de página con fecha y empresa
- `src/components/print/PrintInkBadge.tsx` - Badge de tintas optimizado para impresión

### 4. Componentes de Listas de Precios

**Creados tres componentes de layout para impresión:**

1. `src/components/print/lista-precios/ListaPreciosGranFormatoLayout.tsx`
   - Diseño moderno con tablas
   - Agrupación por tecnología y tipo de tinta
   - Badges visuales de tintas
   - Soporta paginación automática

2. `src/components/print/lista-precios/ListaPreciosLaserLayout.tsx`
   - Tablas por producto y medida
   - Información de materiales y acabados
   - Precios por cantidad fija o unitarios

3. `src/components/print/lista-precios/ListaPreciosMaterialesRigidosLayout.tsx`
   - Agrupación por material
   - Columnas de precio por placa y m²
   - Información de espesores y variantes

### 5. Integraciones

**Páginas actualizadas:**

- `PreciosGranFormatoTab.tsx` - Usa `ListaPreciosGranFormatoLayout`
- `PreciosLaserTab.tsx` - Usa `ListaPreciosLaserLayout`
- `PreciosMaterialesRigidosTab.tsx` - Usa `ListaPreciosMaterialesRigidosLayout`

Todas las páginas ahora:
- Renderizan el componente de layout de forma oculta con `hidden`
- Usan el hook `usePrintDocument` para manejar la impresión
- Actualizan el botón de exportación para llamar a la función `print()`

### 6. Archivos Eliminados

**Carpetas completas:**
- `src/utils/pdfComponents/` (7 archivos)
- `src/utils/pdfGenerators/` (3 archivos)

**Archivos individuales:**
- `src/utils/reactPdfWrapper.ts`
- `scripts/test-pdf-generation.ts`

## Ventajas de la Nueva Implementación

1. **Simplicidad:** Componentes React normales con Tailwind CSS
2. **Sin configuración compleja:** No más polyfills de Node.js
3. **Mejor rendimiento:** Menos dependencias, bundle más pequeño
4. **Mayor control:** Diseño exacto usando las herramientas habituales
5. **Vista previa nativa:** Los usuarios ven exactamente lo que van a imprimir
6. **Mantenibilidad:** Código más fácil de entender y modificar
7. **Reutilizable:** Sistema base que puede expandirse para otros documentos

## Funcionamiento

1. El usuario hace clic en "Descargar Lista de Precios"
2. El sistema renderiza el componente de layout (oculto en el DOM)
3. `react-to-print` captura el componente renderizado
4. El navegador abre el diálogo de impresión nativo
5. El usuario puede guardar como PDF o imprimir directamente

## Build Verificado

El proyecto compila correctamente con `npm run build`:
- ✅ Sin errores
- ✅ Bundle: 1.14 MB (284 KB gzipped)
- ✅ Todas las referencias a React-PDF eliminadas

## Próximos Pasos Sugeridos

Esta base puede usarse para implementar:
- Presupuestos
- Órdenes de producción
- Recibos
- Facturas
- Remitos
- Cualquier otro documento del sistema
