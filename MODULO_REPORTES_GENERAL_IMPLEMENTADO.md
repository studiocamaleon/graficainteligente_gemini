# Módulo de Reportes General - Implementación Completa

## Resumen

Se ha reformulado completamente el módulo de reportes en Finanzas. El antiguo reporte de "Ventas" ha sido eliminado y reemplazado por un nuevo reporte "General" con análisis más profundos y útiles para la toma de decisiones del negocio.

## Cambios Implementados

### 1. Base de Datos - Nuevas Funciones SQL

#### Funciones Creadas:

1. **fn_reporte_ventas_por_categoria**
   - Facturación agrupada por categorías (Impresión Láser, Gran Formato, Copiado, etc.)
   - Incluye porcentajes y tickets promedio

2. **fn_reporte_ventas_por_dia_semana**
   - Análisis de ventas por día de la semana (Lunes-Domingo)
   - Identifica patrones de demanda semanal

3. **fn_reporte_ventas_por_hora**
   - Análisis de órdenes por hora del día
   - **Zona horaria: Argentina (UTC-3)**
   - Identifica horarios pico de pedidos

4. **fn_reporte_ventas_por_usuario**
   - Ranking de usuarios por facturación generada
   - Top 10 usuarios con mayor impacto

5. **fn_reporte_tasa_sena**
   - Análisis completo de tasa de seña vs meta del 50%
   - Excluye órdenes de cuenta corriente
   - Incluye métricas de órdenes con/sin seña

#### Funciones Actualizadas:

1. **fn_reporte_ventas_kpis**
   - Reemplazada "tasa de conversión" por "tasa de cobro"
   - Excluye cuenta corriente del cálculo de tasa de cobro

2. **fn_reporte_ventas_por_canal**
   - Agregadas cantidades separadas: órdenes trabajo vs órdenes copiado
   - Doble métrica de porcentajes (ventas y órdenes)

3. **fn_reporte_ventas_timeline**
   - Agregada separación de órdenes trabajo y copiado
   - Dual metric en evolución temporal

### 2. TypeScript - Tipos y Hooks

#### Nuevo Archivo: `src/types/reportes.ts`
Tipos completos para todas las métricas del reporte:
- `ReporteGeneralKPIs`
- `VentasPorCanal`
- `VentasPorCategoria`
- `VentasPorDiaSemana`
- `VentasPorHora`
- `VentasPorUsuario`
- `TasaSenaData`
- `TimelineData`
- `ReporteGeneralData`
- `PeriodoPreset`

#### Nuevo Hook: `useReporteGeneral.ts`
- Carga paralela de 9 fuentes de datos
- Gestión de estados de loading y error
- Función de refetch para actualizar datos

### 3. Componentes de UI

#### Componentes Nuevos:

1. **VentasPorCategoriaChart.tsx**
   - Gráfico de barras horizontales por categoría
   - Tabla resumen con detalles
   - Colores distintivos por categoría

2. **VentasPorDiaChart.tsx**
   - Gráfico de barras verticales por día de la semana
   - Identifica y destaca el mejor día
   - Vista ordenada Lunes-Domingo

3. **VentasPorHoraChart.tsx**
   - Heatmap de horarios con intensidad de color
   - Top 3 horarios pico destacados
   - Leyenda de intensidad (Muy Alto, Alto, Medio, Bajo)

4. **VentasPorUsuarioTable.tsx**
   - Tabla ranking con trofeos para top 3
   - Barras de progreso de porcentaje
   - Información completa: facturación, órdenes, ticket promedio

5. **TasaSenaCard.tsx**
   - Card especial con análisis de seña vs meta 50%
   - Estados: Alerta Roja (<30%), Amarilla (30-45%), Verde (45-55%), Excelente (>55%)
   - Recomendaciones automáticas cuando está por debajo de meta
   - Progreso visual hacia meta
   - Desglose completo: órdenes con/sin seña, montos

#### Componentes Actualizados:

1. **VentasKPICards.tsx**
   - Actualizado para usar nuevos tipos
   - KPI "Tasa de Cobro" reemplaza "Tasa de Conversión"

2. **VentasTimelineChart.tsx**
   - Rediseñado con dual metric (facturación + cantidad órdenes)
   - Dos ejes Y (izquierdo: $, derecho: cantidad)
   - Tooltip mejorado con toda la información

3. **VentasPorCanalChart.tsx**
   - Actualizado para mostrar cantidades separadas
   - Formato: "X órdenes (Y trabajo, Z copiado)"
   - Tabla con columna adicional de órdenes

### 4. Páginas y Navegación

#### Nueva Página: `ReporteGeneral.tsx`
Página completa con todas las secciones:
1. Filtros de período (mismos que antes)
2. KPIs principales (6 tarjetas)
3. Evolución de ventas (dual metric)
4. Ventas por canal (con cantidades)
5. Facturación por categorías
6. Top 10 productos
7. Ventas por día de semana
8. Horarios pico de pedidos
9. Facturación por usuario
10. Análisis de tasa de seña

#### Actualizado: `ReportesView.tsx`
- Tab "Ventas" → "General"
- Ruta `/app/finanzas/reportes/ventas` → `/app/finanzas/reportes/general`
- Redirección actualizada

## Características Principales

### 1. Análisis de Tasa de Seña
**Objetivo:** Monitorear cumplimiento de meta del 50% de seña

**Métricas:**
- Tasa de seña promedio del período
- Cantidad de órdenes con/sin seña
- Monto promedio de seña
- % de órdenes con seña

