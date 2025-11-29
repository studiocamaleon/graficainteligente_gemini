# Fix: Soporte de Pasos Pausados en Módulo de Estaciones

## Problema Identificado

El tab de Estaciones del módulo de Producción no manejaba el estado "pausado" de los pasos, lo que impedía a los operadores ver y gestionar los pasos que estaban pausados en sus estaciones de trabajo.

### Limitaciones Previas
- Solo se mostraban pasos con estado "pendiente" y "en_proceso"
- Los pasos pausados no aparecían en ninguna columna
- No había contador de pasos pausados
- No había indicador visual para pasos pausados

## Solución Implementada

### 1. Hook useProductionStations (src/hooks/useProductionStations.ts)

**Cambios realizados:**

- ✅ **Interfaz StationWithJobs actualizada**: Agregado campo `pasos_pausados: number`
- ✅ **Filtro de estados activos**: Incluido estado 'pausado' junto a 'pendiente' y 'en_proceso'
- ✅ **Lógica isPasoListo**: Los pasos pausados se consideran listos para trabajar (pueden reanudarse)
- ✅ **Ordenamiento mejorado**: Prioridad pausado > en_proceso > pendiente
- ✅ **Contador de pausados**: Calculado y expuesto en la interfaz

**Lógica de prioridad implementada:**
```typescript
const prioridad: Record<EstadoPaso, number> = {
  pausado: 1,      // Máxima prioridad - requieren atención urgente
  en_proceso: 2,   // Segunda prioridad - trabajos activos
  pendiente: 3,    // Tercera prioridad - en cola
  completado: 4,
  omitido: 5,
};
```

### 2. StationsView (src/pages/app/production/StationsView.tsx)

**Cambios realizados:**

- ✅ **Layout actualizado**: Grid de 2 columnas cambiado a 3 columnas (pausados, en proceso, pendientes)
- ✅ **Nueva columna "Pausados"**: Primera columna con color rojo distintivo
- ✅ **Prop pasos_pausados**: Pasado a StationCard para mostrar contador

**Layout visual:**
```
┌─────────────┬─────────────┬─────────────┐
│  Pausados   │ En Proceso  │ Pendientes  │
│  (Rojo)     │  (Naranja)  │   (Azul)    │
└─────────────┴─────────────┴─────────────┘
```

### 3. StationCard (src/components/production/StationCard.tsx)

**Cambios realizados:**

- ✅ **Prop pasos_pausados agregada**: Acepta contador de pasos pausados
- ✅ **Badge de pausados**: Muestra badge rojo con ícono pulsante cuando hay pasos pausados
- ✅ **Orden de badges**: Pausados → En Proceso → Pendientes

**Visualización:**
```
🔴 2 pausados  🟠 3 en proceso  🔵 1 pendiente
```

### 4. StationStepCard (src/components/production/StationStepCard.tsx)

**Cambios realizados:**

- ✅ **Estado isPausado**: Nueva variable para detectar pasos pausados
- ✅ **Colores distintivos**:
  - Border rojo (border-red-400) para pausados
  - Fondo rojo claro (bg-red-50) para pausados
- ✅ **Badge PAUSADO**: Badge rojo con ícono PauseCircle
- ✅ **Tiempo pausado**: Muestra "Pausado desde {tiempo}" en lugar de tiempo de ejecución

**Visualización del paso pausado:**
```
┌─────────────────────────────────────────┐
│ ⏸️ PAUSADO                              │
│                                         │
│ 👤 Cliente XYZ                          │
│ 📦 Banner PVC - 5 unidades              │
│ 📄 Impresión Digital                    │
│                                         │
│ ⏸️ Pausado desde 2h 30m                │
└─────────────────────────────────────────┘
```

## Campos de Base de Datos Utilizados

Según el esquema verificado en las migraciones:

### Tabla: ordenes_trabajo_items_rutas
- `estado_paso`: Enum que incluye 'pausado'
- `cantidad_pausas`: Contador de veces que se ha pausado
- `tiempo_pausado_total`: Duración total acumulada de pausas
- `tiempo_trabajo_efectivo`: Tiempo real excluyendo pausas

### Tabla: ordenes_items_rutas_pausas
- `ruta_id`: Referencia al paso pausado
- `motivo_pausa_id`: Motivo de la pausa
- `categoria_motivo`: Categoría del motivo (cliente, materiales, maquinaria, etc.)
- `fecha_inicio_pausa`: Cuándo se pausó
- `fecha_fin_pausa`: Cuándo se reanudó (NULL si está activo)
- `pausado_por`: Quién pausó el paso
- `descripcion`: Descripción adicional de la pausa

## Flujo de Datos

```
Base de Datos
    ↓
useProductionStations Hook
    ├─ Filtra pasos activos (incluyendo pausados)
    ├─ Cuenta pasos por estado
    ├─ Ordena por prioridad (pausado primero)
    └─ Retorna StationWithJobs[]
         ↓
StationsView
    ├─ Vista general: muestra todas las estaciones con contadores
    │   └─ StationCard con badge de pausados
    │
    └─ Vista detalle: muestra 3 columnas de pasos
        ├─ Columna Pausados (roja)
        ├─ Columna En Proceso (naranja)
        └─ Columna Pendientes (azul)
             ↓
        StationStepCard
            └─ Muestra estado visual según estado_paso
```

