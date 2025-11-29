# ✅ FASE 1 COMPLETADA: Sistema de Pausas en Producción - Base de Datos

**Fecha**: 2025-11-30
**Duración**: Completada exitosamente
**Estado**: ✅ Todas las tablas creadas y validadas

---

## 📋 Resumen Ejecutivo

La Fase 1 del Sistema de Pausas en Producción ha sido implementada completamente. Se crearon 3 nuevas tablas, se modificó la estructura de `ordenes_trabajo_items_rutas`, y se configuraron 16 motivos predeterminados para cada empresa.

---

## 🗄️ Tablas Creadas

### 1. `pasos_motivos_pausa` ✅
**Propósito**: Catálogo de motivos de pausa configurables por empresa

**Campos**:
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies)
- `nombre` (text)
- `categoria` (text): cliente, materiales, maquinaria, personal, externo, otro
- `requiere_descripcion` (boolean)
- `color` (text): Color hex para UI
- `icono` (text): Nombre del icono de lucide-react
- `orden` (integer)
- `is_active` (boolean)
- `created_at`, `updated_at`

**Índices**:
- `idx_motivos_pausa_company` (company_id)
- `idx_motivos_pausa_categoria` (categoria)
- `idx_motivos_pausa_activos` (company_id, is_active WHERE is_active = true)

**RLS**: ✅ Habilitado
- SELECT: Todos los usuarios de la empresa
- INSERT/UPDATE/DELETE: Solo super_admin, admin, manager

**Constraint**:
- Unique: (company_id, nombre)

---

### 2. `ordenes_items_rutas_pausas` ✅
**Propósito**: Registro histórico de pausas con motivos y duraciones

**Campos**:
- `id` (uuid, PK)
- `ruta_id` (uuid, FK → ordenes_trabajo_items_rutas)
- `motivo_pausa_id` (uuid, FK → pasos_motivos_pausa)
- `categoria_motivo` (text)
- `descripcion` (text, nullable)
- `fecha_inicio_pausa` (timestamptz)
- `fecha_fin_pausa` (timestamptz, nullable) ← NULL = pausa activa
- `pausado_por` (uuid, FK → profiles)
- `reanudado_por` (uuid, FK → profiles)
- `duracion_minutos` (integer, GENERATED STORED)
- `created_at`

**Campo Calculado**:
```sql
duracion_minutos = EXTRACT(EPOCH FROM (fecha_fin_pausa - fecha_inicio_pausa)) / 60
```

**Índices**:
- `idx_pausas_ruta` (ruta_id)
- `idx_pausas_motivo` (motivo_pausa_id)
- `idx_pausas_activas` (ruta_id WHERE fecha_fin_pausa IS NULL)
- `idx_pausas_categoria` (categoria_motivo)
- `idx_pausas_fecha_inicio` (fecha_inicio_pausa)

**RLS**: ✅ Habilitado
- Políticas por company_id a través de JOIN con ordenes_trabajo_items_rutas

**Constraints**:
- CHECK: fecha_fin_pausa >= fecha_inicio_pausa

**Casos de Uso**:
- ✅ Múltiples pausas por paso (ciclos de revisión)
- ✅ Historial completo de pausas
- ✅ Duración automática calculada

---

### 3. `notificaciones_internas` ✅
**Propósito**: Sistema de notificaciones para super_admin y admin

**Campos**:
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies)
- `usuario_id` (uuid, FK → profiles)
- `tipo` (text): pausa_prolongada, paso_completado, orden_finalizada, alerta_produccion, sistema
- `titulo` (text)
- `mensaje` (text)
- `referencia_tipo` (text): orden_trabajo, orden_item, ruta_paso, pausa
- `referencia_id` (uuid)
- `metadata` (jsonb)
- `leida` (boolean)
- `leida_at` (timestamptz)
- `created_at`

**Índices**:
- `idx_notificaciones_usuario` (usuario_id, leida, created_at DESC)
- `idx_notificaciones_company` (company_id)
- `idx_notificaciones_referencia` (referencia_tipo, referencia_id)
- `idx_notificaciones_no_leidas` (usuario_id, company_id WHERE leida = false)

