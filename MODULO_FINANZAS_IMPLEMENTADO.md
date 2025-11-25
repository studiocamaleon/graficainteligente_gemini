# Módulo de Finanzas - Implementación Completa

## ✅ Estado: MVP Implementado y Funcional

El módulo de **Finanzas** con el submódulo de **Cuentas Corrientes** ha sido implementado completamente como MVP (Minimum Viable Product).

---

## 📋 Resumen de Implementación

### **1. Base de Datos (SQL) ✅**

#### Tablas Creadas

**`cuentas_corrientes_movimientos`**
- Registra todos los movimientos de cuenta corriente (cargos, pagos, ajustes)
- Campos: tipo_movimiento, fecha, monto_debe, monto_haber, saldo_acumulado
- Vinculación con órdenes, pagos y liquidaciones
- Cálculo automático de saldo acumulado

**`liquidaciones`**
- Agrupa órdenes de trabajo para facturación
- Campos: numero_liquidacion, fecha_emision, fecha_vencimiento, estado
- Totales: subtotal_ordenes, total_ajustes, total_general, total_pagado, saldo_pendiente
- Estados: pendiente, pagada_parcial, pagada_total, vencida, cancelada
- Generación automática de número secuencial (LIQ-000001)

**`liquidaciones_items`**
- Items que componen cada liquidación
- Vincula órdenes de trabajo a liquidaciones
- Evita duplicación de órdenes en múltiples liquidaciones

**`liquidaciones_pagos`**
- Vincula pagos de ordenes_trabajo_pagos con liquidaciones
- Permite distribuir un pago entre múltiples liquidaciones
- Campo monto_aplicado para pagos parciales

#### Funciones SQL Creadas

**`fn_generar_numero_liquidacion(p_company_id)`**
- Genera números secuenciales de liquidación por empresa
- Formato: LIQ-000001, LIQ-000002, etc.

**`fn_calcular_saldo_cuenta_corriente(p_cliente_id, p_fecha_hasta)`**
- Calcula el saldo actual de cuenta corriente de un cliente
- Suma: monto_debe - monto_haber hasta fecha específica

**`fn_obtener_estado_cuenta(p_company_id, p_cliente_id, p_fecha_desde, p_fecha_hasta)`**
- Retorna todos los movimientos en un período
- Incluye información de órdenes asociadas
- Ordenado cronológicamente

**`fn_obtener_ordenes_pendientes_liquidar(p_company_id, p_cliente_id, p_fecha_desde, p_fecha_hasta)`**
- Lista órdenes completadas sin liquidar
- Filtra por período
- Útil para crear nuevas liquidaciones

#### Triggers Implementados

**`trigger_registrar_cargo_cc_orden_completada()`**
- Se activa al cambiar estado de orden a "completado"
- Si cliente tiene cuenta corriente, genera cargo automático
- Actualiza saldo acumulado

**`trigger_registrar_pago_cc()`**
- Se activa al insertar pago en ordenes_trabajo_pagos
- Si cliente tiene cuenta corriente, registra movimiento de pago
- Actualiza saldo acumulado

**`trigger_actualizar_estado_liquidacion()`**
- Se activa al insertar/actualizar pagos de liquidación
- Recalcula total_pagado y saldo_pendiente
- Actualiza estado automáticamente según pagos

#### Seguridad (RLS)
- ✅ Todas las tablas con RLS habilitado
- ✅ Filtrado automático por company_id
- ✅ SELECT para todos los usuarios autenticados
- ✅ INSERT/UPDATE solo para admin, super_admin, manager

---

### **2. Tipos TypeScript ✅**

**Archivo:** `src/types/database.ts`