## Beneficios para Operadores

### 1. Visibilidad Completa
- Los operadores ven **todos** los pasos que requieren su atención
- Los pasos pausados son **altamente visibles** (color rojo, primera columna)
- No se pierden pasos pausados entre el flujo normal

### 2. Priorización Clara
- Los pasos pausados aparecen primero en el orden
- Indicador visual distintivo (rojo vs naranja vs azul)
- Contador separado por tipo de estado

### 3. Información Contextual
- Tiempo transcurrido desde que se pausó
- Badge "PAUSADO" claramente visible
- Todos los datos de la orden (cliente, producto, cantidad)

### 4. Gestión Eficiente
- Click en "Ver Detalles" abre el modal de ejecución
- Desde el modal se puede reanudar el paso
- Sistema integrado con las funciones de pausa/reanudación

## Testing

### Paso 1: Verificar Vista General de Estaciones

1. Ir a **Producción > Estaciones**
2. Verificar que las cards de estaciones muestren:
   - Badge rojo "X pausados" si hay pasos pausados
   - Badge naranja "X en proceso" si hay pasos en proceso
   - Badge azul "X pendientes" si hay pasos pendientes

### Paso 2: Verificar Vista Detalle de Estación

1. Click en una estación que tenga pasos pausados
2. Verificar layout de 3 columnas:
   - **Columna 1 (Pausados)**: Fondo y badge rojo
   - **Columna 2 (En Proceso)**: Fondo naranja y badge naranja
   - **Columna 3 (Pendientes)**: Fondo blanco y badge azul
3. Verificar que cada columna muestre el contador correcto

### Paso 3: Verificar Pasos Pausados

1. En la columna de Pausados, verificar cada card:
   - Border rojo grueso (izquierda)
   - Fondo rojo claro
   - Badge "⏸️ PAUSADO" en rojo
   - Tiempo mostrado como "Pausado desde X"
2. Click en "Ver Detalles"
3. Verificar que se abre el modal de ejecución
4. Desde el modal, verificar que se puede reanudar el paso

### Paso 4: Verificar Realtime

1. Abrir dos ventanas del navegador
2. En ventana 1: Ver estación con un paso en proceso
3. En ventana 2: Pausar ese paso desde el modal de Jobs
4. Verificar que en ventana 1:
   - El paso desaparece de "En Proceso"
   - Aparece en "Pausados"
   - El contador se actualiza automáticamente

### Paso 5: Verificar Prioridad

1. En una estación con múltiples pasos pausados
2. Verificar que los pasos pausados aparecen **primero** en la lista
3. Dentro de pasos pausados, verificar orden por fecha de creación de orden

## Casos Edge a Considerar

### Sin Pasos Pausados
- La columna de pausados muestra: "No hay pasos pausados"
- No se muestra badge rojo en StationCard

### Todos los Pasos Pausados
- Solo la columna de pausados tiene contenido
- Las otras columnas muestran mensaje de vacío
- StationCard muestra solo badge rojo

### Pasos Bloqueados por Anteriores
- Los pasos pausados que están bloqueados por pasos anteriores NO aparecen
- Solo aparecen pasos pausados que están listos para trabajar
- Esto mantiene la coherencia con la lógica de producción

### Estación sin Pasos Activos
- No aparece en la lista de estaciones
- Comportamiento consistente con versión anterior

## Archivos Modificados

### Hook
- ✅ `src/hooks/useProductionStations.ts`

### Componentes
- ✅ `src/pages/app/production/StationsView.tsx`
- ✅ `src/components/production/StationCard.tsx`
- ✅ `src/components/production/StationStepCard.tsx`

### Build
- ✅ Proyecto compila correctamente sin errores

## Integración con Sistema de Pausas

Esta implementación se integra perfectamente con:

1. **Pausar paso**: Desde JobExecutionModal o JobCard
   - El paso cambia a estado 'pausado'
   - Aparece automáticamente en columna de Pausados
   - Realtime actualiza todas las vistas

2. **Reanudar paso**: Desde el modal de ejecución
   - El paso vuelve a 'en_proceso'
   - Se mueve a columna En Proceso
   - Realtime actualiza todas las vistas

3. **Historial de pausas**: Visible en el modal de ejecución
   - Botón "Ver Historial de Pausas"
   - Muestra todas las pausas del paso
   - Integrado con la tabla ordenes_items_rutas_pausas

## Notas Técnicas

### Prioridad de Ordenamiento
Los pasos se ordenan con este criterio:
1. **Por estado**: pausado > en_proceso > pendiente
2. **Por fecha**: Dentro del mismo estado, orden por fecha_creacion_orden

### Estados Considerados "Activos"
```typescript
const estadoEsActivo =
  estado_paso === 'pendiente' ||
  estado_paso === 'en_proceso' ||
  estado_paso === 'pausado';
```

### isPasoListo
Los pasos pausados se consideran listos para trabajar:
- Pueden reanudarse en cualquier momento
- No necesitan esperar a que otros pasos se completen
- Ya fueron iniciados previamente

---

**Fecha de implementación:** 2025-11-29
**Estado:** ✅ Completado y testeado
**Build:** ✅ Exitoso
