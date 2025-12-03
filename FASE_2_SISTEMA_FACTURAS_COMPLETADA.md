# ✅ FASE 2 COMPLETADA: Sistema de Facturación - Funciones de Base de Datos

**Fecha de implementación**: 2025-12-03
**Migración aplicada**: `create_facturas_functions.sql`
**Estado**: ✅ EXITOSO

---

## 📋 Resumen de Cambios Aplicados

### ✅ 3 Funciones de Base de Datos Creadas

Se implementaron las funciones principales para gestionar el sistema de facturación:

---

## 1. ✅ `fn_ordenes_pendientes_facturacion`

**Propósito**: Obtener lista de órdenes que requieren factura pero aún no han sido facturadas

### Parámetros:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `p_company_id` | uuid | ✅ Sí | ID de la empresa |
| `p_fecha_desde` | date | No | Filtro desde fecha |
| `p_fecha_hasta` | date | No | Filtro hasta fecha |
| `p_cliente_id` | uuid | No | Filtro por cliente |
| `p_estado` | text | No | Filtro por estado |

### Retorna: TABLE con 15 columnas
- **Orden**: id, numero_orden, estado, fecha_creacion, fecha_estimada_entrega
- **Cliente**: cliente_id, cliente_nombre, cliente_email, cliente_whatsapp
- **Vendedor**: vendedor_id, vendedor_nombre
- **Montos**: subtotal, subtotal_iva, total
- **Métricas**: dias_pendiente (calculado desde creación)

### Ejemplo de uso:
```sql
-- Todas las órdenes pendientes de una empresa
SELECT * FROM fn_ordenes_pendientes_facturacion('company-uuid');

-- Con filtros de fecha
SELECT * FROM fn_ordenes_pendientes_facturacion(
  'company-uuid',
  '2025-01-01'::date,
  '2025-12-31'::date
);

-- Por cliente específico y estado
SELECT * FROM fn_ordenes_pendientes_facturacion(
  'company-uuid',
  NULL,
  NULL,
  'cliente-uuid',
  'finalizada'
);
```

### Optimización:
- ✅ Usa índice `idx_ordenes_pendientes_facturacion` (Fase 1)
- ✅ JOIN eficientes con clients y profiles
- ✅ Ordenamiento por fecha de creación DESC

---

## 2. ✅ `fn_registrar_factura`

**Propósito**: Registrar que una orden ha sido facturada (operación completa con auditoría)

### Parámetros:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `p_orden_id` | uuid | ✅ Sí | ID de la orden |
| `p_numero_factura` | text | ✅ Sí | Número de factura fiscal |
| `p_factura_storage_path` | text | ✅ Sí | Ruta del PDF en storage |
| `p_observaciones` | text | No | Notas adicionales |
| `p_user_id` | uuid | No | ID del usuario |

### Retorna: JSON
```json
{
  "orden_id": "uuid",
  "numero_orden": "OT-2025-001",
  "numero_factura": "FC-001-00000123",
  "cliente_nombre": "Cliente SA",
  "cliente_whatsapp": "+5491123456789",
  "cliente_email": "cliente@example.com",
  "company_id": "uuid",
  "company_name": "Mi Empresa",
  "factura_storage_path": "company-uuid/orden-uuid/factura.pdf",
  "total": 15000.00,
  "subtotal_iva": 2605.00,
  "fecha_facturacion": "2025-12-03T10:30:00Z"
}
```

### Validaciones implementadas:
1. ✅ Orden debe existir
2. ✅ Orden debe requerir factura (`requiere_factura = true`)
3. ✅ Orden NO debe estar ya facturada (`facturada = false`)
4. ✅ Cliente debe existir
5. ✅ Empresa debe existir

### Side effects (transacción atómica):
1. **Actualiza `ordenes_trabajo`**:
   - `facturada` = true
   - `fecha_facturacion` = now()
   - `numero_factura` = valor ingresado
   - `factura_storage_path` = ruta del PDF
   - `updated_at` = now()
   - `updated_by` = usuario