**Estados Visuales:**
- 🚨 Alerta Roja (<30%): Riesgo de liquidez
- ⚠️ Alerta Amarilla (30-45%): Mejorable
- ✅ Verde (45-55%): Cerca de meta
- 🎉 Excelente (>55%): Por encima de meta

**Recomendaciones Automáticas:**
Cuando tasa < 45%, muestra sugerencias:
- Reforzar política de 50% de seña
- Capacitar al equipo
- Considerar incentivos para pagos anticipados

### 2. Horarios Pico (UTC-3 Argentina)
**Objetivo:** Identificar horarios de mayor demanda

**Características:**
- Conversión automática a zona horaria argentina
- Heatmap con colores de intensidad
- Top 3 horarios pico destacados con 🔥
- Útil para planificación de staffing

### 3. Ventas por Día de Semana
**Objetivo:** Identificar patrones semanales

**Características:**
- Gráfico de barras por día
- Identifica y destaca mejor día
- Porcentajes de distribución
- Útil para planificación de inventario y personal

### 4. Facturación por Usuario
**Objetivo:** Detectar mejores vendedores

**Características:**
- Ranking con trofeos para top 3
- Porcentaje de contribución al total
- Ticket promedio por usuario
- Identifica quién genera mayor facturación

### 5. Dual Metrics en Timeline
**Objetivo:** Ver facturación Y cantidad simultáneamente

**Características:**
- Dos barras por fecha (azul: $, verde: órdenes)
- Dos ejes Y para mejor legibilidad
- Tooltip detallado con ambas métricas

### 6. Cantidades por Canal
**Objetivo:** Separar órdenes trabajo vs copiado

**Características:**
- Muestra cantidad total y desglose
- Formato: "45 órdenes (30 trabajo, 15 copiado)"
- Útil para entender composición por canal

## Datos Técnicos

### Índices Creados para Performance
```sql
- idx_ordenes_trabajo_fecha_creacion_company
- idx_ordenes_trabajo_created_by_company
- idx_centro_copiado_ordenes_fecha_solicitud_company
- idx_centro_copiado_ordenes_created_by_company
- idx_ordenes_trabajo_items_producto_categoria
```

### Carga de Datos
- Carga paralela de 9 endpoints RPC
- Promesas en paralelo con Promise.all
- Estados de loading individuales por sección

### Filtros de Período
Presets disponibles:
- Hoy
- Esta Semana
- Este Mes
- Mes Pasado
- Últimos 3/6 Meses
- Este Año
- Año Pasado
- Personalizado (fecha inicio/fin)

## Flujo de Usuario

1. Usuario entra a Finanzas → Reportes
2. Por defecto muestra tab "General"
3. Selecciona período (default: "Este Mes")
4. Sistema carga todas las métricas en paralelo
5. Se muestran progresivamente las secciones
6. Usuario puede:
   - Cambiar período y actualizar
   - Ver tooltips con detalles
   - Analizar tasa de seña vs meta
   - Identificar horarios pico
   - Ver ranking de usuarios
   - Exportar a PDF (preparado para futuro)

## Validaciones y Exclusiones

### Tasa de Seña
- ✅ Incluye: Órdenes confirmadas, en producción, completadas, entregadas
- ❌ Excluye: Órdenes canceladas, borradores
- ❌ Excluye: Órdenes de cuenta corriente
- ❌ Excluye: Órdenes de copiado asociadas a orden trabajo

### Tasa de Cobro (KPI)
- ✅ Incluye: Total cobrado / total facturado
- ❌ Excluye: Órdenes de cuenta corriente

### Estados Considerados
- Confirmado
- En Producción
- Completado
- Entregada

## Testing

✅ Compilación exitosa con `npm run build`
✅ Todos los tipos TypeScript correctos
✅ Importaciones válidas
✅ Componentes con props correctos
✅ Funciones SQL creadas y validadas

## Archivos Creados/Modificados

### Creados:
- `supabase/migrations/create_reporte_general_functions_v2.sql`
- `supabase/migrations/drop_and_update_reporte_functions.sql`
- `src/types/reportes.ts`
- `src/hooks/useReporteGeneral.ts`
- `src/components/reportes/VentasPorCategoriaChart.tsx`
- `src/components/reportes/VentasPorDiaChart.tsx`
- `src/components/reportes/VentasPorHoraChart.tsx`
- `src/components/reportes/VentasPorUsuarioTable.tsx`
- `src/components/reportes/TasaSenaCard.tsx`
- `src/pages/app/finanzas/reportes/ReporteGeneral.tsx`

### Modificados:
- `src/components/reportes/VentasKPICards.tsx`
- `src/components/reportes/VentasTimelineChart.tsx`
- `src/components/reportes/VentasPorCanalChart.tsx`
- `src/pages/app/finanzas/ReportesView.tsx`

## Próximos Pasos Sugeridos

1. **Exportación a PDF:** Implementar generación de PDF del reporte completo
2. **Comparación de Períodos:** Agregar vista comparativa entre dos períodos
3. **Alertas Automáticas:** Notificaciones cuando tasa de seña < 30%
4. **Gráficos Interactivos:** Agregar biblioteca de gráficos más avanzada (Chart.js, Recharts)
5. **Drill-down:** Click en gráficos para ver detalles
6. **Exportación a Excel:** Descargar datos en formato Excel

## Conclusión

El nuevo módulo de Reportes General proporciona una vista 360° del negocio con métricas clave para:
- Asegurar liquidez (tasa de seña)
- Optimizar operaciones (horarios pico, días de mayor venta)
- Evaluar equipo (ranking de usuarios)
- Identificar oportunidades (categorías rentables)
- Analizar canales y productos

Todas las métricas están diseñadas para facilitar la toma de decisiones basada en datos reales del negocio.
