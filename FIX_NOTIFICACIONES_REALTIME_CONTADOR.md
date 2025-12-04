# Fix: Actualización en Tiempo Real del Contador de Notificaciones

## Problema Resuelto
El contador de notificaciones no se actualizaba en tiempo real cuando se creaba una nueva notificación. El usuario tenía que hacer clic en el icono de la campanita para ver las notificaciones nuevas.

## Cambios Implementados

### 1. Optimización del Hook `useNotificaciones`

#### Cambios principales:
- **Eliminación de dependencias problemáticas**: Se removió `cargarNotificaciones` de las dependencias del useEffect para evitar re-suscripciones innecesarias que podían desconectar el canal Realtime.

- **Filtrado en el servidor**: Se agregó el parámetro `filter` en la suscripción de Realtime:
  ```typescript
  filter: `usuario_id=eq.${currentUserId}`
  ```
  Esto hace que Supabase solo envíe eventos de notificaciones para el usuario actual, mejorando la eficiencia.

- **Canal único por usuario**: El canal ahora se crea con un nombre único por usuario:
  ```typescript
  const channelName = `notificaciones-internas-${currentUserId}`;
  ```
  Esto evita conflictos si el mismo usuario tiene múltiples tabs abiertos.

- **Prevención de duplicados**: Se agregó validación para evitar agregar la misma notificación múltiples veces:
  ```typescript
  if (prev.some(n => n.id === nuevaNotif.id)) {
    console.log('[Notificaciones] ⚠️ Notificación duplicada, ignorando');
    return prev;
  }
  ```

- **Mejor manejo de estados de conexión**: Se implementó logging detallado para los estados:
  - `SUBSCRIBED`: Canal conectado exitosamente
  - `CLOSED`: Canal cerrado
  - `CHANNEL_ERROR`: Error en el canal

- **Bandera isMounted**: Se agregó para evitar actualizaciones de estado en componentes desmontados:
  ```typescript
  let isMounted = true;
  // ...
  if (!isMounted) return;
  ```

- **Logging mejorado**: Se agregaron logs con emojis para facilitar el debugging:
  - 🔌 Configuración de conexión
  - 📨 Nuevas notificaciones recibidas
  - 🔄 Actualizaciones de notificaciones
  - ✅ Operaciones exitosas
  - ❌ Errores
  - 🔢 Recálculo del contador

### 2. Mejora Visual del Badge de Notificaciones

Se reemplazó el punto rojo simple por un badge con número:

**Antes:**
```tsx
<span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
```

**Después:**
```tsx
<motion.span
  key={noLeidas}
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
>
  {noLeidas > 9 ? '9+' : noLeidas}
</motion.span>
```

**Beneficios:**
- Muestra el número exacto de notificaciones no leídas
- Animación suave al aparecer/cambiar
- Muestra "9+" si hay más de 9 notificaciones
- Mejor feedback visual para el usuario

## Cómo Probar

### 1. Verificar Conexión Realtime

1. Abre la aplicación y inicia sesión
2. Abre las herramientas de desarrollo (F12)
3. Busca en la consola los siguientes mensajes:
   ```
   [Notificaciones] Cargando notificaciones iniciales...
   [Notificaciones] ✅ Cargadas X notificaciones
   [Notificaciones] 🔌 Configurando suscripción realtime para usuario: [uuid]
   [Notificaciones] 📡 Estado de suscripción: SUBSCRIBED
   [Notificaciones] ✅ Canal realtime conectado exitosamente
   ```

### 2. Probar Notificación de Nuevo Cliente

1. **Usuario A (admin)**: Mantén la sesión abierta en el dashboard
2. **Usuario B (cliente)**: En otra ventana/navegador incógnito, registra un nuevo cliente en:
   ```
   https://tu-dominio.com/registro-cliente
   ```
3. **Verifica en Usuario A**:
   - El contador debe actualizarse automáticamente SIN hacer clic
   - Debe aparecer el badge con el número "1"
   - En la consola debe aparecer:
     ```
     [Notificaciones] 📨 Evento INSERT recibido: ...
     [Notificaciones] ✅ Agregando notificación al estado: Nuevo Cliente Registrado
     [Notificaciones] 🔢 Recalculando contador: { total: X, noLeidas: 1 }
     ```

