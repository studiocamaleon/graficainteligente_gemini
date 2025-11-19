# Lógica de Negocio - Wizard de Items

## Descripción General

El wizard de items es un asistente paso a paso que guía al usuario en la configuración completa de un producto para agregarlo a una orden de trabajo. La Fase 1 implementa soporte completo para productos de **Impresión Laser**.

## Categoría: Impresión Laser

### Estructura de Datos

Los productos de Impresión Laser están almacenados en:
- **Tabla principal**: `productos` (registro general)
- **Tabla específica**: `productos_impresion_laser` (detalles técnicos)
- **Tabla de precios**: `productos_impresion_laser_precios` (matriz de precios)

### Atributos Clave

1. **Tipo de Venta**
   - `unidad`: El usuario puede especificar cualquier cantidad
   - `cantidad_fija`: Solo se permiten cantidades predefinidas (ej: 100, 500, 1000)
   - Campo relacionado: `cantidades_fijas` (array de números)

2. **Cantidad Mínima**
   - Valor opcional que define la cantidad mínima para ordenar
   - Se valida solo si está configurada

3. **Medidas**
   - Formato: `{ ancho: number, alto: number }` en centímetros
   - Cada producto puede tener múltiples combinaciones de medidas configuradas
   - Solo se muestran medidas con precios configurados

4. **Material y Variante**
   - Relación con tablas `materiales` y `material_variantes`
   - Define el sustrato de impresión (ej: Papel Bond 90gr)
   - Heredado del producto, no seleccionable por el usuario

5. **Tintas**
   - Relación con tabla `tecnologia_tintas`
   - Tipos disponibles: `CMYK` (color) o `K` (blanco y negro)
   - Cada producto define qué tintas soporta

6. **Caras Impresas**
   - `solo_frente`: Impresión en una sola cara
   - `frente_dorso`: Impresión en ambas caras
   - Campo: `caras_impresas_disponibles` (array)

7. **Servicios**
   - Operaciones adicionales aplicables (ej: Diseño Gráfico)
   - Pueden tener múltiples niveles (ej: Básico, Intermedio, Avanzado)
   - Impacto en precio: porcentaje, monto fijo, o ambos

8. **Acabados**
   - Terminaciones finales (ej: Plastificado, Barniz)
   - Pueden tener múltiples niveles
   - Impacto en precio: porcentaje, monto fijo, o ambos

### Flujo del Wizard - 7 Pasos

#### Paso 1: Búsqueda de Producto
**Objetivo**: Seleccionar el producto a configurar

**Campos**:
- Input de búsqueda con debounce
- Filtrado por nombre o descripción
- Solo productos activos de categoría "Impresión Laser"

**Validación**:
- Debe seleccionar un producto
- El producto debe estar activo

**Datos recopilados**:
```typescript
{
  producto_id: string,
  producto_laser_id: string,
  producto_nombre: string,
  categoria_nombre: string,
  tipo_venta: 'unidad' | 'cantidad_fija',
  cantidades_fijas: number[],
  cantidad_minima: number | null,
  material_id: string,
  material_nombre: string,
  variante_id: string,
  variante_nombre: string
}
```

#### Paso 2: Cantidad
**Objetivo**: Definir cuántas unidades se requieren

**Comportamiento por tipo de venta**:

**Tipo "cantidad_fija"**:
- Mostrar grid de botones con cantidades predefinidas
- Solo se puede seleccionar una de las opciones
- Ejemplo: [100, 500, 1000, 2500, 5000]

**Tipo "unidad"**:
- Input numérico libre
- Validar contra cantidad_minima si existe
- Incrementos de 1 unidad

**Validación**:
- Cantidad debe ser > 0
- Si hay cantidad_minima, cantidad >= cantidad_minima
- Si es cantidad_fija, debe ser una de las opciones válidas

**Datos recopilados**:
```typescript
{
  cantidad: number
}
```

