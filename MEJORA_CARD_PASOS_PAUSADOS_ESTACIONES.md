# Mejora: Información de Pausa en Cards de Estaciones

## Problema Identificado

Las cards de pasos pausados en la vista de Estaciones no mostraban:
1. El tiempo correcto de la pausa activa (mostraban desde `fecha_inicio` del paso en lugar de `fecha_inicio_pausa`)
2. El motivo por el cual el paso está pausado

Esto obligaba a los operadores a entrar al detalle de cada paso para conocer el motivo de la pausa.

## Solución Implementada

### 1. Hook useProductionStations

**Cambios realizados:**

- ✅ **Interfaz StationStep actualizada**: Agregado campo opcional `pausa_activa` con:
  - `motivo_nombre`: Nombre del motivo de pausa
  - `categoria_motivo`: Categoría del motivo (cliente, materiales, maquinaria, etc.)
  - `fecha_inicio_pausa`: Timestamp exacto de cuándo se pausó

- ✅ **Query de pausas activas**: Después de obtener las rutas, se hace un query adicional para obtener información de pausas activas:
  ```typescript
  // Solo para rutas con estado 'pausado'
  SELECT
    ruta_id,
    categoria_motivo,
    fecha_inicio_pausa,
    motivo:pasos_motivos_pausa(nombre)
  FROM ordenes_items_rutas_pausas
  WHERE fecha_fin_pausa IS NULL
  ```

- ✅ **Mapa de pausas**: Se crea un mapa para vincular cada ruta pausada con su información de pausa activa

**Flujo de datos:**
```
1. Query rutas activas (pendiente, en_proceso, pausado)
2. Filtrar IDs de rutas pausadas
3. Query pausas activas para esos IDs
4. Crear mapa: ruta_id → info_pausa
5. Agregar pausa_activa a cada StationStep pausado
```

### 2. StationStepCard Component

**Cambios realizados:**

- ✅ **Prop pausa_activa**: Acepta información opcional de pausa activa
- ✅ **Sección de motivo**: Nueva sección visual que muestra el motivo cuando está pausado
- ✅ **Tiempo correcto**: Usa `pausa_activa.fecha_inicio_pausa` en lugar de `fecha_inicio`

**Visualización mejorada:**

```
┌─────────────────────────────────────────┐
│ GI-000008   ⏸️ PAUSADO                  │
│                                         │
│ 👤 Lucas                                │
│ 📦 Tarjetas Personales - 100 unidades  │
│ 📄 Diseño gráfico Basico               │
│ ─────────────────────────────────────── │
│ ⏸️ Motivo: Esperando aprobación        │
│                                         │
│ ⏸️ Pausado desde 8m      [Ver Detalles]│
└─────────────────────────────────────────┘
```

## Detalles Técnicos

### Estructura de Pausa Activa

```typescript
interface PausaActiva {
  motivo_nombre: string;        // Ej: "Esperando aprobación del cliente"
  categoria_motivo: string;     // Ej: "cliente", "materiales", "maquinaria"
  fecha_inicio_pausa: string;   // Timestamp ISO cuando se pausó
}
```

### Categorías de Motivos

Las pausas están categorizadas en:
- `cliente`: Esperando respuesta/aprobación del cliente
- `materiales`: Falta de materiales o insumos
- `maquinaria`: Problema con equipo o maquinaria
- `personal`: Falta de personal o capacitación
- `externo`: Factores externos (clima, proveedores, etc.)
- `otro`: Otros motivos no categorizados

### Query de Pausas Activas

**Condiciones:**
- Solo pausas con `fecha_fin_pausa IS NULL` (pausas activas)
- Join con `pasos_motivos_pausa` para obtener el nombre del motivo
- Filtrado por `ruta_id` de rutas pausadas

**Rendimiento:**
- Query ejecutado solo si hay rutas pausadas
- Usa índices en `ruta_id` y `fecha_fin_pausa`
- Mapa en memoria para lookup O(1)

### Cálculo de Tiempo

**Antes:**
```typescript
// Incorrecto - mostraba tiempo desde que inició el paso
calcularTiempoTranscurrido(fecha_inicio)
```

**Después:**
```typescript
// Correcto - muestra tiempo desde que se pausó
calcularTiempoTranscurrido(pausa_activa.fecha_inicio_pausa)
```

**Ejemplo:**
- Paso inició: 10:00 AM
- Trabajó hasta: 10:30 AM (30 minutos)
- Se pausó: 10:30 AM
- Hora actual: 11:00 AM

**Resultado correcto:** "Pausado desde 30m" (desde 10:30)
**Resultado incorrecto anterior:** "Pausado desde 1h" (desde 10:00)

## Visualización por Categoría de Motivo

Las cards mantienen el mismo estilo visual (rojo) independientemente de la categoría, pero el motivo se muestra claramente para que el operador sepa qué acción tomar:

### Ejemplo 1: Cliente
```
⏸️ Motivo: Esperando aprobación del cliente
→ Acción: Esperar respuesta, no se puede continuar
```

### Ejemplo 2: Materiales
```
⏸️ Motivo: Falta de papel fotográfico
→ Acción: Verificar llegada de materiales
```

### Ejemplo 3: Maquinaria
```
⏸️ Motivo: Impresora en mantenimiento
→ Acción: Esperar reparación del equipo
```

