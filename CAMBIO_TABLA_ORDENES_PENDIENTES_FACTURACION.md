# Cambio: Visualización en Tabla para Órdenes Pendientes de Facturación

## Fecha
2025-12-03

## Cambio Realizado
Se cambió la visualización de las órdenes pendientes de facturación de un **grid de cards** a una **tabla profesional**.

## Motivación
Mejor aprovechamiento del espacio y visualización más eficiente de la información en un formato tabular que permite comparar múltiples órdenes simultáneamente.

## Archivos Creados

### 1. `OrdenesPendientesTable.tsx`
Nuevo componente de tabla que reemplaza las cards individuales.

**Características**:
- ✅ Diseño tabular con todas las columnas necesarias
- ✅ Badge de estado por días pendientes (verde ≤3d, amarillo ≤7d, rojo >7d)
- ✅ Formato de moneda argentino
- ✅ Iconos para mejor UX
- ✅ Botón de "Cargar Factura" por cada orden
- ✅ Footer con resumen: total de órdenes y monto total pendiente
- ✅ Hover states para mejor interacción
- ✅ Soporte para botón opcional "Ver Detalle"

**Columnas de la tabla**:
1. **Orden**: Número de orden + fecha estimada de entrega
2. **Cliente**: Razón social (con truncate para nombres largos)
3. **Vendedor**: Nombre del vendedor
4. **Fecha Creación**: Fecha en formato DD/MM/YYYY
5. **Días Pendiente**: Badge con colores según urgencia
6. **Subtotal**: Monto sin IVA
7. **IVA**: Monto del IVA (21%)
8. **Total**: Monto total (en negrita)
9. **Acciones**: Botones de acción

## Archivos Modificados

### 1. `FacturasView.tsx`
- ✅ Importación de `OrdenesPendientesTable` en lugar de `OrdenPendienteCard`
- ✅ Reemplazo del grid 3-columnas por tabla única
- ✅ Skeleton de carga actualizado para formato tabular
- ✅ Mismo flujo de funcionamiento (modal, handlers, etc.)

## Archivos Mantenidos (sin usar actualmente)

### `OrdenPendienteCard.tsx`
Se mantiene el archivo original por si se requiere volver a la visualización en cards o usarlo en otra sección.

## Comparación Visual

### Antes (Cards)
```
┌────────┐ ┌────────┐ ┌────────┐
│ Orden  │ │ Orden  │ │ Orden  │
│        │ │        │ │        │
│ Cliente│ │ Cliente│ │ Cliente│
│ ...    │ │ ...    │ │ ...    │
│ [BTN]  │ │ [BTN]  │ │ [BTN]  │
└────────┘ └────────┘ └────────┘
```

### Ahora (Tabla)
```
┌───────────────────────────────────────────────────────────────────────┐
│ Orden  │ Cliente  │ Vendedor │ Fecha │ Días │ Subtotal │ IVA │ Total │
├────────┼──────────┼──────────┼───────┼──────┼──────────┼─────┼───────┤
│ 001    │ Cliente1 │ Juan     │ 01/12 │ 2d   │ $10,000  │ ... │ ...   │
│ 002    │ Cliente2 │ María    │ 28/11 │ 5d   │ $25,000  │ ... │ ...   │
│ 003    │ Cliente3 │ Pedro    │ 20/11 │ 13d  │ $8,000   │ ... │ ...   │
└────────┴──────────┴──────────┴───────┴──────┴──────────┴─────┴───────┘
Footer: 3 órdenes pendientes | Total Pendiente: $43,000
```

## Ventajas de la Tabla

### 1. **Mejor Densidad de Información**
- Más órdenes visibles sin scroll
- Comparación directa entre filas

### 2. **Escaneo Visual Mejorado**
- Columnas alineadas facilitan lectura
- Fácil comparar montos y fechas

### 3. **Footer con Resumen**
- Total de órdenes pendientes
- Suma total de todos los montos

### 4. **Responsive Design**
- Scroll horizontal en pantallas pequeñas
- Mantiene estructura tabular

### 5. **Estados Visuales Claros**
- Badge de urgencia por días
- Hover states en filas
- Iconos descriptivos

## Funcionalidad

### Datos Mostrados por Orden
1. ✅ Número de orden
2. ✅ Fecha estimada de entrega (opcional)
3. ✅ Cliente (razón social)
4. ✅ Vendedor
5. ✅ Fecha de creación
6. ✅ Días pendientes (con badge de color)
7. ✅ Subtotal
8. ✅ IVA (21%)
9. ✅ Total
10. ✅ Botón "Cargar Factura"

### Acciones Disponibles
- **Cargar Factura**: Abre modal de registro de factura
- **Ver Detalle** (opcional): Navega al detalle de la orden

## Flujo de Trabajo
1. Usuario visualiza órdenes en tabla
2. Identifica orden por urgencia (badge de días)
3. Click en "Cargar Factura"
4. Modal se abre con datos pre-cargados
5. Usuario sube PDF y número de factura
6. Sistema registra y notifica al cliente

## Compatibilidad
- ✅ Funciona con todos los filtros existentes
- ✅ Compatible con los hooks actuales
- ✅ Mismo formato de datos
- ✅ Sin cambios en el backend

## Estado
✅ **IMPLEMENTADO** - Build exitoso, tabla funcionando

## Testing Recomendado
1. Verificar visualización con 0, 1, 5, 20+ órdenes
2. Probar filtros (fechas, cliente, estado)
3. Validar responsive en mobile
4. Confirmar scroll horizontal cuando sea necesario
5. Verificar cálculos del footer
6. Probar botón "Cargar Factura"