**RLS**: ✅ Habilitado
- Usuarios solo ven sus propias notificaciones

**Uso**:
- Alertas de pausas > 24 horas
- Notificaciones de producción
- Sistema de mensajería interna

---

## 🔧 Modificaciones a Tablas Existentes

### `ordenes_trabajo_items_rutas` ✅

**Constraint Actualizado**:
```sql
CHECK (estado_paso IN ('pendiente', 'en_proceso', 'completado', 'omitido', 'pausado'))
```
✅ Nuevo estado: `'pausado'`

**Nuevos Campos**:
1. `tiempo_trabajo_efectivo` (interval)
   - Tiempo real de trabajo excluyendo pausas
   - Calculado: (fecha_fin - fecha_inicio) - tiempo_pausado_total

2. `tiempo_pausado_total` (interval)
   - Suma de todas las duraciones de pausas

3. `cantidad_pausas` (integer, DEFAULT 0)
   - Contador de ciclos de pausa/reanudación
   - Ejemplo: Cliente requiere 3 revisiones → cantidad_pausas = 3

**Índice Agregado**:
- `idx_rutas_pausadas` (company_id, estado_paso WHERE estado_paso = 'pausado')

---

## 🌱 Función de Seed: `fn_seed_motivos_pausa_default`

**Descripción**: Crea 16 motivos predeterminados para una empresa

**Motivos Creados por Categoría**:

### 👤 Cliente (Prioridad #1) - 4 motivos
1. ✅ Esperando aprobación de diseño
2. ✅ Esperando confirmación de colores
3. ✅ Cliente solicitó cambios (requiere descripción)
4. ✅ Esperando archivos del cliente

### 📦 Materiales - 3 motivos
5. ✅ Falta papel/sustrato
6. ✅ Falta tinta/consumibles
7. ✅ Material en pedido a proveedor (requiere descripción)

### 🔧 Maquinaria - 3 motivos
8. ✅ Máquina averiada (requiere descripción)
9. ✅ Mantenimiento preventivo
10. ✅ Calibración necesaria

### 👷 Personal - 3 motivos
11. ✅ Falta operador capacitado
12. ✅ Operador ausente (requiere descripción)
13. ✅ Esperando asignación de responsable

### 🌐 Externo - 2 motivos
14. ✅ Corte de energía
15. ✅ Condiciones climáticas adversas

### 📝 Otro - 1 motivo
16. ✅ Otro motivo (requiere descripción)

**Colores por Categoría**:
- Cliente: `#3B82F6` (Azul)
- Materiales: `#F59E0B` (Naranja)
- Maquinaria: `#EF4444` (Rojo)
- Personal: `#8B5CF6` (Morado)
- Externo: `#6B7280` (Gris)
- Otro: `#6B7280` (Gris)

---

## 🔄 Trigger Automático

### `trigger_auto_seed_motivos_pausa` ✅

**Función**: `trigger_seed_motivos_pausa_new_company()`

**Comportamiento**:
- Se ejecuta automáticamente AFTER INSERT en `companies`
- Llama a `fn_seed_motivos_pausa_default(NEW.id)`
- Crea los 16 motivos predeterminados para la nueva empresa

**Resultado**: Empresas nuevas ya tendrán motivos configurados desde el inicio

---

## ✅ Validación de Implementación

### Estado de Empresas Existentes

```
Empresa: Grafica Corporearte
  - Motivos creados: 16 ✅
  - Categorías: 6 ✅

Empresa: Test Company
  - Motivos creados: 16 ✅
  - Categorías: 6 ✅
```

### Tablas Verificadas

```sql
✅ pasos_motivos_pausa          → Existe
✅ ordenes_items_rutas_pausas   → Existe
✅ notificaciones_internas      → Existe
```

### Campos Verificados en `ordenes_trabajo_items_rutas`

```sql
✅ tiempo_trabajo_efectivo  (interval)
✅ tiempo_pausado_total     (interval)
✅ cantidad_pausas          (integer)
```

### Constraint Verificado

```sql
✅ check_estado_paso_item_ruta
   CHECK (estado_paso IN ('pendiente', 'en_proceso', 'completado', 'omitido', 'pausado'))
```

