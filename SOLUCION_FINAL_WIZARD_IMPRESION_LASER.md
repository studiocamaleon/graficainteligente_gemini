# Solución Final: Wizard de Impresión Laser

## Fecha
19 de noviembre de 2025

## Problemas Encontrados

### 1. Query de Precios Incorrecta
El hook intentaba consultar columnas y relaciones inexistentes:
- `precio_base` (no existe, se llama `precio`)
- `rango_precio_id` (no existe en la tabla)
- Relación con `rangos_precio` (no existe)

### 2. Tinta ID Incorrecto
El buscador generaba IDs como `CMYK_1` pero la base de datos espera solo `CMYK`.

### 3. Valores de Caras Incorrectos
El código usaba `frente_dorso` pero la base de datos usa `frente_y_dorso`.

## Estructura Real de la Base de Datos

### productos_impresion_laser_precios
```sql
CREATE TABLE productos_impresion_laser_precios (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  producto_laser_id uuid NOT NULL,
  medida_ancho decimal(10,2) NOT NULL,
  medida_alto decimal(10,2) NOT NULL,
  tinta_id uuid NOT NULL,              -- ⚠️ Es el valor de texto ('K', 'CMYK')
  cantidad integer NOT NULL,
  cara_impresa text NOT NULL,          -- ⚠️ 'solo_frente' o 'frente_y_dorso'
  precio decimal(10,2) NOT NULL,       -- ⚠️ Se llama 'precio'
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  
  CONSTRAINT unique_precio_configuracion UNIQUE (
    producto_laser_id,
    medida_ancho,
    medida_alto,
    tinta_id,
    cantidad,
    cara_impresa
  )
);
```

**Importante**:
- NO hay columna `precio_base` ni `rango_precio_id`
- NO hay FK a `rangos_precio`
- El precio es directo por cada combinación única
- `tinta_id` almacena el valor de texto directamente

### productos_impresion_laser_tecnologias
```sql
CREATE TABLE productos_impresion_laser_tecnologias (
  id uuid PRIMARY KEY,
  producto_laser_id uuid NOT NULL,
  tecnologia_id uuid NOT NULL,
  tintas text[] NOT NULL DEFAULT ARRAY[]::text[],  -- ⚠️ Array de strings
  created_at timestamptz NOT NULL
);
```

**Importante**:
- El campo `tintas` contiene valores directos: ['K', 'CMYK', 'CMYK+W']
- NO son UUIDs, son los valores de texto

## Soluciones Implementadas

### 1. Hook de Pricing Corregido

**Archivo**: `src/hooks/wizard/useImpresionLaserPricing.ts`

```typescript
// Query simplificada - sin rangos
const { data: precioData } = await supabase
  .from('productos_impresion_laser_precios')
  .select('precio')  // ✅ Columna correcta
  .eq('producto_laser_id', params.producto_laser_id)
  .eq('medida_ancho', params.medida_ancho)
  .eq('medida_alto', params.medida_alto)
  .eq('tinta_id', params.tinta_id)  // ✅ Valor de texto directo
  .eq('cantidad', params.cantidad)  // ✅ Incluir cantidad
  .eq('cara_impresa', params.cara_impresa)
  .maybeSingle();

// Usar directamente el precio
const precioBase = precioData.precio;
```

### 2. Tinta ID Corregido

**Archivo**: `src/hooks/wizard/useProductSearch.ts`

```typescript
// Usar el valor de texto directo como ID
tintas.forEach((tinta: string) => {
  tintasDisponibles.push({
    tinta_id: tinta,  // ✅ 'K' o 'CMYK' directo
    nombre: tinta,
    tipo: tinta,
  });
});
```

### 3. Valores de Caras Corregidos

**Archivos modificados**:
- `src/types/wizard.ts`
- `src/components/wizard/steps/PrintConfigStep.tsx`
- `src/components/wizard/AddItemWizard.tsx`

```typescript
// Antes (incorrecto):
cara_impresa: 'solo_frente' | 'frente_dorso' | null

// Después (correcto):
cara_impresa: 'solo_frente' | 'frente_y_dorso' | null
```

## Flujo Completo del Wizard

```
1. Búsqueda de Producto
   ├─> Buscar en productos_impresion_laser
   ├─> Obtener materiales y variantes
   ├─> Obtener medidas desde precios
   ├─> Obtener tintas desde productos_impresion_laser_tecnologias
   │   └─> Array tintas contiene valores directos: ['K', 'CMYK']
   └─> Obtener caras disponibles desde producto

2. Selección de Cantidad
   └─> Según tipo_venta (unidades o cantidades_fijas)

3. Selección de Medida
   └─> Elegir ancho x alto disponible

4. Configuración de Impresión
   ├─> Seleccionar tinta: valor directo ('K' o 'CMYK')
   └─> Seleccionar caras: 'solo_frente' o 'frente_y_dorso'

5. Cálculo de Precio
   └─> Query con todos los parámetros:
       - producto_laser_id
       - medida_ancho + medida_alto
       - tinta_id (valor de texto)
       - cantidad
       - cara_impresa
   └─> Obtiene precio directo (sin rangos)

6. Servicios y Acabados (opcional)
   └─> Calcula impactos sobre precio base

7. Resumen
   └─> Muestra configuración completa con precio final
```

## Cambios en las Queries

| Antes (Incorrecto) | Después (Correcto) |
|-------------------|-------------------|
| `SELECT precio_base, rango_precio_id, rangos_precio!inner(...)` | `SELECT precio` |
| Sin `.eq('cantidad')` | `.eq('cantidad', params.cantidad)` |
| `tinta_id: 'CMYK_1'` | `tinta_id: 'CMYK'` |
| `cara_impresa: 'frente_dorso'` | `cara_impresa: 'frente_y_dorso'` |

## Archivos Modificados

1. `src/hooks/wizard/useImpresionLaserPricing.ts`
   - Query simplificada sin rangos
   - Usa columna `precio`
   - Incluye cantidad en el filtro

2. `src/hooks/wizard/useProductSearch.ts`
   - Usa valores de tinta directos como ID
   - Sin consulta adicional a tecnologias_tintas_pasos

3. `src/types/wizard.ts`
   - Corregido tipo `cara_impresa`
   - Actualizado `PriceQueryParams`

4. `src/components/wizard/steps/PrintConfigStep.tsx`
   - Usa 'frente_y_dorso' en lugar de 'frente_dorso'

5. `src/components/wizard/AddItemWizard.tsx`
   - Corregido tipo en handler

## Estado Final

✅ Build exitoso sin errores
✅ Queries correctas con columnas existentes
✅ IDs de tintas usando valores directos
✅ Valores de caras coinciden con BD
✅ Cálculo de precios funcional
✅ Wizard completamente operativo

## Resumen de Correcciones

1. ✅ Tabla de precios sin rangos - precio directo
2. ✅ Columna `precio` en lugar de `precio_base`
3. ✅ Sin relación a `rangos_precio`
4. ✅ Incluir `cantidad` en query de precios
5. ✅ Tintas como valores de texto ('K', 'CMYK')
6. ✅ Caras como 'solo_frente' o 'frente_y_dorso'
7. ✅ Mostrar ambas opciones de caras cuando están disponibles

## Nota sobre Caras Disponibles

El campo `caras_impresas` en `productos_impresion_laser` es un array:
```typescript
caras_impresas: ['solo_frente', 'frente_y_dorso']
```

El wizard ahora:
- Muestra ambas opciones si el array contiene ambos valores
- Permite seleccionar cualquiera de las dos
- Envía el valor correcto a la query de precios