## Beneficios para Operadores

### 1. Información Inmediata
- **Antes**: Tenían que hacer click en "Ver Detalles" para saber por qué está pausado
- **Después**: Ven el motivo directamente en la card

### 2. Tiempo Preciso
- **Antes**: Tiempo desde que inició el paso (incluía tiempo trabajado)
- **Después**: Tiempo exacto desde que se pausó

### 3. Toma de Decisiones
- Pueden priorizar qué pausas atender primero
- Saben si pueden hacer algo o deben esperar
- Identifican bloqueos rápidamente

### 4. Comunicación Mejorada
- Motivo claro para informar a supervisores
- Pueden gestionar expectativas con clientes
- Facilita coordinación entre áreas

## Testing

### Paso 1: Pausar un Paso

1. Ir a **Producción > Jobs**
2. Seleccionar un trabajo en proceso
3. Click en "Pausar"
4. Seleccionar un motivo (ej: "Esperando aprobación del cliente")
5. Agregar descripción opcional
6. Confirmar pausa

### Paso 2: Verificar en Vista de Estaciones

1. Ir a **Producción > Estaciones**
2. Seleccionar la estación donde está el paso pausado
3. En la columna "Pausados", verificar la card muestra:
   - Badge "⏸️ PAUSADO" en rojo
   - Sección con ícono y texto: "⏸️ Motivo: [nombre del motivo]"
   - Tiempo correcto: "Pausado desde X" (debe coincidir con el tiempo desde la pausa, no desde el inicio del paso)

### Paso 3: Comparar Tiempos

**Escenario de prueba:**
1. Iniciar un paso a las 10:00 AM
2. Trabajar 30 minutos
3. Pausar a las 10:30 AM
4. Esperar 15 minutos
5. Verificar a las 10:45 AM

**Resultado esperado:**
- Tiempo en card: "Pausado desde 15m" ✅
- NO debe mostrar: "Pausado desde 45m" ❌

### Paso 4: Múltiples Pausas

Si un paso ha sido pausado y reanudado varias veces:
1. La card muestra la **pausa activa actual**
2. El tiempo es desde el **último inicio de pausa**
3. Las pausas anteriores se ven en el historial (modal de detalle)

### Paso 5: Diferentes Motivos

Probar con diferentes categorías de motivos:

**Cliente:**
```
✅ Motivo: Esperando respuesta del cliente
✅ Motivo: Cambios solicitados por cliente
```

**Materiales:**
```
✅ Motivo: Falta de papel
✅ Motivo: Esperando insumos
```

**Maquinaria:**
```
✅ Motivo: Impresora en reparación
✅ Motivo: Calibración de equipo
```

## Casos Edge

### Sin Pausa Activa (No debería ocurrir)
Si un paso tiene estado 'pausado' pero no hay pausa activa en BD:
- No se muestra sección de motivo
- Usa `fecha_inicio` como fallback para el tiempo
- Se puede detectar y corregir en base de datos

### Pausa sin Motivo Configurado
Si el motivo fue eliminado de la tabla de configuración:
- Muestra: "Motivo: Sin motivo"
- El paso sigue siendo pausado normalmente
- Se recomienda siempre mantener motivos activos

### Múltiples Pausas Activas (No debería ocurrir)
Si hay un error en BD y hay múltiples pausas sin `fecha_fin_pausa`:
- El query usa la primera que encuentra
- Se debe corregir en base de datos (solo debe haber una activa)

## Integración con Sistema Existente

Esta mejora se integra con:

1. **Sistema de Pausas**: Lee de las tablas existentes
   - `ordenes_items_rutas_pausas`
   - `pasos_motivos_pausa`

2. **Modal de Ejecución**: Al hacer click en "Ver Detalles"
   - Muestra todos los detalles de la pausa
   - Permite reanudar el paso
   - Muestra historial completo de pausas

3. **Realtime**: Actualización automática
   - Cuando se pausa un paso, aparece inmediatamente
   - Cuando se reanuda, desaparece de la columna
   - El motivo se actualiza en tiempo real

## Archivos Modificados

### Hook
- ✅ `src/hooks/useProductionStations.ts`
  - Agregado query de pausas activas
  - Actualizada interfaz `StationStep`
  - Agregado mapa de pausas

### Componente
- ✅ `src/components/production/StationStepCard.tsx`
  - Agregada prop `pausa_activa`
  - Agregada sección visual de motivo
  - Actualizado cálculo de tiempo para pausados

### Build
- ✅ Proyecto compila sin errores

## Notas de Implementación

### Performance
- Query de pausas solo se ejecuta si hay rutas pausadas
- Usa índices en `ruta_id` y `fecha_fin_pausa`
- Mapa en memoria para vincular datos (O(1) lookup)

### Mantenibilidad
- Estructura clara y tipada
- Separación de responsabilidades (hook vs componente)
- Código reutilizable para otros contextos

### Escalabilidad
- Funciona con cualquier número de pausas
- No afecta performance de rutas no pausadas
- Query optimizado con filtros apropiados

---

**Fecha de implementación:** 2025-11-29
**Estado:** ✅ Completado y testeado
**Build:** ✅ Exitoso
**Versión:** 2.0 (Cards con información completa de pausa)
