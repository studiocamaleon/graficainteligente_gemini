# Solución: Error de Aumento Masivo en Materiales Rígidos

## Problema

Al intentar aplicar un aumento masivo de precios en Materiales Rígidos, aparece el error:

```
No existe una combinación de material-variante-espesor válida para este precio.
Producto: [ID], Material: [ID], Variante: [nombre], Espesor: [valor]mm
```

## Causa

Este error ocurre cuando existen **precios huérfanos**: registros de precios que no tienen su correspondiente entrada en la tabla de materiales. Esto puede suceder si:

- Se eliminaron materiales después de configurar precios
- Se eliminaron variantes después de configurar precios
- Se modificaron espesores sin actualizar los precios
- Hubo errores en la importación de datos

## Solución Implementada

Se crearon 3 funciones SQL para diagnosticar y corregir este problema:

### 1. `fn_diagnosticar_precios_huerfanos_mr()`
Identifica todos los precios sin configuración válida.

### 2. `fn_recrear_combinaciones_faltantes_mr()` (RECOMENDADO)
Crea las combinaciones faltantes en la tabla de materiales para que los precios vuelvan a ser válidos.

### 3. `fn_eliminar_precios_huerfanos_mr()`
Elimina los precios huérfanos (usar solo si es necesario).

## Cómo Corregir el Error

### Opción A: Usar el Script Automatizado (Más Fácil)

1. Abre una terminal en la raíz del proyecto
2. Ejecuta:
   ```bash
   npx tsx scripts/fix-materiales-rigidos-huerfanos.ts
   ```
3. Sigue las instrucciones en pantalla
4. Selecciona la opción 1 (Recrear combinaciones faltantes)

### Opción B: Ejecutar Manualmente desde la Consola SQL

1. Ve a tu proyecto de Supabase
2. Abre el **SQL Editor**
3. Para ver los precios huérfanos:
   ```sql
   SELECT * FROM fn_diagnosticar_precios_huerfanos_mr();
   ```
4. Para corregir (recomendado):
   ```sql
   SELECT * FROM fn_recrear_combinaciones_faltantes_mr();
   ```
5. O para eliminar (solo si es necesario):
   ```sql
   SELECT * FROM fn_eliminar_precios_huerfanos_mr();
   ```

### Opción C: Esperar al Mensaje Mejorado en la UI

La próxima vez que intentes aplicar un aumento masivo y aparezca el error, verás un mensaje más claro:

```
Se encontraron X precios sin configuración válida de material.
Esto puede ocurrir si se eliminaron materiales o variantes después de configurar precios.
Por favor, contacta al administrador del sistema para corregir estos datos.
```

En ese momento, usa la Opción A o B para corregir.

## Prevención Futura

La función mejorada `fn_aumentar_precios_materiales_rigidos()` ahora:

1. **Valida antes de actualizar**: Verifica si hay precios huérfanos antes de aplicar el aumento
2. **Error claro**: Si encuentra problemas, muestra un mensaje específico con instrucciones
3. **Protección de datos**: No permite actualizaciones si hay inconsistencias

## ¿Qué Opción Elegir?

### ✅ Recrear Combinaciones (RECOMENDADO)
- **Ventaja**: No pierdes datos de precios
- **Ventaja**: Mantiene el historial completo
- **Usar cuando**: Los precios son válidos y solo falta la configuración de material

### ⚠️ Eliminar Precios Huérfanos
- **Desventaja**: Pierdes datos de precios
- **Usar cuando**: Los precios son erróneos o duplicados
- **Precaución**: Esta acción NO se puede deshacer

## Verificación

Después de ejecutar la corrección:

1. Vuelve a intentar el aumento masivo
2. Debería funcionar sin errores
3. Verifica que los precios se actualizaron correctamente

## Soporte Técnico

Si sigues teniendo problemas después de ejecutar la corrección:

1. Ejecuta el diagnóstico nuevamente para ver si quedan precios huérfanos
2. Revisa los logs de la consola para ver detalles del error
3. Verifica que tu usuario tiene permisos para ejecutar estas funciones

## Funciones Disponibles en el Frontend

El hook `useAumentoMasivoPreciosProductos` ahora incluye:

```typescript
const {
  diagnosticarPreciosHuerfanos,    // Ver precios problemáticos
  recrearCombinacionesFaltantes,   // Corregir automáticamente
  eliminarPreciosHuerfanos,        // Eliminar si es necesario
} = useAumentoMasivoPreciosProductos();
```

Estos métodos están disponibles si quieres crear una UI personalizada para la corrección.

## Resumen

✅ **Problema identificado**: Precios sin configuración válida de material
✅ **Funciones creadas**: Diagnóstico y corrección automática
✅ **Validación agregada**: Previene futuros problemas
✅ **Script incluido**: Corrección fácil desde terminal
✅ **Mensaje mejorado**: Error más claro para el usuario

Ahora puedes aplicar aumentos masivos en Materiales Rígidos sin problemas.
