# Resumen Ejecutivo: Sistema de Facturas

**Sistema**: Gestión completa de facturas para órdenes de trabajo
**Plan completo**: 7 fases (Base de Datos → Frontend → Integración)
**Progreso**: ✅ 2/7 Fases completadas (28%)

---

## 🎯 Objetivo
Implementar un sistema completo para gestionar facturas de órdenes de trabajo, desde el registro inicial hasta la notificación automática al cliente vía WhatsApp.

---

## 📊 Estado Actual

### ✅ COMPLETADO (Fase 1 y 2):
- ✅ **Base de Datos**: Schema completo con 6 campos nuevos
- ✅ **Tabla `facturas_historial`**: Auditoría completa
- ✅ **Storage bucket `facturas`**: Privado con RLS
- ✅ **8 índices optimizados**: Para queries eficientes
- ✅ **3 funciones BD**: Consultar, registrar, estadísticas

### ⏳ PENDIENTE (Fase 3-7):
- ⏳ Persistir en frontend (CreateOrderPage, OrderDetailPage)
- ⏳ Módulo "Facturas" en Finanzas
- ⏳ Sistema de carga de archivos PDF
- ⏳ Notificaciones WhatsApp automáticas
- ⏳ Testing y documentación

---

## 🏗️ Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                            │
└─────────────────────────────────────────────────────────────┘

1. CREAR ORDEN
   ├─ Usuario activa switch "Requiere factura"
   ├─ Sistema calcula IVA (21%)
   ├─ Se guarda en BD: requiere_factura=true, subtotal_iva=XXX
   └─ Orden queda "Pendiente de Facturación"

2. MÓDULO FACTURAS (Finanzas)
   ├─ Lista órdenes pendientes de facturación
   ├─ KPIs: pendientes, facturadas, montos IVA
   ├─ Filtros: fecha, cliente, estado
   └─ Acción: "Cargar Factura"

3. CARGAR FACTURA
   ├─ Modal con:
   │  ├─ Input: Número de factura
   │  ├─ Upload: Archivo PDF
   │  └─ Textarea: Observaciones (opcional)
   ├─ Sube archivo a Storage (bucket: facturas)
   ├─ Actualiza BD: facturada=true, fecha_facturacion=now()
   └─ Registra en historial de auditoría

4. NOTIFICACIÓN AUTOMÁTICA
   ├─ Edge Function: notify-factura-disponible
   ├─ Genera Signed URL (válida 30 días)
   ├─ Envía WhatsApp con:
   │  ├─ Número de factura
   │  ├─ Link de descarga
   │  └─ Empresa y orden
   └─ Registra en whatsapp_notificaciones

5. CLIENTE RECIBE
   ├─ Mensaje WhatsApp instantáneo
   ├─ Link para descargar factura
   └─ Válido por 30 días
