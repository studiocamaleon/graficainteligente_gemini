# Guía Rápida: Cómo Probar Liquidaciones

## 🧪 Test Completo - 5 Minutos

### **Pre-requisitos:**
- ✅ Tener al menos 1 cliente con cuenta corriente habilitada
- ✅ Tener al menos 1 orden finalizada o entregada para ese cliente
- ✅ Estar logueado como usuario con permisos (cualquier rol)

---

## 📝 Paso 1: Verificar que el Fix Está Aplicado

### **Opción A: Desde Supabase Dashboard (Recomendado)**

1. Ir a **Supabase Dashboard**
2. Ir a **SQL Editor**
3. Pegar esta query:

```sql
SELECT
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_complete_liquidacion';
```

4. **Ejecutar**
5. **Resultado esperado:** Debe retornar 1 fila con:
   - `trigger_name: trigger_auto_complete_liquidacion`
   - `event_object_table: liquidaciones`

✅ Si retorna 1 fila → El trigger está aplicado correctamente
❌ Si retorna 0 filas → El trigger NO está aplicado (revisar migraciones)

---

## 🎯 Paso 2: Crear Liquidación de Prueba

### **Desde la Aplicación:**

1. **Ir a:** Finanzas → Liquidaciones

2. **Buscar cliente** que tenga:
   - Acuerdo de pago: Cuenta Corriente
   - Órdenes finalizadas o entregadas

3. **Hacer clic en:** "Nueva Liquidación" (botón junto al cliente)

4. **Seleccionar período:**
   - **Opción Recomendada:** Usar "Período Sugerido"
   - **Opción Manual:** Seleccionar fechas personalizadas

5. **Verificar que aparecen órdenes:**
   - Debe mostrar lista de órdenes finalizadas/entregadas
   - Con su número, descripción y monto
   - Total a liquidar calculado automáticamente

6. **Hacer clic en:** "Generar Liquidación"

---

## ✅ Paso 3: Verificar Resultado

### **3.1 En la UI:**

**Resultado Esperado:**
```
✅ Modal se cierra
✅ Aparece mensaje de éxito
✅ La liquidación aparece en la lista
✅ Con número LIQ-XXXXXX
```

**Si aparece error:**
```
❌ Ver detalles en consola del navegador (F12)
❌ Copiar mensaje de error
❌ Revisar sección "Troubleshooting" abajo
```

---

### **3.2 En la Base de Datos:**

1. **Ir a:** Supabase Dashboard → SQL Editor
2. **Pegar esta query:**

```sql
-- Verificar última liquidación creada
SELECT
  numero_liquidacion,
  company_id,
  created_by,
  c.nombre_fantasia as cliente,
  fecha_emision,
  fecha_vencimiento,
  estado,
  total_general,
  saldo_pendiente,
  created_at
FROM liquidaciones l
JOIN clients c ON l.cliente_id = c.id
ORDER BY l.created_at DESC
LIMIT 1;
```

3. **Ejecutar**

**Verificar que:**
- ✅ `numero_liquidacion` tiene formato: `LIQ-000001` (o siguiente)
- ✅ `company_id` tiene un UUID válido (no NULL)
- ✅ `created_by` tiene tu UUID de usuario (no NULL)
- ✅ `cliente` muestra el nombre correcto
- ✅ `total_general` es mayor a 0
- ✅ `saldo_pendiente` = `total_general` (nueva liquidación)
- ✅ `created_at` es la fecha/hora actual

---

### **3.3 Verificar Items de Liquidación:**

```sql
-- Ver items de la última liquidación
SELECT
  l.numero_liquidacion,
  li.numero_orden,
  li.descripcion,
  li.fecha_orden,
  li.monto
FROM liquidaciones_items li
JOIN liquidaciones l ON li.liquidacion_id = l.id
WHERE l.id = (
  SELECT id FROM liquidaciones
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY li.fecha_orden;
```

**Verificar que:**
- ✅ Aparecen todas las órdenes seleccionadas
- ✅ Los montos son correctos
- ✅ La suma de items = total_general de liquidación

---

## 🔍 Paso 4: Prueba de Números Secuenciales

Para verificar que los números se generan correctamente:

1. **Crear segunda liquidación** (repetir Paso 2)
2. **Verificar número:**

```sql
-- Ver últimas 3 liquidaciones
SELECT
  numero_liquidacion,
  created_at
FROM liquidaciones
ORDER BY created_at DESC
LIMIT 3;
```

**Resultado Esperado:**
```
LIQ-000003  (más reciente)
LIQ-000002
LIQ-000001  (más antigua)
```

✅ Los números deben ser **secuenciales** y **únicos**

---

## 🧹 Paso 5: Limpiar Datos de Prueba (Opcional)

Si deseas eliminar las liquidaciones de prueba:

```sql
-- Ver liquidaciones de prueba
SELECT
  id,
  numero_liquidacion,
  total_general,
  created_at
FROM liquidaciones
WHERE estado = 'pendiente'
ORDER BY created_at DESC;

-- Eliminar última liquidación de prueba (CUIDADO!)
-- Descomenta solo si estás seguro
/*
DELETE FROM liquidaciones_items
WHERE liquidacion_id = (
  SELECT id FROM liquidaciones
  ORDER BY created_at DESC
  LIMIT 1
);

DELETE FROM liquidaciones
WHERE id = (
  SELECT id FROM liquidaciones
  ORDER BY created_at DESC
  LIMIT 1
);
*/
```

