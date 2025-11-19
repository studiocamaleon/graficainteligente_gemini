# Implementación de Pestaña de Precios para Portabanners

## Resumen
Se ha implementado exitosamente la pestaña de precios para productos Portabanners con una matriz de precios donde las filas son productos y las columnas son tecnologías de impresión.

## Archivos Creados

### 1. Hook de Gestión de Precios
**Archivo:** `src/hooks/useAllProductosPortabannersPrecios.ts`

Funcionalidades:
- Carga de productos portabanners activos con rangos de precio
- Carga de tecnologías únicas de todos los productos
- Carga de precios existentes desde la base de datos
- Gestión de estado de precios modificados
- Guardado selectivo de precios (solo las combinaciones modificadas)
- Snapshot para detectar cambios reales
- Validación de cambios no guardados

### 2. Componente de Matriz de Precios
**Archivo:** `src/components/productos/portabanners/PortabannersMatrizPrecios.tsx`

Características:
- Tabla con productos en filas
- Tecnologías en columnas (con sub-columnas por rango de cantidad)
- Header de dos niveles: Tecnología > Rangos
- Primera columna: Nombre del producto + Badge con medidas (ancho × alto cm)
- Celdas deshabilitadas para tecnologías no disponibles en el producto
- Inputs numéricos para precios con formato de moneda
- Detección automática de cambios

### 3. Pestaña de Precios
**Archivo:** `src/pages/app/productos/portabanners/PreciosPortabannersTab.tsx`

Características:
- Agrupación de productos por rango de precio
- Sección para cada rango con su propia tabla
- Botón flotante de guardado (solo visible con cambios)
- Validación de cambios no guardados al salir
- Exportación a PDF e impresión
- Estados de carga, error y vacío

### 4. Template PDF
**Archivo:** `src/components/pdf/templates/PortabannersPDFTemplate.tsx`

Características:
- Formato profesional para exportación
- Agrupación por rango de precio
- Tabla con estructura idéntica a la vista web
- Header de dos niveles
- Celdas marcadas para tecnologías no disponibles
- Footer con notas y aclaraciones

## Estructura de la Tabla

```
┌─────────────────────┬────────────────────────────────────┬────────────────────────────────────┐
│ Producto / Medida   │        Tecnología 1                │        Tecnología 2                │
│                     ├──────────┬──────────┬──────────────┼──────────┬──────────┬──────────────┤
│                     │ 1-10 un  │ 11-50 un │ 51-100 un    │ 1-10 un  │ 11-50 un │ 51-100 un    │
├─────────────────────┼──────────┼──────────┼──────────────┼──────────┼──────────┼──────────────┤
│ Portabanner XL      │  $100    │  $90     │  $80         │  $110    │  $100    │  $90         │
│ [85 × 200 cm]       │          │          │              │          │          │              │
├─────────────────────┼──────────┼──────────┼──────────────┼──────────┼──────────┼──────────────┤
│ Portabanner Mini    │  $50     │  $45     │  $40         │    -     │    -     │    -         │
│ [60 × 160 cm]       │          │          │              │          │          │              │
└─────────────────────┴──────────┴──────────┴──────────────┴──────────┴──────────┴──────────────┘
```

## Flujo de Datos

### Carga Inicial
1. Hook obtiene `company_id` del usuario autenticado
2. Carga productos portabanners activos con rango de precio
3. Para cada producto, carga sus tecnologías asociadas
4. Carga el rango de precio asignado y normaliza valores
5. Carga precios existentes de la BD
6. Filtra productos sin rango de precio
7. Agrupa productos por rango de precio
8. Crea snapshot de precios para detección de cambios

### Edición de Precios
1. Usuario modifica precio en input
2. Estado local se actualiza inmediatamente
3. Hook detecta cambios automáticamente
4. Botón flotante de guardado aparece
5. Array de precios modificados se mantiene en memoria

### Guardado
1. Agrupa precios por combinación producto + tecnología
2. Borra solo las combinaciones modificadas de la BD
3. Inserta nuevos precios (filtrando precios = 0)
4. Actualiza snapshot con nuevos valores
5. Limpia estado de cambios pendientes
6. Recarga datos actualizados

## Base de Datos

### Tabla: productos_portabanners_precios

Campos clave:
- `producto_id`: FK a productos_portabanners
- `tecnologia_id`: FK a tecnologias (puede ser NULL)
- `ancho_cm`, `alto_cm`: Medidas del producto
- `cantidad_desde`, `cantidad_hasta`: Rango de cantidad
- `precio`: Precio unitario
- `company_id`: Multi-tenancy

Índices:
- company_id
- producto_id
- tecnologia_id
- (producto_id, ancho_cm, alto_cm)
- (cantidad_desde, cantidad_hasta)

Constraints:
- Precios >= 0
- Cantidades > 0
- cantidad_hasta >= cantidad_desde o NULL
- Unique: (producto_id, ancho_cm, alto_cm, cantidad_desde, cantidad_hasta)

## Características Destacadas

1. **Guardado Selectivo**: Solo se borran y reinsertan las combinaciones (producto + tecnología) que fueron modificadas, preservando el resto de precios.

2. **Detección de Cambios Reales**: Sistema de snapshot que compara valores actuales vs iniciales para detectar cambios reales.

3. **Validación al Salir**: Alerta al usuario si intenta salir con cambios sin guardar.

4. **Tecnologías Deshabilitadas**: Las celdas para tecnologías no asociadas al producto se muestran deshabilitadas con "-".

5. **Agrupación Inteligente**: Los productos se agrupan automáticamente por rango de precio, mostrando una tabla independiente para cada grupo.

6. **Exportación Profesional**: PDF con formato idéntico a la vista web, incluyendo notas y aclaraciones.

## Testing Recomendado

1. Crear productos portabanners con diferentes medidas
2. Asignar tecnologías a cada producto
3. Asignar rango de precio a los productos
4. Verificar que la tabla se muestre correctamente
5. Ingresar precios para diferentes combinaciones
6. Verificar que el guardado funcione correctamente
7. Recargar la página y verificar que los precios se mantengan
8. Probar la exportación a PDF
9. Verificar que las celdas de tecnologías no disponibles se muestren deshabilitadas
10. Verificar la alerta de cambios sin guardar

## Notas Técnicas

- Los rangos con valor máximo NULL representan "infinito" (ej: "101+")
- Los precios se normalizan antes de guardar (NULL → 999999999)
- La tabla soporta cualquier número de tecnologías y rangos
- El diseño es responsive y se adapta al ancho disponible
- Las celdas mantienen un ancho mínimo para legibilidad
