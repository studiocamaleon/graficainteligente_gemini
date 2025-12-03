# Fix Aplicado: Reporte de Ventas por Canal - Campo Origen

## Problema Identificado

El componente `VentasPorCanalChart` estaba mostrando todas las órdenes de centro copiado agrupadas en el canal "Mostrador", independientemente del valor real del campo `origen`.

### Causa Raíz

La función SQL `fn_reporte_ventas_por_canal` tenía hardcodeado el valor 'Mostrador' para todas las órdenes de copiado independientes:

```sql
-- ❌ CÓDIGO INCORRECTO (anterior)
SELECT
  'Mostrador' AS canal,  -- Hardcodeado
  cc.total AS monto,
  'copiado' AS tipo_orden
FROM centro_copiado_ordenes cc
WHERE cc.orden_trabajo_id IS NULL
```

## Solución Aplicada

✅ Se aplicó la migración `force_update_reporte_canal_origen` que corrige la función para usar el campo `origen` correctamente:

```sql
-- ✅ CÓDIGO CORRECTO (nuevo)
SELECT
  COALESCE(cc.origen, 'Mostrador') AS canal,  -- Usa el campo real
  cc.total AS monto,
  'copiado' AS tipo_orden
FROM centro_copiado_ordenes cc
WHERE cc.orden_trabajo_id IS NULL
```

### Cambios Implementados

1. **Órdenes de Trabajo**: Siguen usando `canal_venta`
2. **Órdenes de Copiado Vinculadas**: Priorizan el canal de la orden de trabajo, luego el origen de copiado
3. **Órdenes de Copiado Independientes**: Ahora usan el campo `origen` directamente

## Pasos de Verificación para el Usuario

### 1. Limpiar Caché del Navegador

**IMPORTANTE**: Antes de verificar, debes refrescar completamente la página:

- **Chrome/Edge**: `Ctrl + Shift + R` (Windows/Linux) o `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows/Linux) o `Cmd + Shift + R` (Mac)

Esto es crucial porque el navegador puede tener en caché los resultados antiguos de la función.

### 2. Verificar Datos en la Base de Datos

Las órdenes de centro copiado deben tener el campo `origen` poblado correctamente:

```sql
-- Consulta para verificar los orígenes de las órdenes
SELECT
  origen,
  COUNT(*) as cantidad,
  SUM(total) as total_ventas
FROM centro_copiado_ordenes
WHERE estado != 'cancelada'
  AND orden_trabajo_id IS NULL  -- Solo independientes
GROUP BY origen
ORDER BY cantidad DESC;
```

### 3. Valores Esperados del Campo `origen`

El campo `origen` debe tener uno de estos valores:
- `'Mostrador'` - Órdenes creadas en el mostrador físico
- `'WhatsApp'` - Órdenes recibidas por WhatsApp
- `'Web'` - Órdenes desde la web
- `'App Mobile'` - Órdenes desde la aplicación móvil

### 4. Verificar el Reporte

1. Ir a **Finanzas > Reportes > Ventas**
2. Seleccionar un período que tenga órdenes de copiado
3. Verificar la sección **"Ventas por Canal"**
4. Confirmar que las órdenes aparecen en sus canales correctos

**Ejemplo esperado**:
```
Ventas por Canal
├── WhatsApp: $279,234.20 (89.6%)
│   2 órdenes (0 trabajo, 2 copiado)
│   Promedio: $139,617.10
│
├── Mostrador: $31,600.00 (10.4%)
│   1 órdenes (0 trabajo, 1 copiado)
│   Promedio: $31,600.00
│
└── App Mobile: $15,800.00 (...)
    1 órdenes (0 trabajo, 1 copiado)
    Promedio: $15,800.00
```

## ¿Qué Hacer Si el Problema Persiste?

### Escenario 1: Los datos no tienen `origen` poblado

Si todas las órdenes de copiado tienen `origen = NULL` o `origen = 'Mostrador'`, entonces el problema está en la creación de las órdenes. Verifica:

1. ¿Se está pasando el campo `origen` al crear las órdenes desde la app móvil?
2. ¿El campo tiene un valor por defecto en la base de datos?

**Solución**: Actualizar las órdenes existentes:

```sql
-- Ejemplo: Actualizar órdenes que deberían ser de App Mobile
UPDATE centro_copiado_ordenes
SET origen = 'App Mobile'
WHERE origen IS NULL
  AND created_at > '2025-12-01'  -- Ajustar fecha
  AND [CONDICIÓN PARA IDENTIFICAR APP MOBILE];
```

### Escenario 2: La función sigue devolviendo datos incorrectos

Si después de limpiar el caché y verificar los datos el problema persiste:

1. Verificar la definición actual de la función en la base de datos:

```sql
-- Ver la definición de la función
SELECT pg_get_functiondef('fn_reporte_ventas_por_canal'::regproc);
```

2. Si la función sigue teniendo el código antiguo, reaplicar la migración manualmente.

### Escenario 3: Problema de caché en Supabase

Si usas Supabase en modo production, puede haber caché en el backend:

1. Esperar 5-10 minutos para que expire el caché
2. O forzar la invalidación llamando a la función con parámetros diferentes
3. Contactar al soporte de Supabase si el problema persiste

## Archivos Modificados

- ✅ Función SQL: `fn_reporte_ventas_por_canal` (actualizada)
- ✅ Migración aplicada: `force_update_reporte_canal_origen.sql`
- 📝 Script de diagnóstico: `scripts/debug-reporte-canal.ts` (para testing)

## Testing

Para probar que la corrección funciona:

1. Crear una orden de copiado con `origen = 'App Mobile'`
2. Ir al reporte de ventas
3. Verificar que aparezca en el canal "App Mobile" y no en "Mostrador"

## Notas Técnicas

- La función usa `COALESCE(cc.origen, 'Mostrador')` como fallback seguro
- Las órdenes vinculadas a órdenes de trabajo priorizan el canal de la orden de trabajo
- La función incluye contadores separados para órdenes de trabajo y copiado
- Los porcentajes se calculan sobre el total de ventas del período seleccionado