2. **Inserta en `facturas_historial`**:
   - Tipo de operación: `'creacion'`
   - Todos los montos (subtotal, IVA, total)
   - Ruta del archivo
   - Usuario que lo creó
   - Observaciones

3. **Retorna JSON para notificación**:
   - Datos listos para enviar WhatsApp
   - Información completa para email
   - Links de descarga

### Ejemplo de uso:
```sql
-- Registrar factura
SELECT fn_registrar_factura(
  'orden-uuid',
  'FC-001-00000123',
  '550e8400-e29b-41d4-a716-446655440000/orden-uuid/1733256000000_factura.pdf',
  'Factura generada correctamente',
  'user-uuid'
);
```

### Manejo de errores:
```sql
-- Error si orden no existe
ERROR: Orden no encontrada con ID: {uuid}

-- Error si orden no requiere factura
ERROR: Esta orden no requiere factura. Número de orden: OT-2025-001

-- Error si ya está facturada
ERROR: Esta orden ya tiene factura registrada. Número de factura: FC-001-00000122
```

---

## 3. ✅ `fn_estadisticas_facturacion`

**Propósito**: Obtener KPIs y métricas del sistema de facturación

### Parámetros:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `p_company_id` | uuid | ✅ Sí | ID de la empresa |
| `p_fecha_desde` | date | No | Filtro desde fecha |
| `p_fecha_hasta` | date | No | Filtro hasta fecha |

### Retorna: JSON con 9 KPIs
```json
{
  "total_ordenes_requieren_factura": 150,
  "ordenes_pendientes": 45,
  "ordenes_facturadas": 105,
  "monto_total_pendiente": 450000.00,
  "monto_total_facturado": 1250000.00,
  "monto_iva_pendiente": 78300.00,
  "monto_iva_facturado": 217500.00,
  "promedio_dias_facturacion": 3.5,
  "tasa_facturacion": 70.00
}
```

### KPIs incluidos:

1. **`total_ordenes_requieren_factura`**: Total de órdenes que necesitan factura
2. **`ordenes_pendientes`**: Órdenes sin factura aún
3. **`ordenes_facturadas`**: Órdenes ya facturadas
4. **`monto_total_pendiente`**: $ pendiente de facturar
5. **`monto_total_facturado`**: $ ya facturado
6. **`monto_iva_pendiente`**: IVA pendiente
7. **`monto_iva_facturado`**: IVA ya facturado
8. **`promedio_dias_facturacion`**: Promedio de días entre creación y facturación
9. **`tasa_facturacion`**: % de órdenes facturadas vs pendientes

### Ejemplo de uso:
```sql
-- Estadísticas generales
SELECT fn_estadisticas_facturacion('company-uuid');

-- Estadísticas de un período
SELECT fn_estadisticas_facturacion(
  'company-uuid',
  '2025-01-01'::date,
  '2025-12-31'::date
);

-- Solo del mes actual
SELECT fn_estadisticas_facturacion(
  'company-uuid',
  date_trunc('month', CURRENT_DATE)::date,
  CURRENT_DATE::date
);
```

### Casos especiales:
- ✅ Si no hay órdenes, todos los valores numéricos son 0
- ✅ `promedio_dias_facturacion` solo cuenta órdenes facturadas
- ✅ `tasa_facturacion` se calcula como % sobre total
- ✅ Todos los montos son numéricos con 2 decimales

---

## 🔒 Seguridad

### SECURITY DEFINER
Todas las funciones usan `SECURITY DEFINER`:
- ✅ Se ejecutan con privilegios del creador
- ✅ Bypass controlado de RLS
- ✅ Validación de company_id en la lógica

### Permisos otorgados:
```sql
GRANT EXECUTE ON FUNCTION fn_ordenes_pendientes_facturacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_factura TO authenticated;
GRANT EXECUTE ON FUNCTION fn_estadisticas_facturacion TO authenticated;
```

### Validaciones de seguridad:
- ✅ Solo usuarios autenticados pueden ejecutar
- ✅ Cada función valida company_id
- ✅ No se pueden registrar facturas en órdenes de otras empresas
- ✅ Auditoría completa en facturas_historial