#### Paso 3: Medida
**Objetivo**: Seleccionar el tamaño del producto

**Presentación**:
- Grid de cards con medidas disponibles
- Formato visual: "21 x 29.7 cm"
- Solo mostrar medidas con precios configurados

**Validación**:
- Debe seleccionar una medida
- La medida debe tener configuración de precios

**Datos recopilados**:
```typescript
{
  medida_ancho: number,
  medida_alto: number,
  medida_display: string
}
```

#### Paso 4: Configuración de Impresión
**Objetivo**: Definir tipo de tinta y caras a imprimir

**Sección 1: Tipo de Tinta**
- Radio buttons: CMYK (Color) | K (Blanco y Negro)
- Iconos distintivos para cada opción
- Solo mostrar tintas disponibles del producto

**Sección 2: Caras Impresas**
- Radio buttons: Solo Frente | Frente y Dorso
- Solo mostrar opciones disponibles del producto

**Validación**:
- Debe seleccionar tipo de tinta
- Debe seleccionar configuración de caras
- Ambas opciones deben estar disponibles en el producto

**Datos recopilados**:
```typescript
{
  tinta_id: string,
  tinta_nombre: string,
  tipo_tinta: 'CMYK' | 'K',
  cara_impresa: 'solo_frente' | 'frente_dorso'
}
```

**Actualización de precio**:
- Este paso completa la configuración base
- Se consulta `productos_impresion_laser_precios`
- Query: producto_laser_id + medida_ancho + medida_alto + tinta_id + cantidad + cara_impresa

#### Paso 5: Servicios
**Objetivo**: Agregar servicios opcionales

**Presentación**:
- Lista de servicios disponibles para la categoría
- Checkbox para activar/desactivar
- Si tiene niveles: Dropdown para seleccionar nivel
- Mostrar impacto en precio por servicio

**Comportamiento**:
- Permitir múltiples servicios
- Si se activa un servicio con niveles, debe elegir nivel
- Si se desactiva, limpiar nivel seleccionado

**Cálculo de impacto**:
```typescript
// Tipo: porcentaje
impacto = precio_base * (valor_porcentaje / 100)

// Tipo: monto_fijo
impacto = valor_monto

// Tipo: ambos
impacto = (precio_base * (valor_porcentaje / 100)) + valor_monto
```

**Validación**:
- Si servicio está seleccionado y tiene niveles, nivel no puede ser null

**Datos recopilados**:
```typescript
{
  servicios_seleccionados: [
    {
      servicio_id: string,
      servicio_nombre: string,
      nivel_id: string | null,
      nivel_nombre: string | null,
      tipo_impacto: 'porcentaje' | 'monto_fijo' | 'ambos',
      valor_porcentaje: number | null,
      valor_monto: number | null,
      impacto_calculado: number
    }
  ]
}
```

#### Paso 6: Acabados
**Objetivo**: Agregar acabados finales

**Presentación y comportamiento**:
- Idéntico al paso de servicios
- Lista de acabados disponibles para la categoría
- Mismo sistema de niveles e impactos

**Validación**:
- Si acabado está seleccionado y tiene niveles, nivel no puede ser null

**Datos recopilados**:
```typescript
{
  acabados_seleccionados: [
    {
      acabado_id: string,
      acabado_nombre: string,
      nivel_id: string | null,
      nivel_nombre: string | null,
      tipo_impacto: 'porcentaje' | 'monto_fijo' | 'ambos',
      valor_porcentaje: number | null,
      valor_monto: number | null,
      impacto_calculado: number
    }
  ]
}
```

#### Paso 7: Resumen
**Objetivo**: Revisar configuración completa y confirmar

**Presentación**:
- Resumen de todos los datos seleccionados
- Desglose completo de precio:
  - Precio base
  - + Impacto de servicios
  - + Impacto de acabados
  - = Precio total

**Navegación**:
- Permitir volver a cualquier paso para editar
- Botón "Agregar a Orden" para confirmar