**Tipos Creados:**
- `TipoMovimientoCC`: 'cargo' | 'pago' | 'ajuste' | 'nota_credito' | 'nota_debito'
- `EstadoLiquidacion`: 'pendiente' | 'pagada_parcial' | 'pagada_total' | 'vencida' | 'cancelada'
- `CuentaCorrienteMovimiento`: Interface completa para movimientos
- `Liquidacion`: Interface completa para liquidaciones
- `LiquidacionItem`: Interface para items de liquidación
- `LiquidacionPago`: Interface para pagos de liquidación
- `LiquidacionConDetalles`: Extended interface con datos enriquecidos
- `EstadoCuentaMovimiento`: Interface para vista de estado de cuenta
- `ClienteConSaldo`: Interface para clientes con saldo calculado

---

### **3. Custom Hooks ✅**

#### `useCuentasCorrientes()` - `src/hooks/useCuentasCorrientes.ts`

**Funcionalidades:**
- Lista clientes con cuenta corriente habilitada
- Calcula saldo actual de cada cliente
- Determina estado CC (al_dia, proximo_vencer, vencido)
- Filtros por búsqueda y estado
- Auto-refresh

**Retorna:**
```typescript
{
  clientes: ClienteConSaldo[],
  loading: boolean,
  refetch: () => void
}
```

#### `useEstadoCuenta(clienteId)` - `src/hooks/useCuentasCorrientes.ts`

**Funcionalidades:**
- Obtiene movimientos de cuenta corriente por período
- Calcula saldo inicial y final
- Filtrado por fechas

**Retorna:**
```typescript
{
  movimientos: EstadoCuentaMovimiento[],
  loading: boolean,
  saldoInicial: number,
  saldoFinal: number,
  fetchEstadoCuenta: (desde?, hasta?) => void
}
```

#### `useMovimientosCC()` - `src/hooks/useCuentasCorrientes.ts`

**Funcionalidades:**
- Crear ajustes manuales (debe/haber)
- Recalcula saldo automáticamente

#### `useLiquidaciones()` - `src/hooks/useLiquidaciones.ts`

**Funcionalidades:**
- Lista liquidaciones con filtros (cliente, estado)
- Paginación
- Auto-refresh

**Retorna:**
```typescript
{
  liquidaciones: Liquidacion[],
  totalCount: number,
  loading: boolean,
  refetch: () => void
}
```

#### `useLiquidacion(liquidacionId)` - `src/hooks/useLiquidaciones.ts`

**Funcionalidades:**
- Obtiene detalle completo de una liquidación
- Incluye items y pagos aplicados
- Datos enriquecidos del cliente

#### `useLiquidacionMutations()` - `src/hooks/useLiquidaciones.ts`

**Funcionalidades:**
- `crearLiquidacion()`: Crea nueva liquidación con órdenes seleccionadas
- `anularLiquidacion()`: Cancela una liquidación
- Cálculo automático de fecha de vencimiento según acuerdo de pago

#### `useOrdenesPendientesLiquidar(clienteId)` - `src/hooks/useLiquidaciones.ts`

**Funcionalidades:**
- Lista órdenes completadas sin liquidar
- Filtro por período
- Útil para modal de creación de liquidación

---

### **4. Componentes UI ✅**

#### `ClienteCard` - `src/components/finanzas/ClienteCard.tsx`

**Características:**
- Muestra datos del cliente (nombre, razón social, documento)
- Badge de estado (al día, próximo a vencer, vencido)
- Saldo actual destacado
- Acuerdo de pago
- Botones: "Ver Estado" y "Nueva Liquidación"
- Estados visuales con colores (verde/amarillo/rojo)

#### `EstadoCuentaModal` - `src/components/finanzas/EstadoCuentaModal.tsx`

**Características:**
- Modal tamaño XL con tabla completa
- Filtros por fecha (desde/hasta) con DatePickers
- Tabla de movimientos con columnas:
  - Fecha
  - Tipo (badge con color)
  - Descripción
  - Debe (rojo)
  - Haber (verde)
  - Saldo acumulado