---

## 📊 Performance

### Índices utilizados:
1. **`idx_ordenes_pendientes_facturacion`** - Query principal
2. **`idx_ordenes_facturadas`** - Estadísticas de facturadas
3. **`idx_ordenes_numero_factura`** - Búsqueda por número
4. **`idx_facturas_historial_orden`** - Historial por orden

### Optimizaciones:
- ✅ JOIN solo con tablas necesarias
- ✅ Filtros opcionales con `IS NULL OR condición`
- ✅ FILTER clauses para agregaciones eficientes
- ✅ Índices parciales para queries frecuentes

---

## 🎯 Queries de Verificación

### Verificar funciones creadas:
```sql
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type,
  obj_description(oid) as description
FROM pg_proc
WHERE proname LIKE 'fn_%factura%'
ORDER BY proname;
```

### Probar función de órdenes pendientes:
```sql
-- Debe retornar vacío si no hay órdenes pendientes
SELECT * FROM fn_ordenes_pendientes_facturacion(
  (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);
```

### Probar estadísticas:
```sql
-- Debe retornar JSON con 9 campos
SELECT fn_estadisticas_facturacion(
  (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);
```

---

## 📊 Métricas de la Implementación

| Métrica | Valor |
|---------|-------|
| Funciones creadas | 3 |
| Parámetros totales | 13 |
| Validaciones implementadas | 5 |
| KPIs calculados | 9 |
| Tablas afectadas | 3 (ordenes_trabajo, facturas_historial, clients) |
| Índices utilizados | 4 |
| Líneas de SQL | ~350 |

---

## ✅ Checklist de Validación

### Funciones
- [x] `fn_ordenes_pendientes_facturacion` creada
- [x] `fn_registrar_factura` creada
- [x] `fn_estadisticas_facturacion` creada

### Validaciones
- [x] Orden debe existir
- [x] Orden debe requerir factura
- [x] Orden no debe estar facturada
- [x] Cliente debe existir
- [x] Empresa debe existir

### Seguridad
- [x] SECURITY DEFINER habilitado
- [x] Permisos otorgados a authenticated
- [x] Validación de company_id

### Auditoría
- [x] Registro en facturas_historial
- [x] Tipo de operación 'creacion'
- [x] Usuario que registra (created_by)

### Integración
- [x] Retorna JSON para notificaciones
- [x] Datos completos para WhatsApp
- [x] Información para email

---

## 🚀 Próximos Pasos

La Fase 2 está completa. Ahora puedes proceder con:

### **FASE 3: Actualizar Frontend - Persistir Facturación** (Próxima)
- Actualizar tipos TypeScript (`src/types/database.ts`)
- Modificar `CreateOrderPage.tsx` para persistir `requiere_factura` y `subtotal_iva`
- Actualizar `OrderDetailPage.tsx` para mostrar estado de facturación
- Agregar badge visual para órdenes facturadas

### **FASE 4: Crear Módulo de Facturas en Finanzas**
- Hook `useFacturas.ts` para consumir las funciones
- Página `FacturasView.tsx` para gestión
- Componentes de UI (lista, filtros, estadísticas)

---

## 📝 Notas Técnicas

### Transacciones
- `fn_registrar_factura` es atómica (todo o nada)
- Si falla la inserción en historial, se revierte el UPDATE
- Garantiza consistencia de datos

### JSON de notificación
El JSON retornado por `fn_registrar_factura` está listo para:
- Enviar WhatsApp con todos los datos
- Generar email de confirmación
- Crear link de descarga del PDF
- Logging y auditoría

### Extensibilidad
El sistema está preparado para:
- Agregar `fn_reemplazar_factura` (tipo_operacion='reemplazo')
- Agregar `fn_anular_factura` (tipo_operacion='anulacion')
- Agregar más filtros a las queries
- Agregar más KPIs a estadísticas

---

**Estado Final**: ✅ FASE 2 COMPLETADA EXITOSAMENTE

**Tiempo de implementación**: ~10 minutos
**Sin errores detectados**
**Sistema listo para Fase 3 (Frontend)**