### 3. Probar Notificación de Presupuesto Aprobado

1. **Usuario A (vendedor/admin)**: Mantén la sesión abierta
2. **Cliente**: Abre un presupuesto mediante el link de tracking y apruébalo
3. **Verifica en Usuario A**:
   - El contador debe incrementarse automáticamente
   - Si ya había 1 notificación, ahora debe mostrar "2"
   - El badge debe animarse al cambiar

### 4. Probar Marcar como Leída

1. Haz clic en el icono de la campanita para abrir el panel
2. Haz clic en una notificación
3. **Verifica**:
   - El contador debe decrementarse automáticamente
   - Si era "2", ahora debe ser "1"
   - En la consola:
     ```
     [Notificaciones] 🔢 Recalculando contador: { total: X, noLeidas: 1 }
     ```

### 5. Probar Marcar Todas como Leídas

1. Con varias notificaciones no leídas, abre el panel
2. Haz clic en "Marcar todas"
3. **Verifica**:
   - El badge debe desaparecer completamente
   - El contador debe ser 0
   - En la consola:
     ```
     [Notificaciones] 🔢 Recalculando contador: { total: X, noLeidas: 0 }
     ```

## Debugging

Si el contador no se actualiza en tiempo real, verifica:

### 1. Estado de Conexión Realtime
Busca en la consola:
```
[Notificaciones] 📡 Estado de suscripción: SUBSCRIBED
[Notificaciones] ✅ Canal realtime conectado exitosamente
```

Si ves `CLOSED` o `CHANNEL_ERROR`, hay un problema de conexión.

### 2. Políticas RLS
Verifica que la política de SELECT en `notificaciones_internas` permita ver las notificaciones:
```sql
SELECT * FROM notificaciones_internas WHERE usuario_id = auth.uid();
```

### 3. REPLICA IDENTITY
Verifica que la tabla tenga REPLICA IDENTITY FULL:
```sql
SELECT relname, relreplident
FROM pg_class
WHERE relname = 'notificaciones_internas';
```
Debe mostrar `relreplident = 'f'` (full).

### 4. Publicación Realtime
Verifica que la tabla esté en la publicación:
```sql
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'notificaciones_internas';
```

## Archivos Modificados

1. `src/hooks/useNotificaciones.ts`
   - Optimización del useEffect
   - Mejor manejo de estados
   - Logging mejorado
   - Prevención de duplicados

2. `src/layouts/MainLayout.tsx`
   - Badge mejorado con número
   - Animación con framer-motion

## Beneficios

1. **Tiempo Real Confiable**: El contador se actualiza instantáneamente sin intervención del usuario
2. **Mejor UX**: Los usuarios ven inmediatamente cuando hay nuevas notificaciones
3. **Mayor Visibilidad**: El badge con número es más informativo que un simple punto
4. **Debugging Facilitado**: Logs detallados permiten identificar problemas rápidamente
5. **Rendimiento Optimizado**: Filtrado en el servidor reduce tráfico innecesario
6. **Prevención de Bugs**: Validaciones evitan duplicados y errores de estado

## Notas Técnicas

- El canal Realtime se crea una sola vez al montar el componente
- El filtrado por `usuario_id` se hace en el servidor (Supabase), no en el cliente
- Las políticas RLS de la tabla son las que controlan qué eventos llegan al cliente
- El contador se recalcula automáticamente cada vez que cambia el array de notificaciones
- Las notificaciones del navegador (browser notifications) requieren permiso explícito del usuario

## Siguiente Pasos Opcionales

1. **Sonido de Notificación**: Agregar un sonido sutil cuando llega una notificación nueva
2. **Notificaciones de Escritorio**: Mejorar las notificaciones del navegador con más información
3. **Polling de Respaldo**: Implementar polling cada 30s como fallback si Realtime falla
4. **Indicador de Conexión**: Agregar un pequeño indicador en el panel que muestre el estado de la conexión Realtime
5. **Vibración en Móvil**: Usar la API de vibración en dispositivos móviles cuando llega una notificación

---

**Fecha de Implementación**: 2025-12-04
**Estado**: ✅ Completado y probado
