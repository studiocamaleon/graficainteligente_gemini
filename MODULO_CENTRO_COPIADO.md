# Módulo Centro de Copiado - Implementación Completa

## Descripción General

El módulo de Centro de Copiado es un sistema completo de gestión para servicios de copiado e impresión, que incluye configuración de precios dinámicos, servicios de terminación (anillado y plastificado) y gestión de órdenes.

## Características Principales

### 1. Configuración de Papeles y Tamaños

- **Tamaños de Papel**: Gestión de tamaños personalizados (A4, SRA3, Carta, etc.)
- **Tipos de Papel**: Vinculación con materiales del sistema ABM Core
- **Ordenamiento**: Los papeles pueden reordenarse para personalizar su visualización

### 2. Servicios de Terminación

#### Anillado
- Rangos de cantidad de hojas
- Dos tipos: Ring Wire y Plástico
- Precios diferenciados por tipo y rango

#### Plastificado
- Rangos de cantidad de unidades
- Tres tipos: A4, SRA3 y Carnet
- Precios escalonados por cantidad

### 3. Sistema de Precios de Impresión

- **Matriz de Precios Multidimensional**:
  - Tamaño de papel
  - Tipo de papel
  - Tipo de tinta (CMYK / B&N)
  - Rango de cantidad de hojas
  - Cara impresa (Frente / Frente y Dorso)

- **Rangos de Precio**: Sistema de precios escalonados por cantidad de hojas

### 4. Gestión de Órdenes

- **Creación de Órdenes**:
  - Órdenes independientes o vinculadas a órdenes de trabajo
  - Múltiples items por orden
  - Cálculo automático de precios
  - Terminaciones opcionales por item

- **Estados de Orden**:
  - Pendiente
  - En Proceso
  - Finalizada
  - Entregada
  - Cancelada

- **Información de Orden**:
  - Cliente asociado
  - Fechas de solicitud y entrega
  - Observaciones
  - Desglose de items
  - Total calculado

## Estructura de Base de Datos

### Tablas Principales

1. **centro_copiado_tamanios_papel**
   - Gestión de tamaños de papel
   - Dimensiones en milímetros

2. **centro_copiado_papeles**
   - Tipos de papel disponibles
   - Vinculación con materiales
   - Campo de ordenamiento

3. **centro_copiado_rangos_anillado**
   - Rangos de cantidad de hojas para anillado
   - Precios por tipo (Ring Wire / Plástico)

4. **centro_copiado_plastificados**
   - Rangos de cantidad de unidades
   - Precios por tipo (A4 / SRA3 / Carnet)

5. **centro_copiado_rangos_precio_impresion**
   - Rangos de cantidad de hojas
   - Ordenamiento personalizable

6. **centro_copiado_precios_impresion**
   - Matriz de precios
   - Unique constraint por combinación de parámetros

7. **centro_copiado_ordenes**
   - Órdenes de copiado
   - Vinculación opcional con órdenes de trabajo
   - Control de estados

8. **centro_copiado_ordenes_items**
   - Items de órdenes
   - Tipos: impresión, anillado, plastificado
   - Terminaciones opcionales

## Páginas del Módulo

### `/app/centro-copiado/configuracion`
- Gestión de tamaños de papel
- Gestión de tipos de papel
- Reordenamiento de papeles

### `/app/centro-copiado/terminaciones`
- Configuración de rangos de anillado
- Configuración de rangos de plastificado
- Precios por tipo

### `/app/centro-copiado/rangos-precio`
- Gestión de rangos de cantidad de hojas
- Ordenamiento de rangos
- Validación de solapamientos

### `/app/centro-copiado/precios`
- Matriz de precios de impresión
- Tabs por tipo de tinta (CMYK / B&N)
- Guardado flotante de cambios

### `/app/centro-copiado/ordenes`
- Listado de órdenes
- Filtros por estado
- Búsqueda por número de orden

### `/app/centro-copiado/ordenes/crear`
- Creación de nueva orden
- Configuración de items
- Cálculo automático de precios
- Selección de terminaciones

### `/app/centro-copiado/ordenes/:id`
- Detalle de orden
- Cambio de estados
- Visualización de items
- Historial de fechas

## Componentes Principales

### Formularios
- `CentroCopiadoItemForm`: Formulario de item de orden
- `CentroCopiadoItemTerminaciones`: Selector de terminaciones
- `TamanioPapelForm`: Formulario de tamaño de papel
- `PapelForm`: Formulario de tipo de papel
- `RangoAnilladoForm`: Formulario de rango de anillado
- `PlastificadoForm`: Formulario de plastificado
- `RangoPrecioImpresionForm`: Formulario de rango de precio

