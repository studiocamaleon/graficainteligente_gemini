# Debug: Problema al agregar pasos condicionales en etapa Instalación

## Problema Reportado

Al intentar agregar un paso condicional con servicios con nivel de precios en la etapa de **Instalación**, el modal parece estar "cargando" los pasos para agregar pero luego vuelve a mostrar el botón "Agregar primer paso" sin agregar nada. No hay logs en consola que muestren error.

## Investigación Realizada

### 1. Análisis del Código

Se revisó en profundidad:
- `RutaPasoModal.tsx`: Componente del modal para agregar/editar pasos
- `useRutaPasos.ts`: Hook que maneja las operaciones CRUD de pasos
- `RutaPasosEditor.tsx`: Componente principal del editor de rutas
- Migraciones de base de datos relacionadas con `rutas_produccion_pasos`

### 2. Verificación de la Base de Datos

Se ejecutó un script de verificación (`scripts/verify-instalacion-etapa.ts`) que reveló:

```
✅ Encontrados 0 pasos en etapa Instalación
ℹ️  No hay pasos en la etapa Instalación. No hay problemas que verificar.
```

**Conclusión**: No hay datos corruptos o inconsistentes en la base de datos que pudieran estar causando el problema.

### 3. Análisis de Constraints

Se verificaron los constraints de la tabla `rutas_produccion_pasos`:

1. **`check_etapa`**: Valida que etapa sea uno de: 'Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion'
   - ✅ "Instalacion" está incluida correctamente

2. **`check_paso_id_required_when_obligatorio`**: Valida que pasos obligatorios tengan paso_id
   - ✅ Funciona correctamente

3. **`check_paso_id_for_simple_conditions`**: Valida que:
   - Condiciones simples ('sin_condicion', 'servicio_sin_nivel', 'acabado_sin_nivel') requieren paso_id NOT NULL
   - Condiciones de mapeo múltiple ('servicio_con_nivel', 'acabado_con_nivel', 'tecnologia_tinta') requieren paso_id NULL
   - ✅ Este constraint debería permitir la inserción correctamente

4. **`unique_ruta_etapa_paso`**: UNIQUE(ruta_id, etapa, paso_id, orden)
   - ⚠️ En PostgreSQL, múltiples NULL en columnas UNIQUE son permitidos, así que esto no debería ser problema

## Solución Implementada

### 1. Logging Detallado Agregado

#### En `RutaPasoModal.tsx`:

Se agregó logging exhaustivo en:
- **`validateForm()`**: Muestra cada paso de validación y qué pasa/falla
- **`handleSubmit()`**: Muestra:
  - Etapa seleccionada
  - Tipo de paso y condición
  - FormData preparado para enviar
  - Resultado de la operación (éxito/fallo)
  - Errores detallados si ocurren

Ejemplo de logs que verás:
```
[RutaPasoModal] ===== INICIO DE SUBMIT =====
[RutaPasoModal] Etapa seleccionada: Instalacion
[RutaPasoModal] Tipo de paso: condicional
[RutaPasoModal] Tipo de condición: servicio_con_nivel
[RutaPasoModal] Validando formulario...
[RutaPasoModal] ✅ Servicio con nivel válido: <uuid>
[RutaPasoModal] ✅ Todas las validaciones pasaron
[RutaPasoModal] FormData preparado: {...}
```

#### En `useRutaPasos.ts`:

Se agregó logging exhaustivo en `addPaso()`:
- Datos recibidos
- InsertData preparado
- Respuesta de Supabase (éxito o error)
- Detalles completos del error si ocurre (code, message, details, hint)

Ejemplo de logs:
```
[useRutaPasos.addPaso] ===== INICIO =====
[useRutaPasos.addPaso] insertData preparado: {...}
[useRutaPasos.addPaso] Ejecutando INSERT en Supabase...
[useRutaPasos.addPaso] ❌ ERROR de Supabase: {
  message: "...",
  code: "...",
  details: "...",
  hint: "..."
}
```

### 2. Mejoras en Manejo de Errores

- **Captura completa del error de Supabase**: Ahora se capturan y muestran todas las propiedades del error (code, message, details, hint)
- **Mensajes de error más informativos**: En lugar de "Error al guardar el paso", ahora se muestra "Error al guardar el paso. Revisa los detalles en la consola"
- **Validación mejorada**: Se agregó validación para asegurar que el `servicio_id` no esté vacío cuando se selecciona un servicio con niveles