⚠️ **CUIDADO:** Solo eliminar si son liquidaciones de prueba, no reales.

---

## 🚨 Troubleshooting

### **Error: "Debe completar todas las fechas"**
- ❌ **Causa:** Falta seleccionar fecha desde, hasta o vencimiento
- ✅ **Solución:** Completar todas las fechas requeridas

---

### **Error: "No hay órdenes para liquidar"**
- ❌ **Causa:** No hay órdenes finalizadas/entregadas en el período
- ✅ **Solución:**
  1. Verificar que existan órdenes con estado 'finalizada' o 'entregada'
  2. Ampliar el rango de fechas
  3. Verificar con esta query:

```sql
SELECT
  numero_orden,
  estado,
  fecha_completado,
  total
FROM ordenes_trabajo
WHERE cliente_id = 'uuid-del-cliente'
  AND estado IN ('finalizada', 'entregada')
ORDER BY fecha_completado DESC;
```

---

### **Error: 403 - RLS Policy Violation**
- ❌ **Causa:** El trigger NO está aplicado o la política RLS está incorrecta
- ✅ **Solución:**

1. **Verificar trigger:**
```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_complete_liquidacion';
```

2. **Si NO existe, aplicar migración:**
   - Ir a Supabase Dashboard
   - SQL Editor
   - Ejecutar contenido de: `fix_liquidaciones_auto_complete_fields.sql`

3. **Verificar política RLS:**
```sql
SELECT policyname, with_check
FROM pg_policies
WHERE tablename = 'liquidaciones'
  AND cmd = 'INSERT';
```

---

### **Error: "company_id IS NULL"**
- ❌ **Causa:** El trigger no está ejecutándose
- ✅ **Solución:**

1. **Verificar función:**
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'fn_auto_complete_liquidacion';
```

2. **Si NO existe, revisar migraciones aplicadas**

---

### **Número NO tiene formato LIQ-XXXXXX**
- ❌ **Causa:** Función generadora no funciona o no existe
- ✅ **Solución:**

1. **Probar función:**
```sql
SELECT fn_generar_numero_liquidacion('tu-company-id-uuid');
```

2. **Si falla, verificar que existe:**
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'fn_generar_numero_liquidacion';
```

---

## ✅ Checklist de Prueba Exitosa

### **En la UI:**
- [ ] Modal de "Nueva Liquidación" abre correctamente
- [ ] Aparecen fechas sugeridas
- [ ] Carga órdenes disponibles
- [ ] Muestra total a liquidar
- [ ] Botón "Generar Liquidación" funciona
- [ ] Modal se cierra después de crear
- [ ] Liquidación aparece en lista
- [ ] Número tiene formato LIQ-XXXXXX

### **En Base de Datos:**
- [ ] Trigger existe y está activo
- [ ] Función existe con SECURITY DEFINER
- [ ] Política RLS correcta (INSERT permitido)
- [ ] Liquidación tiene company_id válido
- [ ] Liquidación tiene numero_liquidacion formato correcto
- [ ] Liquidación tiene created_by con UUID
- [ ] Items de liquidación creados correctamente
- [ ] Números son secuenciales

### **Funcionalidad:**
- [ ] Se puede crear liquidación sin errores
- [ ] Números se generan automáticamente
- [ ] Números son únicos y secuenciales
- [ ] Items se asocian correctamente
- [ ] Totales calculan bien

---

## 🎉 Prueba Exitosa

Si todos los checks están ✅, el sistema está funcionando correctamente.

**Próximos pasos:**
1. Usar el sistema normalmente
2. Crear liquidaciones reales
3. Registrar pagos a liquidaciones
4. Generar reportes

---

## 📞 Ayuda Adicional

### **Archivos de Referencia:**
- `FIX_LIQUIDACIONES_RLS_COMPLETO.md` - Explicación detallada
- `VERIFICACION_FIX_LIQUIDACIONES.sql` - Queries de verificación
- `RESUMEN_FIX_LIQUIDACIONES.md` - Resumen ejecutivo

### **Queries Útiles:**

```sql
-- Ver todas las liquidaciones
SELECT * FROM liquidaciones ORDER BY created_at DESC;

-- Ver items de una liquidación
SELECT * FROM liquidaciones_items WHERE liquidacion_id = 'uuid';

-- Ver saldo de cuenta corriente de un cliente
SELECT * FROM fn_calcular_saldo_cuenta_corriente('cliente-uuid');

-- Ver órdenes pendientes de liquidar
SELECT * FROM fn_sugerir_ordenes_para_liquidacion(
  'cliente-uuid',
  '2025-01-01',
  '2025-12-31'
);
```

---

**¡Sistema listo para usar!** 🚀

**Tiempo estimado de prueba:** 5-10 minutos
**Dificultad:** Fácil
**Estado:** ✅ Funcional