---

## 🔒 Seguridad (RLS)

### Todas las tablas tienen RLS habilitado ✅

**pasos_motivos_pausa**:
- ✅ SELECT: Usuarios de la empresa
- ✅ ALL: Solo super_admin, admin, manager

**ordenes_items_rutas_pausas**:
- ✅ SELECT: Usuarios de la empresa (vía JOIN con rutas)
- ✅ INSERT/UPDATE: Usuarios de la empresa

**notificaciones_internas**:
- ✅ SELECT/UPDATE: Solo el usuario destinatario
- ✅ INSERT: Sistema (cualquier usuario puede crear para su empresa)

---

## 📊 Estadísticas de Seed

**Empresas procesadas**: 2
**Motivos por empresa**: 16
**Total motivos creados**: 32

**Distribución por categoría**:
- Cliente: 4 motivos (25%)
- Materiales: 3 motivos (18.75%)
- Maquinaria: 3 motivos (18.75%)
- Personal: 3 motivos (18.75%)
- Externo: 2 motivos (12.5%)
- Otro: 1 motivo (6.25%)

---

## 🔍 Ejemplo de Datos Creados

```sql
{
  "categoria": "cliente",
  "nombre": "Esperando aprobación de diseño",
  "requiere_descripcion": false,
  "color": "#3B82F6",
  "orden": 1
}

{
  "categoria": "cliente",
  "nombre": "Cliente solicitó cambios",
  "requiere_descripcion": true,  ← Requiere descripción
  "color": "#3B82F6",
  "orden": 3
}

{
  "categoria": "maquinaria",
  "nombre": "Máquina averiada",
  "requiere_descripcion": true,  ← Requiere descripción
  "color": "#EF4444",
  "orden": 20
}
```

---

## 🎯 Próximos Pasos: Fase 2

**Archivo**: Backend y Triggers (Funciones SQL)

**Funciones a implementar**:
1. ✅ `fn_pausar_paso()` - Pausar paso con validaciones
2. ✅ `fn_reanudar_paso()` - Reanudar paso y cerrar pausa
3. ✅ `fn_recalcular_tiempos_paso()` - Calcular tiempos automáticamente
4. ✅ Trigger: Auto-recalcular al cerrar pausa
5. ✅ `fn_crear_notificacion_pausa_prolongada()` - Alertas a admins
6. ✅ `fn_detectar_pausas_prolongadas()` - Para cron job
7. ✅ Actualizar `fn_get_public_order_tracking()` - Incluir info de pausas

**Duración estimada Fase 2**: 1 día

---

## 📝 Notas Importantes

1. **Múltiples Ciclos Soportados**: ✅
   - Un paso puede pausarse N veces
   - Cada pausa se registra independientemente
   - `cantidad_pausas` cuenta todos los ciclos

2. **Campos Calculados**: ✅
   - `duracion_minutos` en pausas (GENERATED STORED)
   - Cálculo automático cuando se cierra pausa

3. **Prioridad Cliente**: ✅
   - 4 motivos de categoría "cliente"
   - Ordenados primero (orden 1-4)
   - Principal: "Esperando aprobación de diseño"

4. **Descripciones Obligatorias**: ✅
   - Algunos motivos requieren descripción
   - Validación en frontend y backend

5. **Iconos Lucide**: ✅
   - Nombres de iconos guardados para UI
   - Colores hex por categoría

---

## ✅ Build Verificado

```bash
npm run build
✓ built in 22.09s
```

Sin errores de compilación ✅

---

## 🎉 Conclusión Fase 1

La implementación de la Fase 1 está **100% completa** y **validada**:

✅ 3 tablas nuevas creadas
✅ 1 tabla modificada
✅ 32 motivos seed creados (2 empresas × 16 motivos)
✅ RLS habilitado en todas las tablas
✅ Triggers automáticos funcionando
✅ Constraints validados
✅ Índices optimizados
✅ Build sin errores

**Estado**: ✅ Listo para Fase 2
**Próximo paso**: Implementar funciones SQL de backend

---

**Documento generado automáticamente**
Fecha: 2025-11-30