- Saldo inicial y final destacados
- Botón "Exportar PDF" (placeholder)
- Scroll interno para muchos movimientos

---

### **5. Vistas Principales ✅**

#### `CuentasCorrientesView` - `src/pages/app/finanzas/CuentasCorrientesView.tsx`

**Características:**
- Barra de búsqueda (nombre, razón social, documento)
- Filtro por estado CC
- Grid responsive de ClienteCards (1-2-3 columnas)
- Estado de carga con skeleton
- Empty state cuando no hay clientes
- Contador de resultados
- Integración con EstadoCuentaModal

#### `LiquidacionesView` - `src/pages/app/finanzas/LiquidacionesView.tsx`

**Características:**
- Filtro por estado de liquidación
- Tabla completa con columnas:
  - N° Liquidación
  - Fecha Emisión
  - Vencimiento
  - Total
  - Pagado (verde)
  - Saldo (rojo/verde según valor)
  - Estado (badge con colores)
  - Acciones (botón Ver detalle)
- Paginación (muestra 25 por página)
- Empty state cuando no hay liquidaciones
- Estado de carga con skeleton

#### `Finanzas` - `src/pages/app/Finanzas.tsx`

**Características:**
- Componente principal con routing interno
- Sistema de Tabs para navegación
- Dos submódulos:
  1. Cuentas Corrientes
  2. Liquidaciones
- Integración con PageHeader
- Redirección automática a Cuentas Corrientes

---

### **6. Configuración del Módulo ✅**

#### Actualización de `constants/modules.ts`

Módulo **Finanzas** actualizado como desplegable:
```typescript
{
  id: 'finance',
  name: 'Finanzas',
  icon: TrendingUp,
  path: '/app/finanzas',
  children: [
    {
      id: 'finance-cuentas-corrientes',
      name: 'Cuentas Corrientes',
      path: '/app/finanzas/cuentas-corrientes',
      icon: DollarSign,
    },
    {
      id: 'finance-liquidaciones',
      name: 'Liquidaciones',
      path: '/app/finanzas/liquidaciones',
      icon: FileText,
    },
  ],
}
```

#### Rutas en `App.tsx`

```typescript
<Route path="finanzas/*" element={<Finanzas />} />
```

---

## 🎯 Funcionalidades Implementadas (MVP)

### ✅ Gestión de Cuentas Corrientes

1. **Visualización de clientes con CC:**
   - Lista de todos los clientes con cuenta corriente habilitada
   - Cálculo automático de saldo actual
   - Indicadores visuales de estado (al día, próximo a vencer, vencido)
   - Búsqueda y filtrado

2. **Estado de Cuenta:**
   - Historial completo de movimientos
   - Filtrado por período
   - Saldo inicial y final
   - Exportación PDF (pendiente implementación completa)

3. **Automatización:**
   - Cargo automático al completar orden
   - Registro automático de pagos
   - Cálculo automático de saldos acumulados

### ✅ Gestión de Liquidaciones

1. **Listado de liquidaciones:**
   - Todas las liquidaciones generadas
   - Filtros por estado
   - Información completa en tabla
   - Paginación

2. **Estados automáticos:**
   - Pendiente (sin pagos)
   - Pagada Parcial (pagos < total)
   - Pagada Total (pagos = total)
   - Vencida (manual o por fecha)
   - Cancelada (anulación manual)

---

## 📊 Flujo de Negocio Implementado

### Flujo Completo de Cuenta Corriente

```
1. Cliente con tiene_cuenta_corriente = true
   ↓
2. Orden completada
   ↓
3. Trigger registra CARGO en movimientos
   ↓
4. Saldo aumenta (debe)
   ↓
5. Se crea Liquidación (agrupa órdenes)
   ↓
6. Cliente realiza pago
   ↓
7. Trigger registra PAGO en movimientos
   ↓
8. Saldo disminuye (haber)
   ↓
9. Trigger actualiza estado liquidación
```