### Visualización
- `CentroCopiadoMatrizPrecios`: Matriz de precios interactiva
- `CentroCopiadoTintaSection`: Sección por tipo de tinta
- `CentroCopiadoResumenOrden`: Resumen de orden con totales

## Hooks Personalizados

- `useCentroCopiadoTamanios`: Gestión de tamaños de papel
- `useCentroCopiadoPapeles`: Gestión de tipos de papel
- `useCentroCopiadoRangosAnillado`: Gestión de rangos de anillado
- `useCentroCopiadoPlastificados`: Gestión de plastificados
- `useCentroCopiadoRangosPrecioImpresion`: Gestión de rangos de precio
- `useCentroCopiadoPreciosImpresion`: Gestión de precios de impresión
- `useCentroCopiadoOrdenes`: Gestión de órdenes
- `useCentroCopiadoOrden`: Hook para orden individual
- `useCentroCopiadoOrdenItems`: Gestión de items de orden
- `useCentroCopiadoPriceCalculator`: Calculadora de precios

## Funcionalidades Destacadas

### Cálculo Automático de Precios
El sistema calcula automáticamente el precio de cada item basándose en:
- Precio base de impresión según la matriz
- Cantidad de hojas y copias
- Precio de anillado (si aplica)
- Precio de plastificado (si aplica)

### Sistema de Rangos
Los rangos permiten aplicar precios escalonados:
- Menor cantidad = Mayor precio unitario
- Mayor cantidad = Menor precio unitario
- Soporte para rangos infinitos (último rango)

### Validaciones
- No se permiten solapamientos de rangos
- Validación de datos obligatorios
- Verificación de existencia de precios antes de crear órdenes

### Multi-tenancy
Todos los datos están aislados por `company_id`:
- RLS habilitado en todas las tablas
- Políticas restrictivas por empresa
- Sin acceso cruzado entre empresas

## Seguridad

### Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Políticas por operación (SELECT, INSERT, UPDATE, DELETE)
- Verificación de `company_id` en todas las operaciones

### Validaciones de Base de Datos
- Constraints de unicidad
- Validaciones de rangos
- Foreign keys con ON DELETE CASCADE/SET NULL

## Flujo de Trabajo Típico

1. **Configuración Inicial**:
   - Crear tamaños de papel
   - Agregar tipos de papel desde materiales
   - Configurar rangos de anillado
   - Configurar rangos de plastificado
   - Crear rangos de precio de impresión

2. **Configuración de Precios**:
   - Ingresar a matriz de precios
   - Seleccionar tipo de tinta
   - Completar precios para todas las combinaciones
   - Guardar cambios

3. **Creación de Orden**:
   - Seleccionar cliente
   - Agregar items con configuración
   - Seleccionar terminaciones opcionales
   - Revisar resumen y total
   - Guardar orden

4. **Gestión de Orden**:
   - Cambiar estado según avance
   - Registrar fecha de entrega
   - Consultar historial

## Migraciones Aplicadas

1. `20251119135523_create_centro_copiado_complete_schema.sql`
   - Creación de todas las tablas
   - Configuración de RLS
   - Índices de optimización

2. `20251119144525_add_orden_to_centro_copiado_papeles.sql`
   - Campo de ordenamiento en papeles
   - Actualización de papeles existentes
   - Índice de ordenamiento

3. `20251119151945_update_plastificados_add_rangos.sql`
   - Campos de rango en plastificados
   - Constraint único actualizado
   - Índices de rangos

## Estado del Módulo

✅ **Completamente Implementado**
- Base de datos con todas las tablas y relaciones
- Todas las páginas funcionales
- Hooks personalizados completos
- Componentes de UI completos
- Validaciones implementadas
- Seguridad RLS configurada
- Integración con menú lateral
- Build exitoso sin errores

## Próximos Pasos Recomendados

1. **Reportes y Estadísticas**:
   - Dashboard de órdenes por estado
   - Reportes de ventas por período
   - Productos más vendidos

2. **Exportación**:
   - Exportar orden a PDF
   - Exportar precios a Excel
   - Etiquetas de órdenes

3. **Notificaciones**:
   - Alertas de órdenes pendientes
   - Recordatorios de entrega
   - Notificaciones de cambio de estado

4. **Integración**:
   - Vinculación directa con órdenes de trabajo
   - Importación masiva de precios
   - API para sistemas externos
