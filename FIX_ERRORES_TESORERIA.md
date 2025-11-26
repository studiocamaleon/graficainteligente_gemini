# Corrección de Errores en Módulo de Tesorería

## 🐛 Errores Encontrados y Corregidos

### Error 1: Query incorrecta en `useIngresosPeriodo`

**Ubicación:** `src/hooks/useTesoreria.ts` línea 113

**Problema:**
```typescript
.in('caja_id',
  supabase
    .from('cajas')
    .select('id')
    .eq('company_id', profile.company_id)
)
```

El operador `.in()` de Supabase no acepta directamente otra query como parámetro. Esto causaba el error:
```
TypeError: object is not iterable (cannot read property Symbol(Symbol.iterator))
```

**Solución:**
Primero obtener los IDs de las cajas, luego usarlos en el filtro:

```typescript
// Primero obtener IDs de cajas de la empresa
const { data: cajasData, error: cajasError } = await supabase
  .from('cajas')
  .select('id')
  .eq('company_id', profile.company_id);

if (cajasError) throw cajasError;

const cajaIds = (cajasData || []).map(c => c.id);

if (cajaIds.length === 0) {
  setIngresos([]);
  setTotalIngresos(0);
  setLoading(false);
  return;
}

// Obtener movimientos de tipo ingreso de esas cajas
const { data, error } = await supabase
  .from('cajas_movimientos')
  .select(`
    *,
    caja:cajas(nombre, tipo, moneda),
    medio_cobro:medios_cobro(nombre, categoria)
  `)
  .in('caja_id', cajaIds)
  .eq('tipo_movimiento', 'ingreso')
  .gte('fecha', desde)
  .lte('fecha', hasta)
  .order('fecha', { ascending: false })
  .order('created_at', { ascending: false });
```

### Error 2: Validación de fechas en `IngresosPanel`

**Ubicación:** `src/components/tesoreria/IngresosPanel.tsx` líneas 15-16 y 59

**Problema:**
El componente intentaba llamar `.toISOString()` y `.toLocaleDateString()` directamente en las fechas sin validar que sean objetos Date válidos.

**Solución:**
Agregada validación defensiva con `useMemo` para convertir fechas de forma segura:

```typescript
const fechaDesdeStr = useMemo(() => {
  return fechaDesde instanceof Date && !isNaN(fechaDesde.getTime())
    ? fechaDesde.toISOString().split('T')[0]
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}, [fechaDesde]);

const fechaHastaStr = useMemo(() => {
  return fechaHasta instanceof Date && !isNaN(fechaHasta.getTime())
    ? fechaHasta.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
}, [fechaHasta]);
```

Y en la visualización:
```typescript
{fechaDesde instanceof Date ? fechaDesde.toLocaleDateString('es-AR') : fechaDesdeStr} -
{fechaHasta instanceof Date ? fechaHasta.toLocaleDateString('es-AR') : fechaHastaStr}
```

## ✅ Estado Actual

- ✅ Errores corregidos
- ✅ Build exitoso sin errores
- ✅ Validación defensiva implementada
- ✅ Código TypeScript correcto

## 🎯 Funcionalidad Verificada

El módulo de Tesorería ahora:
1. Obtiene correctamente las cajas de la empresa
2. Filtra los movimientos de ingreso por cajas de la empresa
3. Maneja fechas de forma segura con validación
4. Muestra ingresos con detalle de caja y medio de cobro
5. Calcula totales correctamente

## 📝 Recomendaciones

Para futuras implementaciones similares:
1. **Queries anidadas en Supabase**: Siempre ejecutar primero la query interna, obtener los IDs, y luego usarlos en `.in()`
2. **Validación de tipos**: Siempre validar que los objetos Date sean válidos antes de llamar métodos como `.toISOString()`
3. **useMemo para transformaciones**: Usar `useMemo` para transformaciones costosas o que puedan fallar
4. **Manejo de arrays vacíos**: Verificar si hay resultados antes de continuar con queries dependientes

---

## 🐛 Errores SQL Adicionales Corregidos

### Error 3: Referencia incorrecta en `fn_calcular_saldos_pendientes_cobro`

**Ubicación:** Migración `20251126060557_create_cajas_sync_triggers.sql` línea 155

**Problema:**
```sql
LEFT JOIN pagos_por_orden p ON ot.orden_id = p.orden_id
```

La tabla `ordenes_trabajo` no tiene columna `orden_id`, solo tiene `id`. Esto causaba:
```
Error: column ot.orden_id does not exist
Hint: Perhaps you meant to reference the column "p.orden_id"
```

**Solución:**
```sql
LEFT JOIN pagos_por_orden p ON ot.id = p.orden_id
```

### Error 4: Ambigüedad en `fn_obtener_detalle_por_cobrar`

**Problema:**
El nombre de la columna de retorno `orden_id` era ambiguo con el alias usado internamente.

**Solución:**
Se agregó alias explícito en la subconsulta CTE:
```sql
WITH pagos_por_orden AS (
  SELECT
    otp.orden_id,  -- Alias explícito 'otp'
    COALESCE(SUM(otp.monto), 0) as total_pagado
  FROM ordenes_trabajo_pagos otp
  GROUP BY otp.orden_id
)
```

## 📋 Migración Aplicada

**Archivo:** `fix_tesoreria_functions_orden_id.sql`

Se creó una nueva migración que:
1. ✅ Corrige `fn_calcular_saldos_pendientes_cobro` con el JOIN correcto
2. ✅ Reaplica `fn_obtener_detalle_por_cobrar` con aliases explícitos
3. ✅ Ambas funciones marcadas como `SECURITY DEFINER`

---

**Estado:** ✅ Todas las correcciones aplicadas y verificadas

## 📊 Resumen de Correcciones

| Error | Tipo | Ubicación | Estado |
|-------|------|-----------|--------|
| Query .in() incorrecta | TypeScript | useTesoreria.ts | ✅ Corregido |
| Validación fechas | TypeScript | IngresosPanel.tsx | ✅ Corregido |
| JOIN con ot.orden_id | SQL | fn_calcular_saldos_pendientes_cobro | ✅ Corregido |
| Ambigüedad orden_id | SQL | fn_obtener_detalle_por_cobrar | ✅ Corregido |

**Build Status:** ✅ Exitoso sin errores
