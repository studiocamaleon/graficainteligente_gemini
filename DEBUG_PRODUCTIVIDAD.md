# Guía de Depuración - Tab Productividad

## Problema: El botón "Actualizar" gira en loop infinito

Se han agregado logs exhaustivos para identificar el problema. Sigue estos pasos:

## Paso 1: Abrir la Consola del Navegador

1. Presiona **F12** o **Ctrl+Shift+I** (Windows/Linux) o **Cmd+Option+I** (Mac)
2. Ve a la pestaña **Console**
3. Limpia la consola (icono de 🚫 o Ctrl+L)

## Paso 2: Navegar al Tab de Productividad

1. Ve a **Producción** en el menú lateral
2. Haz clic en el tab **Productividad**
3. Observa los logs en la consola

## Logs Esperados

Deberías ver logs en este orden:

```
[ProductivityView] Render state: { loading: true, ... }
[Productivity] Starting metrics load...
[Productivity] Loading metrics with date range: { fechaDesde: "...", fechaHasta: "...", companyId: "..." }
[Productivity] Loading KPIs generales...
[Productivity] Loading metricas por paso...
[Productivity] Loading metricas por categoria...
[Productivity] Loading metricas por etapa...
[Productivity] Loading metricas por operario...
[Productivity] Loading ordenes completadas...
[Productivity] Loading cuellos de botella...
[Productivity] Loading tendencias temporales...
[Productivity] KPIs generales loaded: [...]
[Productivity] Metricas por paso loaded: X items
[Productivity] Metricas por categoria loaded: X items
[Productivity] Metricas por etapa loaded: X items
[Productivity] Metricas por operario loaded: X items
[Productivity] Ordenes completadas loaded: X items
[Productivity] Cuellos de botella loaded: X items
[Productivity] Tendencias temporales loaded: X items
[Productivity] Metrics load completed
[Productivity] Setting loading to false
[ProductivityView] Render state: { loading: false, ... }
```

## Posibles Problemas y Soluciones

### Problema 1: No aparece "Starting metrics load..."

**Causa**: El hook no se está ejecutando o no hay companyId

**Solución**: Verifica que el usuario esté autenticado y tenga un companyId válido

### Problema 2: Se queda en "Loading XXX..." sin completar

**Causa**: Una función RPC está colgada o no existe en la base de datos

**Busca en los logs**:
- ¿Cuál fue la última función que se empezó a cargar?
- ¿Hay algún error de Supabase?

**Solución**:
1. Verifica que las funciones SQL existen ejecutando:
   ```bash
   npx tsx scripts/test-productivity-functions.ts
   ```

### Problema 3: Error "function fn_XXXX does not exist"

**Causa**: Las funciones SQL no fueron creadas correctamente

**Solución**: Las funciones deben haberse creado con la migración `create_productivity_analytics_functions.sql`

Verifica en Supabase Dashboard:
1. Ve a SQL Editor
2. Ejecuta: `SELECT proname FROM pg_proc WHERE proname LIKE 'fn_%';`
3. Deberías ver:
   - fn_calcular_duracion_paso
   - fn_kpis_generales
   - fn_metricas_por_paso
   - fn_metricas_por_categoria
   - fn_metricas_por_etapa
   - fn_metricas_por_operario
   - fn_ordenes_completadas_detalle
   - fn_cuellos_botella
   - fn_tendencias_temporales

### Problema 4: "Setting loading to false" pero el botón sigue girando

**Causa**: El estado no se está actualizando correctamente

**Busca en logs**:
```
[ProductivityView] Render state: { loading: false, ... }
```

Si `loading: false` pero el botón sigue girando, hay un problema de renderizado.

### Problema 5: No hay datos (arrays vacíos)

**Causa**: No hay pasos de producción completados con timestamps

**Solución**: Esto es normal si no has ejecutado ningún paso de producción todavía.

Para verificar:
```sql
SELECT COUNT(*)
FROM ordenes_trabajo_items_rutas
WHERE estado_paso = 'completado'
  AND fecha_inicio IS NOT NULL
  AND fecha_fin IS NOT NULL;
```

Si el conteo es 0, necesitas ejecutar pasos de producción primero.

## Información Adicional para Reportar

Si el problema persiste, copia y pega:

1. **Todos los logs de la consola** que comiencen con `[Productivity]` o `[ProductivityView]`
2. **Errores de Supabase** (en rojo)
3. **Tu company_id** (puedes encontrarlo en los logs)
4. **Estado final del hook** (último log de `[ProductivityView] Render state`)

## Manejo de Errores Implementado

El sistema ahora maneja errores de forma resiliente:

- ✅ Si una función falla, las demás continúan cargando
- ✅ Los errores se registran pero no bloquean la UI
- ✅ El estado de loading siempre se completa
- ✅ Los datos parciales se muestran correctamente

## Siguiente Paso

Una vez identifiques el error específico en los logs, compártelo y podremos solucionarlo rápidamente.
