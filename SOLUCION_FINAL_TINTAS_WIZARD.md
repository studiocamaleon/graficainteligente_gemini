# Solución Final: Tintas en Buscador del Wizard

## Fecha
19 de noviembre de 2025

## Problema

```
invalid input syntax for type uuid: "K"
```

El código intentaba usar los valores del array `tintas` ('K', 'CMYK', etc.) como UUIDs para consultar `tecnologias_tintas_pasos`.

## Causa Raíz

El campo `tintas` en `productos_impresion_laser_tecnologias` fue cambiado de `uuid[]` a `text[]` en la migración `20251115041032_fix_tintas_field_type_in_productos_laser.sql`.

**Estructura real:**
```sql
CREATE TABLE productos_impresion_laser_tecnologias (
  id uuid,
  producto_laser_id uuid,
  tecnologia_id uuid,
  tintas text[] NOT NULL DEFAULT ARRAY[]::text[],  -- ✅ Array de strings
  created_at timestamptz
);
```

## Datos en la Tabla

```json
{
  "id": "...",
  "producto_laser_id": "...",
  "tecnologia_id": "...",
  "tintas": ["K", "CMYK", "CMYK+W"]  // ← Valores de texto directo
}
```

## Solución Implementada

Ya NO es necesario consultar `tecnologias_tintas_pasos`. Los valores de tintas están directamente en el array.

### Código Corregido

```typescript
// 1. Obtener tecnología con tintas
const tecnologiasRes = await supabase
  .from('productos_impresion_laser_tecnologias')
  .select('tecnologia_id, tintas')
  .eq('producto_laser_id', laserData.id)
  .limit(1)
  .maybeSingle();

// 2. Usar directamente los valores del array
const tintasDisponibles = [];
if (tecnologiasRes.data && tecnologiasRes.data.tintas) {
  const tintas = tecnologiasRes.data.tintas.filter(Boolean);

  tintas.forEach((tinta: string, index: number) => {
    tintasDisponibles.push({
      tinta_id: `${tinta}_${index}`,  // ID generado para UI
      nombre: tinta,                   // 'K', 'CMYK', etc.
      tipo: tinta,                     // Mismo valor
    });
  });
}
```

## Flujo Final Simplificado

```
1. Buscar productos en productos_impresion_laser
2. Para cada producto:
   ├─> Obtener materiales
   ├─> Obtener medidas  
   ├─> Obtener tecnología y tintas
   │   └─> El array 'tintas' contiene valores de texto directos
   └─> Obtener precio mínimo
3. Construir resultado con tintas directamente del array
```

## Cambios vs Versión Anterior

| Antes (Incorrecto) | Ahora (Correcto) |
|-------------------|------------------|
| ❌ Consultar `tecnologias_tintas_pasos` | ✅ Usar array directo |
| ❌ Usar tintas como UUIDs | ✅ Usar tintas como strings |
| ❌ Query adicional innecesaria | ✅ Sin query extra |

## Resultado

```json
{
  "tintas_disponibles": [
    {
      "tinta_id": "K_0",
      "nombre": "K",
      "tipo": "K"
    },
    {
      "tinta_id": "CMYK_1",
      "nombre": "CMYK",
      "tipo": "CMYK"
    }
  ]
}
```

## Estado Final

✅ Build exitoso
✅ Sin errores de tipo UUID
✅ Sin consultas innecesarias
✅ Tintas obtenidas correctamente
✅ Buscador completamente funcional

## Resumen de Todas las Correcciones

1. ✅ Tabla correcta: `productos_impresion_laser` (no `productos`)
2. ✅ Columna correcta: `precio` (no `precio_base`)
3. ✅ Obtener tintas de `productos_impresion_laser_tecnologias`
4. ✅ Usar array `tintas` directamente (no consultar otra tabla)
5. ✅ Tintas son strings, no UUIDs