**Validación final**:
- Todos los campos obligatorios completos
- Configuración consistente
- Precio calculado exitosamente

### Estructura de Precios

La tabla `productos_impresion_laser_precios` tiene esta estructura:

```sql
CREATE TABLE productos_impresion_laser_precios (
  id uuid PRIMARY KEY,
  producto_laser_id uuid REFERENCES productos_impresion_laser(id),
  medida_ancho numeric NOT NULL,
  medida_alto numeric NOT NULL,
  tinta_id uuid REFERENCES tecnologia_tintas(id),
  cara_impresa text CHECK (cara_impresa IN ('solo_frente', 'frente_dorso')),
  rango_precio_id uuid REFERENCES rangos_precio(id),
  precio_base numeric NOT NULL,
  -- constraints, indexes, etc.
);
```

**Consulta de precio base**:
```sql
SELECT precio_base
FROM productos_impresion_laser_precios
WHERE producto_laser_id = $1
  AND medida_ancho = $2
  AND medida_alto = $3
  AND tinta_id = $4
  AND cara_impresa = $5
  AND EXISTS (
    SELECT 1 FROM rangos_precio_valores rpv
    WHERE rpv.rango_precio_id = productos_impresion_laser_precios.rango_precio_id
      AND $6 BETWEEN rpv.cantidad_desde AND COALESCE(rpv.cantidad_hasta, 999999)
  )
```

**Manejo de precio no encontrado**:
- Si no hay resultado, `precio_base = null`
- Mostrar warning: "No se encontró precio configurado"
- Permitir continuar, pero marcar item con advertencia
- El usuario puede agregar el item de todas formas

### Construcción del Item de Orden

Una vez completado el wizard, se construye un objeto `OrdenTrabajoItem`:

```typescript
{
  orden_trabajo_id: string,
  producto_id: string,
  categoria_id: string,
  cantidad: number,
  precio_unitario: number,
  subtotal: number,
  configuracion: {
    tecnologia_nombre: "Impresión Laser",
    tipo_tinta: "CMYK",
    cara_impresion: "solo_frente",
    medida_seleccionada: { ancho: 21, alto: 29.7 },
    material_nombre: "Papel Bond",
    variante_nombre: "90gr",
    servicios_seleccionados: [
      { nombre: "Diseño Gráfico", nivel: "Básico", impacto: 150 }
    ],
    acabados_seleccionados: [
      { nombre: "Plastificado", nivel: "Brillante", impacto: 200 }
    ],
    tiene_precio_configurado: true,
    precio_base: 500,
    precio_servicios: 150,
    precio_acabados: 200,
    precio_total: 850
  }
}
```

## Validaciones Globales

### Durante el flujo
1. No avanzar si paso actual no es válido
2. Permitir retroceder siempre
3. Recalcular precio en cada cambio relevante
4. Mostrar errores de forma clara

### Al agregar a orden
1. Configuración completa
2. Cantidad > 0
3. Producto activo
4. Precio calculado (puede ser 0 si no configurado)

## Casos Especiales

### Producto sin precios
- Permitir configurar todo el wizard
- Mostrar advertencia clara
- `precio_total = 0`
- Marcar `tiene_precio_configurado = false`
- El usuario debe configurar precios antes de producir

### Servicios/Acabados sin niveles
- No mostrar selector de nivel
- Aplicar impacto directamente

### Cantidad fuera de rangos
- Si no hay rango que cubra la cantidad, precio_base = null
- Mostrar mensaje sugiriendo verificar rangos de precio

## Extensibilidad

Este diseño permite agregar futuras categorías:
- Cada categoría tendrá su propio conjunto de pasos
- Los pasos 1-2 son comunes a todas
- Los pasos 3-6 son específicos por categoría
- El paso 7 es común pero muestra datos específicos

### Próximas categorías a implementar:
1. Gran Formato
2. Materiales Rígidos
3. Plotter de Corte
4. Portabanners
5. Sellos