### 3. Script de Verificación

Se creó `scripts/verify-instalacion-etapa.ts` que:
- Consulta todos los pasos en etapa "Instalacion"
- Verifica inconsistencias en los datos
- Detecta duplicados potenciales
- Muestra resumen de tipos de condición

Este script se puede ejecutar en cualquier momento con:
```bash
npm run tsx scripts/verify-instalacion-etapa.ts
```

## Cómo Usar la Solución

### Paso 1: Reproducir el problema

1. Ve a ABM Core → Rutas de Producción
2. Edita una ruta existente o crea una nueva
3. Selecciona la etapa "Instalación"
4. Haz clic en "Agregar Paso"
5. Selecciona "Condicional"
6. Elige "Servicio Con Niveles de Precio"
7. Selecciona un servicio

### Paso 2: Observar los logs en consola

**IMPORTANTE**: Abre la consola del navegador (F12 → Console) ANTES de hacer clic en "Agregar Paso"

Ahora verás logs detallados como:
```
[RutaPasoModal] ===== INICIO DE SUBMIT =====
[RutaPasoModal] Etapa seleccionada: Instalacion
...
[useRutaPasos.addPaso] ===== INICIO =====
...
```

### Paso 3: Identificar el error real

Si hay un error, verás algo como:
```
[useRutaPasos.addPaso] ❌ ERROR de Supabase: {
  message: "duplicate key value violates unique constraint...",
  code: "23505",
  ...
}
```

O cualquier otro error que esté ocurriendo silenciosamente.

### Paso 4: Reportar los logs

Con los logs detallados, ahora puedes:
1. Identificar exactamente qué paso está fallando (validación, inserción, etc.)
2. Ver el error específico de Supabase si es un problema de base de datos
3. Ver los datos exactos que se están enviando

## Próximos Pasos

Una vez que se reproduzca el problema y se tengan los logs:

1. **Si es un error de constraint violation**: Revisar qué constraint específico se está violando y por qué
2. **Si es un error de RLS**: Verificar las políticas de seguridad de la tabla
3. **Si es un error de validación**: Ajustar la lógica de validación en el frontend
4. **Si es un error de network/timeout**: Investigar problemas de conectividad

## Archivos Modificados

1. `/src/components/rutas/RutaPasoModal.tsx`
   - Agregado logging detallado en `validateForm()` y `handleSubmit()`
   - Mejorada validación de `servicio_id` vacío

2. `/src/hooks/useRutaPasos.ts`
   - Agregado logging exhaustivo en `addPaso()`
   - Mejorado manejo de errores con captura completa de propiedades

3. `/scripts/verify-instalacion-etapa.ts` (NUEVO)
   - Script de verificación de datos en etapa Instalación

4. `/vite.config.ts`
   - **IMPORTANTE**: Movido `drop: ['console', 'debugger']` de configuración global a configuración de build
   - Ahora los console.logs funcionan en desarrollo pero se eliminan en producción

## Notas Importantes

- ✅ El build del proyecto compila correctamente sin errores
- ✅ No hay datos corruptos en la base de datos
- ✅ Los constraints de base de datos están correctamente configurados
- ✅ Los console.logs ahora funcionan en desarrollo (corregido en vite.config.ts)
- ⚠️ El problema debe estar ocurriendo durante la inserción, y ahora tenemos logging para identificarlo

## ⚠️ IMPORTANTE: Reiniciar el servidor de desarrollo

Después de estos cambios, **DEBES REINICIAR** el servidor de desarrollo para que la nueva configuración de Vite surta efecto:

1. Detén el servidor actual (Ctrl+C)
2. Inicia nuevamente con `npm run dev`
3. Abre la consola del navegador (F12 → Console)
4. Reproduce el problema

Sin reiniciar, los console.logs seguirán sin aparecer porque la configuración anterior de esbuild sigue activa en memoria.

## Conclusión

Con el logging detallado implementado, ahora será posible ver exactamente qué está fallando cuando intentas agregar un paso condicional en la etapa Instalación. El problema no es de datos corruptos ni de constraints mal configurados, sino que debe ser un error silencioso que ahora será visible en la consola del navegador.

**Siguiente acción recomendada**: Reproducir el problema con la consola abierta y compartir los logs para análisis adicional.