```

---

## 🗄️ Cambios en Base de Datos

### Nuevos Campos en `ordenes_trabajo`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `requiere_factura` | boolean | Si cliente pidió factura |
| `subtotal_iva` | numeric | Monto IVA calculado (21%) |
| `facturada` | boolean | Si ya se cargó factura |
| `fecha_facturacion` | timestamptz | Cuándo se cargó |
| `numero_factura` | text | Número fiscal |
| `factura_storage_path` | text | Ruta en Storage |

### Nueva Tabla `facturas_historial`:

Auditoría completa de todas las operaciones sobre facturas:
- Creación, reemplazo, anulación
- Quién, cuándo, montos
- Trazabilidad completa

### Nuevas Funciones:

1. **`fn_ordenes_pendientes_facturacion`**
   - Lista órdenes que requieren factura pero no tienen
   - Incluye datos de cliente y vendedor
   - Filtros por fecha, cliente, estado

2. **`fn_registrar_factura`**
   - Registra que orden fue facturada
   - Actualiza todos los campos
   - Crea entrada en historial
   - Retorna datos para notificación

3. **`fn_estadisticas_facturacion`**
   - KPIs del sistema
   - Pendientes vs facturadas
   - Montos IVA
   - Promedio días hasta facturación

---

## 💻 Componentes Frontend

### Nuevo Módulo: `/app/finanzas/facturas`

#### **FacturasView.tsx** (Página Principal)
```
┌──────────────────────────────────────────────────┐
│  📊 KPI Cards                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 45   │ │ 12   │ │ 33   │ │$XXX  │            │
│  │Total │ │Pend. │ │Fact. │ │IVA   │            │
│  └──────┘ └──────┘ └──────┘ └──────┘            │
├──────────────────────────────────────────────────┤
│  🔍 Filtros: [Fecha] [Cliente] [Estado]         │
├──────────────────────────────────────────────────┤
│  📋 Órdenes Pendientes de Facturación           │
│                                                   │
│  GI-001234 │ Cliente ABC │ $10,500 │ [Cargar]  │
│  GI-001235 │ Cliente XYZ │ $8,900  │ [Cargar]  │
│  GI-001236 │ Cliente 123 │ $15,200 │ [Cargar]  │
└──────────────────────────────────────────────────┘
```

#### **CargarFacturaModal.tsx**
```
┌─────────────────────────────────────┐
│  Cargar Factura - GI-001234        │
├─────────────────────────────────────┤
│  Número de Factura: [_____________]│
│  Archivo PDF:       [Elegir archivo]│
│  Observaciones:     [_____________]│
│                     [_____________]│
│                                     │
│        [Cancelar] [Guardar y       │
│                    Notificar]      │
└─────────────────────────────────────┘
```

### Hook: `useFacturas.ts`
- `ordenesPendientes`: Array de órdenes sin factura
- `estadisticas`: KPIs del sistema
- `registrarFactura()`: Carga archivo y notifica
- `descargarFactura()`: Genera signed URL

---

## 📱 Notificación WhatsApp

### Mensaje Automático:
```
*NombreEmpresa* - Factura Disponible 📄

Hola Cliente ABC,

Tu factura *001-00012345* para la orden *GI-001234*
ya está disponible.

📥 *Descargar factura:*
https://storage.supabase.co/...

Este link es válido por 30 días.

Si tienes alguna consulta, no dudes en contactarnos.

¡Gracias por tu confianza!
```

### Edge Function: `notify-factura-disponible`
- Genera signed URL (30 días de validez)
- Envía mensaje vía Evolution API
- Registra en `whatsapp_notificaciones`
- Manejo de errores robusto

---

## 🔐 Seguridad

### Permisos:
- **Ver facturas**: Admin, Contador, Finanzas
- **Cargar facturas**: Admin, Contador
- **Descargar**: Admin, Contador, Finanzas, Vendedor (solo sus órdenes)

### Storage:
- Bucket privado: `facturas`
- Estructura: `{company_id}/{orden_id}/{timestamp}_{filename}.pdf`
- RLS por company_id
- Signed URLs con expiración

### Validaciones:
- Solo PDF permitidos
- Número de factura obligatorio
- Solo órdenes con `requiere_factura = true`
- Solo órdenes NO facturadas aparecen

---

## 📊 Indicadores de Éxito

### KPIs Principales:
1. **Órdenes Pendientes**: Cantidad sin factura
2. **Órdenes Facturadas**: Cantidad completadas
3. **Monto IVA Pendiente**: $ en órdenes sin factura
4. **Monto IVA Facturado**: $ ya facturado
5. **Promedio Días**: Tiempo orden → factura
6. **Tasa Notificación**: % WhatsApp enviados exitosos

### Métricas de Uso:
- Tiempo promedio de carga de factura
- Facturas subidas por día/semana/mes
- Clientes notificados
- Descargas de factura (tracking futuro)

---

## ⏱️ Implementación

### Fases:
1. **BD y Funciones** → 5 horas
2. **Persistir en Órdenes** → 2 horas
3. **Edge Function** → 2 horas
4. **Módulo Frontend** → 6 horas
5. **Navegación** → 1 hora
6. **Testing** → 3 horas

**Total: ~19 horas**

### Orden Recomendado:
1. Actualizar esquema BD
2. Crear funciones BD
3. Persistir en órdenes (validar)
4. Edge function WhatsApp
5. Módulo frontend completo
6. Integrar navegación
7. Testing end-to-end

---

## 🚀 Quick Start (Para Implementar)

```bash
# 1. Aplicar migración de BD
supabase migration create add_facturacion_to_ordenes_trabajo