### Cálculo de Saldo

```
Saldo = Σ(monto_debe) - Σ(monto_haber)
```

- **Debe (+)**: Cargos por órdenes, ajustes de debe, notas de débito
- **Haber (-)**: Pagos, ajustes de haber, notas de crédito

---

## 🔒 Seguridad Implementada

### Row Level Security (RLS)

**Todas las tablas:**
- SELECT: Todos los usuarios autenticados de la empresa
- INSERT/UPDATE: Solo admin, super_admin, manager
- DELETE: Solo super_admin (soft delete recomendado)

### Multi-Tenancy

- Filtrado automático por `company_id` en todas las consultas
- Isolación estricta de datos entre empresas
- Funciones SQL con `SECURITY DEFINER` para operaciones seguras

---

## 🚀 Estado del Proyecto

### ✅ Completado (MVP)

1. ✅ Base de datos completa (4 tablas)
2. ✅ Funciones SQL (4 funciones)
3. ✅ Triggers automatizados (3 triggers)
4. ✅ Tipos TypeScript completos
5. ✅ Custom hooks (6 hooks)
6. ✅ Componentes UI (2 componentes)
7. ✅ Vistas principales (3 vistas)
8. ✅ Integración en sidebar (módulo desplegable)
9. ✅ Routing configurado
10. ✅ Compilación exitosa

### 📝 Pendiente (Mejoras Futuras)

1. **Modal de Creación de Liquidación:**
   - Selector de órdenes pendientes
   - Preview de total
   - Campo de ajustes

2. **Modal de Detalle de Liquidación:**
   - Ver items completos
   - Historial de pagos
   - Registrar nuevo pago
   - Anular liquidación
   - Exportar PDF

3. **Exportación PDF Completa:**
   - Estado de cuenta con logo de empresa
   - Liquidación con detalles
   - Timezone Argentina (UTC-3)

4. **Modal de Registro de Pago:**
   - Selector de medio de cobro
   - Upload de comprobante
   - Distribución entre liquidaciones

5. **Dashboard Financiero:**
   - KPIs de cobranza
   - Gráficos de aging
   - Proyección de ingresos

6. **Notificaciones:**
   - Email al generar liquidación
   - Alertas de vencimiento
   - Recordatorios automáticos

7. **Ajustes Manuales:**
   - Modal para crear ajustes
   - Notas de crédito/débito

---

## 💡 Cómo Usar el Módulo

### Para Clientes con Cuenta Corriente

1. **Configurar Cliente:**
   - En módulo Clientes, marcar `tiene_cuenta_corriente = true`
   - Asignar `acuerdo_pago` (Semanal/Quincenal/Mensual)

2. **Flujo Normal:**
   - Crear orden de trabajo normalmente
   - Al completar orden, se genera cargo automático en CC
   - Cliente NO necesita pagar de inmediato

3. **Crear Liquidación:**
   - Ir a Finanzas > Liquidaciones
   - Clic en "Nueva Liquidación" (futuro)
   - Seleccionar órdenes del período
   - Sistema calcula total y vencimiento

4. **Registrar Pagos:**
   - Cliente paga liquidación
   - Registrar pago en sistema
   - Se actualiza automáticamente saldo y estado

5. **Ver Estado de Cuenta:**
   - Ir a Finanzas > Cuentas Corrientes
   - Buscar cliente
   - Clic en "Ver Estado"
   - Filtrar por período si es necesario

---

## 🎉 El módulo de Finanzas está listo para usar en su versión MVP

**Funcionalidades core implementadas:**
- ✅ Registro automático de cargos y pagos
- ✅ Cálculo de saldos en tiempo real
- ✅ Visualización de estado de cuenta
- ✅ Gestión de liquidaciones
- ✅ Estados automáticos
- ✅ Multi-tenancy seguro

**El sistema está preparado para ser extendido con las funcionalidades adicionales según las prioridades del negocio.**
