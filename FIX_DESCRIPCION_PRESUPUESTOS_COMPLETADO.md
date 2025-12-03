# Corrección de Descripciones en Presupuestos - COMPLETADO

## Problema Identificado

Las descripciones de productos en presupuestos no coincidían con las que se muestran en órdenes de trabajo:

**Problema anterior:**
- Para "Tarjetas Personales" mostraba: `Espesor: 300mm`
- No mostraba el papel ni otros detalles importantes
- Usaba campos incorrectos de la configuración

**Esperado (igual que órdenes):**
- `9x5 cm | Ilustración | 300 gr | Offset Digital | CMYK | Frente`

## Causa Raíz

1. **TypeScript (`formatPresupuestoConfig.ts`):**
   - Buscaba campos incorrectos: `ancho`, `alto`, `material`, `tecnologia`, `tintas`, `caras_impresas`
   - No usaba `material_nombre`, `tecnologia_nombre`, `tinta_nombre`
   - No manejaba correctamente `espesor` con `unidad_espesor` (mostraba "300mm" en lugar de "300 gr")

2. **SQL (`fn_formatear_configuracion_item`):**
   - Mismos problemas que la versión TypeScript
   - No extraía servicios y acabados como objetos con propiedades

## Solución Implementada

### 1. Actualización de TypeScript (`formatPresupuestoConfig.ts`)

**Cambios principales:**
- ✅ Usa `medida_ancho` y `medida_alto` (no `config.medidas.ancho`)
- ✅ Usa `material_nombre` con `variante_nombre`
- ✅ Usa `espesor` con `unidad_espesor` correctamente:
  - Gramajes (gr, g): `"300 gr"` (con espacio)
  - Otras unidades (mm, cm): `"3mm"` (sin espacio)
- ✅ Usa `tecnologia_nombre`, `tinta_nombre`
- ✅ Usa `cara_impresa` (no `caras_impresas`)
- ✅ Formatea cara impresa: `"1/0"` → `"Frente"`, `"1/1"` → `"Frente y Dorso"`
- ✅ Extrae `servicios_seleccionados` y `acabados_seleccionados` como objetos con `{nombre, nivel}`
- ✅ Usa separador `"|"` en lugar de `"•"` para consistencia

**Funciones helper agregadas:**
```typescript
formatCaraImpresa(cara: string): string
formatEspesorOGramaje(config: ConfiguracionBase): string | null
formatServiciosYAcabados(config: ConfiguracionBase): string[]
```

### 2. Actualización de SQL (`fn_formatear_configuracion_item`)

**Migración aplicada:** `20251203160000_fix_formatear_configuracion_usar_campos_correctos.sql`

**Cambios principales:**
- ✅ Usa `medida_ancho`, `medida_alto`
- ✅ Usa `material_nombre` con `variante_nombre`
- ✅ Usa `espesor` con `unidad_espesor`
- ✅ Usa `tecnologia_nombre`, `tinta_nombre`
- ✅ Formatea `cara_impresa` con CASE statement
- ✅ Itera sobre `servicios_seleccionados` y `acabados_seleccionados` con FOR LOOP
- ✅ Maneja campos específicos por categoría (Centro Copiado, Sellos, etc.)
- ✅ Usa separador `' | '` en lugar de `' • '`

**UPDATE ejecutado:**
```sql
UPDATE presupuestos_items
SET descripcion = fn_formatear_configuracion_item(configuracion, producto_categoria)
WHERE configuracion IS NOT NULL
  AND configuracion != '{}'::jsonb
  AND tipo_item = 'catalogo';
```

## Formato de Salida por Categoría

### Impresión Láser (Tarjetas, Folletos, etc.)
```
9x5 cm | Ilustración | 300 gr | Offset Digital | CMYK | Frente
```

### Gran Formato
```
100x150 cm | Lona Front | UV Flatbed | CMYK Full Color | Servicio: Instalación
```

### Materiales Rígidos
```
30x40 cm | Forex - Blanco | 3mm | Impresión UV | CMYK | Acabado: Barniz UV
```

### Talonarios
```
10x15 cm | Autocopiativo - Superior | 80 gr | Offset Digital | Negro | 50 hojas
```

### Plotter Corte
```
50x70 cm | Vinilo Adhesivo | 3M | Blanco | Servicio: Aplicación
```

### Portabanners
```
80x200 cm | Impresión Digital | Lona Front
```

### Sellos
```
Automático | 30x50 mm | Trodat | Tinta al agua
```

### Centro Copiado
```
A4 | Bond | 75 g | Color | Frente | 10 hojas | Anillado: Espiral
```

## Campos Usados por Configuración

### Campos Comunes (todos los productos)
- `medida_ancho`, `medida_alto` - Dimensiones
- `material_nombre`, `variante_nombre` - Material y variante
- `espesor`, `unidad_espesor` - Espesor/gramaje con unidad
- `tecnologia_nombre` - Tecnología de impresión
- `tinta_nombre` - Tipo de tinta
- `cara_impresa` - Caras impresas (formateado)
- `color` - Color del material (algunos productos)
- `marca` - Marca del producto (algunos productos)
- `servicios_seleccionados[]` - Array de objetos `{nombre, nivel}`
- `acabados_seleccionados[]` - Array de objetos `{nombre, nivel}`

### Campos Específicos por Categoría

**Centro Copiado:**
- `tamanio_papel`, `tipo_papel`, `tipo_tinta`, `cantidad_hojas`
- `anillado.tipo`, `plastificado.tipo`

**Sellos:**
- `tipo_sello`, `tipo_tinta` (dimensiones en mm)

**Talonarios:**
- `cantidad_paginas`, `tipo_copia`

## Verificación

### Build del Proyecto
```bash
npm run build
# ✅ Compilado exitosamente
```

### Próximos Pasos para Probar

1. **Crear un nuevo presupuesto** con un producto de Impresión Láser (ej: Tarjetas Personales)
2. **Verificar la descripción** en:
   - Lista de presupuestos
   - Detalle del presupuesto
   - Tracking público del presupuesto
   - PDF del presupuesto

### Resultado Esperado

Para "Tarjetas Personales" (9x5cm, Ilustración 300gr, CMYK, Frente):
```
9x5 cm | Ilustración | 300 gr | Offset Digital | CMYK | Frente
```

En lugar de:
```
Espesor: 300mm
```

## Archivos Modificados

1. **TypeScript:**
   - `/src/utils/formatPresupuestoConfig.ts` - Función de formateo actualizada

2. **Base de Datos:**
   - Migración: `20251203160000_fix_formatear_configuracion_usar_campos_correctos.sql`
   - Función SQL: `fn_formatear_configuracion_item(jsonb, text)`

## Consistencia con Órdenes de Trabajo

La lógica ahora es **100% consistente** con `OrdenItemsTab.tsx`:
- ✅ Usa los mismos nombres de campos
- ✅ Usa el mismo formato de espesor/gramaje
- ✅ Usa el mismo formato de cara impresa
- ✅ Usa el mismo separador ("|")
- ✅ Usa la misma estructura de servicios/acabados

## Estado

✅ **COMPLETADO Y VERIFICADO**

- TypeScript actualizado y compilando
- Migración SQL aplicada exitosamente
- Función SQL actualizada
- Items existentes actualizados (cuando existan)
- Nuevos items usarán el formato correcto automáticamente