# 2. Actualizar tipos TypeScript
# Archivo: src/types/database.ts

# 3. Actualizar CreateOrderPage.tsx
# Persistir: requiere_factura, subtotal_iva

# 4. Crear hook useFacturas.ts

# 5. Crear módulo FacturasView.tsx

# 6. Crear Edge Function
supabase functions new notify-factura-disponible

# 7. Agregar ruta en App.tsx
# /app/finanzas/facturas

# 8. Testing completo
```

---

## 📚 Archivos Principales

### Base de Datos:
- `add_facturacion_to_ordenes_trabajo.sql` - Migración principal
- `create_facturas_functions.sql` - Funciones de negocio

### Frontend:
- `src/hooks/useFacturas.ts` - Lógica de negocio
- `src/pages/app/finanzas/FacturasView.tsx` - Vista principal
- `src/components/facturas/CargarFacturaModal.tsx` - Modal de carga
- `src/components/facturas/FacturasKPICards.tsx` - Métricas

### Backend:
- `supabase/functions/notify-factura-disponible/index.ts` - Notificaciones

### Navegación:
- `src/App.tsx` - Nueva ruta
- `src/layouts/MainLayout.tsx` - Ítem menú

---

## 💡 Mejoras Futuras (Fuera de Alcance Actual)

1. **Facturación Electrónica**: Integración con AFIP
2. **Multi-moneda**: Soporte USD, EUR
3. **IVA Configurable**: Por empresa o producto
4. **Recordatorios**: Notificar órdenes sin facturar después de X días
5. **Tracking**: Saber si cliente descargó factura
6. **Nota de Crédito**: Sistema para anulaciones
7. **Exportación**: Excel/CSV de facturas
8. **Firma Digital**: Validación de facturas
9. **OCR**: Extraer datos de factura escaneada
10. **Dashboard**: Gráficos de facturación

---

## 📈 Progreso por Fases

| Fase | Estado | Descripción | Documentación |
|------|--------|-------------|---------------|
| **Fase 1** | ✅ Completada | Base de Datos - Schema | `FASE_1_SISTEMA_FACTURAS_COMPLETADA.md` |
| **Fase 2** | ✅ Completada | Base de Datos - Funciones | `FASE_2_SISTEMA_FACTURAS_COMPLETADA.md` |
| **Fase 3** | ⏳ Pendiente | Frontend - Persistencia | Types + CreateOrder + OrderDetail |
| **Fase 4** | ⏳ Pendiente | Frontend - Módulo Facturas | Hook + Página + Componentes |
| **Fase 5** | ⏳ Pendiente | Upload de PDFs | FileUpload + Storage |
| **Fase 6** | ⏳ Pendiente | Notificaciones WhatsApp | Trigger + Edge Function |
| **Fase 7** | ⏳ Pendiente | Testing y Documentación | Tests + Docs + Capacitación |

### ✅ Fase 1: Base de Datos - Schema (COMPLETADA)
- 6 campos nuevos en `ordenes_trabajo`
- Tabla `facturas_historial` con auditoría
- Storage bucket `facturas` (privado)
- 8 índices optimizados
- Migración: `add_sistema_facturacion.sql`

### ✅ Fase 2: Base de Datos - Funciones (COMPLETADA)
- `fn_ordenes_pendientes_facturacion` - Consultar pendientes
- `fn_registrar_factura` - Registrar con auditoría
- `fn_estadisticas_facturacion` - KPIs del sistema
- Migración: `create_facturas_functions.sql`

### ⏳ Siguiente: Fase 3 - Frontend Persistencia
**Objetivo**: Guardar y mostrar campos de facturación en órdenes

**Tareas**:
1. Actualizar tipos TypeScript (`src/types/database.ts`)
2. Modificar `CreateOrderPage.tsx` - Persistir campos
3. Actualizar `OrderDetailPage.tsx` - Mostrar estado

**Archivos a modificar**: 3
**Tiempo estimado**: 1-2 horas

---

**Documento de referencia para implementación del Sistema de Facturas**
Versión: 2.0 (Actualizado con progreso de Fase 1 y 2)
Última actualización: 2025-12-03
