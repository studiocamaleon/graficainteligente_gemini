# Solución: Problema "Paso sin nombre" en Rutas de Producción

## Problema Identificado

Los pasos condicionales en las rutas de producción aparecían como "Paso sin nombre" porque:

1. Los pasos con condiciones tenían `paso_id = null` en `rutas_produccion_pasos`
2. Los mapeos en `configuracion_condicion` estaban vacíos `{}`
3. El sistema no podía encontrar el ID del paso específico para consultar su nombre

## Causa Raíz

El sistema estaba diseñado para usar **mapeos manuales** en el campo `configuracion_condicion`:

```json
{
  "mapeo_niveles": {
    "Basico": "uuid-paso-basico",
    "Intermedio": "uuid-paso-intermedio"
  }
}
```

Pero estos mapeos estaban **vacíos** en la base de datos, resultando en:
- `paso_id_especifico = null`
- No se podía consultar el nombre del paso
- Aparecía "Paso sin nombre"

## Solución Implementada

Se implementó un sistema de **consultas dinámicas** que obtiene los pasos directamente de las tablas relacionales:

### 1. Para `servicio_con_nivel`:
```typescript
// Si no hay mapeo manual, consultar servicios_niveles_precio
const { data: nivelData } = await supabase
  .from('servicios_niveles_precio')
  .select('paso_id')
  .eq('servicio_id', servicio.servicio_id)
  .eq('nombre', nivelAplicado)
  .maybeSingle();

if (nivelData?.paso_id) {
  pasoIdEspecifico = nivelData.paso_id;
}
```

### 2. Para `acabado_con_nivel`:
```typescript
// Si no hay mapeo manual, consultar acabados_niveles_precio
const { data: nivelData } = await supabase
  .from('acabados_niveles_precio')
  .select('paso_id')
  .eq('acabado_id', acabado.acabado_id)
  .eq('nombre', nivelAplicado)
  .maybeSingle();

if (nivelData?.paso_id) {
  pasoIdEspecifico = nivelData.paso_id;
}
```

### 3. Para `tecnologia_tinta`:
```typescript
// Si no hay mapeo manual, consultar tecnologias_tintas_pasos
const { data: tintaData } = await supabase
  .from('tecnologias_tintas_pasos')
  .select('paso_id')
  .eq('tecnologia_id', tecnologiaId)
  .eq('tinta', tintaNombre)
  .maybeSingle();

if (tintaData?.paso_id) {
  pasoIdEspecifico = tintaData.paso_id;
}
```

## Ventajas de la Solución

1. **No requiere configuración manual** - Usa las tablas relacionales existentes
2. **Siempre actualizado** - Si cambias un paso en servicios/acabados/tecnologías, se refleja automáticamente
3. **Menos propenso a errores** - No hay que mantener mapeos duplicados
4. **Mantiene compatibilidad** - Si existen mapeos manuales, los usa primero (fallback inteligente)
5. **Evita duplicación de datos** - La información ya existe en las tablas relacionales

## Flujo de Resolución

```
1. Sistema intenta obtener paso_id del mapeo manual
   ↓
2. Si mapeo está vacío → Consulta tabla relacional
   - servicio_con_nivel → servicios_niveles_precio
   - acabado_con_nivel → acabados_niveles_precio  
   - tecnologia_tinta → tecnologias_tintas_pasos
   ↓
3. Obtiene paso_id dinámicamente
   ↓
4. Consulta nombre en tabla pasos
   ↓
5. Muestra nombre real ✅
```

## Archivos Modificados

- `src/hooks/useGenerateProductionRoute.ts` - Agregadas consultas dinámicas

## Testing

Para probar la solución:

1. Abre una orden de trabajo con items
2. Ve al tab "Rutas de Producción"
3. Verifica que los pasos muestren nombres correctos:
   - ✅ "Diseño Gráfico - Básico" (en lugar de "Paso sin nombre")
   - ✅ "Impresión Color (CMYK)" (en lugar de "Paso sin nombre")
   - ✅ "Guillotinado" (ya funcionaba)

## Notas Técnicas

- La solución mantiene compatibilidad hacia atrás con mapeos manuales
- Se eliminaron logs de debug innecesarios
- El código es más limpio y mantenible
- No requiere cambios en la base de datos

---

## Corrección Adicional: Mapeo de Tintas (19/11/2024)

### Problema Detectado

El sistema estaba fallando al buscar pasos para tecnologías/tintas debido a un **desajuste de formatos**:

**En Base de Datos (`tecnologias_tintas_pasos.tinta`):**
- `'K'`, `'CMYK'`, `'CMYK+W'`, `'CMYK+V'`, `'CMYK+W+V'`

**En Configuración (`configuracion.tinta_nombre`):**
- `'Negro (K)'`, `'Color (CMYK)'`, `'Color + Blanco'`, etc.

El hook estaba usando `tinta_nombre` (nombre legible) para buscar en la BD, cuando debía usar `tipo_tinta` (código).

### Solución Implementada

Modificado `useGenerateProductionRoute.ts` línea 279-283:

```typescript
// Antes ❌
const tintaNombre = configuracion?.tinta_nombre || configuracion?.tinta;

// Después ✅
const tintaCodigo = configuracion?.tipo_tinta || configuracion?.tinta;
const tintaNombreDisplay = configuracion?.tinta_nombre || tintaCodigo;
```

**Cambios:**
1. Usa `tipo_tinta` (código: 'CMYK') para consultar BD
2. Mantiene `tinta_nombre` (legible: 'Color (CMYK)') solo para display
3. La consulta ahora encuentra matches correctamente

### Resultado

- ✅ Búsqueda usa códigos: `'CMYK'`, `'K'`, etc.
- ✅ Display usa nombres legibles: `'Color (CMYK)'`, `'Negro (K)'`
- ✅ Los pasos de impresión ahora se resuelven correctamente
